$(document).ready(function() {

    // reference:
    // http://learn.jquery.com/plugins/basic-plugin-creation/

    // TBD
    // more styles
    // auto_hide
    // hold key down on arrows continually update scrollbar
    // disabled not implemented
    // theme not implemented
    
    (function ($) {

        var mjScrollBar = {

            _init: function (options, el) {

                this.widget_class = "mjScrollBar";

                // variables for managing state

                this.state = {
                    range: 0,
                    prev_pos: 0,
                    thumb_size: 0,
                    track_element: null,
                    maxscroll: 0,
                    //viewport_size: 0,
                    //content_size: 0,
                    scrolling: 0,
                    mousestart: 0,
                    start_pos: 0,
                    has_touch_events: false,
                }

                // NOTE: if you change the contents or size of the text widget you need to recreate the scrollbar

                this.el = el;
                this.$el = $(el);

                this._validateData(options);

                // plugin have been applied previously
                // blow away any existing instance

                this.close();

                this._render();
                this._startListening();

                return this;
            },

            _validateData: function(options)
            {
                var default_options = {
                    orientation: "vertical",
                    min: 0,
                    max: 1000,                  // should be the number of items we are going to scroll
                    value: 0,
                    step_size: 1,               // when user clicks on arrow how to move by
                    show_buttons: true,         // show the arrow buttons
                    //style: "normal",            // normal, thin, square
                    integer_values: true,       // if false valueChanged callback can return floating point numbers
                    page_size: null,            // if  you want the size of the thumb to change depending on the number of items we are scrolling set page_size
                                                // since you probably only want to create a mjScrollBar for a virtual grid you should know the page_size
                    width: mjcore.MJ_VERTICAL_SCROLLBAR_WIDTH,                  // the width of a vertical scrollbar
                    height: mjcore.MJ_HORIZONTAL_SCROLLBAR_HEIGHT,                 // the height of a horizontal scrollbar

                    disabled: false,
                    theme: null
                };

                this.settings = $.extend({}, default_options, options);

                var s = this.settings;
                var t = this.state;

                s.orientation = mjcore.validateString(s.orientation, ["vertical", "horizontal"], "vertical");
                s.min = mjcore.validateFloat(s.min, 0);
                s.max = mjcore.validateFloat(s.max, 1000);
                s.value = mjcore.validateFloat(s.value, s.min);

                // cant handle max < min yet

                if (s.min > s.max)
                {
                    var tmp = s.min;
                    s.min = s.max;
                    s.max = tmp;
                }

                if (s.value < s.min)
                    s.value = s.min;

                if (s.value > s.max)
                    s.value = s.max;
                
                s.step_size = mjcore.validateFloat(s.step_size, 1);
                s.show_buttons = mjcore.validateBool(s.show_buttons, true);
                //s.style = mjcore.validateString(s.style, ["normal", "thin", "square"], "normal");
                s.integer_values = mjcore.validateBool(s.integer_values, true);
                s.page_size = mjcore.validateInt(s.page_size, null, null);

                // common properties

                s.disabled = mjcore.validateBool(s.disabled, false);

                t.range = s.max - s.min;

                if (s.page_size > t.range)
                    s.page_size = t.range;

                if (s.step_size > t.range)
                    s.step_size = t.range; 

                //var MAX_INT = 4294967295;
                var MAX_INT = 9007199254740992;

                // ES6 introduces Number.MIN_SAFE_INTEGER, not supported in IE and safari

                t.prev_pos = MAX_INT;

                s.width = mjcore.validateInt(s.width, null, default_options.width);
                s.height = mjcore.validateInt(s.height, null, default_options.height);
            },

            _calcThumbSize: function()
            {
                var s = this.settings;
                var t = this.state;

                var r;  // 0..1
                
                // should be number of items in viewport / number of items
                // but we dont know what that is

                r = 0.1;
                    
                if (s.page_size && s.range > t.page_size)
                    r = s.page_size / t.range;

                if (s.orientation == "vertical")
                    t.thumb_size = t.track_element.height() * r;
                else
                    t.thumb_size = t.track_element.width() * r;

                var MIN_THUMB_SIZE = 5;

                if (t.thumb_size < MIN_THUMB_SIZE)
                    t.thumb_size = MIN_THUMB_SIZE;

                if (s.orientation == "vertical") {
                    if (t.track_element.height() - t.thumb_size <= 0) {
                        // thumb is bigger than the track!!!

                        t.thumb_size = 0;
                        t.thumb_element.hide();
                    }
                    else
                        t.thumb_element.show();
                }
                else
                {
                    if (t.track_element.width() - t.thumb_size <= 0) {
                        // thumb is bigger than the track!!!

                        t.thumb_size = 0;
                        t.thumb_element.hide();
                    }
                    else
                        t.thumb_element.show();
                }
            },

            _calcMaxScroll: function()
            {
                var s = this.settings;
                var t = this.state;

                // call this when we start the drag

                this._calcThumbSize();

                // recalculate size of scrollbar track just in case scrollbar has been resized

                if (t.thumb_size == 0) {

                    // if thumb is not visible just remove max val

                    t.maxscroll = s.max;
                }
                else {
                    if (s.orientation == "vertical") {
                        t.maxscroll = t.track_element.height() - t.thumb_size;    // subtract size of thumb
                        t.thumb_element.height(t.thumb_size);
                    }
                    else {
                        t.maxscroll = t.track_element.width() - t.thumb_size;    // subtract size of thumb
                        t.thumb_element.width(t.thumb_size);
                    }
                }
            },

            _render: function()
            {
                var s = this.settings;
                var t = this.state;

                var orientation = "mj-vertical";

                if (s.orientation == "horizontal")
                    orientation = "mj-horizontal";

                var c = "<div class='mj-widget mj-scrollbar " + orientation + "'>";
               
                // slider

                c += "<div class='mj-scrollbar-slider'>";

                if (s.show_buttons)
                {
                    if (s.orientation == "vertical")
                        c += "  <div class='mj-arrow mj-arrow-up'></div>";
                    else
                        c += "  <div class='mj-arrow mj-arrow-left'></div>"; 
                }
                        
                c += " <div class='mj-scrollbar-track'>";                   // track
                c += "  <div class='mj-scrollbar-thumb'></div>";            // thumb
                c += " </div>";

                if (s.show_buttons)
                {
                    if (s.orientation == "vertical")
                        c += "  <div class='mj-arrow mj-arrow-down'></div>";
                    else
                        c += "  <div class='mj-arrow mj-arrow-right'></div>";
                }
                        
                c += "</div>";      // end slider
                c += "</div>";      // end widget

                this.$el.html(c);

                this._applyCSS();

                // if no buttons track take up total area of slider

                if (!s.show_buttons)
                {
                    if (s.orientation == "vertical")
                        this.$el.find(".mj-scrollbar-track").css({ top: 0, bottom: 0 });
                    else
                        this.$el.find(".mj-scrollbar-track").css({ left: 0, right: 0 });
                }                        

                t.thumb_element = this.$el.find(".mj-scrollbar-thumb");
                t.track_element = this.$el.find(".mj-scrollbar-track");

                this.set(s.value);
            },

            _stopListening: function () {
                this.$el.off();
            },

            _startListening: function()
            {
                var self = this;

                var s = this.settings;
                var t = this.state;

                this.scrolling = false;
                this.mousestart = 0;
                this.maxscroll = 0;
                this.start_pos = 0;
	
                this.has_touch_events = ("ontouchstart" in document.documentElement);

                this.$el.on("mousedown", ".mj-scrollbar-thumb", function (e) {

                    // start drag

                    e.preventDefault();
                    e.stopPropagation();        // we dont want to trigger a track click

                    self._dragstart(e);

                    //self.t = setInterval(function () {self.draw(); }, 50);
		
                    $(document).bind("mousemove", self, self._drag);
                    $(document).bind("mouseup", self, self._dragend);
                });

                this.$el.on("mousedown", ".mj-scrollbar-track", function (e) {

                    e.preventDefault();

                    var t = self.state;

                    var page_size = t.range * 0.1;

                    if (s.page_size)
                        page_size = s.page_size;

                    var thumb_offset = t.thumb_element.offset();
                    var widget_offset = self.$el.offset();

                    if (s.orientation == "vertical") {

                        var y1 = (thumb_offset.top - widget_offset.top);
                        var y2 = (e.pageY - widget_offset.top);

                        if (y1 < y2)
                            self.set(s.value + page_size, true);
                        else
                            self.set(s.value - page_size, true);
                    }
                    else {

                        var x1 = (thumb_offset.left - widget_offset.left);
                        var x2 = (e.pageX - widget_offset.left);

                        if (x1 < x2)
                            self.set(s.value + page_size, true);
                        else
                            self.set(s.value - page_size, true);
                    }                        
                });

                this.$el.on("click", ".mj-arrow", function (e) {

                    // arrow click

                    e.preventDefault();

                    var val = s.value;

                    if (s.orientation == "vertical") {
                        if ($(e.currentTarget).hasClass("mj-arrow-down"))
                            self.set(val + s.step_size, true);
                        else
                            self.set(val - s.step_size, true);
                    }
                    else
                    {
                        if ($(e.currentTarget).hasClass("mj-arrow-right"))
                            self.set(val + s.step_size, true);
                        else
                            self.set(val - s.step_size, true);
                    }
                });

                $(document).on("mouseleave", function (e) {

                    // if mouse leaves the browser window stop the scroll

                    e.data = self;
                    self._dragend(e);
                    t.scrolling = false;
                });
            },

            _applyCSS: function()
            {
                var self = this;

                var s = this.settings;

                var w = s.width;
                var h = s.height;

                if (s.orientation == "vertical") {
                    this.$el.find(".mj-scrollbar").css({ width: w });
                    this.$el.find(".mj-scrollbar-slider").css({ width: w });
                    this.$el.find(".mj-scrollbar-track").css({ top: w, bottom: (w + 2), width: (w - 2) });

                    this.$el.find(".mj-arrow").css({ width: w, height: (w-2) });
                }
                else {
                    this.$el.find(".mj-scrollbar").css({ height: h });
                    this.$el.find(".mj-scrollbar-slider").css({ height: h });
                    this.$el.find(".mj-scrollbar-track").css({ left: h, right: (h + 2), height: (h - 2) });

                    this.$el.find(".mj-arrow").css({ width: (h - 2), height: h });
                }

                var e = this.$el.find(".mj-scrollbar-thumb");

                e.css({ width: (w - 4), height: (h - 4) });

                // load css based on style param

                //var url = "../css/mjScrollBarThin.css";

                //var jqxhr = $.ajax({
                //    type: "GET",
                //    //dataType: 'css',
                //    url: url,
                //    contentType: "application/text; charset=utf-8",

                //    success: function (data) {

                //        $('<style type="text/css">\n' + data + '</style>').appendTo("head");
                //    },
                //    error: function (jqXHR, textStatus, thrownError) {

                //        mjcore.error("_loadCSS error: " + thrownError);
                //    },
                //    complete: function (jqxhr, status) {

                //        // always runs

                //        jqxhr = null;
                //    }
                //});

                //return jqxhr;
            },

            _dragstart: function(e)
            {
                var s = this.settings;
                var t = this.state;

                t.scrolling = true;                    

                var pos = t.thumb_element.position();

                t.thumb_element.addClass("mj-scrollbar-thumb-drag");

                this._calcMaxScroll();

                // recalculate size of scrollbar track just in case scrollbar has been resized

                if (s.orientation == "vertical") {
                    t.start_pos = pos.top;       // current thumb position
                    t.mousestart = e.pageY;		// save starting position
                }
                else {
                    t.start_pos = pos.left;
                    t.mousestart = e.pageX;		// save starting position
                }

                var val = s.value;

                //if (this.settings.integer_values)
                //    val = parseInt(val, 10)

                this.$el.trigger("scrollStart", val);
            },
            
            _drag: function (e) {

                // preventdefault stops select all

                e.preventDefault();

                var self = e.data;

                var s = self.settings;
                var t = self.state;

                if (!t.scrolling)
                    return;

                var delta = 0

                if (s.orientation == "vertical")
                    delta = e.pageY - t.mousestart;
                else
                    delta = e.pageX - t.mousestart;

                //if (self.settings.orientation == "vertical")
                //    delta = parseInt(e.pageY - self.mousestart, 10);
                //else
                //    delta = parseInt(e.pageX - self.mousestart, 10);

                if (delta == 0)
                    return;

                self._move(t.start_pos + delta, true);
            },

            _dragend: function (e) {

                e.preventDefault();

                var self = e.data;

                var s = self.settings;
                var t = self.state;

                if (!t.scrolling)
                    return;

                t.scrolling = false;

                t.thumb_element.removeClass("mj-scrollbar-thumb-drag");

                $(document).unbind("mousemove", self, self._drag);
                $(document).unbind("mouseup", self, self._dragend);

                var val = s.value;

                //if (self.settings.integer_values)
                //    val = parseInt(val, 10);

                self.$el.trigger("scrollEnd", val);
            },
	
            _move: function(pos, trigger_change_event)
            {
                var s = this.settings;
                var t = this.state;

                // pos: 0..maxscroll
                // where maxscroll = track height/width - thumb height/width

                if (pos <= 0)
                    pos = 0;
                else
                if (pos >= t.maxscroll)
                    pos = t.maxscroll;

                if (pos == t.prev_pos)       // no change
                    return;

                t.prev_pos = pos;

                // move the thumb

                if (s.orientation == "vertical")
                    t.thumb_element.css({ top: pos });
                else
                    t.thumb_element.css({ left: pos });

                var r = pos / t.maxscroll;   // r: 0..1

                // calculate value
                
                s.value = s.min + r * t.range;

                var val = s.value;

                if (trigger_change_event) {

                    if (s.integer_values)
                        this.$el.trigger("valueChanged", parseInt(val, 10));
                    else
                        this.$el.trigger("valueChanged", val);
                }

                //$(".mj-scrollbar-thumb").css("transform", "translateY(" + y + "px)");	
			
                /*
			    var pos = $(".mj-scrollbar-thumb").position();
			
			    y = y - pos.top ;
									
			    $(".mj-scrollbar-thumb").animate({
				    top: "+=" + y,
			        }, 10, function() {
				    // Animation complete.
			        });	
		          */
            },

            set: function(val, trigger_change_event)
            {
                var s = this.settings;
                var t = this.state;

                if (val < s.min)
                    val = s.min;
                else
                if (val > s.max)
                    val = s.max;

                this._calcMaxScroll();

                // map val (min..max) to maxscroll(0..maxscroll)

                var pos = ((val - s.min) / t.range) * t.maxscroll;

                this._move(pos, trigger_change_event);
            },

            get: function()
            {
                var s = this.settings;

                var val = s.value;

                if (s.integer_values)
                    val = parseInt(val, 10);

                var o = {
                    orientation: s.orientation,
                    min: s.min,
                    max: s.max,
                    value: val,
                    step_size: s.step_size,
                    show_buttons: s.show_buttons,
                    style: s.style,
                    integer_values: s.integer_values,
                    page_size: s.page_size
                };

                return o;
            },

            val: function(n)
            {
                // get or set value;

                if (n != null)
                {
                    this.set(n);
                }
                else
                {
                    var s = this.settings;

                    var val = s.value;

                    if (s.integer_values)
                        val = parseInt(val, 10);

                    return val;
                }
            },

            setMinMax: function(min, max)
            {
                var s = this.settings;
                var t = this.state;

                s.min = mjcore.validateFloat(min, 0);
                s.max = mjcore.validateFloat(max, 1000);

                // cant handle max < min yet

                if (s.min > s.max) {
                    var tmp = s.min;
                    s.min = s.max;
                    s.max = tmp;
                }

                if (s.value < s.min)
                    s.value = s.min;

                if (s.value > s.max)
                    s.value = s.max;

                t.range = max - min;

                this._calcMaxScroll();

                this.set(s.value);       // dont trigger valueChanged event
            },

            close: function () {

                // dont clear the data
                // important to turn off events

                this._stopListening();

                // we may still want to get the data after the scrollbar has closed so dont remove the data

                $.removeData(this.el, 'mj-scrollbar-data');

                var e = this.$el.find(".mj-scrollbar");

                if (e && e.length > 0)
                    e.remove();
            }
        }

        $.fn.mjScrollBar = function (options) {

            // options is empty or an object
            // create the scrollbar            
            // check that element exists using this.length

            if (!this.length) {

                mjcore.mjError("mjScrollBar: the html element to attach to '" + this.selector + "' does not exist."); 
                return null;
            }

            // within a plugin use this not $(this) to refer to the element to attach to
            // this refers to the element we are attaching to
            // needs to return this for chainability

            if (mjScrollBar[options]) {

                // options is the name of a method in mjScrollBar

                var o = $(this).data('mj-scrollbar-data');

                // cant call slice directly on arguments

                if (o)
                    return o[options].apply(o, Array.prototype.slice.call(arguments, 1));

                // if o is not found then the mjScrollBar has not been attached to the element
                // its not an necessarily and error

                return null;
            }
            else if (!options || typeof options === 'object') {

                // Note: a jquery query select can refer to any number of html elements
                // return is for chainability, dont have to return anything

                return this.each(function (index, o) {

                    var x = Object.create(mjScrollBar);
                   
                    x._init(options, o);

                    // attach object instance to this html element

                    $.data(o, 'mj-scrollbar-data', x);
                });
            }
            else {

                // method does not exist

                mjcore.mjError("Method '" + options + "' does not exist in mjScrollBar");
            }
        };
})(jQuery);     // pass jQuery as an argument to the immiediatly executed javascript function so that $ always refers to jquery

});



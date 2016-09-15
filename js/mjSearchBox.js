$(document).ready(function () {

    (function ($) {
    
        var mjSearchBox = {

            init: function (options, el) {

                this.widget_class = "mjSearchBox";

                this.el = el;
                this.$el = $(el);                

                // plugin have been applied previously
                // blow away any existing instance

                this.close();

                this._validateData(options);

                this._render();

                this._startListening();
            },

            //----------------------------------------------------------------------------------------------------------
            // private functions

            _validateData: function(options)
            {                
                var default_settings = {
                    value: "",
                    placeholder: "",

                    // properties common to all controls

                    width: '100%',
                    height: '100%',
                    disabled: false,                    
                    theme: null
                };

                this.settings = $.extend({}, default_settings, options);
            },

            _startListening: function () {

                var self = this;

                // we may be recreating the plugin for the second time
                // if we do not stop listening to events on the element we get strange behaviour

                this._stopListening();

                this.$el.on("keyup", "input", function (e) {

                    e.preventDefault();

                    var str = $(e.currentTarget).val();

                    self.$el.trigger("mjKeyup", str);
                });

                this.$el.on("click", ".mj-search-btn", function (e) {

                    e.preventDefault();

                    var str = self.$el.find("input").val();

                    self.$el.trigger("search", str);
                });

            },

            _stopListening: function () {
                this.$el.off();
            },

            _render: function () {

                var self = this;

                var str = "<div class='mj-widget mj-searchbox '>";

                str += " <div class='mj-searchbox-container'>";
                str += "  <input class='mj-input' value='" + this.settings.value + "' placeholder='" + this.settings.placeholder + "' />";        // on ipad we autofocus causes the keyboard to appear
                str += " </div>";

                str += " <div class='mj-search-btn'></div>";

                str += "</div>";

                this.$el.html(str);

                return this;
            },

            //----------------------------------------------------------------------------
            // public interface
            //----------------------------------------------------------------------------

            clear: function()
            {
                var e = this.$el.find("input").val("");
            },

            //--------------------------------------------------------------------------------------------------------------

            close: function () {

                // dont clear the data
                // important to turn off events

                this._stopListening();
                this.$el.data(this, 'mj-searchbox-data', null);
                this.$el.html("");
            }
        }

        $.fn.mjSearchBox = function (options) {

            // options is empty or an object
            // within a plugin use this not $(this)
            // check that element exists using this.length

            if (!this.length) {

                mjcore.mjError("mjSearchBox: the html element to attach to '" + this.selector + "' does not exist");                

                return null;
            }

            if (mjSearchBox[options]) {

                var q = $(this).data('mj-searchbox-data');

                if (q)
                    return q[options].apply(q, Array.prototype.slice.call(arguments, 1));
            }
            else if (!options || typeof options === 'object') {

                // return is for chainability, dont have to return anything
                // if the selector was multiply defined you would be creating plugin for each selector

                return this.each(function () {
                    var searchbox = Object.create(mjSearchBox);
                    searchbox.init(options, this);
                    $.data(this, 'mj-searchbox-data', searchbox);
                });
            }
            else {

                // method does not exist

                mjcore.mjError("Method '" + options + "' does not exist on mjSearchBox"); 
            }
        };
    })(jQuery);

});
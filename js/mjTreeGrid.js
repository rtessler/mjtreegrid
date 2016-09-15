$(document).ready(function () {

    // row data structure:

    // id:         int, mandatory. If omitted one will be generated
    // pid:         parent key field, default null
    // image:       string (default null)
    // selected:    true,false (ignored if show_checkbox is true, default false)
    // expanded:    true|false
    // checked:     0|1|2, 0 is not checked, 1 is checked, 2 is half ticked (ignored if show_checkbox is false)
    // disabled:    true or false (default false)

    // node structure:

    // data    
    // parent
    // children
    // next
    // prev
    // visible

    // column structure:

    // text
    // data_field
    // width
    // align                                (left,right,center) (default: left)    

    // TBD

    // rendering into hidden elements
    // column headers
    // themes
    // width, height
    // disabled
    // _enableKeyEvents
    // wrap_text
    // editable: false,
    // format_string: null,                 for rendering and validating date cells
    // disabled: false,                     for disabled columns
    // group: null,                         for nested column headers
    // hidden: false,      


    (function ($) {

        var mjTreeGrid = {

            init: function (options, el) {

                this.el = el;
                this.$el = $(el);

                // plugin have been applied previously
                // blow away any existing instance

                this.close();

                this.widget_class = "mjTreeGrid";

                this._reset();

                this._validateData(options);

                this._render();

                this._startListening();
            },

            //----------------------------------------------------------------------------------------------------------
            // private functions

            _reset: function () {

                // initialize instance variables                

                this.filtered_start = 0;    // for virtual rendering, index of current top row in window in filtered array
                this.scrollable_start = 0;  // for virtual rendering, index of current top row in window in scrollable array
                this.tree = null;           // root of tree
                this.node_map = {};         // a hash table of nodes indexed by id
                this.nodes = [];            // an array of all nodes in order of appearance in the tree
                this.filtered = [];         // an array of nodes which have not been filtered out in order of appearance in the tree
                this.scrollable = [];       // array of visible nodes which we can scroll through in virtual mode
                this.idf = null;
                this.pidf = null;

                this.drop_placement = null;
                this.drop_id = null;
            },

            _validateItem: function (o) {

                var default_item = { image: null };

                var x = $.extend({}, default_item, o);  // o overrides default

                $.extend(o, x);

                // every node must have an id, if there is no id generate one

                if (o[this.idf] == null)
                    o[this.idf] = mjcore.generateId();

                if (o[this.pidf] === undefined)
                    o[this.pidf] = null;

                // valid values of selected is true,false
                // checked and selected are mutually exclusive
                // for booleans we accept 0,1,true,false

                if (this.settings.show_checkboxes) {

                    // valid values for checked is 0,1,2

                    if (o.checked) {
                        var subs = [{ val: 0, to: 0 }, { val: false, to: 0 }, { val: 1, to: 1 }, { val: 2, to: 2 }];
                        o.checked = mjcore.validate(o.checked, subs, 0);
                        o.selected = null;    // if checked is set selected must be null                                   
                    }
                }
                else {

                    if (o.selected) {
                        var subs = [{ val: 0, to: false }, { val: false, to: false }, { val: 1, to: true }, { val: true, to: true }];
                        o.selected = mjcore.validate(o.selected, subs, false);
                        o.checked = null;       // if selected is set checked must be null
                    }
                }

                if (o.disabled) {
                    var subs = [{ val: 0, to: false }, { val: false, to: false }, { val: 1, to: true }, { val: true, to: true }];
                    o.disabled = mjcore.validate(o.disabled, subs, false);
                }

                if (o.expanded) {
                    var subs = [{ val: 0, to: false }, { val: false, to: false }, { val: 1, to: true }, { val: true, to: true }];
                    o.expanded = mjcore.validate(o.expanded, subs, false);
                }
            },

            _validateData: function (options) {

                var self = this;

                var default_settings = {

                    id_field: "id",             // MANDATORY, name of the id field in every row item object
                    parent_id_field: "pid",     // MANDATORY, name of the parent id field in every object

                    rows: [],
                    show_checkboxes: false,     // bool
                    cellRender: null,           // custom rendering function each each item. signature: cellRender(item)

                    animation_duration: 0,      // time in milliseconds, 0 for no animation 
                    multi_select: false,        // bool
                    dragdrop: false,            // bool
                    sublist_indent: 16,         // sublist indent in pixels
                    recursive: true,            // bool
                    virtual_mode: false,        // bool
                    page_size: 15,              // needed in virtual mode

                    filter_function: null,

                    scrollbar_height: mjcore.MJ_HORIZONTAL_SCROLLBAR_HEIGHT,
                    scrollbar_width: mjcore.MJ_VERTICAL_SCROLLBAR_WIDTH,

                    columns: [],                // array of columns {text, width, align: (left,right,center) (default: left)}, data_field
                    wrap_text: false,           // bool
                    show_borders: true,         // bool
                    border_color: "efefef",

                    // properties common to all controls

                    width: '100%',
                    height: '100%',
                    disabled: false,
                    theme: null
                };

                this.settings = $.extend({}, default_settings, options);    // options overrides default        

                var s = this.settings;

                if (!s.rows)
                    s.rows = [];

                var rows = s.rows;

                // make some short cuts

                if (s.id_field == null) {
                    mjcore.mjError("mjTreeGrid Error: id_field not defined!!");
                    s.id_field = "id";
                }

                if (s.parent_id_field == null) {
                    mjcore.mjError("mjTreeGrid Error: parent_id_field not defined!!");
                    s.parent_id_field = "pid";
                }

                this.idf = s.id_field;
                this.pidf = s.parent_id_field;

                s.scrollbar_width = mjcore.validateInt(s.scrollbar_width, null, default_settings.scrollbar_width);
                s.scrollbar_height = mjcore.validateInt(s.scrollbar_height, null, default_settings.scrollbar_height);

                var data_map = {};

                // validate the row items
                // stage 1: look for duplicate ids
                // build map of all nodes indexed by id

                $.each(rows, function (index, o) {

                    self._validateItem(o);

                    var id = o[self.idf];

                    if (data_map[id])
                        mjcore.mjError("mjTreeGrid Error: duplicate id: " + id + " found in data. Ids must be unique.");

                    data_map[id] = o;
                });

                // stage 2: using the map we just created, look for references to non existant parents
                // if a parent does not exist set it to null   

                $.each(rows, function (index, o) {

                    var pid = o[self.pidf];

                    if (pid != null && !data_map[pid]) {
                        mjcore.mjError("mjTreeGrid Error: found reference to non existent id: " + pid);
                        o[self.pidf] = null;
                    }
                });

                // create a tree from flat data
                // we use this tree for editing, dragdrop and filtering
                // we do not assume the rows are any particular order
                // child nodes could appear before parent nodes
                // before we can render we need child nodes to appear directly after the parent node
                // to do this convert to a tree and flatten the tree

                this._toTree(rows);

                this._flattenTree();
            },

            _startListening: function () {

                var self = this;

                var s = this.settings;

                // we may be recreating the plugin for the second time
                // if we do not stop listening to events on the element we get strange behaviour

                this._stopListening();

                this.$el.on("click", ".mj-expander", function (e) {

                    // use clicked expander icon, expand/collapse   node

                    e.preventDefault();
                    e.stopPropagation();

                    var q = $(e.currentTarget);

                    var r = q.closest(".mj-row");
                    var node = r.data("d");

                    if (q.hasClass("mj-open")) {

                        self.collapse(node);
                        self.$el.trigger("collapse", node);
                    }
                    else {

                        self.expand(node);
                        self.$el.trigger("expand", node);
                    }
                });

                this.$el.on("click", ".mj-treegrid", function (e) { self.$el.trigger("emptySpaceClick"); });   // click in non-data part of grid

                this.$el.find("click", ".mj-content").unbind('click');

                this.$el.on("click", ".mj-content", function (e) {

                    // clicked on the checkbox or text

                    e.preventDefault();
                    e.stopPropagation();

                    var q = $(e.currentTarget);
                    var p = q.closest(".mj-row");
                    var o = p.data("d");

                    if (o) {

                        if (o.disabled)
                            return;

                        if (self.settings.show_checkboxes) {

                            if (o.checked == 1)
                                self.uncheck(o);
                            else
                                self.check(o);

                            self.$el.trigger("checkChange", o);
                        }
                        else {

                            self.select(o);
                            self.$el.trigger("selected", o);
                        }
                    }
                });

                if (s.virtual_mode) {

                    if (mjcore.isTouchScreen()) {

                        // there is no mouse wheel event to worry about
                        // because its a virtual grid we need to handle scrolling

                        var e = this.$el.find(".mj-treegrid-container");

                        e.on('touchstart', this, this._touchstart);
                        e.on('touchmove', this, this._touchmove);
                        e.on('touchend', this, this._touchend);
                    }
                    else {

                        // chrome, safari: mousewheel
                        // firefox: DOMMouseScroll
                        // IE: wheel

                        this.$el.on('mousewheel DOMMouseScroll wheel', 'tr', function (e) {

                            e.preventDefault();

                            var n = self.scrollable_start;

                            if (e.originalEvent.wheelDelta > 0)
                                n--;
                            else
                                n++;

                            if (n >= 0 && n < self.scrollable.length - self.settings.page_size)        
                                self.scrollToRowByIndex(n);
                        });
                    }
                }


                if (this.settings.dragdrop) {

                    jQuery.event.props.push('dataTransfer');

                    this.$el.on({

                        // drag drop functions on a row

                        dragstart: function (e) {

                            $(this).css('opacity', '0.5');

                            var r = $(e.currentTarget).data("d");

                            var id = r.data[self.idf];

                            self.drop_id = id;

                            var browser = mjcore.getBrowserName();

                            if (browser != "msie") {
                                e.dataTransfer.setData("dragdrop-data", id);          // problem in IE

                                //e.originalEvent.dataTransfer.setData('text/plain', 'anything');
                            }
                        },

                        dragenter: function (e) {

                            e.preventDefault();
                            e.stopPropagation();
                        },

                        dragleave: function (e) {

                            e.preventDefault();
                            e.stopPropagation();

                            //var o = $(e.currentTarget).data("d");
                            //$(e.currentTarget).find(".mj-cell").first().css("background", "#f00");
                            //console.log("dragleave: id = %d", o.id);
                        },

                        dragover: function (e) {

                            e.preventDefault();
                            e.stopPropagation();

                            //var id = e.dataTransfer.getData("dragdrop-data");     // cant get dataTransfer data in dragover

                            var o = self.node_map[self.drop_id];

                            var draggable = self.getRowElement(o);
                            var droppable = $(e.currentTarget);

                            self.$el.find(".mj-cell").removeClass('mj-drag-over');
                            self.$el.find(".mj-cell .mj-content").removeClass('mj-drag-over-dashed-border-above');
                            self.$el.find(".mj-cell .mj-content").removeClass('mj-drag-over-dashed-border-below');

                            $(e.currentTarget).find(".mj-cell").addClass('mj-drag-over');

                            //if (self.drop_id == $(e.currentTarget).data("d").id)
                            //return;                              

                            if (self.drop_id == $(e.currentTarget).data("d").data[self.idf])
                                return;

                            var h = droppable.outerHeight();

                            var a = parseInt(e.originalEvent.clientY, 10) - parseInt(self.$el.offset().top, 10);
                            var b = droppable.offset().top - parseInt(self.$el.offset().top, 10);

                            self.drop_placement = "drop-into";

                            if (a <= b + h / 4) {

                                $(e.currentTarget).find(".mj-cell .mj-content").addClass('mj-drag-over-dashed-border-above');

                                self.drop_placement = "drop-before";
                            }
                            else if (a > b + h - h / 4) {

                                $(e.currentTarget).find(".mj-cell .mj-content").addClass('mj-drag-over-dashed-border-below');

                                self.drop_placement = "drop-after";
                            }
                        },

                        dragend: function (e) {

                            e.preventDefault();
                            e.stopPropagation();

                            self.$el.find(".mj-row .mj-cell").removeClass('mj-drag-over');
                            self.$el.find(".mj-row .mj-cell .mj-content").removeClass('mj-drag-over-dashed-border-above');
                            self.$el.find(".mj-row .mj-cell .mj-content").removeClass('mj-drag-over-dashed-border-below');

                            $(this).css('opacity', '1');

                            // dragdrop does not work on PC safari
                            // not worth implementing, no one uses safari on PC

                            //var browser = mjcore.mjGetBrowserName();

                            //mjcore.debug("dragend: browser = " + browser);

                            //if (browser == "safari") {

                            //    // jquery.drop does not fire on safari

                            //    var id = self.drop_id;

                            //    var x = self.getRow(id);

                            //    var drag_target = $(x).data("d");
                            //    var drop_target = $(e.originalEvent.target.offsetParent).data("d");

                            //    //mjcore.debug(drag_target);
                            //    //mjcore.debug(drop_target);
                            //    mjcore.debug(e);

                            //    if (self.settings.beforeDrop) {
                            //        if (self.settings.beforeDrop(drag_target, drop_target, self.drop_placement)) {

                            //            // beforeDrop gives the user a chance to cancel the dragdrop

                            //            self._dropIt(e);
                            //        }
                            //    }
                            //    else {
                            //        // there is no beforeDrop function, just do it

                            //        self._dropIt(e);
                            //    }

                            //    if (self.settings.afterDrop)
                            //        self.settings.afterDrop(drag_target, drop_target);
                            //}
                        },

                        drop: function (e) {

                            e.preventDefault();
                            e.stopPropagation();

                            var id = self.drop_id;
                            //var id = e.dataTransfer.getData("dragdrop-data");     // problem on IE

                            var o = self.node_map[id];

                            var s = self.settings;

                            var drag_target = o;
                            var drop_target = $(e.currentTarget).data("d");

                            if (s.beforeDrop) {
                                if (s.beforeDrop(drag_target, drop_target, self.drop_placement)) {

                                    // beforeDrop gives the user a chance to cancel the dragdrop

                                    self._dropIt(drag_target, drop_target);

                                    if (s.afterDrop)
                                        s.afterDrop(drag_target, drop_target, self.drop_placement);
                                }
                            }
                            else {
                                // there is no beforeDrop function, just do it

                                self._dropIt(drag_target, drop_target);

                                if (s.afterDrop)
                                    s.afterDrop(drag_target, drop_target, self.drop_placement);
                            }
                        },
                    }, '.mj-row');
                }
            },

            _dropIt: function (drag_target, drop_target) {

                switch (this.drop_placement) {
                    case "drop-before": this._dropBefore(drag_target, drop_target); break;
                    case "drop-after": this._dropAfter(drag_target, drop_target); break;
                    default: this._dropInto(drag_target, drop_target); break;
                }
            },

            _isBadDrag: function (drag_target, drop_target) {

                // cant drag into itself

                if (drop_target == drag_target)
                    return true;

                var children = this.getChildren(drag_target);

                // cant drag a parent into one of its children

                for (var i = 0, len = children.length; i < len; i++) {

                    var o = children[i];

                    if (o == drop_target)
                        return true;
                }

                return false;
            },

            _removeNodeFromTree: function (o) {
                if (o.prev)
                    o.prev.next = o.next;

                if (o.next)
                    o.next.prev = o.prev;

                if (o.parent) {
                    // if the node we are deleting is the 1st child of its parent
                    // set the first child of the parent to the nodes next sibling

                    if (o.parent.children == o)
                        o.parent.children = o.next;
                }

                // if the drag target is the root node of the tree change the root node

                if (this.tree == o)
                    this.tree = o.next;

                o.prev = null;
                o.next = null;
            },

            _dropBefore: function (drag_target, drop_target) {

                var self = this;

                var id = self.drop_id;
                //var id = e.dataTransfer.getData("dragdrop-data");     // problem on IE

                if (this._isBadDrag(drag_target, drop_target))
                    return;

                // update the parent id, the drag_target will have the same parent as the drop_target

                //----------------------------------------------------------------------
                // remove the drag item from the tree

                this._removeNodeFromTree(drag_target);

                //----------------------------------------------------------------------

                // insert drag_target to new position

                drag_target.data[self.pidf] = drop_target.data[self.pidf];
                drag_target.parent = drop_target.parent;

                drag_target.next = drop_target;
                drag_target.prev = drop_target.prev;

                if (drop_target.prev) {
                    drop_target.prev.next = drag_target;
                }
                else {
                    if (drop_target.parent && drop_target.parent.children == drop_target)
                        drop_target.parent.children = drag_target;
                }

                drop_target.prev = drag_target;

                if (self.tree == drop_target)
                    self.tree = drag_target;

                self._buildNodesFromTree();     // rebuild the nodes array
                self._flattenTree();
                self._getScrollable();
                self._redraw();
                self._applyCSS();
            },

            _dropAfter: function (drag_target, drop_target) {

                var self = this;

                var id = self.drop_id;
                //var id = e.dataTransfer.getData("dragdrop-data");         // problem on IE

                if (this._isBadDrag(drag_target, drop_target))
                    return;

                //----------------------------------------------------------------------
                // remove the drag item from the tree

                this._removeNodeFromTree(drag_target);

                //----------------------------------------------------------------------

                // insert drag_target to new position

                drag_target.data[self.pidf] = drop_target.data[self.pidf];
                drag_target.parent = drop_target.parent;

                drag_target.prev = drop_target;
                drag_target.next = drop_target.next;

                if (drop_target.next)
                    drop_target.next.prev = drag_target;

                drop_target.next = drag_target;

                self._buildNodesFromTree();     // rebuild the nodes array
                self._flattenTree();
                self._getScrollable();
                self._redraw();
                self._applyCSS();
            },

            _dropInto: function (drag_target, drop_target) {

                var self = this;

                var id = self.drop_id;
                //var id = e.dataTransfer.getData("dragdrop-data"); // problem on IE

                if (this._isBadDrag(drag_target, drop_target))
                    return;

                //----------------------------------------------------------------------
                // remove the drag item from the tree

                this._removeNodeFromTree(drag_target);

                // update the parent id

                drag_target.data[this.pidf] = drop_target.data[this.idf];
                drag_target.parent = drop_target;

                if (drop_target.children) {
                    var x = drop_target.children;

                    drag_target.next = x;
                    x.prev = drag_target;
                }

                drop_target.children = drag_target;

                self._buildNodesFromTree();     // rebuild the nodes array
                self._flattenTree();
                self._getScrollable();
                self._redraw();
                self._applyCSS();
            },

            _stopListening: function () {
                this.$el.off();
            },

            _renderRow: function (node) {

                var s = this.settings;

                var row = $("<tr>", { 'class': 'mj-row' });

                if (s.dragdrop)
                    row.attr("draggable", "true");

                row.data("d", node);        // associate data with the row

                var cell = $("<td>", { class: 'mj-cell' });

                if (node.children) {

                    // if the item has child nodes, even if the items array is empty create an expander

                    var e = $("<div>", { 'class': 'mj-expander' });

                    if (node.expanded)
                        e.addClass("mj-open");
                    else
                        e.addClass("mj-closed");

                    cell.append(e);
                }

                // root nodes are always visible
                // is the the parent is expanded the child must be visible

                var p = node.parent;

                if (node.parent == null || node.expanded || (p && p.expanded))
                    row.show();
                else
                    row.hide();

                // make the content: checkbox, image, text

                var e = $("<div>", { 'class': 'mj-content' });

                if (node.disabled)
                    row.addClass("mj-disabled");

                // cant be selected and disabled

                if (node.selected && !node.disabled)
                    e.addClass("selected");

                if (s.show_checkboxes) {

                    var checked = "";

                    switch (node.checked) {
                        case 1: checked = " checked"; break;
                        case 2: checked = " half-ticked"; break;
                    }

                    e.append("<div class='mj-checkbox-box" + checked + "'><div class='mj-tick'></div></div>");
                }

                // add the image

                if (node.data.image)
                    e.append("<img class='mj-image ' src='" + node.data.image + "' />");

                var c = s.columns[0];
                var text;

                if (s.cellRender)
                    text = s.cellRender(node, c, 0);
                else
                    text = node.data[c.data_field];

                if (s.wrap_text)
                    e.append("<div class='mj-text' title='" + c.data_field + "'>" + text + "</div>");
                else
                    e.append("<div class='mj-text mj-nowrap' title='" + c.data_field + "'>" + text + "</div>");

                // associate data with mj-content as well

                e.data("d", node);

                cell.append(e);

                row.append(cell);

                // add the remaining columns

                for (var i = 1, len = s.columns.length; i < len; i++) {

                    c = s.columns[i];

                    var str = "";

                    if (s.cellRender)
                        str = s.cellRender(node, c, i);
                    else
                        str = node.data[c.data_field];

                    cell = $("<td>", { class: "mj-cell", html: str });

                    row.append(cell);
                }

                return row;
            },

            _render: function () {

                // called once

                var self = this;

                var s = this.settings;

                var widget = $("<div>", { 'class': 'mj-widget mj-treegrid mj-noselect' });

                var treegrid_container = $("<div>", { class: 'mj-treegrid-container' });

                var t = $("<table>", { 'class': 'mj-table mj-root' });

                if (s.dragdrop)
                    widget.attr("draggable", "true");

                treegrid_container.html(t);

                widget.html(treegrid_container);

                var vertical_scrollbar = $("<div>", { class: "mj-vertical-scrollbar-container" });

                var horizontal_scrollbar = $("<div>", { class: "mj-horizontal-scrollbar-container" });

                widget.append(vertical_scrollbar);

                widget.append(horizontal_scrollbar);

                this.$el.html(widget);

                this._redraw();

                this._createScrollBars();

                //this.$el.find(".mj-treegrid").css({ width: s.width, height: s.height });

                return this;
            },

            _redraw: function () {

                var e = this.$el.find(".mj-root");

                e.empty();

                // draw visible rows

                var self = this;

                var s = this.settings;

                if (s.virtual_mode) {
                    var len = this.filtered.length;

                    var j = 0;

                    for (var i = this.filtered_start; i < len && j < s.page_size; i++) {

                        var o = this.filtered[i];

                        var r = this._renderRow(o);

                        e.append(r);

                        // r may be rendered hidden

                        if (r.is(":visible"))
                            j++;
                    }
                }
                else {
                    $.each(this.filtered, function (i, o) {

                        var r = self._renderRow(o);
                        e.append(r);
                    });

                    //function _renderTree(tree)
                    //{                        
                    //    // traverse the tree

                    //    var node = tree;

                    //    while (node)
                    //    {                  
                    //        if (node.visible) {

                    //            var r = self._renderRow(node);
                    //            e.append(r);                                

                    //            if (node.children)
                    //                _renderTree(node.children);
                    //        }

                    //        node = node.next;
                    //    }
                    //}

                    //_renderTree(this.tree);
                }

                this._applyCSS();
            },

            _applyCSS: function () {

                var self = this;
                var s = this.settings;

                // do padding

                var rows = this.$el.find(".mj-row");

                $.each(rows, function (index, e) {

                    var node = $(e).data("d");

                    var level = self.getLevel(node);

                    var indent = level * s.sublist_indent + 2;

                    $(e).find(".mj-cell").first().css({ "padding-left": indent });
                });

                // set column widths and cell alignment

                $.each(s.columns, function (index, c) {

                    var e = self.$el.find(".mj-cell:nth-child(" + (index + 1) + ")");

                    var style = {};

                    if (c.width) {
                        style.width = c.width;
                        style["max-width"] = c.width;
                    }

                    if (c.align)
                        style["text-align"] = c.align;

                    e.css(style);
                });

                if (s.show_borders)
                    this.$el.find(".mj-cell").css({ border: "1px solid #" + s.border_color });
                else
                    this.$el.find(".mj-cell").css({ border: "1px solid transparent" });
            },

            _createHorizontalScrollBar: function () {

                var self = this;

                var s = this.settings;

                var t = this.$el.find(".mj-treegrid-container");

                var container_width = t.width();

                var w = this.$el.find(".mj-table").width();

                var e = this.$el.find(".mj-horizontal-scrollbar-container");

                var x = e.find(".mj-scrollbar");

                var val = null;

                if (x.length)
                    val = e.mjScrollBar("val");

                // table is wider than container, create horizontal scrollbar

                var create_horizontal_scrollbar = (w > container_width);

                // number of items is greater than page size, create vertical scrollbar

                var n = this.scrollable.length;

                var create_vertical_scrollbar = (n > s.page_size);

                if (create_horizontal_scrollbar) {

                    // create horizontal scrollbar

                    //this.$el.find(".mj-listbox").css("overflow-x", "auto");  

                    e.css({ right: s.scrollbar_width + "px", height: s.scrollbar_height });

                    var settings = { min: 0, max: 0, orientation: "horizontal", page_size: s.page_size, width: s.scrollbar_width, height: s.scrollbar_height };

                    var w = this.$el.find(".mj-table").width();

                    if (create_vertical_scrollbar) {
                        e.css({ right: s.scrollbar_width + "px", height: s.scrollbar_height });
                        settings.max = w - container_width + s.scrollbar_width;
                    }
                    else {
                        e.css({ right: "0px", height: s.scrollbar_height });
                        settings.max = w - container_width;
                    }

                    if (val != null && val > settings.min && settings <= settings.max)
                        settings.value = val;

                    e.mjScrollBar(settings);

                    e.on("valueChanged", function (e, n) {

                        //self.$el.find(".mj-table").css("left", -n);

                        self.$el.find(".mj-cell,.mj-header-cell").not(".mj-frozen").css("left", -n);
                    });
                }
                else {

                    // remove horizontal scrollbar

                    if (x.length)
                        e.mjScrollBar("close");
                }
            },

            _createVerticalScrollBar: function () {

                var self = this;

                var s = this.settings;

                var t = this.$el.find(".mj-treegrid-container");

                var container_width = t.width();

                var w = this.$el.find(".mj-table").width();

                var e = this.$el.find(".mj-vertical-scrollbar-container");

                // get value of existing scrollbar

                var val = null;

                var x = e.find(".mj-scrollbar");

                if (x.length)
                    val = e.mjScrollBar("val");

                // table is wider than container, create horizontal scrollbar

                var create_horizontal_scrollbar = (w > container_width);

                // number of items is greater than page size, create vertical scrollbar

                var n = this.scrollable.length;

                var create_vertical_scrollbar = (n > s.page_size);

                if (create_vertical_scrollbar) {

                    if (create_horizontal_scrollbar)
                        e.css({ bottom: s.scrollbar_height + "px", width: s.scrollbar_width });
                    else
                        e.css({ bottom: "0px", width: s.scrollbar_width });

                    var settings = { min: 0, max: n - s.page_size, page_size: s.page_size, width: s.scrollbar_width, height: s.scrollbar_height };

                    if (val != null && val > settings.min && val <= settings.max)
                        settings.value = val;

                    e.mjScrollBar(settings);

                    e.on("valueChanged", function (e, n) {

                        self.scrollToRowByIndex(n);

                        // recreate horizontal scrollbar

                        //var x = self.$el.find(".mj-horizontal-scrollbar-container .mj-scrollbar");

                        //var val = null;

                        //if (x.length) {
                        //    val = self.$el.find(".mj-horizontal-scrollbar-container").mjScrollBar("val");
                        //    console.log("val = " + val);
                        //}

                        //self.$el.find(".mj-table").css("left", 0);

                        //self._createHorizontalScrollBar();
                    });
                }
                else {
                    // remove vertical scrollbar

                    if (x.length)
                        e.mjScrollBar("close");
                }
            },

            _createScrollBars: function () {

                this._getScrollable();

                // dont create scrollbars for touch screens

                if (mjcore.isTouchScreen())
                    return;

                var s = this.settings;

                // for use in virtual mode only

                if (!s.virtual_mode)
                    return;

                //this.$el.find(".mj-listbox").css("overflow", "hidden");

                var t = this.$el.find(".mj-treegrid-container");
                t.css({ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, overflow: "hidden" });
                //t.css({ position: "absolute", left: 0, right: right_offset + "px", top: 0, bottom: bottom_offset + "px", overflow: "hidden" });

                this._createVerticalScrollBar();

                this._createHorizontalScrollBar();
            },
        
            _buildNodesFromTree: function () {

                var self = this;

                // rebuild the nodes array from the tree

                this.nodes = [];

                for (var node = this.tree; node; node = node.next) {
                    this.nodes.push(node);

                    this.recurseChildren(node, function (x) { self.nodes.push(x); });
                }
            },

            //--------------------------------------------------------------------------------------------------------------

            _flattenTree: function () {

                var self = this;

                // create the visible nodes array

                this.filtered = [];

                // turns a tree into a flat array
                // stores references to elements in the tree in the array
                // we use the flattened tree to render the treegrid

                for (var node = this.tree; node; node = node.next) {
                    if (node.visible) {
                        this.filtered.push(node);

                        self.recurseChildren(node, function (x) {

                            if (x.visible)
                                self.filtered.push(x);
                        });
                    }
                }

                // remove the items property

                //$.each(arr, function (index, o) { delete o.items; });
            },


            _toTree: function (rows) {

                // given an array of rows each containing id and parent_id
                // build a tree where each node may or may not have an array of sub items
                // the order of items in each node will be the order they appear in the original array
                // the tree holds references to rows in the array

                var self = this;

                this.node_map = {};
                this.nodes = [];
                this.tree = null;

                // note we want the nodes array to contain nodes in the order of appearance in the tree

                // empty tree

                if (!rows || rows.length == 0)
                    return;

                var prev = null;

                // create top level nodes

                var nodes = [];

                $.each(rows, function (index, o) {

                    var node = self._createNode(o);
                    self.node_map[o[self.idf]] = node;
                    nodes.push(node);

                    if (o[self.pidf] == null)  // NOTE: pidf = 0 is not a top level node, must be null 
                    {
                        // top level node

                        if (!self.tree)
                            self.tree = node;       // root of tree

                        // set prev and next pointers

                        if (prev) {
                            prev.next = node;
                            node.prev = prev;
                        }

                        prev = node;
                    }
                });

                // set parent nodes

                $.each(nodes, function (i, o) {

                    var pid = o.data[self.pidf];
                    self.nodes.push(o);

                    if (pid != null) {
                        // set the parent link

                        var p = self.node_map[pid];

                        if (!p)
                            mjcore.mjError("error: node not found in node map");
                        else {
                            o.parent = p;

                            var last_child = self._getLastChildNode(p);

                            if (!last_child)
                                p.children = o;
                            else {
                                // add it to the end

                                last_child.next = o;
                                o.prev = last_child;
                            }
                        }
                    }
                });
            },

            _printTree: function () {

                var self = this;

                for (var node = this.tree; node; node = node.next) {
                    if (node.visible) {
                        mjcore.debug(node.data);

                        this.recurseChildren(node, function (x) {

                            if (x.visible)
                                mjcore.debug(x.data);
                        });
                    }
                }
            },

            _createNode: function (data) {
                // create a node in a tree

                var node = { data: data, parent: null, children: null, next: null, prev: null, visible: true, selected: null, checked: null, disabled: false, expanded: false };

                if (data.selected != undefined)
                    node.selected = data.selected;

                if (data.checked != undefined)
                    node.checked = data.checked;

                if (data.disabled != undefined)
                    node.disabled = data.disabled;

                if (data.expanded != undefined)
                    node.expanded = data.expanded;

                return node;
            },

            _getLastRootNode: function () {
            
                var last_root_node = null;

                $.each(this.nodes, function (index, o) {

                    if (!o.parent)
                        last_root_node = o;
                });

                return last_root_node;
            },

            _getLastChildNode: function (node) {

                if (!node)
                    return null;

                var last_child = null;

                for (var o = node.children; o; o = o.next)
                    last_child = o;

                return last_child;
            },

            //----------------------------------------------------------------------------------
            // public functions

            getLevel: function (node) {

                var level = 0;

                while (node) {
                    node = node.parent;

                    if (node)
                        level++;
                }

                return level;
            },

            _touchstart: function (evt) {

                evt.preventDefault();       // need this otherwise the whole page scrolls
                //evt.stopPropagation();

                var self = evt.data;

                var e = evt.originalEvent;

                var y = 0;

                if (e.touches)
                    y = e.touches[0].pageY;
                else
                    y = e.pageY;

                self.touch_y = y;

                self.touch_busy = false;
            },

            _touchmove: function (evt) {

                var self = evt.data;

                var s = self.settings;

                var e = evt.originalEvent;

                var y = 0;

                if (e.touches)
                    y = e.touches[0].pageY;
                else
                    y = e.pageY;

                if (y == self.touch_y)
                    return;         // no change

                if (self.touch_busy)      // still drawing
                    return;

                var h = self.$el.height();

                var delta = (y - self.touch_y);          // change

                var t = delta / h;         // % change can be -ve

                self.touch_y = y;

                var n = s.items.length;			// number of items 

                y = self.scrollable_start + Math.floor((n - s.page_size) * t);

                if (y < 0 || y >= n)
                    return;

                self.touch_busy = true;

                self.scrollToRowByIndex(y);

                self.touch_busy = false;
            },

            _touchend: function (evt) {

                //evt.preventDefault();

                var self = evt.data;

                self.touch_busy = false;
            },

            _getScrollable: function () {

                var self = this;

                this.scrollable = [];

                // traverse the tree

                function __getScrollable(tree) {

                    var node = tree;

                    while (node) {
                        if (node.visible) {

                            self.scrollable.push(node);

                            if (node.children && node.expanded)
                                self.scrollable.concat(__getScrollable(node.children));
                        }

                        node = node.next;
                    }
                }

                __getScrollable(this.tree);
            },

            //----------------------------------------------------------------------------
            // public interface
            //----------------------------------------------------------------------------             

            recurseChildren: function (node, callback) {
                // run a callback on every child node of a tree

                if (!node || !callback)
                    return;

                for (var n = node.children; n; n = n.next) {
                    callback(n);

                    if (n.children)
                        this.recurseChildren(n, callback);
                }
            },

            recurseParents: function (node, callback) {
                // run a callback on every child node of a tree

                if (!node || !callback)
                    return;

                if (node.parent) {
                    callback(node.parent);
                    this.recurseParents(node.parent, callback);
                }
            },

            /*
            hasChildren: function (o, items) {
            
                if (mjcore.mjEmpty(items))
                    items = this.toArrayDataOnly();
                                
                for (var i = 0, len = items.length; i < len; i++) {
            
                    var x = items[i];
            
                    if (x[this.pidf] == o[this.idf])
                        return true;
                }
            
            
                return false;
            },
            */

            getChildren: function (node) {

                // gets a nodes children as an array

                var arr = [];

                this.recurseChildren(node, function (x) { arr.push(x); });

                return arr;
            },

            getChildrenById: function (id) {

                if (id == null)
                    return null;

                var node = this.node_map[id];

                return this.getChildren(node);
            },

            getSiblings: function (node) {

                var self = this;

                var arr = [];

                if (!node)
                    return arr;

                for (n = node; n; n = n.next)
                    arr.push(n);

                return arr;
            },

            getRows: function () {
                return this.nodes;
            },

            getFilteredRows: function () {
                return this.filtered;
            },

            getScrollableRows: function () {
                return this.scrollable;
            },

            getRowElement: function (node) {

                // find the DOM .mj-row element for a node
                // if the row is not in the visible nodes return null

                if (!node)
                    return null;

                var rows = this.$el.find(".mj-row");

                for (var i = 0, len = rows.length; i < len; i++) {
                    var e = rows[i];

                    if ($(e).data("d") == node)
                        return $(e);
                }

                return null;
            },

            getRowElementById: function (id) {

                var self = this;

                // returns the row element with data.d = id
                // if the row is not in the visible nodes return null

                if (id == null)
                    return null;

                var rows = this.$el.find(".mj-row");

                for (var i = 0, len = rows.length; i < len; i++) {
                    var e = rows[i];

                    var node = $(e).data("d");

                    if (node && node.data[this.idf] == id)
                        return $(e);
                }

                return null;
            },

            getRowById: function (id) {

                if (id == null)
                    return null;

                return this.node_map[id];
            },

            clear: function () {

                // empty the data and list

                this.settings.rows = [];

                this.filtered_start = 0;
                this.scrollable_start = 0;
                this.tree = null;       // root of tree
                this.node_map = {};     // a hash table of nodes indexed by id
                this.nodes = [];        // an array of all nodes in order of appearance in the tree
                this.filtered = [];     // an array of visible nodes in order of appearance in the tree    
                this.scrollable = [];

                this._redraw();
            },


            search: function (search_function) {

                // use user supplied function which returns true or false to test each object
                // returns an array of rows

                if (!search_function)
                    return [];

                var list = this.$el.find(".mj-row");

                return list.filter(function (index) {

                    var o = $(this).data("d");

                    return search_function(o);
                });
            },

            //------------------------------------------------------------------------------------------------
            // enable, disable functions

            enableAll: function () {

                this.$el.find(".mj-row").removeClass("mj-disabled");

                $.each(this.node_map, function (index, node) { node.disabled = false; });
            },

            disableAll: function () {

                this.$el.find(".mj-row").addClass("mj-disabled");

                $.each(this.node_map, function (index, node) { node.disabled = true; });
            },

            enable: function (node) {

                var self = this;

                if (!node)
                    return;

                node.disabled = false;

                var e = this.getRowElement(node);

                if (e) {
                    e.removeClass("mj-disabled");

                    self.recurseChildren(node, function (x) {

                        x.disabled = false;

                        e = self.getRowElement(x);

                        if (e)
                            e.removeClass("mj-disabled");
                    });
                }
            },

            enableById: function (id) {
                if (id == null)
                    return;

                var node = this.node_map[id];
                this.enable(node);
            },

            enableAt: function (n) {
                if (n == null || n < 0 || n >= this.nodes.length)
                    return;

                var node = this.nodes[n];
                this.enable(node);
            },

            disable: function (node) {

                var self = this;

                if (!node)
                    return;

                node.data.disabled = true;

                var e = this.getRowElement(node);

                if (e) {
                    e.addClass("mj-disabled");

                    self.recurseChildren(node, function (x) {

                        x.disabled = true;

                        e = self.getRowElement(x);

                        if (e)
                            e.addClass("mj-disabled");
                    });
                }
            },

            disableById: function (id) {
                if (id == null)
                    return;

                var node = this.node_map[id];
                this.disable(node);
            },

            disableAt: function (n) {
                if (n == null || n < 0 || n >= this.nodes.length)
                    return;

                var node = this.nodes[n];
                this.disable(node);
            },

            //---------------------------------------------------------------------------------------------------------
            // checkbox functions         

            checkAll: function () {

                if (!this.settings.show_checkboxes)
                    return;

                $.each(this.node_map, function (index, node) { node.checked = 1; });

                this.$el.find(".mj-checkbox-box").addClass("checked").removeClass("half-ticked");
            },

            uncheckAll: function () {

                if (!this.settings.show_checkboxes)
                    return;

                $.each(this.node_map, function (index, node) { node.checked = 0; });

                this.$el.find(".mj-checkbox-box").removeClass("checked").removeClass("half-ticked");
            },

            check: function (node, check_parents) {

                var s = this.settings;

                var self = this;

                if (!node || !s.show_checkboxes)
                    return;

                // check all sublist checkboxes 

                var e = this.getRowElement(node);

                node.checked = 1;

                if (e)
                    e.find(".mj-checkbox-box").addClass("checked").removeClass("half-ticked");

                //var arr;

                if (s.recursive) {

                    // check the children

                    self.recurseChildren(node, function (x) {

                        x.checked = 1;

                        e = self.getRowElement(x);

                        if (e)
                            e.find(".mj-checkbox-box").addClass("checked").removeClass("half-ticked");
                    });

                    if (check_parents == true || check_parents == undefined) {

                        // check all parent checkboxes 

                        self.recurseParents(node, function (x) {

                            x.checked = 1;

                            e = self.getRowElement(x);

                            if (e)
                                e.find(".mj-checkbox-box").addClass("checked").removeClass("half-ticked");
                        });
                    }
                }
            },

            checkById: function (id) {

                if (id == null)
                    return;

                var node = this.node_map[id];
                this.check(node);
            },

            uncheck: function (node) {

                if (!node || !this.settings.show_checkboxes)
                    return;

                var self = this;

                var e = this.getRowElement(node);

                if (e)
                    e.find(".mj-checkbox-box").removeClass("checked").removeClass("half-ticked");

                node.checked = 0;

                // deselect children of this node
                // always do this, ignore settings.recursive, doesnt make sense to not deselect children

                // check the children of this node

                self.recurseChildren(node, function (x) {

                    x.checked = 0;

                    e = self.getRowElement(x);

                    if (e)
                        e.find(".mj-checkbox-box").removeClass("checked").removeClass("half-ticked");
                });
            },

            uncheckById: function (id) {

                if (id == null)
                    return;

                var node = this.node_map[id];
                this.uncheck(node);
            },

            checkAt: function (n) {

                if (n == null || n < 0 || n >= this.nodes.length)
                    return;

                this.check(this.nodes[n]);
            },

            uncheckAt: function (n) {

                if (n == null || n < 0 || n >= this.nodes.length)
                    return;

                this.uncheck(this.nodes[n]);
            },

            getChecked: function () {

                // return array of checked nodes
                // does not return half ticked

                var arr = [];

                $.each(this.nodes, function (index, node) {

                    if (node.checked == 1)
                        arr.push(node);
                });

                return arr;
            },

            getHalfTicked: function () {

                // return array of half checked nodes

                var arr = [];

                $.each(this.nodes, function (index, node) {

                    if (node.checked == 2)
                        arr.push(node);
                });

                return arr;
            },

            halfTick: function (node) {

                if (!node || !this.settings.show_checkboxes)
                    return;

                this.uncheck(node);       // uncheck child nodes

                node.checked = 2;

                var e = this.getRowElement(node);

                if (e)
                    e.find(".mj-checkbox-box").removeClass("checked").addClass("half-ticked");
            },

            halfTickById: function (id) {

                if (id == null)
                    return;

                var node = this.node_map[id];

                if (!node)
                    return;

                this.halfTick(node);
            },

            halfTickAt: function (n) {

                if (n == null || n < 0 || n >= this.nodes.length)
                    return;

                this.halfTick(this.nodes[n]);
            },

            halfTickAll: function () {

                if (!this.settings.show_checkboxes)
                    return;

                // dont call halfTick for every node, too slow

                $.each(this.node_map, function (index, node) { node.checked = 2; });

                this.$el.find(".mj-checkbox-box").removeClass("checked").addClass("half-ticked");
            },

            deselectHalfTicked: function () {

                if (!this.settings.show_checkboxes)
                    return;

                // dont call halfTick for every node, too slow
                // deselect all nodes which are half ticked

                $.each(this.node_map, function (index, node) {

                    if (node.checked == 2)
                        node.checked = 0;
                });

                this.$el.find(".mj-checkbox-box.half-ticked").removeClass("half-ticked");
            },

            //--------------------------------------------------------------------------
            // select functions

            select: function (node, e) {
                var s = this.settings;

                if (!node || s.show_checkboxes)
                    return;

                if (!s.multi_select)
                    this.deselectAll();

                node.selected = true;

                if (!e)
                    e = this.getRowElement(node);

                e.find(".mj-content").addClass("selected");
            },

            selectById: function (id) {

                if (id == null)
                    return;

                var node = this.node_map[id];
                this.select(node);
            },

            deselect: function (node, e) {

                var s = this.settings;

                if (!node || s.show_checkboxes)
                    return;

                node.selected = false;

                if (!e)
                    e = this.getRowElement(node);

                e.find(".mj-content").removeClass("selected");
            },

            deselectById: function (id) {

                if (id == null)
                    return;

                var node = this.node_map[id];
                this.deselect(node);
            },

            getSelected: function () {

                var arr = [];

                if (this.settings.show_checkboxes)
                    return arr;

                $.each(this.nodes, function (index, node) {

                    if (node.selected)
                        arr.push(node);
                });

                return arr;
            },

            selectAll: function () {

                if (this.settings.show_checkboxes)
                    return;

                $.each(this.node_map, function (index, node) { node.selected = true; });

                this.$el.find(".mj-content").addClass("selected");
            },

            deselectAll: function () {

                if (this.settings.show_checkboxes)
                    return;

                $.each(this.node_map, function (index, node) { node.selected = false; });

                this.$el.find(".mj-content").removeClass("selected");
            },

            selectAt: function (n) {

                if (n == null || n < 0 || n >= this.nodes.length)
                    return;

                this.select(this.nodes[n]);
            },

            deselectAt: function (n) {

                if (n == null || n < 0 || n >= this.nodes.length)
                    return;

                this.deselect(this.nodes[n]);
            },

            sort: function (callback) {

                var self = this;

                // local function

                function _sort(rows, callback) {

                    if (callback) {

                        rows.sort(function (a, b) { return callback(a, b); });
                    }
                    else {

                        var c = self.settings.columns[0].data_field;

                        // no callback function provided, compare text fields

                        rows.sort(function (a, b) {

                            // get the name of the 1st column

                            if (a[c].toLowerCase() > b[c].toLowerCase())
                                return 1;

                            if (a[c].toLowerCase() < b[c].toLowerCase())
                                return -1;

                            return 0;
                        });
                    }
                };

                // get a flat array of data in the current display order

                var arr = [];
                var visibility = [];

                $.each(this.nodes, function (index, o) {
                    arr.push(o.data);
                    visibility.push({ id: o.data[self.idf], visible: o.visible });
                });

                _sort(arr, callback);

                // toTree takes an array of data

                this._toTree(arr);

                $.each(visibility, function (index, x) {
                    self.node_map[x.id].visible = x.visible;
                });

                // flatten the data before display

                this._flattenTree();

                this._redraw();

                this._createScrollBars();
            },

            filter: function (val, callback) {

                var self = this;

                var s = this.settings;

                // mark each node as visible or not using the user supplied filter function

                if (!val || val == "" || (!s.filter && !callback)) {
                    $.each(this.nodes, function (i, node) { node.visible = true; });
                }
                else {
                    function _filter(val, tree) {
                        for (var node = tree; node; node = node.next) {
                            // if a callback was provided use that

                            if (callback)
                                node.visible = callback(node.data, val);
                            else
                                node.visible = s.filter(node.data, val);

                            if (node.visible) {
                                self.recurseParents(node, function (x) { x.visible = true; });
                                self.recurseChildren(node, function (x) { x.visible = true; });
                            }
                            else if (node.children) {
                                _filter(val, node.children);
                            }
                        }

                        return null;
                    }

                    _filter(val, this.tree);
                }

                this._flattenTree();

                this._redraw();                

                this._createScrollBars();                
            },

            //----------------------------------------------------------------------------------------------------
            // add, insert, update, remove

            insertRow: function (node, data) {

                // create a sibling node

                if (node == null || data == null)
                    return;

                var s = this.settings;

                // set the parent id field in the data

                data[this.pidf] = node.data[this.pidf];

                // if we are not showing checkboxes, not multi selecting and selected is true deselect everything 

                this._validateItem(data);

                if (!s.show_checkboxes && !s.multi_select && data.selected)
                    this.deselectAll();

                // create a new node

                var new_node = this._createNode(data);

                // add it to the node map

                this.node_map[data[this.idf]] = new_node;

                // add it to the nodes array

                var index = this.nodes.indexOf(node);

                if (index > -1)
                    this.nodes.splice(index, 0, new_node);

                // insert it into the tree

                if (node.prev) {
                    node.prev.next = new_node;
                    new_node.prev = node.prev;
                }

                new_node.next = node;
                new_node.parent = node.parent;

                if (node.parent) {
                    // node we are adding could be the new 1st child of its parent

                    if (node.parent.children == node)
                        node.parent.children = new_node;

                    // if the parent has been filtered (not visible) out dont add the new node to visible nodes and dont render it

                    if (node.parent.visible) {
                        var index = this.filtered.indexOf(node);

                        if (index > -1)
                            this.filtered.splice(index, 0, new_node);

                        var e = this.getRowElement(node);

                        if (e) {
                            var x = this._renderRow(new_node);
                            e.before(x);

                            var p = this.getRowElement(node.parent);

                            // the parent could be collapsed in which case we dont render the new row

                            if (p && !p.is(":visible"))
                                x.hide();

                            this._applyCSS();
                        }
                    }
                }
                else {
                    // there is no parent node

                    var index = this.filtered.indexOf(node);

                    if (index > -1)
                        this.filtered.splice(index, 0, new_node);

                    var e = this.getRowElement(node);

                    if (e) {
                        var x = this._renderRow(new_node);
                        e.before(x);

                        var p = this.getRowElement(node.parent);

                        // the parent could be collapsed in which case we dont render the new row

                        if (p && !p.is(":visible"))
                            x.hide();

                        this._applyCSS();
                    }
                }

                this._createScrollBars();
            },

            insertRowById: function (id, data) {
                var node = this.node_map[id];
                this.insertRow(node, data);
            },

            addRow: function (node, data) {

                // create a sibling node

                if (node == null || data == null)
                    return;

                var last_root_node = this._getLastRootNode();

                if (node == last_root_node) {
                    this.addRootNode(data);
                    return;
                }

                var s = this.settings;

                this._validateItem(data);

                // if we are not showing checkboxes, not multi selecting and selected is true deselect everything 

                if (!s.show_checkboxes && !s.multi_select && data.selected)
                    this.deselectAll();

                // create a new node

                var new_node = this._createNode(data);

                // add it to the node map

                this.node_map[data[this.idf]] = new_node;

                // add to nodes array

                var index;

                if (node.next) {
                    // get the next sibling and add it before

                    index = this.nodes.indexOf(node.next);

                    if (index > -1)
                        this.nodes.splice(index, 0, new_node);

                    // either there is no parent or there is a parent and the parent is visible

                    if (!node.parent || (node.parent && node.parent.visible)) {
                        var index = this.filtered.indexOf(node.next);

                        if (index > -1) {
                            this.filtered.splice(index, 0, new_node);

                            var e = this.getRowElement(node.next);

                            if (e) {
                                // insert it into the tree

                                new_node.prev = node;
                                new_node.next = node.next;
                                new_node.parent = node.parent;
                                node.next = new_node;

                                var x = this._renderRow(new_node);
                                e.before(x);

                                // the parent could be collapsed

                                var p = this.getRowElement(node.parent);

                                if (p && !p.is(":visible"))
                                    x.hide();

                                this._applyCSS();
                            }
                        }
                    }
                }
                else {
                    // no sibling, add it after the node

                    index = this.nodes.indexOf(node);

                    if (index > -1)
                        this.nodes.splice(index + 1, 0, new_node);

                    // either there is no parent or there is a parent and the parent is visible 

                    if (!node.parent || (node.parent && node.parent.visible)) {
                        var index = this.filtered.indexOf(node);

                        if (index > -1) {
                            this.filtered.splice(index + 1, 0, new_node);

                            var e = this.getRowElement(node);

                            if (e) {
                                // insert it into the tree

                                new_node.prev = node;
                                new_node.next = node.next;
                                new_node.parent = node.parent;
                                node.next = new_node;

                                var x = this._renderRow(new_node);
                                e.after(x);

                                // the parent could be collapsed

                                var p = this.getRowElement(node.parent);

                                if (p && !p.is(":visible"))
                                    x.hide();

                                this._applyCSS();
                            }
                        }
                    }
                }

                this._createScrollBars();
            },

            addRowById: function (id, data) {
                var node = this.node_map[id];
                this.addRow(node, data);
            },

            addRootNode: function (data) {

                if (data == null)
                    return;

                var s = this.settings;

                this._validateItem(data);

                // if we are not showing checkboxes, not multi selecting and selected is true deselect everything 

                if (!s.show_checkboxes && !s.multi_select && data.selected)
                    this.deselectAll();

                // its a root node so by definition it has no parent

                data[this.pidf] = null;

                // create a new node

                var new_node = this._createNode(data);

                // add it to the node map

                this.node_map[data[this.idf]] = new_node;

                // find the last root node in the tree

                var last_root_node = this._getLastRootNode();

                if (last_root_node) {
                    last_root_node.next = new_node;
                    new_node.prev = last_root_node;
                }
                else {
                    this.tree = new_node;
                }

                this.nodes.push(new_node);

                this.filtered.push(new_node);

                var x = this._renderRow(new_node);

                var e = this.$el.find(".mj-root");

                e.append(x);

                this._createScrollBars();
            },

            addChild: function (node, data) {

                var s = this.settings;

                if (!node || !data)
                    return;

                this._validateItem(data);

                // if we are not showing checkboxes, not multi selecting and selected is true deselect everything 

                if (!s.show_checkboxes && !s.multi_select && data.selected)
                    this.deselectAll();

                var new_node = this._createNode(data);

                // add it to the node map

                this.node_map[data[this.idf]] = new_node;

                // set the parent id field in the data

                data[this.pidf] = node.data[this.idf];

                // insert the new node in the tree

                new_node.parent = node;

                if (node.children)
                    new_node.next = node.children;

                node.children = new_node;

                var index = this.nodes.indexOf(node);

                if (index > -1)
                    this.nodes.splice(index + 1, 0, new_node);

                if (node.visible) {
                    // node has not been filtered out

                    var index = this.filtered.indexOf(node);

                    if (index > -1)
                        this.filtered.splice(index + 1, 0, new_node);

                    // render time                      

                    var e = this.getRowElement(node);

                    if (e) {
                        // the node may be collapsed

                        var visible = e.is(":visible");

                        var x = this._renderRow(new_node);
                        e.after(x);

                        if (!visible)
                            x.hide();

                        // need to rerender the parent node we are adding a child into to get the expander

                        x = this._renderRow(node);
                        e.replaceWith(x);


                        this._applyCSS();
                    }
                }

                this._createScrollBars();
            },

            addChildById: function (id, data) {
                var node = this.node_map[id];
                this.addChild(node, data);
            },

            updateRow: function (node, data) {

                // update a nodes data

                if (node == null || data == null)
                    return;

                var s = this.settings;

                this._validateItem(data);

                // if we are not showing checkboxes, not multi selecting and selected is true deselect everything 

                if (!s.show_checkboxes && !s.multi_select && data.selected)
                    this.deselectAll();

                // we dont allow update of the id, parent id field or expanded fields

                data[this.idf] = node.data[this.idf];
                data[this.pidf] = node.data[this.pidf];

                if (data.checked != undefined)
                    node.checked = data.checked;

                if (data.selected != undefined)
                    node.selected = data.selected;

                if (data.disabled != undefined)
                    node.disabled = data.disabled;

                if (data.expanded != undefined)
                    node.expanded = data.expanded;

                // change the data

                node.data = data;

                if (node.visible) {
                    var e = this.getRowElement(node);

                    if (e) {
                        // the row may be collapsed

                        var visible = e.is(":visible");

                        var x = this._renderRow(node);
                        e.replaceWith(x);

                        if (!visible)
                            e.hide();

                        this._applyCSS();
                    }
                }

                this._createScrollBars();
            },

            updateRowById: function (id, data) {

                var node = this.node_map[id];

                this.updateRow(node, data);
            },

            removeRow: function (node) {

                var self = this;

                if (!node)
                    return;

                if (this.tree == node)
                    this.tree = node.next;

                delete this.node_map[node.data[self.idf]];     // delete from node map

                // delete from nodes

                var index = mjcore.findIndex(this.nodes, function (x) { return node == x; });

                if (index > -1)
                    this.nodes.splice(index, 1);

                // delete from visible nodes

                var index = mjcore.findIndex(this.filtered, function (x) { return node == x; });

                if (index > -1)
                    this.filtered.splice(index, 1);

                var e = this.getRowElement(node);

                if (e) {
                    e.data("d", null);
                    e.children().off();
                    e.remove();
                }

                // get the child nodes

                var children = [];

                this.recurseChildren(node, function (x) { children.push(x); });

                $.each(children, function (index, x) {

                    // delete from node map

                    delete self.node_map[x.data[self.idf]];

                    // delete from nodes

                    index = mjcore.findIndex(self.nodes, function (y) { return x == y; });

                    if (index > -1)
                        self.nodes.splice(index, 1);

                    // delete from filtered_nodes

                    index = mjcore.findIndex(self.filtered, function (y) { return x == y; });

                    if (index > -1)
                        self.filtered.splice(index, 1);

                    e = self.getRowElement(x);

                    if (e) {
                        e.data("d", null);
                        e.children().off();
                        e.remove();
                    }
                });

                // remove from tree

                if (node.prev)
                    node.prev.next = node.next;

                if (node.next)
                    node.next.prev = node.prev;

                if (node.parent) {
                    // if the node we are deleting is the 1st child of its parent
                    // set the first child of the parent to the nodes next sibling

                    if (node.parent.children == node)
                        node.parent.children = node.next;
                }

                this._createScrollBars();

                this._applyCSS();
            },

            removeRowById: function (id) {

                var node = this.node_map[id];

                this.removeRow(node);
            },

            //------------------------------------------------------------------------------------
            // expand collapse functions

            expand: function (node) {

                // in virtual mode the row may or may not be visible

                var self = this;

                if (!node)
                    return;

                if (!node.children)             // node has no children
                    return;

                node.expanded = true;     // mark the node as expanded even if the element is not present in the table

                var e = this.getRowElement(node);

                if (!e)             // row element does not exist in the table
                    return;

                var expander = e.find(".mj-expander");

                if (!expander)
                    return;

                // show immediate children and childrens children if expanded

                for (var x = node.children; x; x = x.next) {
                    var e = this.getRowElement(x);

                    if (e)
                        e.show();

                    // if the child is expanded show it, recursive

                    if (x.expanded)
                        this.expand(x);
                }

                expander.removeClass("mj-closed").addClass("mj-open");

                this._createScrollBars();
            },

            expandById: function (id) {

                if (id == null)
                    return null;

                // in virtual mode the row may or may not be visible

                var node = this.node_map[id];
                this.expand(node);
            },

            collapse: function (node) {

                var self = this;

                if (!node)
                    return;

                node.expanded = false;

                var e = this.getRowElement(node);

                if (!e)             // row element does not exist in the table
                    return;

                var expander = e.find(".mj-expander");

                if (!expander)
                    return;

                // hide all children
                // dont collapse children just hide them     

                this.recurseChildren(node, function (x) {

                    var e = self.getRowElement(x);

                    if (e)
                        e.hide();
                });

                expander.removeClass("mj-open").addClass("mj-closed");

                this._createScrollBars();
            },

            collapseById: function (id) {

                if (id == null)
                    return null;

                var node = this.node_map[id];
                this.collapse(node);
            },

            expandAll: function () {

                var self = this;

                $.each(this.node_map, function (i, node) {

                    if (node.children)
                        self.expand(node);
                });
            },

            collapseAll: function () {

                var self = this;

                $.each(this.node_map, function (i, node) {

                    if (node.children)
                        self.collapse(node);
                });
            },

            getExpanded: function () {

                var arr = [];

                $.each(this.nodes, function (index, node) {

                    if (node.expanded)
                        arr.push(node);
                });

                return arr;
            },

            //--------------------------------------------------------------------

            /*
            saveState: function () {

                // save the state of the list

                var self = this;

                this.original_data = [];

                var items = this.toArrayDataOnly();

                $.each(items, function (index, o) {
                    self.original_data.push({ checked: o.checked, selected: o.selected });
                });
            },

            hasChanged: function () {

                var items = this.toArrayDataOnly();

                var len1 = items.length;
                var len2 = this.original_data.length;

                if (len1 != len2)       // rows were added or deleted
                    return true;

                for (var i = 0; i < len1; i++) {

                    var a = items[i];
                    var b = this.original_data[i];

                    // if new state is undefined dont count it as a change

                    if (a.checked != b.checked || a.selected != b.selected)
                        return true;
                }

                return false;
            },
            */

            close: function () {

                // dont clear the data
                // important to turn off events

                this._stopListening();
                this.$el.data(this, 'mj-treegrid-data', null);
                this.$el.html("");

                //this._reset();
            },

            isRowVisible: function(node)
            {
                if (!node)
                    return false;

                var e = this.getRowElement(node);

                if (!e)
                    return false;

                // if there are parents and any parent is not expanded return false                

                while (node.parent)
                {
                    node = node.parent;

                    if (!node.expanded)
                        return false;
                }

                // row element exists and no parent is collapsed
                // is the row within the window
                
                var h = this.$el.height();

                var pos = e.position();
                var offset = e.offset();

                var scrolltop = this.$el.find(".mj-treegrid-container").scrollTop();

                var res = (pos.top < scrolltop + h && pos.top > 0);

                return res;
            },

            isRowVisibleById: function (id) {

                if (id == null)
                    return false;

                var node = this.node_map[id];

                return this.isRowVisible(node);
            },

            scrollToRow: function (node, animate) {

                if (!node)
                    return;

                var s = this.settings;

                this.scrollable_start = this.scrollable.indexOf(node);

                if (this.scrollable_start == -1)
                    this.scrollable_start = 0;

                if (s.virtual_mode)
                {                   
                    //var o = node;

                    //// if any parent is not expanded the row is not visible

                    //while (o.parent) {
                    //    o = o.parent;

                    //    if (!o.expanded)
                    //        return;
                    //}

                    var index = this.filtered.indexOf(node);

                    if (index == -1)        // node does not exist or has been filtered out
                        return;

                    this.filtered_start = index;

                    this._redraw();
                }
                else
                {
                    //var o = node;

                    //// if any parent is not expanded the row is not visible

                    //while (o.parent) {
                    //    o = o.parent;

                    //    if (!o.expanded)
                    //        return;
                    //}

                    var e = this.getRowElement(node);

                    // need to use position rather than offset

                    if (e) {
                        var top = e.position().top;

                        var scrolltop = this.$el.find(".mj-treegrid-container").scrollTop();

                        top = scrolltop + top;

                        if (animate)
                            this.$el.find(".mj-treegrid-container").animate({ scrollTop: top }, 300);
                        else
                            this.$el.find(".mj-treegrid-container").scrollTop(top);
                    }
                }

                this.$el.trigger("mjScrollChange", this.scrollable_start);
            },

            scrollToRowById: function (id, animate) {

                if (id == null)
                    return;

                var self = this;

                var n = mjcore.findIndex(this.scrollable, function (x) {

                    if (x[self.idf] == id)
                        return true;
                });

                if (n == -1)
                    return;

                var node = this.scrollable[n];

                this.scrollToRow(node, animate);
            },

            scrollToRowByIndex: function (n, animate) {

                if (n == null || n < 0 || n >= this.scrollable.length)
                    return;

                var node = this.scrollable[n];

                this.scrollToRow(node, animate);
            },

            getRootRow: function (node) {

                if (!node)
                    return null;

                while (node.parent)
                    node = node.parent;

                return node;
            },

            getRootRowById: function (id) {

                if (id == null)
                    return null;

                var node = this.node_map[id];

                return this.getRootRow(node);
            },
        };

        $.fn.mjTreeGrid = function (options) {

            // options is empty or an object
            // within a plugin use this not $(this)
            // check that element exists using this.length

            if (!this.length) {

                mjcore.mjError("mjTreeGrid: the html element to attach to '" + this.selector + "' does not exist");

                return null;
            }

            if (mjTreeGrid[options]) {

                // called a function in mjTreeGrid, if no data attached object has not been created yet

                var q = $(this).data('mj-treegrid-data');

                if (q)
                    return q[options].apply(q, Array.prototype.slice.call(arguments, 1));
            }
            else if (!options || typeof options === 'object') {

                // return is for chainability, dont have to return anything
                // if the selector was multiply defined you would be creating plugin for each selector

                return this.each(function () {

                    var treegrid = Object.create(mjTreeGrid);

                    treegrid.init(options, this);

                    $.data(this, 'mj-treegrid-data', treegrid);
                });

                // to call a function:

                // $('#my-dom-element').mjTreeGrid("check", 99);

                // another way to call a function:

                //var myTreeview = $('#my-dom-element').data('mj-treegrid-data');
                //myTreeview.check(id);
            }
            else {

                // method does not exist

                mjcore.mjError("Method '" + options + "' does not exist on mjTreeGrid");
            }
        };
    })(jQuery);

});
var mjcore = {

    MJ_VERTICAL_SCROLLBAR_WIDTH: 16,
    MJ_HORIZONTAL_SCROLLBAR_HEIGHT: 16,

    debug: function(msg) {
    
        if (window.console) {
            try { console.log(msg); } catch (e) { }
        }
    },

    mjError: function(msg) {

        if (window.console) {
            try { console.log(msg); } catch (e) { }
        }
    },

    isEmpty: function(val)
    {
        return (val === null || val === undefined);

        // same as return (val == null);  since null == undefined in javascript
    },

    generateId: function () {
        // Number.MAX_SAFE_INTEGER not supported in IE

        MAX_SAFE_INTEGER = 9007199254740991;

        return Math.floor(Math.random() * MAX_SAFE_INTEGER);
    },

    clone: function(o)
    {
        return $.extend({}, o);
    },

    isInt: function (val) {

        if (this.isEmpty(val))
            return false;

        var intRegex = /^[-+]?\d+$/;

        return intRegex.test(val);

        // Note: parseInt(12.5) return 12

        //return isNaN(parseInt(val));      parseInt(12.3) = 12
    },

    isNumber: function(val) {

        return !isNaN(val);
    },

    isHex: function(val) {

        if (!val)
            return false;

        // does not include # character

        var hexRegex = /(^[0-9A-F]{6}$)|(^[0-9A-F]{3}$)/i;

        return hexRegex.test(val);
    },

    validate: function (val, subs, default_val) {

        // value must in the list of substitutions

        for (var i = 0; i < subs.length; i++) {

            if (val == subs[i].val || String(val) == String(subs[i].val))
                return subs[i].to;
        }

        return default_val;
    },

    validateInt: function (val, valid_values, default_value) {

        //if (this.isEmpty(default_value))
        //    default_value = 0;

        //if (this.isEmpty(val))
        //    return default_value;

        if (!this.isInt(val))
            return default_value;

        if (valid_values && valid_values.length > 0) {

            if (valid_values.indexOf(val) == -1)
                return default_value;
        }

        return parseInt(val, 10);
    },

    validateFloat: function (val, default_value) {

        if (this.isEmpty(default_value))
            default_value = 0;

        if (this.isEmpty(val))
            return default_value;

        var val = parseFloat(val);

        if (isNaN(val))
            return default_value;

        return val;
    },

    validateString: function (val, valid_values, default_value) {

        if (this.isEmpty(default_value))
            default_value = "";

        if (this.isEmpty(val))
            return default_value;

        if (valid_values && valid_values.length > 0) {

            if (valid_values.indexOf(val) == -1)
                return default_value;
        }

        return val;
    },

    validateBool: function (val, default_value) {

        if (this.isEmpty(default_value))
            default_value = false;

        // allow string values

        if (val == "true" || val == "TRUE")
            return true;

        if (val == "false" || val == "FALSE")
            return false;

        if (val != true && val != false)
            return default_value;

        return val;
    },

    getBrowserName: function () {

        var s = navigator.userAgent.toLowerCase();

        // ok, its not a tablet or a phone, just return browser name

        if (s.indexOf("firefox") > -1)
            return "firefox";

        if (s.indexOf("chrome") > -1)
            return "chrome";

        if (s.indexOf("msie") > -1)
            return "msie";

        if (s.indexOf("trident") > -1)      // dont search for windows as safari user agent string contains the word window
            return "msie";

        if (s.indexOf("safari") > -1)
            return "safari";

        if (s.indexOf("opera") > -1)
            return "opera";

        return "unknown";
    },

    isTouchScreen: function () {

        // see: http://stackoverflow.com/questions/4817029/whats-the-best-way-to-detect-a-touch-screen-device-using-javascript

        //return (('ontouchstart' in window) || (navigator.msMaxTouchPoints > 0));

        //return typeof window.ontouchstart !== 'undefined';

        var deviceAgent = navigator.userAgent.toLowerCase();

        var isTouchDevice = ('ontouchstart' in document.documentElement) ||
        (deviceAgent.match(/(iphone|ipod|ipad)/) ||
        deviceAgent.match(/(android)/) ||
        deviceAgent.match(/(iemobile)/) ||
        deviceAgent.match(/iphone/i) ||
        deviceAgent.match(/ipad/i) ||
        deviceAgent.match(/ipod/i) ||
        deviceAgent.match(/blackberry/i) ||
        deviceAgent.match(/bada/i));

        return isTouchDevice;
    },

    findIndex: function (arr, f) {

        // find index of 1st occurance of an item in an array which satisfies a predicate, return -1 if not found

        if (!arr || !f)
            return -1;

        for (var i = 0, len = arr.length; i < len; i++) {

            if (f(arr[i]))
                return i;
        }

        return -1;
    },

    find: function (arr, f) {

        // find index of 1st occurance of an item in an array which satisfies a predicate, return the object
        // similar to underscore.js find

        if (!arr || !f)
            return null;

        for (var i = 0, len = arr.length; i < len; i++) {

            if (f(arr[i]))
                return arr[i];
        }

        return null;
    },

    htmlEncode: function (str) {
        return String(str)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
    },


    htmlDecode: function (value) {
        return String(value)
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&');
    },

    // http://www.i-programmer.info/programming/javascript/1504-j.html

    mjCollection: function(arr)
    {
        this.collection = {};

        this.add = function (key, item) {
            if (this.collection[key] != undefined)  // if it already exists dont add it
                return undefined;
            this.collection[key] = item;
        }

        this.remove = function (key) {
            if (this.collection[key] == undefined)
                return undefined;
            delete this.collection[key];
        }

        this.reset = function (arr) {
            this.collection = {};

            if (arr != undefined) {
                for (var o in arr) {
                    if (arr[o].id != undefined)
                        this.add(arr[o].id, arr[o]);
                }
            }
        }

        this.get = function (key) {
            return this.collection[key];
        }

        this.set = function (key, item) {
            this.collection[key] = item;
        }

        this.forEach = function (block) {
            for (key in this.collection) {
                if (this.collection.hasOwnProperty(key)) {
                    block(this.collection[key]);
                }
            }
        }

        this.reset(arr);

        //var myCol = new Collection();
        //myCol.add("A", 0);
        //myCol.add("B", 1);
        //myCol.add("C", 2);
        //alert(myCol.count);

        //for(index in myCol)
        //{
        //    alert(myCol[index]);
        //}
        //for (index in myCol.collection)
        //{
        //    alert(myCol.item(index));
        //}
    }
}


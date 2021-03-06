/* jshint ignore:start */
;(function(BEM) {
    BEM.MODEL._utils = {
        objects: getObjects(),
        functions: getFunctions(),
        inherit: getInherit(),
        observable: getObservable(getIdentify(), getInherit(), getFunctions()),
        identify: getIdentify(),
        throttle: getThrottle(),
        debounce: getDebounce()
    };

    var hasOwnProp = Object.prototype.hasOwnProperty;

    function getObjects() {
        // © bem-core/common.blocks/objects/objects.vanilla.js
        return {
            extend: function(target, source) {
                (typeof target !== 'object' || target === null) && (target = {});

                for(var i = 1, len = arguments.length; i < len; i++) {
                    var obj = arguments[i];
                    if(obj) {
                        for(var key in obj) {
                            hasOwnProp.call(obj, key) && (target[key] = obj[key]);
                        }
                    }
                }

                return target;
            },
            isEmpty : function(obj) {
                for(var key in obj) {
                    if(hasOwnProp.call(obj, key)) {
                        return false;
                    }
                }

                return true;
            },
            each: function(obj, fn, ctx) {
                for(var key in obj) {
                    if(hasOwnProp.call(obj, key)) {
                        ctx? fn.call(ctx, obj[key], key) : fn(obj[key], key);
                    }
                }
            }
        };
    }

    function getFunctions( ) {
        return {
            isFunction: function(obj) {
                return Object.prototype.toString.call(obj) === '[object Function]';
            }
        }
    }

    function getInherit() {

        var hasIntrospection = (function(){ '_';}).toString().indexOf('_') > -1,
            emptyBase = function() {},
            objCreate = Object.create || function(ptp) {
                    var inheritance = function() {};
                    inheritance.prototype = ptp;
                    return new inheritance();
                },
            objKeys = Object.keys || function(obj) {
                    var res = [];
                    for(var i in obj) {
                        obj.hasOwnProperty(i) && res.push(i);
                    }
                    return res;
                },
            extend = function(o1, o2) {
                for(var i in o2) {
                    o2.hasOwnProperty(i) && (o1[i] = o2[i]);
                }

                return o1;
            },
            toStr = Object.prototype.toString,
            isArray = Array.isArray || function(obj) {
                    return toStr.call(obj) === '[object Array]';
                },
            isFunction = function(obj) {
                return toStr.call(obj) === '[object Function]';
            },
            noOp = function() {},
            needCheckProps = true,
            testPropObj = { toString : '' };

        for(var i in testPropObj) { // fucking ie hasn't toString, valueOf in for
            testPropObj.hasOwnProperty(i) && (needCheckProps = false);
        }

        var specProps = needCheckProps? ['toString', 'valueOf'] : null;

        function getPropList(obj) {
            var res = objKeys(obj);
            if(needCheckProps) {
                var specProp, i = 0;
                while(specProp = specProps[i++]) {
                    obj.hasOwnProperty(specProp) && res.push(specProp);
                }
            }

            return res;
        }

        function override(base, res, add) {
            var addList = getPropList(add),
                j = 0, len = addList.length,
                name, prop;
            while(j < len) {
                if((name = addList[j++]) === '__self') {
                    continue;
                }
                prop = add[name];
                if(isFunction(prop) &&
                    (!hasIntrospection || prop.toString().indexOf('.__base') > -1)) {
                    res[name] = (function(name, prop) {
                        var baseMethod = base[name] || noOp;
                        return function() {
                            var baseSaved = this.__base;
                            this.__base = baseMethod;
                            var res = prop.apply(this, arguments);
                            this.__base = baseSaved;
                            return res;
                        };
                    })(name, prop);
                } else {
                    res[name] = prop;
                }
            }
        }

        function applyMixins(mixins, res) {
            var i = 1, mixin;
            while(mixin = mixins[i++]) {
                res?
                    isFunction(mixin)?
                        inherit.self(res, mixin.prototype, mixin) :
                        inherit.self(res, mixin) :
                    res = isFunction(mixin)?
                        inherit(mixins[0], mixin.prototype, mixin) :
                        inherit(mixins[0], mixin);
            }
            return res || mixins[0];
        }

        var inherit = function() {
            var args = arguments,
                withMixins = isArray(args[0]),
                hasBase = withMixins || isFunction(args[0]),
                base = hasBase? withMixins? applyMixins(args[0]) : args[0] : emptyBase,
                props = args[hasBase? 1 : 0] || {},
                staticProps = args[hasBase? 2 : 1],
                res = props.__constructor || (hasBase && base.prototype.__constructor)?
                    function() {
                        return this.__constructor.apply(this, arguments);
                    } :
                    function() {};

            if(!hasBase) {
                res.prototype = props;
                res.prototype.__self = res.prototype.constructor = res;
                return extend(res, staticProps);
            }

            extend(res, base);

            var basePtp = base.prototype,
                resPtp = res.prototype = objCreate(basePtp);

            resPtp.__self = resPtp.constructor = res;

            props && override(basePtp, resPtp, props);
            staticProps && override(base, res, staticProps);

            return res;
        };

        inherit.self = function() {
            var args = arguments,
                withMixins = isArray(args[0]),
                base = withMixins? applyMixins(args[0], args[0][0]) : args[0],
                props = args[1],
                staticProps = args[2],
                basePtp = base.prototype;

            props && override(basePtp, basePtp, props);
            staticProps && override(base, base, staticProps);

            return base;
        };

        return inherit;

    }

    function getIdentify() {
        var counter = 0,
            expando = '__' + (+new Date),
            get = function() {
                return 'uniq' + (++counter);
            };


        /**
         * Makes unique ID
         * @exports
         * @param {Object} obj Object that needs to be identified
         * @param {Boolean} [onlyGet=false] Return a unique value only if it had already been assigned before
         * @returns {String} ID
         */
        return function(obj, onlyGet) {
            if(!obj) return get();

            var key = 'uniqueID' in obj? 'uniqueID' : expando; // Use when possible native uniqueID for elements in IE

            return onlyGet || key in obj?
                obj[key] :
                obj[key] = get();
        };
    }

    function getObservable(identify, inherit, functions) {
        var undef,
            storageExpando = '__' + (+new Date) + 'storage',
            getFnId = function(fn, ctx) {
                return identify(fn) + (ctx? identify(ctx) : '');
            },

            /**
             * @class Event
             * @exports events:Event
             */
            Event = inherit(/** @lends Event.prototype */{
                /**
                 * @constructor
                 * @param {String} type
                 * @param {Object} target
                 */
                __constructor : function(type, target) {
                    /**
                     * Type
                     * @member {String} Event
                     */
                    this.type = type;

                    /**
                     * Target
                     * @member {String} Event
                     */
                    this.target = target;

                    /**
                     * Result
                     * @member {*}
                     */
                    this.result = undef;

                    /**
                     * Data
                     * @member {*}
                     */
                    this.data = undef;

                    this._isDefaultPrevented = false;
                    this._isPropagationStopped = false;
                },

                /**
                 * Prevents default action
                 */
                preventDefault : function() {
                    this._isDefaultPrevented = true;
                },

                /**
                 * Returns whether is default action prevented
                 * @returns {Boolean}
                 */
                isDefaultPrevented : function() {
                    return this._isDefaultPrevented;
                },

                /**
                 * Stops propagation
                 */
                stopPropagation : function() {
                    this._isPropagationStopped = true;
                },

                /**
                 * Returns whether is propagation stopped
                 * @returns {Boolean}
                 */
                isPropagationStopped : function() {
                    return this._isPropagationStopped;
                }
            }),

            /**
             * @lends Emitter
             * @lends Emitter.prototype
             */
            EmitterProps = {
                /**
                 * Adds an event handler
                 * @param {String} e Event type
                 * @param {Object} [data] Additional data that the handler gets as e.data
                 * @param {Function} fn Handler
                 * @param {Object} [ctx] Handler context
                 * @returns {this}
                 */
                on : function(e, data, fn, ctx, _special) {
                    if(typeof e === 'string') {
                        if(functions.isFunction(data)) {
                            ctx = fn;
                            fn = data;
                            data = undef;
                        }

                        var id = getFnId(fn, ctx),
                            storage = this[storageExpando] || (this[storageExpando] = {}),
                            eventTypes = e.split(' '), eventType,
                            i = 0, list, item,
                            eventStorage;

                        while(eventType = eventTypes[i++]) {
                            eventStorage = storage[eventType] || (storage[eventType] = { ids : {}, list : {} });
                            if(!(id in eventStorage.ids)) {
                                list = eventStorage.list;
                                item = { fn : fn, data : data, ctx : ctx, special : _special };
                                if(list.last) {
                                    list.last.next = item;
                                    item.prev = list.last;
                                } else {
                                    list.first = item;
                                }
                                eventStorage.ids[id] = list.last = item;
                            }
                        }
                    } else {
                        for(var key in e) {
                            e.hasOwnProperty(key) && this.on(key, e[key], data, _special);
                        }
                    }

                    return this;
                },

                /**
                 * Adds a one time handler for the event.
                 * Handler is executed only the next time the event is fired, after which it is removed.
                 * @param {String} e Event type
                 * @param {Object} [data] Additional data that the handler gets as e.data
                 * @param {Function} fn Handler
                 * @param {Object} [ctx] Handler context
                 * @returns {this}
                 */
                once : function(e, data, fn, ctx) {
                    return this.on(e, data, fn, ctx, { once : true });
                },

                /**
                 * Removes event handler or handlers
                 * @param {String} [e] Event type
                 * @param {Function} [fn] Handler
                 * @param {Object} [ctx] Handler context
                 * @returns {this}
                 */
                un : function(e, fn, ctx) {
                    if(typeof e === 'string' || typeof e === 'undefined') {
                        var storage = this[storageExpando];
                        if(storage) {
                            if(e) { // if event type was passed
                                var eventTypes = e.split(' '),
                                    i = 0, eventStorage;
                                while(e = eventTypes[i++]) {
                                    if(eventStorage = storage[e]) {
                                        if(fn) {  // if specific handler was passed
                                            var id = getFnId(fn, ctx),
                                                ids = eventStorage.ids;
                                            if(id in ids) {
                                                var list = eventStorage.list,
                                                    item = ids[id],
                                                    prev = item.prev,
                                                    next = item.next;

                                                if(prev) {
                                                    prev.next = next;
                                                } else if(item === list.first) {
                                                    list.first = next;
                                                }

                                                if(next) {
                                                    next.prev = prev;
                                                } else if(item === list.last) {
                                                    list.last = prev;
                                                }

                                                delete ids[id];
                                            }
                                        } else {
                                            delete this[storageExpando][e];
                                        }
                                    }
                                }
                            } else {
                                delete this[storageExpando];
                            }
                        }
                    } else {
                        for(var key in e) {
                            e.hasOwnProperty(key) && this.un(key, e[key], fn);
                        }
                    }

                    return this;
                },

                /**
                 * Fires event handlers
                 * @param {String|events:Event} e Event
                 * @param {Object} [data] Additional data
                 * @returns {this}
                 */
                emit : function(e, data) {
                    var storage = this[storageExpando],
                        eventInstantiated = false;

                    if(storage) {
                        var eventTypes = [typeof e === 'string'? e : e.type, '*'],
                            i = 0, eventType, eventStorage;
                        while(eventType = eventTypes[i++]) {
                            if(eventStorage = storage[eventType]) {
                                var item = eventStorage.list.first,
                                    lastItem = eventStorage.list.last,
                                    res;
                                while(item) {
                                    if(!eventInstantiated) { // instantiate Event only on demand
                                        eventInstantiated = true;
                                        typeof e === 'string' && (e = new Event(e));
                                        e.target || (e.target = this);
                                    }

                                    e.data = item.data;
                                    res = item.fn.apply(item.ctx || this, arguments);
                                    if(typeof res !== 'undefined') {
                                        e.result = res;
                                        if(res === false) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }
                                    }

                                    item.special && item.special.once &&
                                    this.un(e.type, item.fn, item.ctx);

                                    if(item === lastItem) {
                                        break;
                                    }

                                    item = item.next;
                                }
                            }
                        }
                    }

                    return this;
                },

                /**
                 * Fires event handlers
                 * @deprecated use emit
                 * @param {String|events:Event} e Event
                 * @param {Object} [data] Additional data
                 * @returns {this}
                 */
                trigger : function(e, data) {
                    return this.emit(e, data);
                },

                /**
                 * Adds a one time handler for the event.
                 * Handler is executed only the next time the event is fired, after which it is removed.
                 * @deprecated use once
                 * @param {String} e Event type
                 * @param {Object} [data] Additional data that the handler gets as e.data
                 * @param {Function} fn Handler
                 * @param {Object} [ctx] Handler context
                 * @returns {this}
                 */
                onFirst : function(e, data, fn, ctx) {
                    return this.once(e, data, fn, ctx);
                }
            },
            /**
             * @class Emitter
             * @exports events:Emitter
             */
            Emitter = inherit(
                EmitterProps,
                EmitterProps);

        return Emitter;
    }

    function getThrottle() {
        return function(fn, timeout, invokeAsap, ctx) {
            var typeofInvokeAsap = typeof invokeAsap;
            if(typeofInvokeAsap === 'undefined') {
                invokeAsap = true;
            } else if(arguments.length === 3 && typeofInvokeAsap !== 'boolean') {
                ctx = invokeAsap;
                invokeAsap = true;
            }

            var timer, args, needInvoke,
                wrapper = function() {
                    if(needInvoke) {
                        fn.apply(ctx, args);
                        needInvoke = false;
                        timer = global.setTimeout(wrapper, timeout);
                    } else {
                        timer = null;
                    }
                };

            return function() {
                args = arguments;
                ctx || (ctx = this);
                needInvoke = true;

                if(!timer) {
                    invokeAsap?
                        wrapper() :
                        timer = global.setTimeout(wrapper, timeout);
                }
            };
        }
    }

    function getDebounce() {
        return function(fn, timeout, invokeAsap, ctx) {
            if(arguments.length === 3 && typeof invokeAsap !== 'boolean') {
                ctx = invokeAsap;
                invokeAsap = false;
            }

            var timer;
            return function() {
                var args = arguments;
                ctx || (ctx = this);

                invokeAsap && !timer && fn.apply(ctx, args);

                global.clearTimeout(timer);

                timer = global.setTimeout(function() {
                    invokeAsap || fn.apply(ctx, args);
                    timer = null;
                }, timeout);
            };
        }
    }
})(BEM);
/* jshint ignore:end */

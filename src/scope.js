/* jshint globalstrict: true */
"use strict";

function $RootScopeProvider() {

    var TTL = 10;

    this.digestTtl = function(value) {
        if(_.isNumber(value)) {
            TTL = value;
        }
        return TTL;
    };

    this.$get = ["$parse", function($parse) {

        function Scope() {
            // TODO: define the uid for scope
            this.$$watchers = [];
            this.$$lastDirtyWatch = null;
            this.$$asyncQueue = [];
            this.$$phase = null;
            this.$$postDigestQueue = [];
            // in real angular, the children are organized in a linked list
            // using $$nextSibling, $$prevSibling, $$childHead and $$childTail
            this.$$children = [];
            this.$$root = this;
            this.$$listeners = {};

            // TODO: define the isolated bindings and apply async queue
        }

        // to make sure the value 'last' is not equal to any other value
        // in order let the listener function been invoked in the first run
        function initWatchVal() { }

        Scope.prototype.$watch = function(watchFn, listenerFn, valueEq) {
            var self = this;
            watchFn = $parse(watchFn);
            listenerFn = $parse(listenerFn);
            var watcher = {
                watchFn: watchFn,
                // in case the listener func is empty
                // now this thing has been done in parse()
                listenerFn: listenerFn /*|| function() {  }*/,
                valueEq: !!valueEq,
                last: initWatchVal
            };

            // optimization for constant watcher
            if(watchFn.constant) {
                // improve the current listener
                watcher.listenerFn = function(newValue, oldValue, scope) {
                    listenerFn(newValue, oldValue, scope);
                    var index = self.$$watchers.indexOf(watcher);
                    if(index >= 0) {
                        self.$$watchers.splice(index, 1);
                    }
                };
            }

            this.$$watchers.unshift(watcher);

            // reset the last dirty watch since new watch could be added in another watch's listener func
            // make sure monitor on the root's lastDirtyWatch
            this.$$root.$$lastDirtyWatch = null;

            return function() {
                var index = self.$$watchers.indexOf(watcher);
                if(index >= 0) {
                    self.$$watchers.splice(index, 1);
                    // reset the last dirty watch
                    self.$$root.$$lastDirtyWatch = null;
                }
            };
        };

        Scope.prototype.$$digestOnce = function() {
            var self = this;
            var continueLoop = true;
            var dirty = false;

            this.$$everyScope(function(scope) {
                var newValue, oldValue;
                _.forEachRight(scope.$$watchers, function(watcher) {
                    try {
                        if(watcher) {
                            // new value is always retrieved through watchFn
                            newValue = watcher.watchFn(scope);
                            // potentially leak out the initWatchVal outside of scope
                            oldValue = watcher.last;
                            // if(newValue !== oldValue) {
                            if(!scope.$$areEqual(newValue, oldValue, watcher.valueEq)) {
                                // set the last dirty watch
                                // TODO: why not replace self with scope ?
                                self.$$root.$$lastDirtyWatch = watcher;

                                // save the current newValue as the last on watcher obj
                                // when valueEq is true, need to deep clone the value as the old val
                                watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);

                                // first time, not to leak the initWatchVal func, 
                                // return old val as new val
                                watcher.listenerFn(
                                    newValue, 
                                    (oldValue === initWatchVal ? newValue : oldValue),
                                    scope);

                                // set dirty
                                dirty = true;
                            } else if(watcher === self.$$root.$$lastDirtyWatch) {
                                continueLoop = false;
                                // means the watch is clean, then check whether is the last dirty watch
                                // return false: short-circuit the loop and exit immediately
                                return false;
                            }
                        }
                    } catch (e) {
                        console.error(e);
                    }
                });
                return continueLoop;
            });

            return dirty;
        };

        Scope.prototype.$digest = function() {
            var ttl = TTL;
            var dirty;

            // reset the last dirty watch for each digest cycle
            this.$$root.$$lastDirtyWatch = null;
            // set current phase into digest
            this.$beginPhase("$digest");
            do {
                // handle the async queue
                while(this.$$asyncQueue.length) {
                    try {
                        // TODO: why not pop()
                        var asyncTask = this.$$asyncQueue.shift();
                        asyncTask.scope.$eval(asyncTask.expression);
                    } catch (e) {
                        console.error(e);
                    }
                }

                dirty = this.$$digestOnce();
                if((dirty || this.$$asyncQueue.length) && !(ttl--)) {
                    // leave digest phase
                    this.$clearPhase();
                    throw "digest TTL reached: " + ttl;
                }
                // when there is any scheduled task, continue
            } while(dirty || this.$$asyncQueue.length);
            // leave digest phase
            this.$clearPhase();

            // run tasks in the postDigest queue
            while(this.$$postDigestQueue.length) {
                try {
                    // TODO, why not use pop
                    this.$$postDigestQueue.shift()();
                } catch (e) {
                    console.error(e);
                }
            }
        };

        Scope.prototype.$$areEqual = function(newValue, oldValue, valueEq) {
            if(valueEq) {
                // use lodash's equal to execute deep equal judgement
                return _.isEqual(newValue, oldValue);
            } else {
                // handle NaN quirk
                // should make sure the type is number since isNaN("string") also return true
                return newValue === oldValue ||
                    (typeof newValue === "number" && 
                     typeof oldValue === "number" && 
                     isNaN(newValue) && 
                     isNaN(oldValue));
            }
        };

        Scope.prototype.$eval = function(expr, locals) {
            return $parse(expr)(this, locals);
        };

        // TODO: define the $applyAsync
        Scope.prototype.$apply = function(expr) {
            try {
                // set current phase into apply
                this.$beginPhase("$apply");
                return this.$eval(expr);
            } finally {
                // clear the current apply phase
                this.$clearPhase();
                // trigger $digest cycle finally, even exception happened
                // should trigger on root scope
                this.$$root.$digest();
            }
        };

        Scope.prototype.$evalAsync = function(expr) {
            var self = this;
            // only when no phase and async queue length is zero, schedule digest
            if(!self.$$phase && !self.$$asyncQueue.length) {
                // TODO: why should $evalAsync itself rely on the setTimeout
                setTimeout(function() {
                    // make sure currently has task in queue
                    if(self.$$asyncQueue.length) {
                        self.$$root.$digest();
                    }
                }, 0);
            }

            // enqueue a new task
            this.$$asyncQueue.push({
                // for scope inheritance, scope itself should be passed in
                scope: this,
                expression: expr
            });
        };

        Scope.prototype.$$postDigest = function(expr) {
            this.$$postDigestQueue.push(expr);
        };

        Scope.prototype.$beginPhase = function(phase) {
            if(this.$$phase) {
                throw this.$$phase + " already in progress.";
            }

            this.$$phase = phase;
        };

        Scope.prototype.$clearPhase = function(phase) {
            this.$$phase = null;
        };

        Scope.prototype.$new = function(isolated) {
            var child;
            if(isolated) {
                // break the prototypal chain
                child = new Scope();
                // assign the correct root
                child.$$root = this.$$root;
                // prevent shadowing attr
                child.$$asyncQueue = this.$$root.$$asyncQueue;
                child.$$postDigestQueue = this.$$root.$$postDigestQueue;
            } else {
                var ChildScope = function() { };
                ChildScope.prototype = this;
                child = new ChildScope();
            }
            // assign new watchers, shadow the parent's one
            child.$$watchers = [];

            // assign new children array
            child.$$children = [];

            // set parent of current child
            child.$parent = this;

            // add current child into parent's children array
            this.$$children.push(child);

            // assign array for listeners
            child.$$listeners = {};

            return child;
        };

        Scope.prototype.$$everyScope = function(fn) {
            if(fn(this)) {
                return this.$$children.every(function(child) {
                    return child.$$everyScope(fn);
                });
            } else {
                return false;
            }
        };

        Scope.prototype.$destroy = function() {
            if(this === this.$$root) {
                // do not remove the root one
                return;
            }

            var siblings = this.$parent.$$children;
            var indexOfThis = siblings.indexOf(this);
            if(indexOfThis >= 0) {
                this.$broadcast("$destroy");
                siblings.splice(indexOfThis, 1);
            }
        };

        // TODO: define the $watchGroup method as well
        Scope.prototype.$watchCollection = function(watchFn, listenerFn) {
            var self = this;
            var newValue, oldValue;
            var oldLength;
            var veryOldValue;
            // only track the old value when the listenerFn declares 'oldValue' as argument
            var trackVeryOldValue = (listenerFn.length > 1);
            var changeCount = 0;
            var firstRun = true;

            watchFn = $parse(watchFn);
            listenerFn = $parse(listenerFn);

            var internalWatchFn = function(scope) {
                var key, newLength;
                newValue = watchFn(scope);

                if(_.isObject(newValue)) {
                    if(_.isArrayLike(newValue)) {
                        if(!_.isArray(oldValue)) {
                            // sync up with type information
                            oldValue = [];
                            changeCount++;
                        }

                        if(newValue.length !== oldValue.length) {
                            changeCount++;
                            // sync up the length information
                            oldValue.length = newValue.length;
                        }

                        // iterating over each element
                        _.forEach(newValue, function(newItem, i) {
                            // handle NaNs
                            var bothNaN = _.isNaN(newItem) && _.isNaN(oldValue[i]);
                            if(!bothNaN && newItem !== oldValue[i]) {
                                changeCount++;
                                // sync up for each element
                                oldValue[i] = newItem;
                            }
                        });
                    } else {
                        // when the value is object other than array
                        if(!_.isObject(oldValue) || _.isArrayLike(oldValue)) {
                            changeCount++;
                            oldValue = {};
                            // keep the old object's size
                            oldLength = 0;
                        }

                        // reset the new object's size
                        newLength = 0;
                        // field checking
                        _.forOwn(newValue, function(newVal, key) {
                            newLength++;
                            // check whether old value has such key
                            if(oldValue.hasOwnProperty(key)) {
                                // use strict value checking for attributes
                                // handle NaNs
                                var bothNaN = _.isNaN(newVal) && _.isNaN(oldValue[key]);
                                if(!bothNaN && oldValue[key] !== newVal) {
                                    changeCount++;
                                    // sync up for each attribute
                                    oldValue[key] = newVal;
                                }
                            } else {
                                changeCount++;
                                oldLength++;
                                // sync up for the newly added attr
                                oldValue[key] = newVal;
                            }
                        });

                        // launch into second loop only when the oldLength > newLength
                        if(oldLength > newLength) {
                            changeCount++;
                            // second loop for checking whether any attr is removed
                            _.forOwn(oldValue, function(oldVal, key) {
                                // the field is not exist on new value now
                                if(!newValue.hasOwnProperty(key)) {
                                    // update the oldLength info
                                    oldLength--;
                                    // sync up for the removed attribute
                                    delete oldValue[key];
                                }
                            });
                        }
                    }
                } else {
                    // when the values are primitives
                    if(!self.$$areEqual(newValue, oldValue, false)) {
                        changeCount++;
                    }
                    oldValue = newValue;
                }

                return changeCount;
            };

            var internalListenerFn = function() {
                if(firstRun) {
                    listenerFn(newValue, newValue, self);
                    firstRun = false;
                } else {
                    listenerFn(newValue, veryOldValue, self);
                }

                // TODO: for the first round, the oldValue is undefined
                if(trackVeryOldValue) {
                    veryOldValue = _.clone(newValue);
                }
            };

            return this.$watch(internalWatchFn, internalListenerFn);
        };

        Scope.prototype.$on = function(eventName, listener) {
            var listeners = this.$$listeners[eventName];

            if(!listeners) {
                this.$$listeners[eventName] = listeners = [];
            }
            listeners.push(listener);

            // just like watch, returned a function for de-register event
            return function() {
                var index = listeners.indexOf(listener);
                if(index >= 0) {
                    // make it candidate for removing
                    listeners[index] = null;
                }
            };
        };

        Scope.prototype.$emit = function(eventName) {
            var propagationStopped = false;
            var event = {
                name: eventName, 
                targetScope: this,
                stopPropagation: function() {
                    propagationStopped = true;
                },
                defaultPrevented: false,
                preventDefault: function() {
                    this.defaultPrevented = true;
                }
            };
            var additionalArgs = _.rest(arguments);
            var listenerArgs = [event].concat(additionalArgs);

            // propagates event up to root
            var scope = this;
            do {
                event.currentScope = scope;
                scope.$$fireEventOnScope(eventName, listenerArgs);
                scope = scope.$parent;
            } while(scope && !propagationStopped);

            // make sure to return the same event
            return event;
        };

        Scope.prototype.$broadcast = function(eventName) {
            var event = {
                name: eventName,
                targetScope: this,
                defaultPrevented: false,
                preventDefault: function() {
                    this.defaultPrevented = true;
                }
            };
            var additionalArgs = _.rest(arguments);
            var listenerArgs = [event].concat(additionalArgs);

            // propagates event down the tree
            this.$$everyScope(function(scope) {
                event.currentScope = scope;
                scope.$$fireEventOnScope(eventName, listenerArgs);
                // always fire event on each scope
                return true;
            });

            // make sure to return the same event
            return event;
        };

        Scope.prototype.$$fireEventOnScope = function(eventName, listenerArgs) {
            var listeners = this.$$listeners[eventName] || [];

            // iterating over the listeners
            var i = 0;
            while(i < listeners.length) {
                if(listeners[i] === null) {
                    // remove the listener
                    listeners.splice(i, 1);
                } else {
                    try {
                        listeners[i].apply(null, listenerArgs);
                    } catch (e) {
                        console.error(e);
                    }
                    i++;
                }
            }
        };

        // prepare the scope
        var $rootScope = new Scope();
        return $rootScope;
    }];

}


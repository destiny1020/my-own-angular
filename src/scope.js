/* jshint globalstrict: true */
"use strict";

function Scope() {
    this.$$watchers = [];
    this.$$lastDirtyWatch = null;
    this.$$asyncQueue = [];
    this.$$phase = null;
    this.$$postDigestQueue = [];
    this.$$children = [];
    this.$$root = this;
}

// to make sure the value 'last' is not equal to any other value
// in order let the listener function been invoked in the first run
function initWatchVal() { }

Scope.prototype.$watch = function(watchFn, listenerFn, valueEq) {
    var self = this;
    var watcher = {
        watchFn: watchFn,
        // in case the listener func is empty
        listenerFn: listenerFn || function() {  },
        valueEq: !!valueEq,
        last: initWatchVal
    };

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
    var ttl = 10;
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
    return expr(this, locals);
};

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
        siblings.splice(indexOfThis, 1);
    }
};
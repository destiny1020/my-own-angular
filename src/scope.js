/* jshint globalstrict: true */
"use strict";

function Scope() {
    this.$$watchers = [];
    this.$$lastDirtyWatch = null;
}

// to make sure the value 'last' is not equal to any other value
// in order let the listener function been invoked in the first run
function initWatchVal() { }

Scope.prototype.$watch = function(watchFn, listenerFn) {
    var watcher = {
        watchFn: watchFn,
        // in case the listener func is empty
        listenerFn: listenerFn || function() {  },
        last: initWatchVal
    };

    this.$$watchers.push(watcher);

    // reset the last dirty watch since new watch could be added in another watch's listener func
    this.$$lastDirtyWatch = null;
};

Scope.prototype.$$digestOnce = function() {
    var self = this;
    var newValue, oldValue;
    var dirty = false;

    _.forEach(this.$$watchers, function(watcher) {
        // new value is always retrieved through watchFn
        newValue = watcher.watchFn(self);
        // potentially leak out the initWatchVal outside of scope
        oldValue = watcher.last;
        if(newValue !== oldValue) {
            // set the last dirty watch
            self.$$lastDirtyWatch = watcher;

            // save the current newValue as the last on watcher obj
            watcher.last = newValue;

            // first time, not to leak the initWatchVal func, 
            // return old val as new val
            watcher.listenerFn(
                newValue, 
                (oldValue === initWatchVal ? newValue : oldValue),
                self);

            // set dirty
            dirty = true;
        } else if(watcher === self.$$lastDirtyWatch) {
            // means the watch is clean, then check whether is the last dirty watch
            // return false: short-circuit the loop and exit immediately
            return false;
        }
    });

    return dirty;
};

Scope.prototype.$digest = function() {
    var ttl = 10;
    var dirty;

    // reset the last dirty watch for each digest cycle
    this.$$lastDirtyWatch = null;
    do {
        dirty = this.$$digestOnce();
        if(dirty && !(ttl--)) {
            throw "digest TTL reached: " + ttl;
        }
    } while(dirty);
};
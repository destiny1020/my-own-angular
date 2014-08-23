/* jshint globalstrict: true */
"use strict";

_.mixin({
    isArrayLike: function(obj) {
        if(_.isNull(obj) || _.isUndefined(obj)) {
            return false;
        }

        // determine whether array-like by reading length prop
        var length = obj.length;
        // TODO: how to deal with length === 0 such as {length: 0, otherKey: "a"}
        return length === 0 || 
            (_.isNumber(length) && length > 0 && (length - 1) in obj);
    }
});
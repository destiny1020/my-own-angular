/* jshint globalstrict: true */
"use strict";

function $CompileProvider($provide) {

    var hasDirectives = {};

    this.directive = function(name, directiveFactory) {
        if(_.isString(name)) {
            // make sure the directive name is valid
            if(name === "hasOwnProperty") {
                throw "'hasOwnProperty' is not a valid name for directive";
            }

            if(!hasDirectives.hasOwnProperty(name)) {
                hasDirectives[name] = [];
                $provide.factory(name + "Directive", ["$injector", function($injector) {
                    var factories = hasDirectives[name];
                    return _.map(factories, $injector.invoke);
                }]);
            }
            hasDirectives[name].push(directiveFactory);
        } else {
            // passing in an object for multiple directives creating
            // when iterating on object, the first parameter is value, second: key
            _.forEach(name, function(directiveFactory, name) {
                this.directive(name, directiveFactory);
            }, this);
        }
    };

    this.$get = function() {

    };

    $CompileProvider.$inject = ["$provide"];

}
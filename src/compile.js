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

    this.$get = ["$injector", function($injector) {

        function compile($compileNodes) {
            return compileNodes($compileNodes);
        }

        function compileNodes($compileNodes) {
            _.forEach($compileNodes, function(node) {
                var directives = collectDirectives(node);
                applyDirectivesToNode(directives, node);
            });
        }

        function applyDirectivesToNode(directives, compileNode) {
            var $compileNode = $(compileNode);
            _.forEach(directives, function(directive) {
                if(directive.compile) {
                    directive.compile($compileNode);
                }
            });
        }

        function collectDirectives(node) {
            var directives = [];
            var normalizedNodeName = _.camelCase(nodeName(node).toLowerCase());
            addDirective(directives, normalizedNodeName);

            return directives;
        }

        // element: a raw DOM node or a jQuery-wrapped one
        function nodeName(element) {
            return element.nodeName ? element.nodeName : element[0].nodeName;
        }

        function addDirective(directives, name) {
            // seek the factory by directive's name
            if(hasDirectives.hasOwnProperty(name)) {
                // TODO: why using "apply" to concat the returned array to directives
                // directly modify the passed in directives, no need to return explicitly
                directives.push.apply(directives, $injector.get(name + "Directive"));
            }
        }

        return compile;
    }];

    $CompileProvider.$inject = ["$provide"];

}
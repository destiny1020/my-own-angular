/* jshint globalstrict: true */
"use strict";

function $CompileProvider($provide) {

    var hasDirectives = {};
    var PREFIX_REGEXP = /(x[\:\-_]|data[\:\-_])/i;

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
                    return _.map(factories, function(factory) {
                        var directive = $injector.invoke(factory);
                        // give a default restrict if not exit
                        directive.restrict = directive.restrict || "A";
                        return directive;
                    });
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
                // apply to children recursively
                if(node.childNodes && node.childNodes.length) {
                    compileNodes(node.childNodes);
                }
            });
        }

        function applyDirectivesToNode(directives, compileNode) {
            var $compileNode = $(compileNode);
            _.forEach(directives, function(directive) {
                if(directive.$$start) {
                    $compileNode = groupScan(compileNode, directive.$$start, directive.$$end);
                }
                if(directive.compile) {
                    directive.compile($compileNode);
                }
            });
        }

        function groupScan(node, startAttr, endAttr) {
            var nodes = [];
            if(startAttr && node && node.hasAttribute(startAttr)) {
                var depth = 0;
                do {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.hasAttribute(startAttr)) {
                            depth++;
                        } else if (node.hasAttribute(endAttr)) {
                            depth--;
                        }
                    }
                    nodes.push(node);
                    node = node.nextSibling;
                } while (depth > 0);
            } else {
                nodes.push(node);
            }

            return $(nodes);
        }

        function collectDirectives(node) {
            var directives = [];

            if(node.nodeType === Node.ELEMENT_NODE) {
                // for collecting the node name if any
                var normalizedNodeName = directiveNormalize(nodeName(node).toLowerCase());
                addDirective(directives, normalizedNodeName, "E");

                // for collecting the node's attributes if any
                _.forEach(node.attributes, function(attribute) {
                    var attrStartName, attrEndName;
                    var name = attribute.name;
                    var normalizedAttributeName = directiveNormalize(name.toLowerCase());

                    // deal with the possible ng-attr prefix
                    if(/^ngAttr[A-Z]/.test(normalizedAttributeName)) {
                        name = _.snakeCase(
                            normalizedAttributeName[6].toLowerCase() + normalizedAttributeName.substring(7), // remove "ng-attr"
                            "-"
                        );
                    }

                    // deal with the start/end suffix
                    if(/Start$/.test(normalizedAttributeName)) {
                        attrStartName = name;
                        attrEndName = name.substring(0, name.length - 5) + "end";
                        name = name.substring(0, name.length - 6);  // remove the trailing "-start"
                    }

                    normalizedAttributeName = directiveNormalize(name.toLowerCase());
                    addDirective(directives, normalizedAttributeName, "A", attrStartName, attrEndName);
                });

                // for collecting the node's classes if any
                _.forEach(node.classList, function(cls) {
                    var normalizedClassName = directiveNormalize(cls);
                    addDirective(directives, normalizedClassName, "C");
                });
            } else if(node.nodeType === Node.COMMENT_NODE) {
                var match = /^\s*directive\:\s*([\d\w\-_]+)/.exec(node.nodeValue);
                if (match) {
                    addDirective(directives, directiveNormalize(match[1]), "M");
                }
            }

            return directives;
        }

        function directiveNormalize(name) {
            return _.camelCase(name.replace(PREFIX_REGEXP, ""));
        }

        // element: a raw DOM node or a jQuery-wrapped one
        function nodeName(element) {
            return element.nodeName ? element.nodeName : element[0].nodeName;
        }

        function addDirective(directives, name, mode, attrStartName, attrEndName) {
            // seek the factory by directive's name
            if(hasDirectives.hasOwnProperty(name)) {
                // get the directive declaration for the "restrict" value
                var foundDirective = $injector.get(name + "Directive");
                var applicableDirectives = _.filter(foundDirective, function(dir) {
                    return dir.restrict.indexOf(mode) !== -1;
                });

                _.forEach(applicableDirectives, function(directive) {
                    if(attrStartName) {
                        directive = _.create(directive, {
                            $$start: attrStartName,
                            $$end: attrEndName
                        });
                    }
                    directives.push(directive);
                });

                // TODO: why using "apply" to concat the returned array to directives
                // directly modify the passed in directives, no need to return explicitly
                // not used now
                // directives.push.apply(directives, applicableDirectives);
            }
        }

        return compile;
    }];

    $CompileProvider.$inject = ["$provide"];

}
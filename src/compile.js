/* jshint globalstrict: true */
"use strict";

function $CompileProvider($provide) {

    var hasDirectives = {};
    var PREFIX_REGEXP = /(x[\:\-_]|data[\:\-_])/i;

    var BOOLEAN_ATTRS = {
        multiple: true,
        selected: true,
        checked: true,
        disabled: true,
        readOnly: true,
        required: true,
        open: true
    };

    var BOOLEAN_ELEMENTS = {
        INPUT: true,
        SELECT: true,
        OPTION: true,
        TEXTAREA: true,
        BUTTON: true,
        FORM: true,
        DETAILS: true
    };

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

    this.$get = ["$injector", "$rootScope", function($injector, $rootScope) {

        function Attribute(element) {
            this.$$element = element;
            // normalized name -> original name
            this.$attr = {};
        }

        // define the $set on attribute object
        // the fourth attrName is given for explicitly designate the denormalized attr name
        Attribute.prototype.$set = function(key, value, writeAttr, attrName) {
            this[key] = value;

            // special processing for the boolean attribute
            // TODO: why only testing on the first child
            if (isBooleanAttribute(this.$$element[0], key)) {
                this.$$element.prop(key, value);
            }

            if(!attrName) {
                if(this.$attr[key]) {
                    attrName = this.$attr[key];
                } else {
                    attrName = this.$attr[key] = _.snakeCase(key);
                }
            } else {
                // when given the attrName
                this.$attr[key] = attrName;
            }

            // flush the change to the dom element, the key is the normalized name
            // only when the writeAttr is false, the write will not happen
            if(writeAttr !== false) {
                this.$$element.attr(attrName, value);
            }

            // invoke the registered observers
            if(this.$$observers) {
                _.forEach(this.$$observers[key], function(observer) {
                    try {
                        // call the observer with the latest value
                        observer(value);
                    } catch (e) {
                        console.error(e);
                    }
                });
            }
        };

        // observe related
        // the observers will only be invoked through $set
        Attribute.prototype.$observe = function(key, fn) {
            var self = this;
            this.$$observers = this.$$observers || {};
            this.$$observers[key] = this.$$observers[key] || [];
            this.$$observers[key].push(fn);

            // call all the observers once in the next $digest every time the $observe is called
            $rootScope.$evalAsync(function() {
                fn(self[key]);
            });

            return fn;
        };

        Attribute.prototype.$addClass = function(classValue) {
            this.$$element.addClass(classValue);
        };

        Attribute.prototype.$removeClass = function(classValue) {
            this.$$element.removeClass(classValue);
        };

        Attribute.prototype.$updateClass = function(newClassVal, oldClassVal) {
            var newClasses = newClassVal.split(/\s+/);
            var oldClasses = oldClassVal.split(/\s+/);

            var addedClasses = _.difference(newClasses, oldClasses);
            var removedClasses = _.difference(oldClasses, newClasses);
            if (addedClasses.length) {
                this.$addClass(addedClasses.join(" "));
            }
            if (removedClasses.length) {
                this.$removeClass(removedClasses.join(" "));
            }
        };

        function compile($compileNodes) {
            return compileNodes($compileNodes);
        }

        function compileNodes($compileNodes) {
            _.forEach($compileNodes, function(node) {
                // prepare the attrs
                var attrs = new Attribute($(node));
                var directives = collectDirectives(node, attrs);
                applyDirectivesToNode(directives, node, attrs);
                // apply to children recursively
                if(node.childNodes && node.childNodes.length) {
                    compileNodes(node.childNodes);
                }
            });
        }

        function applyDirectivesToNode(directives, compileNode, attrs) {
            var $compileNode = $(compileNode);
            _.forEach(directives, function(directive) {
                if(directive.$$start) {
                    $compileNode = groupScan(compileNode, directive.$$start, directive.$$end);
                }
                if(directive.compile) {
                    // invoke the defined compile function here
                    directive.compile($compileNode, attrs);
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

        function collectDirectives(node, attrs) {
            var directives = [];
            var match;

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
                        // denormalize it
                        name = _.snakeCase(
                            normalizedAttributeName[6].toLowerCase() + normalizedAttributeName.substring(7), // remove "ng-attr"
                            "-"
                        );

                        // normalize again
                        normalizedAttributeName = directiveNormalize(name.toLowerCase());
                    }

                    // save the normalized -> original entry
                    attrs.$attr[normalizedAttributeName] = name;

                    // deal with the start/end suffix
                    if(/Start$/.test(normalizedAttributeName)) {
                        attrStartName = name;
                        attrEndName = name.substring(0, name.length - 5) + "end";
                        name = name.substring(0, name.length - 6);  // remove the trailing "-start"
                    }

                    normalizedAttributeName = directiveNormalize(name.toLowerCase());
                    addDirective(directives, normalizedAttributeName, "A", attrStartName, attrEndName);

                    // collecting the attrs into object
                    attrs[normalizedAttributeName] = attribute.value.trim();
                    // process the boolean attribute
                    if(isBooleanAttribute(node, normalizedAttributeName)) {
                        attrs[normalizedAttributeName] = true;
                    }
                });

                // for collecting the node's classes if any
                var className = node.className;
                if(_.isString(className) && !_.isEmpty(className)) {
                    while ((match = /([\d\w\-_]+)(?:\:([^;]+))?;?/.exec(className))) {
                        var normalizedClassName = directiveNormalize(match[1]);
                        if (addDirective(directives, normalizedClassName, "C")) {
                            attrs[normalizedClassName] = match[2] ? match[2].trim() : undefined;
                        }
                        className = className.substr(match.index + match[0].length);
                    }
                }

                _.forEach(node.classList, function(cls) {
                    var normalizedClassName = directiveNormalize(cls);
                    if(addDirective(directives, normalizedClassName, "C")) {
                        // put the attribute into attrs as placeholder only when matched
                        attrs[normalizedClassName] = undefined;
                    }

                });
            } else if(node.nodeType === Node.COMMENT_NODE) {
                match = /^\s*directive\:\s*([\d\w\-_]+)\s*(.*)$/.exec(node.nodeValue);
                if (match) {
                    var normalizedName = directiveNormalize(match[1]);
                    if (addDirective(directives, normalizedName, "M")) {
                        attrs[normalizedName] = match[2] ? match[2].trim() : undefined;
                    }
                }
            }

            return directives;
        }

        function isBooleanAttribute(node, attrName) {
            return BOOLEAN_ATTRS[attrName] && BOOLEAN_ELEMENTS[node.nodeName];
        }

        function directiveNormalize(name) {
            return _.camelCase(name.replace(PREFIX_REGEXP, ""));
        }

        // element: a raw DOM node or a jQuery-wrapped one
        function nodeName(element) {
            return element.nodeName ? element.nodeName : element[0].nodeName;
        }

        function addDirective(directives, name, mode, attrStartName, attrEndName) {
            var match;
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

                    // mark match as matched
                    match = directive;
                });

                // TODO: why using "apply" to concat the returned array to directives
                // directly modify the passed in directives, no need to return explicitly
                // not used now, but need to know why !
                // directives.push.apply(directives, applicableDirectives);
                return match;
            }
        }

        // expose the compile function for current provider
        return compile;
    }];

    $CompileProvider.$inject = ["$provide"];

}
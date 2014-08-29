/* jshint globalstrict: true */
/* global publishExternalAPI: false, createInjector: false, angular: false */
"use strict";

describe("$compile", function() {

    beforeEach(function() {
        delete window.angular;
        publishExternalAPI();
    });

    it("allows creating directives", function() {
        var myModule = angular.module("myModule", []);

        myModule.directive("testing", function() { });
        var injector = createInjector(["ng", "myModule"]);

        expect(injector.has("testingDirective")).toBe(true);
    });

    it("allows creating many directives with the same name", function() {
        var myModule = angular.module("myModule", []);
        myModule.directive("testing", _.constant({d: "one"}));
        myModule.directive("testing", _.constant({d: "two"}));
        var injector = createInjector(["ng", "myModule"]);

        var result = injector.get("testingDirective");

        // may have multiple results
        expect(result.length).toBe(2);
        expect(result[0].d).toEqual("one");
        expect(result[1].d).toEqual("two");
    });

    it("does not allow a directive called hasOwnProperty", function() {
        var myModule = angular.module("myModule", []);
        myModule.directive("hasOwnProperty", function() { });

        expect(function() {
            createInjector(["ng", "myModule"]);
        }).toThrow();
    });

    it("allows creating directives with object notation", function() {
        var myModule = angular.module("myModule", []);
        myModule.directive({
            a: function() { },
            b: function() { },
            c: function() { }
        });
        var injector = createInjector(["ng", "myModule"]);

        expect(injector.has("aDirective")).toBe(true);
        expect(injector.has("bDirective")).toBe(true);
        expect(injector.has("cDirective")).toBe(true);
    });

    // compiling DOM with element directives
    function makeInjectorWithDirectives() {
        var args = arguments;
        return createInjector(["ng", function($compileProvider) {
            $compileProvider.directive.apply($compileProvider, args);
        }]);
    }

    it("compiles element directives from a single element", function() {
        var injector = makeInjectorWithDirectives("myDirective", function() {
            return {
                restrict: "EACM",
                compile: function(element) {
                    element.data("hasCompiled", true);
                }
            };
        });

        injector.invoke(function($compile) {
            var el = $("<my-directive></my-directive>");
            $compile(el);
            expect(el.data("hasCompiled")).toBe(true);
        });
    });

    it("compiles element directives found from several elements", function() {
        var idx = 1;
        var injector = makeInjectorWithDirectives("myDirective", function() {
            return {
                restrict: "EACM",
                compile: function(element) {
                    element.data("hasCompiled", idx++);
                }
            };
        });

        injector.invoke(function($compile) {
            var el = $("<my-directive></my-directive><my-directive></my-directive>");
            $compile(el);
            expect(el.eq(0).data("hasCompiled")).toBe(1);
            expect(el.eq(1).data("hasCompiled")).toBe(2);
        });
    });

    // recursing to child elements
    it("compiles element directives from child elements", function() {
        var idx = 1;
        var injector = makeInjectorWithDirectives("myDirective", function() {
            return {
                restrict: "EACM",
                compile: function(element) {
                    element.data("hasCompiled", idx++);
                }
            };
        });

        injector.invoke(function($compile) {
            var el = $("<div><my-directive></my-directive></div>");
            $compile(el);
            expect(el.data("hasCompiled")).toBeUndefined();
            expect(el.find("> my-directive").data("hasCompiled")).toBe(1);
        });
    });

    it("compiles nested directives", function() {
        var idx = 1;
        var injector = makeInjectorWithDirectives("myDir", function() {
            return {
                restrict: "EACM",
                compile: function(element) {
                    element.data("hasCompiled", idx++);
                }
            };
        });

        injector.invoke(function($compile) {
            var el = $("<my-dir><my-dir><my-dir/></my-dir></my-dir>");
            $compile(el);
            expect(el.data("hasCompiled")).toBe(1);
            expect(el.find("> my-dir").data("hasCompiled")).toBe(2);
            expect(el.find("> my-dir > my-dir").data("hasCompiled")).toBe(3);
        });
    });

    _.forEach(["x", "data"], function(prefix) {
        _.forEach([":", "-", "_"], function(delim) {
            it("compile element directives with " + prefix + "/" + delim + " prefix", function() {
                var injector = makeInjectorWithDirectives("myDir", function() {
                    return {
                        restrict: "EACM",
                        compile: function(element) {
                            element.data("hasCompiled", true);
                        }
                    };
                });

                injector.invoke(function($compile) {
                    var el = $("<" + prefix + delim + "my-dir></" + prefix + delim + "my-dir>");
                    $compile(el);
                    expect(el.data("hasCompiled")).toBe(true);
                });
            });
        });
    });

    it("compiles attribute directives", function() {
        var injector = makeInjectorWithDirectives("myDir", function() {
            return {
                restrict: "EACM",
                compile: function(element) {
                    element.data("hasCompiled", true);
                }
            };
        });

        injector.invoke(function($compile) {
            var el = $("<div my-dir></div>");
            $compile(el);
            expect(el.data("hasCompiled")).toBe(true);
        });
    });

    _.forEach(["x", "data"], function(prefix) {
        _.forEach([":", "-", "_"], function(delim) {
            it("compiles attribute directives with prefix: " + prefix + "/" + delim, function() {
                var injector = makeInjectorWithDirectives("myDir", function() {
                    return {
                        restrict: "EACM",
                        compile: function(element) {
                            element.data("hasCompiled", true);
                        }
                    };
                });

                injector.invoke(function($compile) {
                    var el = $("<div " + prefix + delim + "my-dir></div>");
                    $compile(el);
                    expect(el.data("hasCompiled")).toBe(true);
                });
            });
        });
    });

    it("compiles several attribute directives in an element", function() {
        var injector = makeInjectorWithDirectives({
            myDirective: function() {
                return {
                    restrict: "EACM",
                    compile: function(element) {
                        element.data("hasCompiled", true);
                    }
                };
            },
            myOtherDirective: function() {
                return {
                    restrict: "EACM",
                    compile: function(element) {
                        element.data("otherCompiled", true);
                    }
                };
            }
        });

        injector.invoke(function($compile) {
            var el = $("<div my-directive my-other-directive></div>");
            $compile(el);

            expect(el.data("hasCompiled")).toBe(true);
            expect(el.data("otherCompiled")).toBe(true);
        });
    });

    it("compiles both attribute and element directives in an element", function() {
        var injector = makeInjectorWithDirectives({
            myDirective: function() {
                return {
                    restrict: "EACM",
                    compile: function(element) {
                        element.data("hasCompiled", true);
                    }
                };
            },
            myOtherDirective: function() {
                return {
                    restrict: "EACM",
                    compile: function(element) {
                        element.data("otherCompiled", true);
                    }
                };
            }
        });

        injector.invoke(function($compile) {
            var el = $("<my-directive my-other-directive></my-directive>");
            $compile(el);

            expect(el.data("hasCompiled")).toBe(true);
            expect(el.data("otherCompiled")).toBe(true);
        });
    });

    it("compiles attribute directives with ng-attr prefix in an element", function() {
        var injector = makeInjectorWithDirectives({
            myDirective: function() {
                return {
                    restrict: "EACM",
                    compile: function(element) {
                        element.data("hasCompiled", true);
                    }
                };
            }
        });

        injector.invoke(function($compile) {
            var el = $("<div ng-attr-my-directive></div>");
            $compile(el);

            expect(el.data("hasCompiled")).toBe(true);
        });
    });

    _.forEach(["x", "data"], function(prefix) {
        _.forEach([":", "-", "_"], function(delim) {
            it("compiles ng-attr attribute directives with prefix: " + prefix + "/" + delim, function() {
                var injector = makeInjectorWithDirectives("myDir", function() {
                    return {
                        restrict: "EACM",
                        compile: function(element) {
                            element.data("hasCompiled", true);
                        }
                    };
                });

                injector.invoke(function($compile) {
                    var el = $("<div " + prefix + delim + "ng-attr-my-dir></div>");
                    $compile(el);
                    expect(el.data("hasCompiled")).toBe(true);
                });
            });
        });
    });

    // applying directives to class
    it("compiles class directives", function() {
        var injector = makeInjectorWithDirectives({
            myDirective: function() {
                return {
                    restrict: "EACM",
                    compile: function(element) {
                        element.data("hasCompiled", true);
                    }
                };
            }
        });

        injector.invoke(function($compile) {
            var el = $("<div class='my-directive'></div>");
            $compile(el);
            expect(el.data("hasCompiled")).toBe(true); 
        });
    });

    it("compiles several class directives to an element", function() {
        var injector = makeInjectorWithDirectives({
            myDirective: function() {
                return {
                    restrict: "EACM",
                    compile: function(element) {
                        element.data("hasCompiled", true);
                    }
                };
            },
            myOtherDirective: function() {
                return {
                    restrict: "EACM",
                    compile: function(element) {
                        element.data("otherCompiled", true);
                    }
                };
            }
        });

        injector.invoke(function($compile) {
            var el = $("<div class='my-directive my-other-directive'></div>");
            $compile(el);

            expect(el.data("hasCompiled")).toBe(true);
            expect(el.data("otherCompiled")).toBe(true);
        });
    });

    _.forEach(["x", "data"], function(prefix) {
        _.forEach([":", "-", "_"], function(delim) {
            it("compiles class directives with prefix: " + prefix + "/" + delim, function() {
                var injector = makeInjectorWithDirectives("myDir", function() {
                    return {
                        restrict: "EACM",
                        compile: function(element) {
                            element.data("hasCompiled", true);
                        }
                    };
                });

                injector.invoke(function($compile) {
                    var el = $("<div class='" + prefix + delim + "my-dir'></div>");
                    $compile(el);
                    expect(el.data("hasCompiled")).toBe(true);
                });
            });
        });
    });

    // applying directives to comments
    it("compiles comment directives", function() {
        var hasCompiled;
        var injector = makeInjectorWithDirectives({
            myDirective: function() {
                return {
                    restrict: "EACM",
                    compile: function(element) {
                        hasCompiled = true;
                    }
                };
            }
        });

        injector.invoke(function($compile) {
            var el = $("<!-- directive: my-directive -->");
            $compile(el);
            expect(hasCompiled).toBe(true); 
        });
    });

    // restrictive directive application
    _.forEach({
        E: {element: true, attribute: false, class: false, comment: false},
        A: {element: false, attribute: true, class: false, comment: false},
        C: {element: false, attribute: false, class: true, comment: false},
        M: {element: false, attribute: false, class: false, comment: true},
        EA: {element: true, attribute: true, class: false, comment: false},
        AC: {element: false, attribute: true, class: true, comment: false},
        EAM: {element: true, attribute: true, class: false, comment: true},
        EACM: {element: true, attribute: true, class: true, comment: true},
    }, function(expected, restrict) {
        describe("restricted to " + restrict, function() {

            _.forEach({
                element: "<my-directive></my-directive>",
                attribute: "<div my-directive></div>",
                class: "<div class='my-directive'></div>",
                comment: "<!-- directive: my-directive -->"
            }, function(dom, type) {

                it((expected[type] ? "matches" : "does not match") + " on "+type, function() {
                    var hasCompiled = false;
                    var injector = makeInjectorWithDirectives("myDirective", function() {
                        return {
                            restrict: restrict,
                            compile: function(element) {
                                hasCompiled = true;
                            }
                        };
                    });

                    injector.invoke(function($compile) {
                        var el = $(dom);
                        $compile(el);
                        expect(hasCompiled).toBe(expected[type]);
                    });
                });
            });
        });
    });

    it("applies to attributes when no restrict given", function() {
        var hasCompiled = false;
        var injector = makeInjectorWithDirectives("myDirective", function() {
            return {
                compile: function(element) {
                    hasCompiled = true;
                }
            };
        });

        injector.invoke(function($compile) {
            var el = $("<div my-directive></div>");
            $compile(el);
            expect(hasCompiled).toBe(true); 
        });
    });

    it("does not apply to elements when no restrict given", function() {
        var hasCompiled = false;
        var injector = makeInjectorWithDirectives("myDirective", function() {
            return {
                compile: function(element) {
                    hasCompiled = true;
                }
            };
        });

        injector.invoke(function($compile) {
            var el = $("<my-directive></my-directive>");
            $compile(el);
            expect(hasCompiled).toBe(false); 
        });
    });

    // applying directives across multiple nodes
    it("allows applying a directive to multiple nodes", function() {
        var compileEL = false;
        var injector = makeInjectorWithDirectives("myDirective", function() {
            return {
                compile: function(element) {
                    compileEL = element;
                }
            };
        });

        injector.invoke(function($compile) {
            var el = $("<div my-directive-start></div><span></span><div my-directive-end></div>");
            $compile(el);
            expect(compileEL.length).toBe(3);
        });
    });

});
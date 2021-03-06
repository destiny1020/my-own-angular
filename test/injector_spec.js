/* jshint globalstrict: true */
/* global createInjector: false, setupModuleLoader: false, angular: false */
"use strict";

describe("injector", function() {

    beforeEach(function() {
        delete window.angular;
        setupModuleLoader(window);
    });

    it("can be created", function() {
        var injector = createInjector([]);
        expect(injector).toBeDefined();
    });

    it("has a constant that has been registered to a module", function() {
        var module = angular.module("myModule", []);
        module.constant("aConstant", 2);
        var injector = createInjector(["myModule"]);

        expect(injector.has("aConstant")).toBe(true);
    });

    it("does not have a non-registered constant", function() {
        var module = angular.module("myModule", []);
        var injector = createInjector(["myModule"]);

        expect(injector.has("aConstant")).toBe(false);
    });

    it("does not allow a constant called hasOwnProperty", function() {
        var module = angular.module("myModule", []);
        module.constant("hasOwnProperty", _.constant(false));
        expect(function() {
            createInjector(["myModule"]);
        }).toThrow();
    });

    it("can return a registered constant", function() {
        var module = angular.module("myModule", []);
        module.constant("aConstant", 22);
        var injector = createInjector(["myModule"]);

        expect(injector.get("aConstant")).toBe(22);
    });

    // requiring other modules
    it("loads multiple modules", function() {
        var module1 = angular.module("myModule1", []);
        var module2 = angular.module("myModule2", []);

        module1.constant("constant1", 1);
        module2.constant("constant2", 2);

        var injector = createInjector(["myModule1", "myModule2"]);

        expect(injector.has("constant1")).toBe(true);
        expect(injector.has("constant2")).toBe(true);
    });

    it("loads the required modules of a module", function() {
        var module1 = angular.module("myModule", []);
        var module2 = angular.module("myOtherModule", ["myModule"]);

        module1.constant("constant1", 1);
        module2.constant("constant2", 2);

        var injector = createInjector(["myOtherModule"]);

        expect(injector.has("constant1")).toBe(true);
        expect(injector.has("constant2")).toBe(true);
    });

    it("loads the transitively required modules of a module", function() {
        var module1 = angular.module("myModule", []);
        var module2 = angular.module("myOtherModule", ["myModule"]);
        var module3 = angular.module("myThirdModule", ["myOtherModule"]);

        module1.constant("constant1", 1);
        module2.constant("constant2", 2);
        module3.constant("constant3", 3);

        var injector = createInjector(["myThirdModule"]);

        expect(injector.has("constant1")).toBe(true);
        expect(injector.has("constant2")).toBe(true);
        expect(injector.has("constant3")).toBe(true);
    });

    it("loads each module only once, avoid infinite loading", function() {
        var module1 = angular.module("myModule", ["myOtherModule"]);
        var module2 = angular.module("myOtherModule", ["myModule"]);

        createInjector(["myModule"]);
    });

    // dependency injection
    it("invokes an annotated function with dependency injection", function() {
        var module = angular.module("myModule", []);

        module.constant("a", 1);
        module.constant("b", 2);
        var injector = createInjector(["myModule"]);

        var fn = function(one, two) {
            return one + two;
        };

        // dependencies are declared in fn.$inject
        fn.$inject = ["a", "b"];

        expect(injector.invoke(fn)).toBe(3);
    });

    it("does not accept non-strings as injection tokens", function() {
        var module = angular.module("myModule", []);
        module.constant("a", 1);
        var injector = createInjector(["myModule"]);

        var fn = function(one, two) {
            return one + two;
        };

        fn.$inject = ["a", 2];

        expect(function() {
            injector.invoke(fn);
        }).toThrow();
    });

    it("invokes a function with given this context", function() {
        var module = angular.module("myModule", []);
        module.constant("a", 1);
        var injector = createInjector(["myModule"]);

        var obj = {
            two: 2,
            fn: function(one) {
                return one + this.two;
            }
        };

        obj.fn.$inject = ["a"];
        expect(injector.invoke(obj.fn, obj)).toBe(3);
    });

    // providing locals to injected functions
    it("overrides dependencies with locals when invoked", function() {
        var module = angular.module("myModule", []);
        module.constant("a", 1);
        module.constant("b", 2);

        var injector = createInjector(["myModule"]);
        var fn = function(one, two) {
            return one + two;
        };
        fn.$inject = ["a", "b"];

        expect(injector.invoke(fn, null, {b: 3})).toBe(4);
    });

    // array-style dependency annotation
    describe("annotate", function() {

        it("return the $inject annotation of a function when it has one", function() {
            var injector = createInjector([]);

            var fn = function() { };
            fn.$inject = ["a", "b"];

            expect(injector.annotate(fn)).toEqual(["a", "b"]);
        });

        it("returns the array-style annotations of a func", function() {
            var injector = createInjector([]);

            var fn = ["a", "b", function() { }];

            expect(injector.annotate(fn)).toEqual(["a", "b"]); 
        });

        it("returns an empty array for a non-annotated 0-arg func", function() {
            var injector = createInjector([]);

            var fn = function() {};

            expect(injector.annotate(fn)).toEqual([]);
        });

        it("returns annotations parsed from func args when not annotated", function() {
            var injector = createInjector([]);

            var fn = function(a, b) { };

            expect(injector.annotate(fn)).toEqual(["a", "b"]);
        });

        it("strips comments from argument lists when parsing", function() {
            var injector = createInjector([]);
            var fn = function(a, /*b,*/ c) { };

            expect(injector.annotate(fn)).toEqual(["a", "c"]);
        });

        it("strips several comments from argument lists when parsing", function() {
            var injector = createInjector([]);
            var fn = function(a, /*b,*/ c/*, d*/ ) { };

            expect(injector.annotate(fn)).toEqual(["a", "c"]);
        });

        it("strips // comments from argument lists when parsing", function() {
            var injector = createInjector([]);
            var fn = function(a, //b,
                                c) { };
            expect(injector.annotate(fn)).toEqual(["a", "c"]);
        });

        it("strips surrounding underscores from argument names when parsing", function() {
            var injector = createInjector([]);

            var fn = function(a, _b_, c_, _d, an_argument) { };

            expect(injector.annotate(fn)).toEqual(["a", "b", "c_", "_d", "an_argument"]);
        });

        // integrating annotation with invocation
        it("invokes an array-annotated function with dependency injection", function() {
            var module = angular.module("myModule", []);

            module.constant("a", 1);
            module.constant("b", 2);
            var injector = createInjector(["myModule"]);

            var fn = ["a", "b", function(one, two) { return one + two; }];

            expect(injector.invoke(fn)).toBe(3);
        });

        it("invokes a non-annotated function with dependency injection", function() {
            var module = angular.module("myModule", []);

            module.constant("a", 1);
            module.constant("b", 2);
            var injector = createInjector(["myModule"]);

            var fn = function(a, b) { return a + b; };

            expect(injector.invoke(fn)).toBe(3);
        });

        // instantiating objects with dependency injection
        it("instantiates an annotated constructor function by $inject", function() {
            var module = angular.module("myModule", []);

            module.constant("a", 1);
            module.constant("b", 2);

            var injector = createInjector(["myModule"]);

            function Type(one, two) {
                this.result = one + two;
            }
            Type.$inject = ["a", "b"];

            var instance = injector.instantiate(Type);
            expect(instance.result).toBe(3);
        });

        it("instantiates an annotated constructor function by array wrapper", function() {
            var module = angular.module("myModule", []);

            module.constant("a", 1);
            module.constant("b", 2);

            var injector = createInjector(["myModule"]);

            function Type(one, two) {
                this.result = one + two;
            }

            var instance = injector.instantiate(["a", "b", Type]);
            expect(instance.result).toBe(3);
        });

        it("instantiates a non-annotated constructor function by self-extracting", function() {
            var module = angular.module("myModule", []);

            module.constant("a", 1);
            module.constant("b", 2);

            var injector = createInjector(["myModule"]);

            function Type(a, b) {
                this.result = a + b;
            }

            var instance = injector.instantiate(Type);
            expect(instance.result).toBe(3);
        });

        it("uses the prototype of the constructor when instantiating", function() {
            function BaseType() { }
            BaseType.prototype.getValue = _.constant(3);

            function Type() { this.v = this.getValue(); }
            Type.prototype = BaseType.prototype;

            var module = angular.module("myModule", []);
            var injector = createInjector(["myModule"]);

            var instance = injector.instantiate(Type);
            expect(instance.v).toBe(3);
        });

        it("supports locals when instantiating", function() {
            var module = angular.module("myModule", []);

            module.constant("a", 1);
            module.constant("b", 2);

            var injector = createInjector(["myModule"]);

            function Type(a, b) {
                this.result = a + b;
            }

            var instance = injector.instantiate(Type, {b: 3});
            expect(instance.result).toBe(4);
        });

    });

    describe("providers", function() {

        it("allows registering a provider and uses its $get", function() {
            var module = angular.module("myModule", []);
            module.provider("a", {
                $get: function() {
                    return 3;
                }
            });

            var injector = createInjector(["myModule"]);

            expect(injector.has("a")).toBe(true);
            expect(injector.get("a")).toBe(3);
        });

        it("injects the $get method of a provider", function() {
            var module = angular.module("myModule", []);
            module.constant("a", 1);
            module.provider("b", {
                $get: function(a) {
                    return a + 2;
                }
            });

            var injector = createInjector(["myModule"]);

            expect(injector.get("b")).toBe(3);
        });

        it("injects the $get method of a provider lazily", function() {
            var module = angular.module("myModule", []);
            module.provider("b", {
                $get: function(a) {
                    return a + 2;
                }
            });
            module.provider("a", {
                $get: _.constant(1)
            });

            var injector = createInjector(["myModule"]);
            expect(injector.get("b")).toBe(3);
        });

        // making sure everyhing is a singleton
        it("instantiates a dependency only once", function() {
            var module = angular.module("myModule", []);
            module.provider("a",  {
                $get: function() {
                    return {};
                }
            });

            var injector = createInjector(["myModule"]);
            expect(injector.get("a")).toBe(injector.get("a"));
        });

        // circular dependencies
        it("notifies the user about a circular dependency", function() {
            var module = angular.module("myModule", []);

            module.provider("a", {$get: function(b){ }});
            module.provider("b", {$get: function(c){ }});
            module.provider("c", {$get: function(a){ }});

            var injector = createInjector(["myModule"]);

            expect(function() {
                injector.get("a");
            }).toThrowError("Circular dependency found: a <- c <- b <- a");
        });

        it("cleans up the circular marker when instantiating fails", function() {
            var module = angular.module("myModule", []);
            module.provider("a", {
                $get: function() {
                    throw "Failing instantiating";
                }
            });

            var injector = createInjector(["myModule"]);

            expect(function() {
                injector.get("a");
            }).toThrow("Failing instantiating");

            expect(function() {
                injector.get("a");
            }).toThrow("Failing instantiating");
        });

        // provider constructors
        it("instantiates a provider if given as a constructor function", function() {
            var module = angular.module("myModule", []);

            module.provider("a", function AProvider() {
                this.$get = function() { return 1; };
            });

            var injector = createInjector(["myModule"]);

            expect(injector.get("a")).toBe(1); 
        });

        it("injects the given provider constructor function", function() {
            var module = angular.module("myModule", []);

            module.constant("b", 2);
            module.provider("a", function AProvider(b) {
                this.$get = function() { return 1 + b; };
            });

            var injector = createInjector(["myModule"]);

            expect(injector.get("a")).toBe(3); 
        });

        // two injectors, The Provider Injector and The Instance Injector
        it("injects another provider to a provider constructor function", function() {
            var module = angular.module("myModule", []);

            module.provider("a", function AProvider() {
                var value = 1;
                this.setValue = function(v) { value = v; };
                this.$get = function() { return value; };
            });

            // since provider will seek other provider dependencies in providerCache, so this should be named as aProvider
            module.provider("b", function BProvider(aProvider) {
                aProvider.setValue(2);
                this.$get = function() { };
            });

            var injector = createInjector(["myModule"]);

            expect(injector.get("a")).toBe(2);
        });

        // limitations below
        it("does not inject an instance to a provider constructor function", function() {
            var module = angular.module("myModule", []);

            module.provider("a", function AProvider() {
                this.$get = function() { return 1; };
            });

            // AProvider cannot accept an instance of another Provider
            module.provider("b", function AProvider(a) {
                this.$get = function() { return a; };
            });

            expect(function() {
                createInjector(["myModule"]);
            }).toThrow();
        });

        it("does not inject a provider to a $get function", function() {
            var module = angular.module("myModule", []);

            module.provider("a", function AProvider() {
                this.$get = function() { return 1; };
            });

            // since aProvider will be seeked in the instance cache, the name should be a rather than aProvider
            // this is correct: this.$get = function(a) { return a; };
            module.provider("b", function BProvider() {
                this.$get = function(aProvider) { return aProvider.$get(); };
            });

            var injector = createInjector(["myModule"]);

            expect(function() {
                injector.get("b");
            }).toThrow();
        });

        it("does not inject a provider to invoke", function() {
            var module = angular.module("myModule", []);

            module.provider("a", function AProvider() {
                this.$get = function() { return 1; };
            });

            var injector = createInjector(["myModule"]);

            expect(function() {
                // since the injector will seek dependency in instance cache, the argument should be a rather than aProvider
                injector.invoke(function(aProvider){ });
            }).toThrow();
        });

        it("corrects the 'does not inject a provider to invoke'", function() {
            var module = angular.module("myModule", []);

            module.provider("a", function AProvider() {
                this.$get = function() {
                    return 1;
                };
            });

            var injector = createInjector(["myModule"]);

            expect(injector.invoke(function(a, b){ return a + b; }, null, {b: 3})).toBe(4);
        });

        it("does not give access to providers through get", function() {
            var module = angular.module("myModule", []);

            module.provider("a", function AProvider() {
                this.$get = function() { return 1; };
            });

            var injector = createInjector(["myModule"]);

            expect(function() {
                // reason as above, first seek the instance cache, 
                // then a suffix "Provider" will be appended and seek for provider cache
                // while "aProviderProvider" is not exist
                injector.get("aProvider");
            }).toThrow();
        });

        // unshifting constants in the invoke queue
        it("registers constants first to make them available to providers", function() {
            var module = angular.module("myModule", []);

            module.provider("a", function AProvider(b) {
                this.$get = function() { return b; };
            });
            module.constant("b", 1);

            var injector = createInjector(["myModule"]);
            expect(injector.get("a")).toBe(1);
        });

    });

    describe("highlevel di features", function() {

        it("allows injecting the instance injector to $get", function() {
            var module = angular.module("myModule", []);

            module.constant("a", 2);
            module.provider("b", function BProvider() {
                this.$get = function($injector) {
                    return $injector.get("a");
                };
            });

            var injector = createInjector(["myModule"]);

            expect(injector.get("b")).toBe(2);
        });

        it("allows injecting the provider injector to provider", function() {
            var module = angular.module("myModule", []);

            module.provider("a", function AProvider() {
                this.value = 2;
                this.$get = function() { return this.value; };
            });

            // $injector here is provider injector
            module.provider("b", function BProvider($injector) {
                var aProvider = $injector.get("aProvider");
                this.$get = function() {
                    return aProvider.value;
                };
            });

            var injector = createInjector(["myModule"]);

            expect(injector.get("b")).toBe(2);
        });

        it("allows injecting the $provide service to providers", function() {
            var module = angular.module("myModule", []);

            module.provider("a", function AProvider($provide) {
                $provide.constant("b", 2);
                this.$get = function(b) { return b + 1; };
            });

            var injector = createInjector(["myModule"]);

            expect(injector.get("a")).toBe(3);
        });

        it("does not allow injecting the $provide service to $get", function() {
            var module = angular.module("myModule", []);

            module.provider("a", function AProvider() {
                // not allowed
                this.$get = function($provide) {

                };
            });

            var injector = createInjector(["myModule"]);

            expect(function() {
                injector.get("a");
            }).toThrow();
        });

        // config block
        it("runs config blocks when the injector is created", function() {
            var module = angular.module("myModule", []);

            var hasRun = false;
            module.config(function() {
                hasRun = true;
            });

            createInjector(["myModule"]);

            expect(hasRun).toBe(true);
        });

        it("injects config blocks with provider injector", function() {
            var module = angular.module("myModule", []);

            // this function's dependency injection is done by provider injector
            module.config(function($provide) {
                $provide.constant("a", 4);
            });

            var injector = createInjector(["myModule"]);

            expect(injector.get("a")).toBe(4);
        });

        it("runs a config block added during module registration", function() {
            var module = angular.module("myModule", [], function($provide) {
                $provide.constant("a", 3);
            });

            var injector = createInjector(["myModule"]);

            expect(injector.get("a")).toBe(3);
        });

        // run blocks
        it("runs run blocks when the injector is created", function() {
            var module = angular.module("myModule", []);

            var hasRun = false;
            module.run(function() {
                hasRun = true;
            });

            createInjector(["myModule"]);

            expect(hasRun).toBe(true);
        });

        it("injects run blocks with the instance injector", function() {
            var module = angular.module("myModule", []);

            module.provider("a", {
                $get: _.constant(3)
            });

            var gotA;
            module.run(function(a) {
                gotA = a;
            });

            createInjector(["myModule"]);

            expect(gotA).toBe(3);
        });

        it("configures all modules before running any run blocks", function() {
            var module1 = angular.module("myModule", []);

            module1.provider("a", {
                $get: _.constant(1)
            });
            var result;
            module1.run(function(a, b) {
                result = a + b;
            });

            var module2 = angular.module("myOtherModule", []);
            module1.provider("b", {
                $get: _.constant(2)
            });

            createInjector(["myModule", "myOtherModule"]);

            expect(result).toBe(3);
        });

        // function modules
        it("runs a function module dependency as a config block", function() {
            var functionModule = function($provide) {
                $provide.constant("a", 3);
            };
            angular.module("myModule", [functionModule]);

            var injector = createInjector(["myModule"]);

            expect(injector.get("a")).toBe(3);
        });

        it("runs a function module with array injection as a config block", function() {
            var functionModule = ["$provide", function($provide) {
                $provide.constant("a", 42);
            }];
            angular.module("myModule", [functionModule]);

            var injector = createInjector(["myModule"]);

            expect(injector.get("a")).toBe(42);
        });

        it("supports returning a run block from a function module", function() {
            var result;
            var functionModule = function($provide) {
                $provide.constant("a", 3);
                return function(a) {
                    result = a;
                };
            };
            angular.module("myModule", [functionModule]);

            createInjector(["myModule"]);

            expect(result).toBe(3);
        });

        it("only loads function modules once", function() {
            var loadedTimes = 0;
            var functionModule = function() {
                loadedTimes++;
            };

            angular.module("myModule", [functionModule, functionModule]);
            createInjector(["myModule"]);

            expect(loadedTimes).toBe(1);
        });

    });

    // factory will be injected with instance injector
    describe("factories", function() {

        it("allows registering a factory", function() {
            var module = angular.module("myModule", []);
            module.factory("a", function() { return 42; });
            var injector = createInjector(["myModule"]);

            expect(injector.get("a")).toBe(42);
        });

        it("injects a factory function with instances", function() {
            var module = angular.module("myModule", []);
            module.factory("a", function() { return 1; });
            module.factory("b", function(a) { return a + 2; });
            var injector = createInjector(["myModule"]);

            expect(injector.get("b")).toBe(3);
        });

        it("only calls a factory function once", function() {
            var module = angular.module("myModule", []);
            module.factory("a", function() { return {}; });
            var injector = createInjector(["myModule"]);

            expect(injector.get("a")).toBe(injector.get("a"));
        });

    });

    // difference between a value and a constant:
    // values are not available to providers or config blocks
    // they are strictly for instances only
    describe("values", function() {

        it("does not make values available to config blocks", function() {
            var module = angular.module("myModule", []);
            module.value("a", 42);

            // since a is value, is not available for config block which uses providerInjector
            module.config(function(a) {

            });

            expect(function() {
                createInjector(["myModule"]);
            }).toThrow();
        });

        it("corrects 'does not make values available to config blocks'", function() {
            var module = angular.module("myModule", []);
            module.value("a", 42);

            // since a is value, is not available for config block which uses providerInjector
            // but changing the key name will be functioning as expected
            var aValue;
            module.config(function(aProvider) {
                aValue = aProvider.$get();
            });

            createInjector(["myModule"]);
            expect(aValue).toBe(42);
        });

    });

    describe("services", function() {

        it("allows registering a service", function() {
            var module = angular.module("myModule", []);

            module.service("aService", function MyService() {
                this.getValue = function() { return 42; };
            });

            var injector = createInjector(["myModule"]);

            expect(injector.get("aService").getValue()).toBe(42);
        });

        it("injects service constructors with instances", function() {
            var module = angular.module("myModule", []);

            module.value("theValue", 42);
            module.service("aService", function MyService(theValue) {
                this.getValue = function() { return theValue; };
            });

            var injector = createInjector(["myModule"]);
            expect(injector.get("aService").getValue()).toBe(42);
        });

        it("injects service constructors with providers", function() {
            var module = angular.module("myModule", []);

            module.constant("aValue", 33);
            module.provider("a", function AProvider(aValue) {
                this.$get = function() { return aValue; };
            });

            // since the service is resolved using instance injector, 
            // so the name here should be "a" rather than "aProvider"
            module.service("aService", function MyService(a) {
                this.getValue = function() { return a; };
            });

            var injector = createInjector(["myModule"]);
            expect(injector.get("aService").getValue()).toBe(33);

        });

        it("only instantiates services once", function() {
            var module = angular.module("myModule", []);

            module.service("aService", function MyService() {

            });

            var injector = createInjector(["myModule"]);
            expect(injector.get("aService")).toBe(injector.get("aService"));
        });

    });

    describe("decorators", function() {

        it("allows changing an instance using a decorator", function() {
            var module = angular.module("myModule", []);
            module.factory("aValue", function() {
                return {aKey: 42};
            });

            module.config(function($provide) {
                $provide.decorator("aValue", function($delegate) {
                    $delegate.decoratedKey = 43;
                });
            });

            var injector = createInjector(["myModule"]);

            expect(injector.get("aValue").aKey).toBe(42);
            expect(injector.get("aValue").decoratedKey).toBe(43);
        });

        it("allows multiple decorators for one service", function() {
            var module = angular.module("myModule", []);
            module.factory("aValue", function() {
                return {aKey: 42};
            });

            module.config(function($provide) {
                $provide.decorator("aValue", function($delegate) {
                    $delegate.decoratedKey = 43;
                });

                $provide.decorator("aValue", function($delegate) {
                    $delegate.decoratedOtherKey = 45;
                });
            });

            var injector = createInjector(["myModule"]);

            expect(injector.get("aValue").aKey).toBe(42);
            expect(injector.get("aValue").decoratedKey).toBe(43);
            expect(injector.get("aValue").decoratedOtherKey).toBe(45);
        });

        it("uses dependency injection with decorators", function() {
            var module = angular.module("myModule", []);

            module.factory("aValue", function() {
                return {};
            });
            module.constant("a", 42);
            module.config(function($provide) {
                $provide.decorator("aValue", function(a, $delegate) {
                    $delegate.decoratedKey = a;
                });
            });

            var injector = createInjector(["myModule"]);

            expect(injector.get("aValue").decoratedKey).toBe(42);
        });

    });

});
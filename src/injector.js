/* jshint globalstrict: true */
/* global angular: false, HashMap: false */
"use strict";

// exposed API:
// has, get, annotate, invoke and instantiate
function createInjector(modulesToLoad) {
    var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
    var FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
    // two situations: // xxxx and /* xxx */
    var STRIP_COMMENTS = /(\/\/.*$)|(\/\*.*?\*\/)/mg;

    // placeholder for marking the dependency is currently under constructing
    var INSTANTIATING = {};

    // for caching dependency instances
    var instanceCache = {};
    // backup is the providerInjector
    // put the instance injector into cache as well
    var instanceInjector = instanceCache.$injector = createInternalInjector(instanceCache, function(name) {
        var provider = providerInjector.get(name + "Provider");
        return instanceInjector.invoke(provider.$get, provider);
    });

    var providerCache = {};
    // no backup, failed on not found
    // put the provider injector into cache as well
    var providerInjector = providerCache.$injector = createInternalInjector(providerCache, function() {
        throw "Unknown Provider: " + path.join(" <- ");
    });

    var loadedModules = new HashMap();

    // store the dependency resolution path
    var path = [];

    // used to resolve the constant and provider
    // put it into the provider cache
    providerCache.$provide = {
        constant: function(key, value) {
            if(key === "hasOwnProperty") {
                throw "hasOwnProperty is not a valid constant name";
            }
            instanceCache[key] = value;
            providerCache[key] = value;
        },
        provider: function(key, provider) {
            if(_.isFunction(provider)) {
                // when the given provider is a function
                // NO CACHE ! will be resolved at once and stored in cache
                // so the providerCache should always store instance of provider
                provider = providerInjector.instantiate(provider);
            }
            // store the provider in cache for lazy resolution
            providerCache[key + "Provider"] = provider;
        },
        factory: function(key, factoryFn) {
            // since the provider object is created on the fly, no config methods are attached
            // so there is basically no point to access to the provider object
            this.provider(key, {
                $get: factoryFn
            });
        },
        value: function(key, value) {
            this.factory(key, _.constant(value));
        },
        service: function(key, Constructor) {
            this.factory(key, function() {
                // use the instance injector
                return instanceInjector.instantiate(Constructor);
            });
        },
        decorator: function(serviceName, decoratorFn) {
            var provider = providerInjector.get(serviceName + "Provider");
            var original$get = provider.$get;
            provider.$get = function() {
                // used to create the instance
                var instance = instanceInjector.invoke(original$get, provider);
                // modofications will be gone here
                instanceInjector.invoke(decoratorFn, null, {$delegate: instance});
                return instance;
            };
        }
    };

    function createInternalInjector(cache, factoryFn) {
        function getService(name) {
            if(cache.hasOwnProperty(name)) {
                if(cache[name] === INSTANTIATING) {
                    throw new Error("Circular dependency found: " + name + " <- " + path.join(" <- "));
                }
                return cache[name];
            } else {
                path.unshift(name);
                cache[name] = INSTANTIATING;
                try {
                    return (cache[name] = factoryFn(name));
                } finally {
                    path.shift();
                    // make sure even something wrong happened during invocation, the marker will be deleted
                    if(cache[name] === INSTANTIATING) {
                        delete cache[name];
                    }
                }
            }
        }

        // 1. create an instance based on possible prototype
        // 2. invoke the invoke func(the results are saved by side-effects)
        // 3. return the instance
        function instantiate(Type, locals) {
            var UnwrappedType = _.isArray(Type) ? _.last(Type) : Type;

            // create the instance based on given prototype if any
            var instance = Object.create(UnwrappedType.prototype);

            invoke(Type, instance, locals);

            return instance;
        }

        // 1. resolve the dependencies
        // 2. invoke the function with real dependencies
        // 3. return the result of the func
        function invoke(fn, context, locals) {
            // resolve the dependencies, from token -> real value
            var args = _.map(annotate(fn), function(token) {
                if(_.isString(token)) {
                    return locals && locals.hasOwnProperty(token) ? locals[token] : getService(token);
                } else {
                    throw "Incorrect injection token, should be a string";
                }
            });

            // when using array-style
            if(_.isArray(fn)) {
                fn = _.last(fn);
            }

            return fn.apply(context, args);
        }

        return {
            has: function(name) {
                return cache.hasOwnProperty(name) || 
                    providerCache.hasOwnProperty(name + "Provider");
            },
            get: getService,
            annotate: annotate,
            invoke: invoke,
            instantiate: instantiate
        };
    }

    function annotate(fn) {
        if(_.isArray(fn)) {
            // when using the array-style
            return fn.slice(0, fn.length - 1);
        } else if(fn.$inject) {
            // when declared an $inject array
            return fn.$inject;
        } else if(!fn.length) {
            // when the func has no declared argument
            return [];
        } else {
            // parsing the code
            var source = fn.toString().replace(STRIP_COMMENTS, "");
            var argDeclaration = source.match(FN_ARGS);
            return _.map(argDeclaration[1].split(","), function(argName) {
                return argName.match(FN_ARG)[2];
            });
        }
    }

    // collect all run blocks
    var runBlocks = [];
    // executed code when using createInjector
    _.forEach(modulesToLoad, function loadModule(moduleElement) {
        // avoid repetitive loading for one module
        if(!loadedModules.get(moduleElement)) {
            // mark current module as loaded
            loadedModules.put(moduleElement, true);
            if(_.isString(moduleElement)) {

                // get the module instance
                var module = angular.module(moduleElement);

                // recursively load each dependencies
                _.forEach(module.requires, loadModule);

                _.forEach(module._invokeQueue, function(invokeArgs) {
                    var service = providerInjector.get(invokeArgs[0]);
                    var method = invokeArgs[1];
                    var args = invokeArgs[2];

                    service[method].apply(service, args);
                });

                runBlocks = runBlocks.concat(module._runBlocks);
            } else if(_.isFunction(moduleElement) || _.isArray(moduleElement)) {
                // when the module is provided as function module or used array-style
                runBlocks.push(providerInjector.invoke(moduleElement));
            }
        }
    });

    // _.compact will remove all undefined entries
    _.forEach(_.compact(runBlocks), function(runBlock) {
        instanceInjector.invoke(runBlock);
    });

    return instanceInjector;
}
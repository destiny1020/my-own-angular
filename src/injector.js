/* jshint globalstrict: true */
/* global angular: false */
"use strict";

function createInjector(modulesToLoad) {
    var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
    var FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
    // two situations: // xxxx and /* xxx */
    var STRIP_COMMENTS = /(\/\/.*$)|(\/\*.*?\*\/)/mg;

    // placeholder for marking the dependency is currently under constructing
    var INSTANTIATING = {};

    // for caching dependency instances
    var instanceCache = {};
    var instanceInjector = createInternalInjector(instanceCache, function(name) {
        var provider = providerInjector.get(name + "Provider");
        return instanceInjector.invoke(provider.$get, provider);
    });

    var providerCache = {};
    var providerInjector = createInternalInjector(providerCache, function() {
        throw "Unknown Provider: " + path.join(" <- ");
    });

    var loadedModules = {};

    // store the dependency resolution path
    var path = [];

    var $provide = {
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
                provider = providerInjector.instantiate(provider);
            }
            // store the provider in cache for lazy resolution
            providerCache[key + "Provider"] = provider;
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

        function instantiate(Type, locals) {
            var UnwrappedType = _.isArray(Type) ? _.last(Type) : Type;

            // create the instance based on given prototype if any
            var instance = Object.create(UnwrappedType.prototype);

            invoke(Type, instance, locals);

            return instance;
        }

        function invoke(fn, context, locals) {
            // resolve the dependencies
            var args = _.map(annotate(fn), function(token) {
                if(_.isString(token)) {
                    return locals && locals.hasOwnProperty(token) ? locals[token] : getService(token);
                } else {
                    throw "Incorrect injection token, should be a string";
                }
            });

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

    // function getService(name) {
    //     if(instanceCache.hasOwnProperty(name)) {
    //         if(instanceCache[name] === INSTANTIATING) {
    //             throw new Error("Circular dependency found: " + name + " <- " + path.join(" <- "));
    //         }
    //         return instanceCache[name];
    //     } else if(providerCache.hasOwnProperty(name)) {
    //         return providerCache[name];
    //     } else if(providerCache.hasOwnProperty(name + "Provider")) {
    //         path.unshift(name);
    //         instanceCache[name] = INSTANTIATING;
    //         try {
    //             var provider = providerCache[name + "Provider"];
    //             var instance = instanceCache[name] = invoke(provider.$get, provider);
    //             return instance;
    //         } finally {
    //             path.shift();
    //             // make sure even something wrong happened during invocation, the marker will be deleted
    //             if(instanceCache[name] === INSTANTIATING) {
    //                 delete instanceCache[name];
    //             }
    //         }
    //     }
    // }

    function annotate(fn) {
        if(_.isArray(fn)) {
            return fn.slice(0, fn.length - 1);
        } else if(fn.$inject) {
            return fn.$inject;
        } else if(!fn.length) {
            return [];
        } else {
            var source = fn.toString().replace(STRIP_COMMENTS, "");
            var argDeclaration = source.match(FN_ARGS);
            return _.map(argDeclaration[1].split(","), function(argName) {
                return argName.match(FN_ARG)[2];
            });
        }
    }

    // executed code when using createInjector
    _.forEach(modulesToLoad, function loadModule(moduleName) {
        if(!loadedModules.hasOwnProperty(moduleName)) {
            // mark current module as loaded
            loadedModules[moduleName] = true;

            var module = angular.module(moduleName);

            // recursively load each dependencies
            _.forEach(module.requires, loadModule);

            _.forEach(module._invokeQueue, function(invokeArgs) {
                var method = invokeArgs[0];
                var args = invokeArgs[1];

                $provide[method].apply($provide, args);
            });
        }
    });

    return instanceInjector;
}
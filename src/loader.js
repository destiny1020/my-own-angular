/* jshint globalstrict: true */
"use strict";

// functions:
// 1. define a global angular object
// 2. define a method "module" on angular
// 3. define "createModule" and "getModule" method used by the method "module"
function setupModuleLoader(window) {
    var ensure = function(obj, name, factory) {
        return obj[name] || (obj[name] = factory());
    };

    // make sure the angular should be global singleton
    var angular = ensure(window, "angular", Object);

    // will not check whether the module with name is already existed or not, just override
    var createModule = function(name, requires, modules, configFn) {
        // check module name validity
        if(name === "hasOwnProperty") {
            throw "hasOwnProperty is not a valid module name";
        }

        // choose the method to operate on the invoke queue
        var invokeLater = function(service, method, arrayMethod) {
            // this returned function will be invoked when registering constant or provider
            return function() {
                var item = [service, method, arguments];
                moduleInstance._invokeQueue[arrayMethod || "push"](item);
                // to support chaining
                return moduleInstance;
            };
        };

        // exposed api for module instance
        var moduleInstance = {
            name: name,
            requires: requires,
            constant: invokeLater("$provide", "constant", "unshift"),
            provider: invokeLater("$provide", "provider"),
            factory: invokeLater("$provide", "factory"),
            value: invokeLater("$provide", "value"),
            service: invokeLater("$provide", "service"),
            // the config function is invoked by the providerInjector
            config: invokeLater("$injector", "invoke"),
            directive: invokeLater("$compileProvider", "directive"),
            run: function(fn) {
                moduleInstance._runBlocks.push(fn);
                return moduleInstance;
            },
            // this array will be processed when calling createInjector([module_name])
            _invokeQueue: [],
            _runBlocks: []
        };

        if(configFn) {
            moduleInstance.config(configFn);
        }

        // store the module instance
        modules[name] = moduleInstance;

        // return the module instance to enable chained declaration
        return moduleInstance;
    };

    var getModule = function(name, modules) {
        if(modules.hasOwnProperty(name)) {
            return modules[name];
        } else {
            throw "Module " + name + " is not available";
        }
    };

    // angular.module is a function
    ensure(angular, "module", function() {
        // holding all the modules
        var modules = {};
        // receives two parameters
        // 1. module's name
        // 2. module's dependencies
        return function(name, requires, configFn) {
            if(requires) {
                return createModule(name, requires, modules, configFn);
            } else {
                return getModule(name, modules);
            }
        };
    });
}
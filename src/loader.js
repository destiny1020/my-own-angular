/* jshint globalstrict: true */
"use strict";

function setupModuleLoader(window) {
    var ensure = function(obj, name, factory) {
        return obj[name] || (obj[name] = factory());
    };

    // make sure the angular should be global singleton
    var angular = ensure(window, "angular", Object);

    var createModule = function(name, requires, modules) {
        // check module name validity
        if(name === "hasOwnProperty") {
            throw "hasOwnProperty is not a valid module name";
        }

        // choose the method to operate on the invoke queue
        var invokeLater = function(method, arrayMethod) {
            return function() {
                moduleInstance._invokeQueue[arrayMethod || "push"]([method, arguments]);
                // to support chaining
                return moduleInstance;
            };
        };

        var moduleInstance = {
            name: name,
            requires: requires,
            constant: invokeLater("constant", "unshift"),
            provider: invokeLater("provider"),
            _invokeQueue: []
        };

        // store the module instance
        modules[name] = moduleInstance;
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
        var modules = {};
        return function(name, requires) {
            if(requires) {
                return createModule(name, requires, modules);
            } else {
                return getModule(name, modules);
            }
        };
    });
}
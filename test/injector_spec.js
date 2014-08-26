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

});
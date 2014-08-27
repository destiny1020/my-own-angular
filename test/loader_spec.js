/* jshint globalstrict: true */
/* global setupModuleLoader: false */
"use strict";

describe("setupModuleLoader", function() {

    beforeEach(function() {
        delete window.angular;
    });

    it("exposes angular on the window", function() {
        setupModuleLoader(window);
        expect(window.angular).toBeDefined();
    });

    it("creates angular just once", function() {
        setupModuleLoader(window);
        var ng = window.angular;
        setupModuleLoader(window);
        expect(window.angular).toBe(ng);
    });

    // the module method
    it("exposes the angular module function", function() {
        setupModuleLoader(window);
        expect(window.angular.module).toBeDefined();
    });

    it("exposes the angular module function just once", function() {
        setupModuleLoader(window);
        var module = window.angular.module;
        setupModuleLoader(window);
        expect(window.angular.module).toBe(module);
    });

    describe("modules", function() {

        beforeEach(function() {
            setupModuleLoader(window);
        });

        it("allows registering a module", function() {
            var myModule = window.angular.module("myModule", []);
            expect(myModule).toBeDefined();
            expect(myModule.name).toEqual("myModule");
        });

        it("replaces a module when registered with the same name again", function() {
            var myModule = window.angular.module("myModule", []);
            var myOtherModule = window.angular.module("myModule", []);
            expect(myModule).not.toBe(myOtherModule);
        });

        it("attaches the requires array to the registered module", function() {
            var myModule = window.angular.module("myModule", ["myOtherModule"]);
            expect(myModule.requires).toEqual(["myOtherModule"]);
        });

        // get a registered module
        it("allows getting a module", function() {
            var myModule = window.angular.module("myModule", []);
            var gotModule = window.angular.module("myModule");

            expect(gotModule).toBeDefined();
            expect(gotModule).toBe(myModule);
        });

        it("throws when trying to get a nonexistent module", function() {
            expect(function() {
                window.angular.module("myModule");
            }).toThrow();
        });

        it("does not allow a module to be called hasOwnProperty", function() {
            expect(function() {
                window.angular.module("hasOwnProperty", []);
            }).toThrow();
        });

    });

});
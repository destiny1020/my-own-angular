/* jshint globalstrict: true */
/* global publishExternalAPI: false, createInjector: false */
"use strict";

describe("angularPublic", function() {

    it("sets up the angular object and the module loader", function() {
        publishExternalAPI();

        expect(window.angular).toBeDefined();
        expect(window.angular.module).toBeDefined();
    });

    it("sets up the ng module", function() {
        publishExternalAPI();

        expect(createInjector(["ng"])).toBeDefined();
    });

    it("sets up the $parse service", function() {
        publishExternalAPI();

        var injector = createInjector(["ng"]);
        expect(injector.has("$parse")).toBe(true);
    });

    it("sets up the $rootScope", function() {
        publishExternalAPI();

        var injector = createInjector(["ng"]);
        expect(injector.has("$rootScope")).toBe(true);
    });

    it("sets up the $compile", function() {
        publishExternalAPI();

        var injector = createInjector(["ng"]);
        expect(injector.has("$compile")).toBe(true);
    });

});
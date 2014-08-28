/* jshint globalstrict: true */
/* global setupModuleLoader: false, angular: false, $ParseProvider: false, $RootScopeProvider: false, $CompileProvider: false */
"use strict";

function publishExternalAPI() {
    setupModuleLoader(window);

    var ngModule = angular.module("ng", []);

    // $parse is provided as provider
    ngModule.provider("$parse", $ParseProvider);
    ngModule.provider("$rootScope", $RootScopeProvider);
    ngModule.provider("$compile", $CompileProvider);
}
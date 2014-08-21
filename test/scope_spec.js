/* jshint globalstrict: true */
// will fix this global Scope issue after implementing DI
/* global Scope: false */
"use strict";

describe("Scope", function() {

    it("can be constructed and used as object", function() {
        var scope = new Scope();
        scope.aProperty = 1;

        expect(scope.aProperty).toBe(1);
    });

    // sub test suite for the digest feature
    describe("digest", function() {

        var scope;

        beforeEach(function() {
            scope = new Scope();
        });

        it("calls the listener function of a watch on first $digest", function() {
            var watchFn = function() {
                return "waterer func";
            };
            var listenerFn = jasmine.createSpy();

            scope.$watch(watchFn, listenerFn);
            scope.$digest();

            expect(listenerFn).toHaveBeenCalled();
        });

        // since in watch func, it needs to access some val in scope
        it("calls the watch function with the scope as arg", function() {
            var watchFn = jasmine.createSpy();
            var listenerFn = function() {};
            scope.$watch(watchFn, listenerFn);

            scope.$digest();

            expect(watchFn).toHaveBeenCalledWith(scope);
        });

        it("calls the listener function when the watched value changed", function() {
            scope.someValue = "a";
            scope.counter = 0;

            // watch func, listener func and scope itself
            scope.$watch(function(scope) {
                return scope.someValue;
            }, function(newValue, oldValue, scope) {
                scope.counter++;
            });

            expect(scope.counter).toBe(0);

            // first triggering
            scope.$digest();
            expect(scope.counter).toBe(1);

            // no change is happened
            scope.$digest();
            expect(scope.counter).toBe(1);

            // no change is happened
            scope.$digest();
            expect(scope.counter).toBe(1);

            // a change has been done
            scope.someValue = "b";
            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        // initializing watch value
        it("calls listener when watch value is undefined", function() {
            scope.counter = 0;

            scope.$watch(
                function(scope) { return scope.someValue; },
                function(newValue, oldValue, scope) { scope.counter++; }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        it("calls listener with new val as old val the first time", function() {
            scope.someValue = 123;
            var oldValueGiven;

            scope.$watch(
                function(scope) { return scope.someValue; },
                // first time run, oldValue should be equal to newValue
                function(newValue, oldValue, scope) { oldValueGiven = oldValue; }
            );

            scope.$digest();
            expect(oldValueGiven).toBe(123);
        });

        // getting notified of digests
        it("may have watchers that omit the listener function", function() {
            var watchFn = jasmine.createSpy().and.returnValue("something");

            // register a watch without listener
            scope.$watch(watchFn);

            scope.$digest();

            expect(watchFn).toHaveBeenCalled();
        });

        // keep digesting while dirty
        it("triggers chained watchers in the same digest", function() {
            scope.name = "Jane";

            scope.$watch(
                function(scope) { return scope.nameUpper; },
                function(newValue, oldValue, scope) {
                    // first round will not create a initial field
                    if(newValue) {
                        scope.initial = newValue.substring(0, 1) + ".";
                    }
                }
            );

            scope.$watch(
                function(scope) { return scope.name; },
                function(newValue, oldValue, scope) {
                    if(newValue) {
                        scope.nameUpper = newValue.toUpperCase();
                    }
                }
            );

            scope.$digest();
            expect(scope.initial).toBe("J.");

            scope.name = "Bob";
            scope.$digest();
            expect(scope.initial).toBe("B.");
        });

        // giving up on an unstable digest
        it("gives up on watchers after 10 iterations", function() {
            scope.counterA = 0;
            scope.counterB = 0;

            scope.$watch(
                function(scope) { return scope.counterA; },
                function(newValue, oldValue, scope) { scope.counterB++; }
            );

            scope.$watch(
                function(scope) { return scope.counterB; },
                function(newValue, oldValue, scope) { scope.counterA++; }
            );

            expect((function() { scope.$digest(); })).toThrow();
        });

        // short-circuiting the digest when the last watch is clean
        it("ends the digest when the last dirty watch is clean", function() {
            scope.array = _.range(100);
            var watchExecutions = 0;

            _.times(100, function(i) {
                scope.$watch(
                    function(scope) { 
                        watchExecutions++;
                        return scope.array[i]; 
                    },
                    function(newValue, oldValue, scope) {  }
                );
            });

            scope.$digest();
            expect(watchExecutions).toBe(200);

            scope.array[0] = 100;
            // only the first watch is dirty
            scope.$digest();
            expect(watchExecutions).toBe(301);
        });

        // corner case: adding another watch in watch listener func
        it("does not end digest so that new watches are not run", function() {
            scope.aValue = "abc";
            scope.counter = 0;

            scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    // add another watch
                    scope.$watch(
                        function(scope) { return scope.aValue; },
                        function(newValue, oldValue, scope) {
                            // should be called here
                            scope.counter++;
                        }
                    );
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);
        });

    });

});
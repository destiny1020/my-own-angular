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

        // value based check
        it("compares based on value rather than ref", function() {
            scope.aValue = [1, 2, 3];
            scope.counter = 0;

            scope.$watch(
                function(scope) {
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                },
                true
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.aValue.push(4);
            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        // handles ref NaNs, value based NaNs has been handled by lodash
        it("handle ref NaNs", function() {
            scope.number = 0 / 0; // NaN
            scope.counter = 0;

            scope.$watch(
                function(scope) {
                    return scope.number;
                },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            // before fixing, below can pass since TTL is reached
            // expect((function(){ scope.$digest(); })).toThrow();
            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        // $eval related
        it("executes $eval func and return results", function() {
            scope.aValue = 42;

            var result = scope.$eval(function(scope) {
                return scope.aValue;
            });

            expect(result).toBe(42);
        });

        it("pass the second parameter into $eval as plain param", function() {
            scope.aValue = 42;

            var result = scope.$eval(function(scope, arg) {
                return scope.aValue + arg;
            }, 10);

            expect(result).toBe(52);
        });

        // $apply related
        it("execute $apply func to trigger digest cycle", function() {
            scope.aValue = "someValue";
            scope.counter = 0;

            scope.$watch(
                function(scope) {
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.$apply(function(scope) {
                scope.aValue = "anotherValue";
            });
            expect(scope.counter).toBe(2);
        });

        // $evalAsync related
        it("executes $evalAsync func later in the same digest", function() {
            scope.aValue = [1, 2, 3];
            scope.asyncEvaluated = false;
            scope.asyncEvaluatedImmediately = false;

            scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.$evalAsync(function(scope) {
                        scope.asyncEvaluated = true;
                    });

                    scope.asyncEvaluatedImmediately = scope.asyncEvaluated;
                }
            );

            scope.$digest();
            expect(scope.asyncEvaluated).toBe(true);
            expect(scope.asyncEvaluatedImmediately).toBe(false);
        });

        // scheduling $evalAsync from watch func
        it("executes $evalAsync in watch func, cause TTL reach error", function() {
            scope.aValue = [1, 2, 3];
            scope.asyncEvaluated = false;

            scope.$watch(
                function(scope) { 
                    // schedule evalAsync in watch func
                    // should be avoided in watch func, since it has side effect of scheduling async task
                    // scheduling a task is the side effect, every digest loop will trigger one
                    scope.$evalAsync(function(scope) {
                        scope.asyncEvaluated = true;
                    });
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {}
            );

            //
            expect(function(){ scope.$digest(); }).toThrow();
        });

        it("executes $evalAsync in watch func when no dirty", function() {
            scope.aValue = [1, 2, 3];
            scope.asyncEvaluatedTimes = 0;

            scope.$watch(
                function(scope) {
                    if(scope.asyncEvaluatedTimes < 2) {
                        scope.$evalAsync(function(scope) {
                            scope.asyncEvaluatedTimes++;
                        });
                    }
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) { }
            );

            scope.$digest();
            expect(scope.asyncEvaluatedTimes).toBe(2);
        });

        // scope phase related
        it("has a $$phase field for current digest phase", function() {
            scope.aValue = [1, 2, 3];
            scope.phaseInWatchFunction = undefined;
            scope.phaseInListenerFunction = undefined;
            scope.phaseInApplyFunction = undefined;

            scope.$watch(
                function(scope) {
                    scope.phaseInWatchFunction = scope.$$phase;
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {
                    scope.phaseInListenerFunction = scope.$$phase;
                }
            );

            // no need to call $digest since $apply will do it now
            scope.$apply(function(scope) {
                scope.phaseInApplyFunction = scope.$$phase;
            });

            expect(scope.phaseInWatchFunction).toBe("$digest");
            expect(scope.phaseInListenerFunction).toBe("$digest");
            expect(scope.phaseInApplyFunction).toBe("$apply");
        });

        it("schedules a digest in $evalAsync", function(done) {
            scope.aValue = "abc";
            scope.counter = 0;

            scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            // $evalAsync will schedule a digest cycle async
            scope.$evalAsync(function(scope) {

            });

            expect(scope.counter).toBe(0);
            setTimeout(function() {
                expect(scope.counter).toBe(1);
                done();
            }, 50);
        });

        // $$postDigest related
        it("runs a $$postDigest after each digest", function() {
            scope.counter = 0;

            scope.$$postDigest(function() {
                scope.counter++;
            });

            expect(scope.counter).toBe(0);
            scope.$digest();
            expect(scope.counter).toBe(1);

            // another digest will not impact
            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        it("$$postDigest runs after digest", function() {
            scope.aValue = 1;

            scope.$$postDigest(function() {
                scope.aValue = 2;
            });

            scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.watchedValue = newValue;
                }
            );

            // in fact, the postDigest has been run after this digest
            // but since it is run after digest, changes cannot be detected
            scope.$digest();
            expect(scope.watchedValue).toBe(1);

            scope.$digest();
            expect(scope.watchedValue).toBe(2);
        });

        // handling exceptions
        it("catches exception in watch func and continues", function() {
            scope.aValue = 1;
            scope.counter = 0;

            scope.$watch(
                function(scope) { throw "Watch Error"; },
                function(newValue, oldValue, scope) {

                }
            );

            scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        it("catches exception in listener func and continues", function() {
            scope.aValue = 1;
            scope.counter = 0;

            scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    throw "Listener Error";
                }
            );

            scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        it("catches exception in $evalAsync", function(done) {
            scope.aValue = 1;
            scope.counter = 0;

            scope.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$evalAsync(function(scope) {
                throw "EvalAsync Error";
            });

            setTimeout(function() {
                expect(scope.counter).toBe(1);
                done();
            }, 50);
        });

        it("catches exception in $$postDigest", function() {
            var didRun = false;

            scope.$$postDigest(function() {
                throw "PostDigest Error";
            });

            scope.$$postDigest(function() {
                didRun = true;
            });

            scope.$digest();
            expect(didRun).toBe(true);
        });

        // destroying a watch
        it("allows destroying a $watch with a removal func", function() {
            scope.aValue = 1;
            scope.counter = 0;

            var destroyFn = scope.$watch(
                    function(scope) { return scope.aValue; },
                    function(newValue, oldValue, scope) {
                        scope.counter++;
                    }
                );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.aValue = 2;
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.aValue = 3;
            destroyFn();
            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        it("destroying watcher in watch func", function() {
            scope.aValue = 1;

            var watchCalls = [];

            scope.$watch(
                function(scope) {
                    watchCalls.push(1);
                    return scope.aValue;
                }
            );

            var destroyFn = scope.$watch(
                function(scope) {
                    watchCalls.push(2);
                    destroyFn();
                }
            );

            scope.$watch(
                function(scope) {
                    watchCalls.push(3);
                    return scope.aValue;
                }
            );

            scope.$digest();
            expect(watchCalls).toEqual([1, 2, 3, 1, 3]);
        });

        // destroy one
        it("destroying watcher in another watch", function() {
            scope.aValue = 1;
            scope.counter = 0;

            scope.$watch(
                function(scope) {
                    console.log(1);
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {
                    destroyFn();
                }
            );

            var destroyFn = scope.$watch(
                function(scope) {
                },
                function(newValue, oldValue, scope) {
                }
            );

            scope.$watch(
                function(scope) {
                    console.log(3);
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        // destroy several
        it("destroying several watchers", function() {
            scope.aValue = 1;
            scope.counter = 0;

            var destroyWatch1 = scope.$watch(
                function(scope) {
                    // in watch func
                    destroyWatch1();
                    destroyWatch2();
                }
            );

            var destroyWatch2 = scope.$watch(
                function(scope) {
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(0);
        });

    });

    describe("inheritance", function() {

        it("inherits the parent prop", function() {
            var parent = new Scope();
            parent.aValue = [1, 2, 3];

            var child = parent.$new();

            expect(child.aValue).toEqual([1, 2, 3]);
        });

        it("parent cannot access to prop on child", function() {
            var parent = new Scope();

            var child = parent.$new();
            child.aValue = [1, 2, 3];

            expect(parent.aValue).toBeUndefined();
        });

        it("inherits from parent prop when defined", function() {
            var parent = new Scope();
            var child = parent.$new();

            parent.aValue = [1, 2, 3];
            expect(child.aValue).toEqual([1, 2, 3]);
        });

        it("change the prop on parent from child", function() {
            var parent = new Scope();
            var child = parent.$new();

            parent.aValue = [1, 2, 3];
            child.aValue.push(4);

            expect(parent.aValue).toEqual([1, 2, 3, 4]);
            expect(child.aValue).toEqual([1, 2, 3, 4]);
        });

        it("watch a prop on parent from child", function() {
            var parent = new Scope();
            var child = parent.$new();

            parent.aValue = [1, 2, 3];
            child.counter = 0;

            child.$watch(
                function(scope) {
                    return scope.aValue; 
                },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                },
                true
            );

            child.$digest();
            expect(child.counter).toBe(1);

            parent.aValue.push(4);
            child.$digest();
            expect(child.counter).toBe(2);
        });

        it("can be nested at any depth", function() {
            var a = new Scope();
            var aa = a.$new();
            var aaa = aa.$new();
            var aab = aa.$new();
            var ab = a.$new();
            var abb = ab.$new();
            a.value = 1;
            expect(aa.value).toBe(1);
            expect(aaa.value).toBe(1);
            expect(aab.value).toBe(1);
            expect(ab.value).toBe(1);
            expect(abb.value).toBe(1);
            ab.anotherValue = 2;
            expect(abb.anotherValue).toBe(2);
            expect(aa.anotherValue).toBeUndefined();
            expect(aaa.anotherValue).toBeUndefined();
        });

        it("shadows a parent's prop by child", function() {
            var parent = new Scope();
            var child = parent.$new();

            parent.name = "Joe";
            child.name = "Jill";

            expect(parent.name).toBe("Joe");
            expect(child.name).toBe("Jill");
        });

        it("does not shadow since it is using object", function() {
            var parent = new Scope();
            var child = parent.$new();

            parent.user = {name: "Joe"};
            child.user.name = "Jill";

            expect(parent.user.name).toBe("Jill");
            expect(child.user.name).toBe("Jill");
        });

        // digest related
        it("does not digest its parent", function() {
            var parent = new Scope();
            var child = parent.$new();

            parent.aValue = "abc";
            parent.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.aValueWas = newValue;
                }
            );

            child.$digest();
            expect(child.aValueWas).toBeUndefined();
        });

        // recursive digesting
        it("keep refs to children", function() {
            var parent = new Scope();
            var child1 = parent.$new();
            var child2 = parent.$new();
            var child21 = child2.$new();

            expect(parent.$$children.length).toBe(2);
            expect(parent.$$children[0]).toBe(child1);
            expect(parent.$$children[1]).toBe(child2);

            expect(child1.$$children.length).toBe(0);

            expect(child2.$$children.length).toBe(1);
            expect(child2.$$children[0]).toBe(child21);
        });

        it("digests children", function() {
            var parent = new Scope();
            var child = parent.$new();

            parent.aValue = "abc";
            child.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.aValueWas = newValue;
                }
            );

            // this will trigger digest cycle for children
            parent.$digest();
            expect(child.aValueWas).toBe("abc");
        });

        // digesting the whole tree from $apply and $evalAsync
        it("digests from root when calling $apply", function() {
            var parent = new Scope();
            var child = parent.$new();
            var child2 = child.$new();

            parent.aValue = 1;
            parent.counter = 0;

            parent.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            // trigger digest from root scope
            child.$apply(function(scope) { });
            expect(parent.counter).toBe(1);
        });

        it("schedules a digest from root by $evalAsync", function(done) {
            var parent = new Scope();
            var child = parent.$new();
            var child2 = child.$new();

            parent.aValue = 1;
            parent.counter = 0;
            parent.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            child2.$evalAsync(function(scope) { });

            setTimeout(function() {
                expect(parent.counter).toBe(1);
                done();
            }, 50);
        });

        // isolated scope related
        it("does not have access to parent prop when isolated", function() {
            var parent = new Scope();
            var child = parent.$new(true);

            parent.aValue = "abc";
            expect(child.aValue).toBeUndefined();
        });

        it("cannot watch parent prop when isolated", function() {
            var parent = new Scope();
            var child = parent.$new(true);

            parent.aValue = "abc";
            child.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.aValueWas = newValue;
                }
            );

            child.$digest();
            expect(child.aValueWas).toBeUndefined();
        });

        it("digests its isolated children", function() {
            var parent = new Scope();
            var child = parent.$new(true);

            child.aValue = "abc";
            child.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.aValueWas = newValue;
                }
            );

            parent.$digest();
            expect(child.aValueWas).toBe("abc");
        });

        // $apply always trigger digest on root scope
        it("digests from root on $apply when isolated", function() {
            var parent = new Scope();
            var child = parent.$new(true);
            var child2 = child.$new();

            parent.aValue = "abc";
            parent.counter = 0;
            parent.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            child2.$apply(function(scope){ });
            expect(parent.counter).toBe(1);
        });

        // $evalAsync always trigger digest on root scope
        it("schedules a digest from root on $evalAsync when isolated", function(done) {
            var parent = new Scope();
            var child = parent.$new(true);
            var child2 = child.$new();

            parent.aValue = "abc";
            parent.counter = 0;
            parent.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            child2.$evalAsync(function(scope){ });

            setTimeout(function() {
                expect(parent.counter).toBe(1);
                done();
            }, 50);
        });

        // $evalAsync always trigger digest on root scope
        it("executes $evalAsync functions on isolated scopes", function(done) {
            var parent = new Scope();
            var child = parent.$new(true);

            child.$evalAsync(function(scope) {
                scope.didEvalAsync = true;
            });

            setTimeout(function() {
                expect(child.didEvalAsync).toBe(true);
                done();
            }, 50);
        });

        it("executes $$postDigest functions on isolated scopes", function() {
            var parent = new Scope();
            var child = parent.$new(true);
            
            child.$$postDigest(function() {
                child.didPostDigest = true;
            });
            parent.$digest();
            expect(child.didPostDigest).toBe(true);
        });

        // destroy related
        it("is no longer digested when $destroy has been called", function() {
            var parent = new Scope();
            var child = parent.$new();

            child.aValue = [1, 2, 3];
            child.counter = 0;
            child.$watch(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                },
                true
            );

            parent.$digest();
            expect(child.counter).toBe(1);

            parent.$digest();
            expect(child.counter).toBe(1);

            child.aValue.push(4);
            parent.$digest();
            expect(child.counter).toBe(2);

            child.$destroy();
            child.aValue.push(5);
            parent.$digest();
            expect(child.counter).toBe(2);
        });
    });

    // watch collection
    describe("$watchCollection", function() {
        var scope;

        beforeEach(function() {
            scope = new Scope();
        });

        it("works like a normal $watch for non-collection", function() {
            var valueProvided;

            scope.aValue = 1;
            scope.counter = 0;

            scope.$watchCollection(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    valueProvided = newValue;
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);
            expect(valueProvided).toBe(scope.aValue);

            scope.aValue = 2;
            scope.$digest();
            expect(scope.counter).toBe(2);
            expect(valueProvided).toBe(scope.aValue);

            scope.$digest();
            expect(scope.counter).toBe(2);
            expect(valueProvided).toBe(scope.aValue);
        });

        it("works like a normal watch for NaNs", function() {
            scope.aValue = 0 / 0;
            scope.counter = 0;

            scope.$watchCollection(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        it("notices when the value becomes an array", function() {
            scope.counter = 0;

            scope.$watchCollection(
                function(scope) { return scope.arr; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.arr = [1, 2, 3];
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        // detecting new or removed items in array
        it("notices add of item in array", function() {
            scope.arr = [1, 2, 3];
            scope.counter = 0;

            scope.$watchCollection(
                function(scope) { return scope.arr; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.arr.push(4);
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        it("notices remove of item in array", function() {
            scope.arr = [1, 2, 3];
            scope.counter = 0;

            scope.$watchCollection(
                function(scope) { return scope.arr; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.arr.shift();
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        // detecting replaced or reordered items in array
        it("notices an item replaced", function() {
            scope.arr = [1, 2, 3];
            scope.counter = 0;

            scope.$watchCollection(
                function(scope) { return scope.arr; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.arr[1] = 22;
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        it("notices items reordering", function() {
            scope.arr = [2, 1, 3];
            scope.counter = 0;

            scope.$watchCollection(
                function(scope) { return scope.arr; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.arr.sort();
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        it("does not fail on NaNs in array", function() {
            scope.arr = [2, NaN, 3];
            scope.counter = 0;

            scope.$watchCollection(
                function(scope) { return scope.arr; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        // array-like object
        it("notices an item replaced in arguments object", function() {
            (function() {
                scope.arrayLike = arguments;
            })(1, 2, 3);

            scope.counter = 0;

            scope.$watchCollection(
                function(scope) { return scope.arrayLike; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.arrayLike[1] = 22;
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        // handle NodeList object
        it("notices an item replaced in a NodeList object", function() {
            document.documentElement.appendChild(document.createElement("div"));
            scope.arrayLike = document.getElementsByTagName("div");

            scope.counter = 0;

            scope.$watchCollection(
                function(scope) { return scope.arrayLike; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            // the nodelist is a live collection, will be updated auto
            document.documentElement.appendChild(document.createElement("div"));
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        // detecting new objects
        it("notices when the value becomes an object", function() {
            scope.counter = 0;

            scope.$watchCollection(
                function(scope) { return scope.obj; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.obj = {a: 1};
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        it("notices when an array becomes an object", function() {
            scope.counter = 0;
            scope.obj = [1, 2, 3];

            scope.$watchCollection(
                function(scope) { return scope.obj; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.obj = {a: 1};
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        // detecting new or replaced attr on object
        it("notices when an attr is added to object", function() {
            scope.counter = 0;
            scope.obj = {a: 1};

            scope.$watchCollection(
                function(scope) { return scope.obj; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.obj.b = 2;
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        it("notices when an attr is changed", function() {
            scope.counter = 0;
            scope.obj = {a: 1};

            scope.$watchCollection(
                function(scope) { return scope.obj; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.obj.a = 2;
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        it("does not fail when the attribute is NaN", function() {
            scope.counter = 0;
            scope.obj = {a: NaN};

            scope.$watchCollection(
                function(scope) { return scope.obj; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        // detecting removed attr
        it("notices when an attr is removed from object", function() {
            scope.counter = 0;
            scope.obj = {a: 1};

            scope.$watchCollection(
                function(scope) { return scope.obj; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            delete scope.obj.a;
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        // dealing with object has a length attr
        it("does not consider any object with a length attr as array", function() {
            scope.counter = 0;
            scope.obj = {length: 42, otherKey: "a"};

            scope.$watchCollection(
                function(scope) { return scope.obj; },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.obj.newKey = "b";
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        // handling old values
        it("gives the old non-collection value to listener", function() {
            scope.aValue = 1;
            var oldValueGiven;

            scope.$watchCollection(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    oldValueGiven = oldValue;
                }
            );

            scope.$digest();
            scope.aValue = 2;
            scope.$digest();
            expect(oldValueGiven).toBe(1);
        });

        it("gives the old collection value to listener", function() {
            scope.aValue = [1, 2, 3];
            var oldValueGiven;

            scope.$watchCollection(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    oldValueGiven = oldValue;
                }
            );

            scope.$digest();
            scope.aValue.push(4);
            scope.$digest();
            expect(oldValueGiven).toEqual([1, 2, 3]);
        });

        it("gives the old object value to listener", function() {
            scope.aValue = {a: 1};
            var oldValueGiven;

            scope.$watchCollection(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    oldValueGiven = oldValue;
                }
            );

            scope.$digest();
            scope.aValue.b = 2;
            scope.$digest();
            expect(oldValueGiven).toEqual({a: 1});
        });

        it("old value should be equal to new value on first digest", function() {
            scope.aValue = {a: 1};
            var oldValueGiven;

            scope.$watchCollection(
                function(scope) { return scope.aValue; },
                function(newValue, oldValue, scope) {
                    oldValueGiven = oldValue;
                }
            );

            scope.$digest();
            expect(oldValueGiven).toEqual({a: 1});
        });
    });

    describe("events", function() {

        var parent;
        var scope;
        var child;
        var isolatedChild;

        beforeEach(function() {
            parent = new Scope();
            scope = parent.$new();
            child = scope.$new();
            isolatedChild = scope.$new(true);
        });

        it("allows registering listeners", function() {
            var listener1 = function() { };
            var listener2 = function() { };
            var listener3 = function() { };

            scope.$on("someEvent", listener1);
            scope.$on("someEvent", listener2);
            scope.$on("someOtherEvent", listener3);

            expect(scope.$$listeners).toEqual({
                someEvent: [listener1, listener2],
                someOtherEvent: [listener3]
            });
        });

        it("registers different listener for every scope", function() {
            var listener1 = function() { };
            var listener2 = function() { };
            var listener3 = function() { };

            scope.$on("someEvent", listener1);
            child.$on("someEvent", listener2);
            isolatedChild.$on("someEvent", listener3);

            expect(scope.$$listeners).toEqual({
                someEvent: [listener1]
            });
            expect(child.$$listeners).toEqual({
                someEvent: [listener2]
            });
            expect(isolatedChild.$$listeners).toEqual({
                someEvent: [listener3]
            });
        });

        // handle $emit and $broadcast on the same scope
        // common test cases for both $emit and $broadcast
        _.forEach(["$emit", "$broadcast"], function(method) {

            it("calls the listeners of the matching event on " + method, function() {
                var listener1 = jasmine.createSpy();
                var listener2 = jasmine.createSpy();

                scope.$on("someEvent", listener1);
                scope.$on("someOtherEvent", listener2);

                scope[method]("someEvent");

                expect(listener1).toHaveBeenCalled();
                expect(listener2).not.toHaveBeenCalled();
            });

            it("passes an event object with a name to listeners on " + method, function() {
                var listener = jasmine.createSpy();
                scope.$on("someEvent", listener);

                scope[method]("someEvent");

                expect(listener).toHaveBeenCalled();
                expect(listener.calls.mostRecent().args[0].name).toEqual("someEvent");
            });

            it("passes the same event object to each listener on " + method, function() {
                var listener1 = jasmine.createSpy();
                var listener2 = jasmine.createSpy();

                scope.$on("someEvent", listener1);
                scope.$on("someEvent", listener2);

                scope[method]("someEvent");

                var event1 = listener1.calls.mostRecent().args[0];
                var event2 = listener2.calls.mostRecent().args[0];

                expect(event1).toBe(event2);
            });

            it("passes additional arguments to listeners on " + method, function() {
                var listener = jasmine.createSpy();
                scope.$on("someEvent", listener);

                scope[method]("someEvent", "1", [2, 3], "4");

                expect(listener.calls.mostRecent().args[1]).toEqual("1");
                expect(listener.calls.mostRecent().args[2]).toEqual([2, 3]);
                expect(listener.calls.mostRecent().args[3]).toEqual("4");
            });

            it("returns the event object on " + method, function() {
                var returnedEvent = scope[method]("someEvent");

                expect(returnedEvent).toBeDefined();
                expect(returnedEvent.name).toEqual("someEvent");
            });

            it("can be deregistered " + method, function() {
                var listener = jasmine.createSpy();
                var deregister = scope.$on("someEvent", listener);

                deregister();

                scope[method]("someEvent");

                expect(listener).not.toHaveBeenCalled();
            });

            it("does not skip next listener when removed on " + method, function() {
                var deregister;

                var listener = function() {
                    deregister();
                };

                var nextListener = jasmine.createSpy();

                deregister = scope.$on("someEvent", listener);
                scope.$on("someEvent", nextListener);

                scope[method]("someEvent");

                expect(nextListener).toHaveBeenCalled();
            });

            // for preventDefault testing
            it("is sets defaultPrevented when preventDefault called on " + method, function() {
                var listener = function(event) {
                    event.preventDefault();
                };

                scope.$on("someEvent", listener);

                var event = scope[method]("someEvent");

                expect(event.defaultPrevented).toBe(true);
            });

            it("does not stop on executions for listeners on " + method, function() {
                var listener1 = function(event) {
                    throw "Listener 1 Error";
                };
                var listener2 = jasmine.createSpy();

                scope.$on("someEvent", listener1);
                scope.$on("someEvent", listener2);

                scope[method]("someEvent");

                expect(listener2).toHaveBeenCalled();
            });

        });

        it("propagates up the scope hierarchy on $emit", function() {
            var parentListener = jasmine.createSpy();
            var scopeListener = jasmine.createSpy();

            parent.$on("someEvent", parentListener);
            scope.$on("someEvent", scopeListener);

            scope.$emit("someEvent");

            expect(scopeListener).toHaveBeenCalled();
            expect(parentListener).toHaveBeenCalled();
        });

        it("propagates the same event up on $emit", function() {
            var parentListener = jasmine.createSpy();
            var scopeListener = jasmine.createSpy();

            parent.$on("someEvent", parentListener);
            scope.$on("someEvent", scopeListener);

            scope.$emit("someEvent");

            var scopeEvent = scopeListener.calls.mostRecent().args[0];
            var parentEvent = parentListener.calls.mostRecent().args[0];

            expect(scopeEvent).toBe(parentEvent);
        });

        it("propagates down the scope by broadcast", function() {
            var scopeListener = jasmine.createSpy();
            var childListener = jasmine.createSpy();
            var isolatedChildListener = jasmine.createSpy();

            scope.$on("someEvent", scopeListener);
            child.$on("someEvent", childListener);
            isolatedChild.$on("someEvent", isolatedChildListener);

            scope.$broadcast("someEvent");

            expect(scopeListener).toHaveBeenCalled();
            expect(childListener).toHaveBeenCalled();
            expect(isolatedChildListener).toHaveBeenCalled();
        });

        it("propagates down the same event by broadcast", function() {
            var scopeListener = jasmine.createSpy();
            var childListener = jasmine.createSpy();
            var isolatedChildListener = jasmine.createSpy();

            scope.$on("someEvent", scopeListener);
            child.$on("someEvent", childListener);
            isolatedChild.$on("someEvent", isolatedChildListener);

            scope.$broadcast("someEvent");

            var scopeEvent = scopeListener.calls.mostRecent().args[0];
            var childEvent = childListener.calls.mostRecent().args[0];
            var isolatedChildEvent = isolatedChildListener.calls.mostRecent().args[0];

            expect(scopeEvent).toBe(childEvent);
            expect(scopeEvent).toBe(isolatedChildEvent);
            expect(childEvent).toBe(isolatedChildEvent);
        });

        it("attaches targetScope on $emit", function() {
            var parentListener = jasmine.createSpy();
            var scopeListener = jasmine.createSpy();

            parent.$on("someEvent", parentListener);
            scope.$on("someEvent", scopeListener);

            scope.$emit("someEvent");

            expect(parentListener.calls.mostRecent().args[0].targetScope).toBe(scope); 
            expect(scopeListener.calls.mostRecent().args[0].targetScope).toBe(scope); 
        });

        it("attaches targetScope on $broadcast", function() {
            var scopeListener = jasmine.createSpy();
            var childListener = jasmine.createSpy();

            scope.$on("someEvent", scopeListener);
            child.$on("someEvent", childListener);

            scope.$broadcast("someEvent");

            expect(scopeListener.calls.mostRecent().args[0].targetScope).toBe(scope); 
            expect(childListener.calls.mostRecent().args[0].targetScope).toBe(scope); 
        });

        it("attaches currentScope on $emit", function() {
            var currentScopeOnScope, currentScopeOnParent;

            var scopeListener = function(event) {
                currentScopeOnScope = event.currentScope;
            };

            var parentListener = function(event) {
                currentScopeOnParent = event.currentScope;
            };

            scope.$on("someEvent", scopeListener);
            parent.$on("someEvent", parentListener);

            scope.$emit("someEvent");

            expect(currentScopeOnScope).toBe(scope);
            expect(currentScopeOnParent).toBe(parent);
        });

        it("attaches currentScope on $broadcast", function() {
            var currentScopeOnScope, currentScopeOnChild, currentScopeOnIsolatedChild;

            var scopeListener = function(event) {
                currentScopeOnScope = event.currentScope;
            };

            var childListener = function(event) {
                currentScopeOnChild = event.currentScope;
            };

            var isolatedChildListener = function(event) {
                currentScopeOnIsolatedChild = event.currentScope;
            };

            scope.$on("someEvent", scopeListener);
            child.$on("someEvent", childListener);
            isolatedChild.$on("someEvent", isolatedChildListener);

            scope.$broadcast("someEvent");

            expect(currentScopeOnScope).toBe(scope);
            expect(currentScopeOnChild).toBe(child);
            expect(currentScopeOnIsolatedChild).toBe(isolatedChild);
        });

        it("does not continue propagate when stopped during $emit", function() {
            var scopeListener = function(event) {
                event.stopPropagation();
            };

            var parentListener = jasmine.createSpy();

            scope.$on("someEvent", scopeListener);
            parent.$on("someEvent", parentListener);

            scope.$emit("someEvent");

            expect(parentListener).not.toHaveBeenCalled();
        });

        it("is received by listeners on current scope after been stopped", function() {
            var scopeListener = function(event) {
                event.stopPropagation();
            };

            var scopeListener2 = jasmine.createSpy();

            scope.$on("someEvent", scopeListener);
            scope.$on("someEvent", scopeListener2);

            scope.$emit("someEvent");

            expect(scopeListener2).toHaveBeenCalled(); 
        });

        // $destroy event related
        it("fires $destroy when destroyed", function() {
            var listener = jasmine.createSpy();
            scope.$on("$destroy", listener);

            scope.$destroy();

            expect(listener).toHaveBeenCalled();
        });

        it("fires $destroy on children as well", function() {
            var childListener = jasmine.createSpy();
            child.$on("$destroy", childListener);

            scope.$destroy();

            expect(childListener).toHaveBeenCalled();
        });

    });

    describe("integrate parse in", function() {

        var scope;

        beforeEach(function() {
            scope = new Scope();
        });

        it("accepts expr for watch function", function() {
            var theValue;

            scope.$watch("1", function(newValue, oldValue, scope) {
                theValue = newValue;
            });

            scope.$digest();

            expect(theValue).toBe(1);
        });

        // since for constant watch, it will never become dirty again
        it("removes constant watches after first invocation", function() {
            scope.$watch("42", function(){ });
            scope.$digest();

            expect(scope.$$watchers.length).toBe(0);
        });

        it("accepts expr for listener function in watch without throwing exception", function() {
            scope.$watch("42", "'fourty-two'");
            scope.$digest();
        });

        it("accepts expr for watch collection func", function() {
            var theValue;

            scope.$watchCollection('[1, 2, 3]', function(newValue, oldValue, scope) {
                theValue = newValue;
            });

            scope.$digest();
            expect(theValue).toEqual([1, 2, 3]);
        });

        it("accepts expr for listener function in watch collection without throwing exception", function() {
            scope.$watchCollection("[1, 2, 3]", "'one-two-three'");
            scope.$digest();
        });

        it("accepts expr in $eval", function() {
            expect(scope.$eval("42")).toBe(42);
        });

        it("accepts expr in $apply", function() {
            expect(scope.$apply("42")).toBe(42);
        });

        it("accepts expr in $evalAsync", function(done) {
            scope.$evalAsync("42");
            scope.$$postDigest(done);
        });

    });

});
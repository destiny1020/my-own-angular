/* jshint globalstrict: true */
// will fix this global parse issue after implementing DI
/* global parse: false */
"use strict";

describe("parse", function() {

    it("can parse an integer", function() {
        var fn = parse("42");

        expect(fn).toBeDefined();
        expect(fn()).toBe(42);
    });

    it("makes integers both constant and literal", function() {
        var fn = parse("42");

        expect(fn.constant).toBe(true);
        expect(fn.literal).toBe(true);
    });

    it("can parse a floating point number", function() {
        var fn = parse("0.42");

        expect(fn).toBeDefined();
        expect(fn()).toBe(0.42);
    });

    it("can parse a floating point number without integer part", function() {
        var fn = parse(".42");

        expect(fn).toBeDefined();
        expect(fn()).toBe(0.42);
    });

    // parse scientific notation
    it("can parse a number in scientific notation", function() {
        var fn = parse("42e3");

        expect(fn).toBeDefined();
        expect(fn()).toBe(42000);
    });

    it("can parse scientific notation with a float coefficient", function() {
        var fn = parse(".42e3");

        expect(fn).toBeDefined();
        expect(fn()).toBe(420);
    });

    it("can parse scientific notation with negative exponents", function() {
        var fn = parse("4200e-3");

        expect(fn).toBeDefined();
        expect(fn()).toBe(4.2);
    });

    it("can parse scientific notation with the + sign", function() {
        var fn = parse("4.2e+3");

        expect(fn).toBeDefined();
        expect(fn()).toBe(4200);
    });

    it("can parse uppercase scientific notation", function() {
        var fn = parse("4.2E+3");

        expect(fn).toBeDefined();
        expect(fn()).toBe(4200);
    });

    it("will not parse invalid scientific notation", function() {
        expect(function() {
            parse("42e-");
        }).toThrow();

        expect(function() {
            parse("42e-a");
        }).toThrow();
    });

    // parse string related
    it("can parse a string in single quotes", function() {
        var fn = parse("'abc'");
        expect(fn()).toEqual("abc");
    });

    it("can parse a string in double quotes", function() {
        var fn = parse("'abc'");
        expect(fn()).toEqual("abc");
    });

    it("will not parse a string with different quotes", function() {
        expect(function(){ parse("'abc\""); }).toThrow();
    });

    it("marks strings as literal and constant", function() {
        var fn = parse("'abc'");

        expect(fn.literal).toBe(true);
        expect(fn.constant).toBe(true);
    });

    it("will parse a string with character escapes", function() {
        var fn = parse("'\\n\\r\\\\'");

        expect(fn()).toEqual("\n\r\\");
    });

    it("will parse a string with unicode escapes", function() {
        var fn = parse("'\\u00A0'");

        expect(fn()).toEqual("\u00A0");
    });

    it("will not parse a string with invalid unicode escapes", function() {
        expect(function() { parse("'\\u00T0'"); }).toThrow();
    });

    // parse boolean related
    it("will parse null", function() {
        var fn = parse("null");

        expect(fn()).toBe(null);
    });

    it("will parse true", function() {
        var fn = parse("true");

        expect(fn()).toBe(true);
    });

    it("will parse false", function() {
        var fn = parse("false");

        expect(fn()).toBe(false);
    });

    it("marks booleans as literal and constant", function() {
        var fn = parse("true");

        expect(fn.literal).toBe(true);
        expect(fn.constant).toBe(true);
    });

    it("marks null as literal and constant", function() {
        var fn = parse("null");

        expect(fn.literal).toBe(true);
        expect(fn.constant).toBe(true);
    });

    // whitespace related
    it("ignores whitespace", function() {
        var fn = parse("  \n42   ");

        expect(fn()).toBe(42);
    });

    // array related
    it("will parse an empty array", function() {
        var fn = parse("[]");

        expect(fn()).toEqual([]);
    });

    it("will parse a non-empty array", function() {
        var fn = parse("[1, 'two', [3]]");

        expect(fn()).toEqual([1, "two", [3]]);
    });

    it("will parse an array with trailing commas", function() {
        var fn = parse("[1, 2, 3, ]");

        expect(fn()).toEqual([1, 2, 3]);
    });

    it("marks array literals as literal and constant", function() {
        var fn = parse("[1, 2, 3]");

        expect(fn.literal).toBe(true);
        expect(fn.constant).toBe(true);
    });

    it("throw when array definition is not correct", function() {
        expect(function(){ parse("[1, 2, 3"); }).toThrow();
    });

    // object related
    it("will parse an empty object", function() {
        var fn = parse("{}");

        expect(fn()).toEqual({});
    });

    it("will parse a non-empty object", function() {
        var fn = parse("{a: 1, b: [2, 3], c: {d: 4}}");

        expect(fn()).toEqual({a: 1, b: [2, 3], c: {d: 4}});
    });

    it("will parse an object with string keys", function() {
        var fn = parse("{'a key': 1, \'another-key\': 2}");

        expect(fn()).toEqual({"a key": 1, "another-key": 2});
    });

    // make parse more robust
    it("returns the function itself when given one", function() {
        var fn = function() {};

        expect(parse(fn)).toBe(fn);
    });

    it("returns a function when given no argument", function() {
        expect(parse()).toEqual(jasmine.any(Function));
    });

    // scope access
    it("looks up an attr in scope", function() {
        var fn = parse("aKey");

        expect(fn({aKey: 42})).toBe(42);
        expect(fn({})).toBeUndefined();
        expect(fn()).toBeUndefined();
    });

    it("looks up 1-level nested attr in scope", function() {
        var fn = parse("aKey.anotherKey");

        expect(fn({aKey: {anotherKey: 42}})).toBe(42);
        expect(fn({aKey: {}})).toBeUndefined();
        expect(fn({})).toBeUndefined();
        expect(fn()).toBeUndefined();
    });

    it("looks up 3-level nested attr in scope", function() {
        var fn = parse("aKey.bKey.cKey.dKey");

        expect(fn({aKey: {bKey: {cKey: {dKey: 42}}}})).toBe(42);
        expect(fn({aKey: {bKey: {cKey: {}}}})).toBeUndefined();
        expect(fn({})).toBeUndefined();
        expect(fn()).toBeUndefined();
    });

    it("cache the fn for parse result", function() {
        var fn = parse("aKey.bKey.cKey.dKey");
        var fn2 = parse("aKey.bKey.cKey.dKey");

        expect(fn).toBe(fn2);
    });

    // locals related
    it("uses locals instead of scope when there is a matching key", function() {
        var fn = parse("aKey");

        expect(fn({aKey: 42}, {aKey: 43})).toBe(43);
    });

    it("does not use locals when there is no matching key", function() {
        var fn = parse("aKey");

        expect(fn({aKey: 42}, {bKey: 43})).toBe(42);
    });

    it("1-level nested, uses locals instead of scope when there is a matching key", function() {
        var fn = parse("aKey.bKey");

        expect(fn({aKey: {bKey: 42}}, {aKey: {bKey: 43}})).toBe(43);
    });

    it("1-level nested, does not use locals when there is no matching key", function() {
        var fn = parse("aKey.bKey");

        expect(fn({aKey: {bKey: 42}}, {cKey: {bKey: 43}})).toBe(42);
    });

    it("uses locals instead of scope when the first part matches", function() {
        var fn = parse("aKey.bKey");

        expect(fn({aKey: {bKey: 42}}, {aKey: {}})).toBeUndefined();
    });

    it("n-level nested, uses locals when there is a matching local key", function() {
        var fn = parse("aKey.key2.key3.key4");

        expect(fn(
            {aKey: {key2: {key3: {key4: 42}}}},
            {aKey: {key2: {key3: {key4: 43}}}}
        )).toBe(43);
    });

    it("n-level nested, uses locals when first part in local matches", function() {
        var fn = parse("aKey.key2.key3.key4");

        expect(fn(
            {aKey: {key2: {key3: {key4: 42}}}},
            {aKey: {}}
        )).toBeUndefined();
    });

    it("n-level nested, does not use locals when there is no matching", function() {
        var fn = parse("aKey.key2.key3.key4");

        expect(fn(
            {aKey: {key2: {key3: {key4: 42}}}},
            {bKey: {}}
        )).toBe(42);
    });

    // square bracket prop access
    it("parses a simple string property access", function() {
        var fn = parse("aKey['anotherKey']");

        expect(fn({aKey: {anotherKey: 42}})).toBe(42);
    });

    it("parses a numeric array access", function() {
        var fn = parse("anArray[1]");

        expect(fn({anArray: [1, 2, 3]})).toBe(2);
    });

    it("parses a property access with another key as property", function() {
        var fn = parse("lock[key]");

        expect(fn({key: "theKey", lock: {theKey: 42}})).toBe(42);
    });

    it("parses property access with another access as property", function() {
        var fn = parse("lock[keys['aKey']]");

        expect(fn({keys: {aKey: "theKey"}, lock: {theKey: 42}})).toBe(42);
    });

    it("parses several field accesses back to back", function() {
        var fn = parse("aKey['anotherKey']['aThirdKey']");

        expect(fn({aKey: {anotherKey: {aThirdKey: 42}}})).toBe(42);
    });

    // field access, combination
    it("parses a field access after a property access", function() {
        var fn = parse("aKey['anotherKey'].aThirdKey");

        expect(fn({aKey: {anotherKey: {aThirdKey: 42}}})).toBe(42);
    });

    it("parses a chain of property and field accesses", function() {
        var fn = parse("aKey['anotherKey'].aThirdKey['aFourthKey']");

        expect(fn({aKey: {anotherKey: {aThirdKey: {aFourthKey: 42}}}})).toBe(42);
    });

    // function calls
    it("parses a function call", function() {
        var fn = parse("aFunction()");

        expect(fn({aFunction: function() { return 42; }})).toBe(42);
    });

    it("parses a function call with a single number argument", function() {
        var fn = parse("aFunction(42)");

        expect(fn({aFunction: function(n) { return n; }})).toBe(42);
    });

    it("parses a function call with a single identifier argument", function() {
        var fn = parse("aFunction(n)");

        expect(fn({aFunction: function(arg) { return arg; }, n: 42})).toBe(42);
    });

    it("parses a function call with a single function call argument", function() {
        var fn = parse("aFunction(argFn())");

        expect(fn({
            argFn: _.constant(42),
            aFunction: function(arg) { return arg; }
        })).toBe(42);
    });

    it("parses function call with multiple arguments", function() {
        var fn = parse("aFunction(37, n, argFn())");

        expect(fn({
            aFunction: function(a1, a2, a3) { return a1 + a2 + a3; },
            n: 2,
            argFn: _.constant(3)
        })).toBe(42);
    });

    it("does not allow calling the function constructor", function() {
        expect(function() {
            var fn = parse("aFunction.constructor('return window;')()");
        }).toThrow();
    });

    it("does not allow accessing __proto__", function() {
        expect(function() {
            var fn = parse("obj.__proto__");
            fn({obj: { }});
        }).toThrow();
    });

    it("does not allow calling __defineGetter__", function() {
        expect(function() {
            var fn = parse("obj.__defineGetter__('evil', fn)");
            fn({obj: { }, fn: function() { }});
        }).toThrow();
    });

    it("does not allow calling __defineSetter__", function() {
        expect(function() {
            var fn = parse("obj.__defineSetter__('evil', fn)");
            fn({obj: { }, fn: function() { }});
        }).toThrow();
    });

    it("does not allow calling __lookupGetter__", function() {
        expect(function() {
            var fn = parse("obj.__lookupGetter__('evil', fn)");
            fn({obj: { }, fn: function() { }});
        }).toThrow();
    });

    it("does not allow calling __lookupSetter__", function() {
        expect(function() {
            var fn = parse("obj.__lookupSetter__('evil', fn)");
            fn({obj: { }, fn: function() { }});
        }).toThrow();
    });

    it("calls functions accessed as prop with the correct this - bracket", function() {
        var scope = {
            anObject: {
                aMember: 1,
                aFunction: function() {
                    return this.aMember;
                }
            }
        };

        var fn = parse("anObject['aFunction']()");
        expect(fn(scope)).toBe(1);
    });

    it("calls functions accessed as field with the correct this - dot", function() {
        var scope = {
            anObject: {
                aMember: 1,
                aFunction: function() {
                    return this.aMember;
                }
            }
        };

        var fn = parse("anObject.aFunction()");
        expect(fn(scope)).toBe(1);
    });

    it("calls method with whitespace before function call", function() {
        var scope = {
            anObject: {
                aMember: 1,
                aFunction: function() {
                    return this.aMember;
                }
            }
        };

        var fn = parse("anObject.aFunction   ()");
        expect(fn(scope)).toBe(1);
    });

    it("clears the this context on function calls", function() {
        var scope = {
            anObject: {
                aMember: 1,
                aFunction: function() {
                    return function() {
                        return this.aMember;
                    };
                }
            }
        };

        var fn = parse("anObject.aFunction()()");
        expect(fn(scope)).toBeUndefined();
    });

    // ensuring safe objects
    it("does not allow accessing window as property", function() {
        var fn = parse("anObject['wnd']");

        expect(function() { fn({ anObject: { wnd: window } }); }).toThrow();
    });

    it("does not allow calling functions of window", function() {
        var fn = parse("wnd.scroll(500, 0)");

        expect(function() { fn({wnd: window}); }).toThrow();
    });

    it("does not allow functions to return window", function() {
        var fn = parse("getWnd()");

        expect(function() { fn({getWnd: _.constant(window)}); }).toThrow();
    });

    it("does not allow calling functions on DOM elements", function() {
        var fn = parse("el.setAttribute('evil', 'true')");

        expect(function() { fn({el: document.documentElement}); }).toThrow();
    });

    it("does not allow calling the aliased function constructor", function() {
        var fn = parse("fnConstructor('return window;')");

        expect(function() {
            fn({fnConstructor: function(){}.constructor});
        }).toThrow();
    });

    it("does not allow calling functions on Object", function() {
        var fn = parse("obj.create({})");

        expect(function() {
            fn({obj: Object});
        }).toThrow();
    });

    // ensuring safe functions, disallow call, apply and bind
    it("does not allow calling call", function() {
        var fn = parse("func.call(obj)");

        expect(function() {
            fn({func: function(){}, obj: {}});
        }).toThrow();
    });

    it("does not allow calling apply", function() {
        var fn = parse("func.apply(obj)");

        expect(function() {
            fn({func: function(){}, obj: {}});
        }).toThrow();
    });

    it("does not allow calling bind", function() {
        var fn = parse("func.bind(obj)");

        expect(function() {
            fn({func: function(){}, obj: {}});
        }).toThrow();
    });

    // assign values
    it("parses a simple attribute assignment", function() {
        var fn = parse("anAttribute = 1");
        var scope = {};
        fn(scope);

        expect(scope.anAttribute).toBe(1);
    });

    it("can assign any primary expression", function() {
        var fn = parse("anAttribute = aFunction()");
        var scope = {aFunction: _.constant(1)};
        fn(scope);

        expect(scope.anAttribute).toBe(1);
    });

    it("parses a nested attribute assignment", function() {
        var fn = parse("anObject.anAttribute = 1");
        var scope = {anObject: {}};
        fn(scope);

        expect(scope.anObject.anAttribute).toBe(1);
    });

    it("creates the objects in the setter path that do not exist", function() {
        var fn = parse("some.nested.path = 1");
        var scope = {};
        fn(scope);

        expect(scope.some.nested.path).toBe(1);
    });

    it("parses an assignment through attribute access", function() {
        var fn = parse("anObject['anAttribute'] = 1");
        var scope = {anObject: {}};
        fn(scope);

        expect(scope.anObject.anAttribute).toBe(1);
    });

    it("parses assignment through field access after bracket access", function() {
        var fn = parse("anObject['anAttribute'].nested = 2");
        var scope = {anObject: {anAttribute: {}}};
        fn(scope);

        expect(scope.anObject.anAttribute.nested).toBe(2);
    });

    // arrays and objects revisited
    it("parses an array with non-literals", function() {
        var fn = parse("[a, b, c()]");

        expect(fn({a: 1, b: 2, c: _.constant(3)})).toEqual([1, 2, 3]);
    });

    it("parses an object with non-literals", function() {
        var fn = parse("{a: a, b: obj.c()}");

        expect(fn({
            a: 1,
            obj: {
                b: _.constant(2),
                c: function() {
                    return this.b();
                }
            }
        })).toEqual({a: 1, b: 2});
    });

    it("makes array constant when they only contain constants", function() {
        var fn = parse("[1, 2, 3, [4]]");

        expect(fn.constant).toBe(true);
    });

    it("makes array non-constant when they contain non-constants", function() {
        expect(parse("[1, 2, a]").constant).toBe(false);
        expect(parse("[1, 2, [[[[[a]]]]]]").constant).toBe(false);
    });

    it("makes objects constant when they only contain constants", function() {
        var fn = parse("{a: 1, b: {c: 3}}");

        expect(fn.constant).toBe(true);
    });

    it("makes objects non-constant when they contain non-constant", function() {
        expect(parse("{a: 1, b: c}").constant).toBe(false);
        expect(parse("{a: 1, b: {c: 1, d: e}}").constant).toBe(false);
    });

    it("allows an array element to be an assignment", function() {
        var fn = parse("[a = 1]");
        var scope = {};

        expect(fn(scope)).toEqual([1]);
        expect(scope.a).toBe(1);
    });

    it("allows an object value to be an assignment", function() {
        var fn = parse("{a: b = 1}");
        var scope = {};

        expect(fn(scope)).toEqual({a: 1});
        expect(scope.b).toBe(1);
    });

});

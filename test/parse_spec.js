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
        var fn = parse('"abc"');
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
        var fn = parse("{'a key': 1, \"another-key\": 2}");

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

});

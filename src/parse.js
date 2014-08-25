/* jshint globalstrict: true */
"use strict";

var ESCAPES = {
    "n": "\n",
    "f": "\f",
    "r": "\r",
    "t": "\t",
    "v": "\v",
    "'": "'",
    "\"": "\""
};

var OPERATORS = {
    "null": _.constant(null),
    "true": _.constant(true),
    "false": _.constant(false)
};

function parse(expr) {
    switch(typeof expr) {
        case "string":
            var lexer = new Lexer();
            var parser = new Parser(lexer);
            return parser.parse(expr); 
        case "function":
            return expr;
        default:
            return _.noop;
    }
    
}

function Lexer() {

}

Lexer.prototype.lex = function(text) {
    this.text = text;
    this.index = 0;
    this.ch = undefined;
    this.tokens = [];

    while(this.index < this.text.length) {
        this.ch = this.text.charAt(this.index);
        // handle number character
        if(this.isNumber(this.ch) ||
           (this.is(".") && this.isNumber(this.peek()))) {
            this.readNumber();
        } else if(this.is("'\"")){
            this.readString(this.ch);
        } else if(this.is("[],{}:.()")) {
            // no fn correlated with the token
            this.tokens.push({
                text: this.ch,
                json: true,
            });
            this.index++;
        } else if(this.isIdent(this.ch)){
            this.readIdent();
        } else if(this.isWhitespace(this.ch)) {
            // just move forward
            this.index++;
        } else {
            throw "Unexpected next character: " + this.ch;
        }
    }

    return this.tokens;
};

Lexer.prototype.is = function(chs) {
    return chs.indexOf(this.ch) >= 0;
};

Lexer.prototype.isNumber = function(ch) {
    return "0" <= ch && ch <= "9";
};

Lexer.prototype.readNumber = function() {
    var number = "";
    while(this.index < this.text.length) {
        var ch = this.text.charAt(this.index).toLowerCase();
        if(this.isNumber(ch) || ch === ".") {
            number += ch;
        } else {
            // 4 situations
            // 1: current is e, next is a valid exp op
            // 2: current is +/-, previous is e, next is number
            // 3: current is +/-, previous is e, next is not number, throw
            // 4: terminate number parsing and emit the token
            var nextCh = this.peek();
            var prevCh = number.charAt(number.length - 1);
            if(ch === "e" && this.isExpOperator(nextCh)) {
                number += ch;
            } else if(this.isExpOperator(ch) && prevCh === "e" && 
                nextCh && this.isNumber(nextCh)) {
                number += ch;
            } else if(this.isExpOperator(ch) && prevCh === "e" && 
                (!nextCh || !this.isNumber(nextCh))) {
                throw "Invalid Exponent";
            } else {
                break;
            }
        }
        this.index++;
    }

    // coerce into number
    number = 1 * number;
    this.tokens.push({
        text: number,
        // a func that always returns the number
        fn: _.constant(number),
        // means the token is a valid json expr
        json: true
    });
};

Lexer.prototype.readString = function(quote) {
    // pass the quote mark
    this.index++;
    var string = "";
    // string with surrounding quotes
    var rawString = quote;
    var escape = false;
    while(this.index < this.text.length) {
        var ch = this.text.charAt(this.index);
        rawString += ch;
        if(escape) {
            // try to escape
            if(ch === "u") {
                var hex = this.text.substring(this.index + 1, this.index + 5);
                // check whether the hex is valid
                if(!hex.match(/[\da-f]{4}/i)) {
                    throw "Invalid Unicode Escape";
                }

                rawString += hex;
                this.index += 4;
                string += String.fromCharCode(parseInt(hex, 16));
            } else {
                var replacement = ESCAPES[ch];
                if(replacement) {
                    string += replacement;
                } else {
                    string += ch;
                }
            }
            escape = false;
        } else if(ch === quote) {
            this.index++;
            this.tokens.push({
                text: rawString,
                string: string,
                fn: _.constant(string),
                json: true
            });
            return;
        } else if(ch === "\\") {
            escape = true;
        } else {
            string += ch;
        }

        this.index++;
    }

    throw "Unmatched Quote";
};

Lexer.prototype.readIdent = function() {
    var text = "";
    while(this.index < this.text.length) {
        var ch = this.text.charAt(this.index);
        if(ch === "." || this.isIdent(ch) || this.isNumber(ch)) {
            text += ch;
        } else {
            break;
        }
        this.index++;
    }

    var token = {
        text: text
    };

    if(OPERATORS.hasOwnProperty(text)) {
        token.fn = OPERATORS[text];
        token.json = true;
    } else {
        // if the text is not built-in identifier, try to access scope
        token.fn = getterFn(text);
    }

    this.tokens.push(token);
};

var getterFn = _.memoize(function(ident) {
    var pathKeys = ident.split(".");
    if(pathKeys.length === 1) {
        return simpleGetterFn1(pathKeys[0]);
    } else if(pathKeys.length === 2){
        return simpleGetterFn2(pathKeys[0], pathKeys[1]);
    } else {
        // more nested case
        return generatedGetterFn(pathKeys);
    }
});

var simpleGetterFn1 = function(key) {
    return function(scope, locals) {
        // return undefined once the scope is undefined. no matter what locals is
        if(!scope) {
            return undefined;
        }
        return (locals && locals.hasOwnProperty(key)) ? locals[key] : scope[key];
    };
};

var simpleGetterFn2 = function(key1, key2) {
    return function(scope, locals) {
        if(!scope) {
            return undefined;
        }
        // drill down the scope object
        scope = (locals && locals.hasOwnProperty(key1)) ? locals[key1] : scope[key1];
        return scope ? scope[key2] : undefined;
    };
};

var generatedGetterFn = function(keys) {
    var code = "";
    _.forEach(keys, function(key, idx) {
        code += "if (!scope) { return undefined; }\n";

        if(idx === 0) {
            code += "scope = (locals && locals.hasOwnProperty('" + key +"')) ? " +
                "locals['" + key + "'] : " +
                "scope['" + key + "'];\n";
        } else {
            code += "scope = scope['"+ key + "'];\n";
        }
    });
    code += "return scope;\n";
    /* jshint -W054 */
    return new Function("scope", "locals", code);
    /* jshint +W054 */
};

Lexer.prototype.peek = function() {
    return this.index < this.text.length - 1 ? 
        this.text.charAt(this.index + 1) :
        false;
};

Lexer.prototype.isExpOperator = function(ch) {
    return ch === "-" || ch === "+" || this.isNumber(ch);
};

Lexer.prototype.isIdent = function(ch) {
    return (ch >= "a" && ch <= "z") ||
        (ch >= "A" && ch <= "Z") ||
        ch === "_" || ch === "$";
};

Lexer.prototype.isWhitespace = function(ch) {
    return (ch === " " ||
        ch === "\r" ||
        ch === "\t" ||
        ch === "\n" ||
        ch === "\v" ||
        ch === "\u00A0");
};

function Parser(lexer) {
    this.lexer = lexer;
}

Parser.prototype.parse = function(text) {
    // tokenize the text
    this.tokens = this.lexer.lex(text);
    return this.primary();
};

Parser.prototype.primary = function() {
    var primary;

    // beginning token
    if(this.expect("[")) {
        primary = this.arrayDeclaration();
    } else if(this.expect("{")) {
        primary = this.object();
    } else {
        var token = this.expect();
        primary = token.fn;
        if(token.json) {
            primary.constant = true;
            primary.literal = true;
        }
    }

    // non-beginning token, prop access, e.g. anArray[idx]
    // replace if by while: in case, anObject["key1"]["key2"]
    var next;
    while((next = this.expect("[", ".", "("))) {
        if(next.text === "[") {
            primary = this.objectIndex(primary);
        } else if(next.text === ".") {
            primary = this.fieldAccess(primary);
        } else if(next.text === "(") {
            primary = this.functionCall(primary);
        }
    }

    return primary;
};

Parser.prototype.objectIndex = function(objFn) {
    // since the content in [] is another primary expr, invoke recursively
    var indexFn = this.primary();
    this.consume("]");

    return function(scope, locals) {
        var obj = objFn(scope, locals);
        var index = indexFn(scope, locals);

        return obj[index];
    };
};

Parser.prototype.fieldAccess = function(objFn) {
    // the token.fn after the "."
    var getter = this.expect().fn;
    return function(scope, locals) {
        var obj = objFn(scope, locals);
        return getter(obj);
    };
};

Parser.prototype.functionCall = function(fnFn) {
    var argFns = [];
    if(!this.peek(")")) {
        do {
            argFns.push(this.primary());
        } while(this.expect(","));
    }
    this.consume(")");
    return function(scope, locals) {
        // resolve the function itself
        var fn = fnFn(scope, locals);

        // prepare all the arguments
        var args = _.map(argFns, function(argFn) {
            return argFn(scope, locals);
        });

        // call it
        return fn.apply(null, args);
    };
};

Parser.prototype.expect = function(e1, e2, e3, e4) {
    var token = this.peek(e1, e2, e3, e4);
    if(token) {
        return this.tokens.shift();
    }
};

Parser.prototype.peek = function(e1, e2, e3, e4) {
    if(this.tokens.length > 0) {
        var text = this.tokens[0].text;
        // when e is declared, return only when matched
        if(text === e1 || text === e2 || text === e3 || text === e4 || 
            (!e1 && !e2 && !e3 && !e4)) {
            // just return, not consume the token
            return this.tokens[0];
        }
    }
};

Parser.prototype.consume = function(e) {
    if(!this.expect(e)) {
        throw "Unexpected. Expecting: " + e;
    }
};

Parser.prototype.arrayDeclaration = function() {
    var elementFns = [];
    if(!this.peek("]")) {
        // means it is not an empty array
        do {
            // tweak to handle trailing comma like [1, 2, 3, ]
            if(this.peek("]")) {
                break;
            }
            elementFns.push(this.primary());
        } while(this.expect(","));
    }

    this.consume("]");

    var arrayFn = function() {
        // map an array will result in another array
        return _.map(elementFns, function(elementFn) {
            return elementFn();
        });
    };

    arrayFn.literal = true;
    arrayFn.constant = true;

    return arrayFn;
};

Parser.prototype.object = function() {
    var keyValues = [];
    if(!this.peek("}")) {
        do {
            var keyToken = this.expect();
            this.consume(":");
            // since value could be any other expression, recursively call primary
            var valueExpr = this.primary();
            keyValues.push({
                // first check string, then fall back on text
                key: keyToken.string || keyToken.text,
                value: valueExpr
            });
        } while(this.expect(","));
    }

    this.consume("}");
    var objectFn = function() {
        var object = {};
        _.forEach(keyValues, function(kv) {
            // call the value fn to get the real content
            object[kv.key] = kv.value();
        });

        return object;
    };

    objectFn.constant = true;
    objectFn.literal = true;

    return objectFn;
};
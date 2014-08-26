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
    "false": _.constant(false),

    // arithmetic operators
    "+": function(self, locals, a, b) {
        a = a(self, locals);
        b = b(self, locals);
        if(!_.isUndefined(a)) {
            if(!_.isUndefined(b)) {
                // when both a and b are defined
                return a + b;
            } else {
                // when b is undefined
                return a;
            }
        }

        // when a is undefined
        return b;
    },
    "!": function(self, locals, a) {
        return !a(self, locals);
    },
    "-": function(self, locals, a, b) {
        a = a(self, locals);
        b = b(self, locals);
        return (_.isUndefined(a) ? 0 : a) - (_.isUndefined(b) ? 0 : b);
    },
    "*": function(self, locals, a, b) {
        return a(self, locals) * b(self, locals);
    },
    "/": function(self, locals, a, b) {
        return a(self, locals) / b(self, locals);
    },
    "%": function(self, locals, a, b) {
        return a(self, locals) % b(self, locals);
    },

    // equality and comparisons
    "<": function(self, locals, a, b) {
        return a(self, locals) < b(self, locals);
    },
    ">": function(self, locals, a, b) {
        return a(self, locals) > b(self, locals);
    },
    "<=": function(self, locals, a, b) {
        return a(self, locals) <= b(self, locals);
    },
    ">=": function(self, locals, a, b) {
        return a(self, locals) >= b(self, locals);
    },
    "==": function(self, locals, a, b) {
        return a(self, locals) == b(self, locals);
    },
    "!=": function(self, locals, a, b) {
        return a(self, locals) != b(self, locals);
    },
    "===": function(self, locals, a, b) {
        return a(self, locals) === b(self, locals);
        },
    "!==": function(self, locals, a, b) {
        return a(self, locals) !== b(self, locals);
    },
    "=": _.noop,

    // logical operators
    "&&": function(self, locals, a, b) {
        return a(self, locals) && b(self, locals);
        },
    "||": function(self, locals, a, b) {
        return a(self, locals) || b(self, locals);
    }
};

var CALL = Function.prototype.call;
var APPLY = Function.prototype.apply;
var BIND = Function.prototype.bind;

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
        } else if(this.is("[],{}:.()?;")) {
            // no fn correlated with the token
            this.tokens.push({
                text: this.ch,
                json: false,
            });
            this.index++;
        } else if(this.isIdent(this.ch)){
            this.readIdent();
        } else if(this.isWhitespace(this.ch)) {
            // just move forward
            this.index++;
        } else {
            // emit operator token
            var ch2 = this.ch + this.peek();
            var ch3 = this.ch + this.peek() + this.peek(2);
            var fn = OPERATORS[this.ch];
            var fn2 = OPERATORS[ch2];
            var fn3 = OPERATORS[ch3];
            if(fn3) {
                this.tokens.push({
                    text: ch3,
                    fn: fn3
                });
                this.index += 3;
            } else if(fn2) {
                this.tokens.push({
                    text: ch2,
                    fn: fn2
                });
                this.index += 2;
            } else if(fn) {
                this.tokens.push({
                    text: this.ch,
                    fn: fn
                });
                this.index++;
            } else {
                throw "Unexpected next character: " + this.ch;
            }
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
    // keep two indices, in order to split the token into parts when met invocation "()""
    var start = this.index;
    var lastDotAt;
    while(this.index < this.text.length) {
        var ch = this.text.charAt(this.index);
        if(ch === "." || this.isIdent(ch) || this.isNumber(ch)) {
            if(ch === ".") {
                lastDotAt = this.index;
            }
            text += ch;
        } else {
            break;
        }
        this.index++;
    }

    // two requirements for identifying invocation
    // 1. there must have been a dot in the token
    // 2. first character after the token must be an opening parenthesis
    var methodName;
    if(lastDotAt) {
        var peekIndex = this.index;
        // ignore the possible whitespace between method token and left parenthesis
        while(this.isWhitespace(this.text.charAt(peekIndex))) {
            peekIndex++;
        }
        if(this.text.charAt(peekIndex) === "(") {
            methodName = text.substring(lastDotAt - start + 1);
            text = text.substring(0, lastDotAt - start);
        }
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
        // let them could be assigned
        token.fn.assign = function(self, value) {
            return setter(self, text, value);
        };
    }

    this.tokens.push(token);

    // emit 3 tokens in total if it is a method invocation
    if(methodName) {
        this.tokens.push({
            text: ".",
            json: false
        });
        this.tokens.push({
            text: methodName,
            fn: getterFn(methodName),
            json: false
        });
    }
};

var setter = function(object, path, value) {
    var keys = path.split(".");
    while(keys.length > 1) {
        var key = keys.shift();
        ensureSafeMemberName(key);
        // create new object if not exist
        if(!object.hasOwnProperty(key)) {
            object[key] = {};
        }
        object = object[key];
    }
    // TODO, expr like "anObject['anAttribute'].nested = 2" will not create intermediate objects on the fly?
    object[keys.shift()] = value;
    return value;
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

var ensureSafeObject = function(obj) {
    if(obj) {
        if(obj.document && obj.location && obj.alert && obj.setInterval) {
            // check whether the obj is window
            throw "Referencing window in Angular Expression is forbidden";
        } else if(obj.children && 
            (obj.nodeName || (obj.prop && obj.attr && obj.find))) {
            throw "Referencing DOM nodes in Angular Expression is forbidden";
        } else if(obj.getOwnPropertyNames || obj.getOwnPropertyDescriptor) {
            throw "Referencing Object in Angular Expression is forbidden";
        }
    }

    return obj;
};

var ensureSafeFunction = function(obj) {
    if(obj) {
        if(obj.constructor === obj) {
            // the function constructor is also a function, so it will also have
            // a constructor property, one that points to itself
            throw "Referencing Function in Angular Expression is forbidden";
        } else if(obj === CALL || obj === APPLY || obj === BIND) {
            throw "Referencing call, apply or bind in Angular Expression is forbidden";
        }
    }

    return obj;
};

var ensureSafeMemberName = function(name) {
    if(name === "constructor" ||
        name === "__proto__" ||
        name === "__defineGetter__" ||
        name === "__defineSetter__" ||
        name === "__lookupGetter__" ||
        name === "__lookupSetter__") {
        throw "Referencing 'constructor' field in expr is forbidden";
    }
};

var simpleGetterFn1 = function(key) {
    ensureSafeMemberName(key);
    return function(scope, locals) {
        // return undefined once the scope is undefined. no matter what locals is
        if(!scope) {
            return undefined;
        }
        return (locals && locals.hasOwnProperty(key)) ? locals[key] : scope[key];
    };
};

var simpleGetterFn2 = function(key1, key2) {
    ensureSafeMemberName(key1);
    ensureSafeMemberName(key2);
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
        ensureSafeMemberName(key);
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

Lexer.prototype.peek = function(n) {
    // init n to 1 if undefined
    n = n || 1;
    return this.index + n < this.text.length ? 
        this.text.charAt(this.index + n) :
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

Parser.ZERO = _.extend(_.constant(0), {constant: true});

Parser.prototype.parse = function(text) {
    // tokenize the text
    this.tokens = this.lexer.lex(text);
    return this.statements();
};

Parser.prototype.primary = function() {
    var primary;

    // beginning token
    if(this.expect("(")) {
        // start a new precedence chain inside the parentheses
        primary = this.assignment();
        this.consume(")");
    } else if(this.expect("[")) {
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
    var context;
    while((next = this.expect("[", ".", "("))) {
        if(next.text === "[") {
            context = primary;
            primary = this.objectIndex(primary);
        } else if(next.text === ".") {
            context = primary;
            primary = this.fieldAccess(primary);
        } else if(next.text === "(") {
            primary = this.functionCall(primary, context);

            // clear the contxt info after an invocation
            context = undefined;
        }
    }

    return primary;
};

Parser.prototype.objectIndex = function(objFn) {
    // since the content in [] is another primary expr, invoke recursively
    var indexFn = this.primary();
    this.consume("]");

    var objectIndexFn = function(scope, locals) {
        var obj = objFn(scope, locals);
        var index = indexFn(scope, locals);

        // check the whether the referenced object is safe or not
        return ensureSafeObject(obj[index]);
    };

    // objectIndexFn should have the assign fn
    objectIndexFn.assign = function(self, value, locals) {
        var obj = ensureSafeObject(objFn(self, locals));
        var index = indexFn(self, locals);
        return (obj[index] = value);
    };

    return objectIndexFn;
};

Parser.prototype.fieldAccess = function(objFn) {
    // the token.fn after the "."
    var token = this.expect();
    var getter = token.fn;
    var fieldAccessFn = function(scope, locals) {
        var obj = objFn(scope, locals);
        return getter(obj);
    };

    fieldAccessFn.assign = function(self, value, locals) {
        var obj = objFn(self, locals);
        return setter(obj, token.text, value);
    };

    return fieldAccessFn;
};

Parser.prototype.functionCall = function(fnFn, contextFn) {
    var argFns = [];
    if(!this.peek(")")) {
        do {
            argFns.push(this.primary());
        } while(this.expect(","));
    }
    this.consume(")");
    return function(scope, locals) {
        // resolve the context, if not exist, use scope
        // at the same time, check the whether the context is safe or not
        var context = ensureSafeObject(contextFn ? contextFn(scope, locals) : scope);

        // resolve the function itself
        // at the same time, check whether the fn is safe or not
        var fn = ensureSafeFunction(fnFn(scope, locals));
        // var fn = fnFn(scope, locals);

        // prepare all the arguments
        var args = _.map(argFns, function(argFn) {
            return argFn(scope, locals);
        });

        // call it
        // at the same time, check the whether the result is safe or not
        return ensureSafeObject(fn.apply(context, args));
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
            elementFns.push(this.assignment());
        } while(this.expect(","));
    }

    this.consume("]");

    var arrayFn = function(scope, locals) {
        // map an array will result in another array
        return _.map(elementFns, function(elementFn) {
            return elementFn(scope, locals);
        });
    };

    arrayFn.literal = true;

    // determine whether is constant
    arrayFn.constant = _.every(elementFns, "constant");

    return arrayFn;
};

Parser.prototype.object = function() {
    var keyValues = [];
    if(!this.peek("}")) {
        do {
            var keyToken = this.expect();
            this.consume(":");
            // since value could be any other expression, recursively call primary
            var valueExpr = this.assignment();
            keyValues.push({
                // first check string, then fall back on text
                key: keyToken.string || keyToken.text,
                value: valueExpr
            });
        } while(this.expect(","));
    }

    this.consume("}");
    var objectFn = function(scope, locals) {
        var object = {};
        _.forEach(keyValues, function(kv) {
            // call the value fn to get the real content
            object[kv.key] = kv.value(scope, locals);
        });

        return object;
    };

    objectFn.literal = true;
    // determine whether is constant
    objectFn.constant = _(keyValues).pluck("value").every("constant");

    return objectFn;
};

// assignment --> multiplicative --> unary --> primary
Parser.prototype.assignment = function() {
    var left = this.ternary();
    if(this.expect("=")) {
        if(!left.assign) {
            throw "Assignment cannot be done since operator is not assignable";
        }
        var right = this.ternary();
        return function(scope, locals) {
            return left.assign(scope, right(scope, locals), locals);
        };
    }

    return left;
};

// falls back on primary for everything other than unary operators
Parser.prototype.unary = function() {
    var parser = this;
    var operator;
    var operand;
    if(this.expect("+")) {
        return this.primary();
    } else if((operator = this.expect("!"))) {
        operand = parser.unary();
        var unaryFn = function(self, locals) {
            return operator.fn(self, locals, operand);
        };
        // keep the constant attr
        unaryFn.constant = operand.constant;
        return unaryFn;
    } else if((operator = this.expect("-"))) {
        operand = parser.unary();
        return this.binaryFn(Parser.ZERO, operator.fn, operand);
    } else {
        return this.primary();
    }
};

Parser.prototype.multiplicative = function() {
    var left = this.unary();
    var operator;
    // process concecutive multiplicatives
    while((operator = this.expect("*", "/", "%"))) {
        left = this.binaryFn(left, operator.fn, this.unary());
    }
    return left;
};

Parser.prototype.additive = function() {
    var left = this.multiplicative();
    var operator;
    // process concecutive additives
    while((operator = this.expect("+", "-"))) {
        left = this.binaryFn(left, operator.fn, this.multiplicative());
    }
    return left;
};

Parser.prototype.relational = function() {
    var left = this.additive();
    var operator;
    // process concecutive relationals
    while((operator = this.expect("<", ">", "<=", ">="))) {
        left = this.binaryFn(left, operator.fn, this.additive());
    }
    return left;
};

Parser.prototype.equality = function() {
    var left = this.relational();
    var operator;
    // process concecutive relationals
    while((operator = this.expect("==", "!=", "===", "!=="))) {
        left = this.binaryFn(left, operator.fn, this.relational());
    }
    return left;
};

Parser.prototype.logicalAND = function() {
    var left = this.equality();
    var operator;
    while ((operator = this.expect("&&"))) {
        left = this.binaryFn(left, operator.fn, this.equality());
    }
    return left;
};

Parser.prototype.logicalOR = function() {
    var left = this.logicalAND();
    var operator;
    while ((operator = this.expect("||"))) {
        left = this.binaryFn(left, operator.fn, this.logicalAND());
    }
    return left;
};

Parser.prototype.ternary = function() {
    var left = this.logicalOR();
    if(this.expect("?")) {
        // recursively
        var middle = this.ternary();
        this.consume(":");
        // recursively
        var right = this.ternary();

        var ternaryFn = function(self, locals) {
            return left(self, locals) ? middle(self, locals) : right(self, locals);
        };
        ternaryFn.constant = left.constant && middle.constant && right.constant;
        return ternaryFn;
    } else {
        return left;
    }
};

Parser.prototype.binaryFn = function(left, op, right) {
    var fn = function(self, locals) {
        return op(self, locals, left, right);
    };
    fn.constant = left.constant && right.constant;

    return fn;
};

Parser.prototype.statements = function() {
    var statements = [];
    do {
        statements.push(this.assignment());
    } while(this.expect(";"));

    if(statements.length === 1) {
        return statements[0];
    } else {
        return function(self, locals) {
            var value;
            _.forEach(statements, function(statement) {
                value = statement(self, locals);
            });

            // return the last expr's value
            return value;
        };
    }
};

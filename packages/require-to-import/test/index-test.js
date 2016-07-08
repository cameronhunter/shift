import test from 'ava';
import jscodeshift from 'jscodeshift';
import transform from '../src/index';

test("/* Comment */\nconst a = require('a');", t => {
    const before = "/* Comment */\nconst a = require('a');";
    const after = "/* Comment */\nimport a from 'a';";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test("const a = require('a')('b');", t => {
    const before = "const a = require('a')('b');";
    const after = "import aFactory from 'a';\nconst a = aFactory('b');";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test("const b = require('b')({ a, b: 'c' }, 'd');", t => {
    const before = "const b = require('b')({ a, b: 'c' }, 'd');";
    const after = "import bFactory from 'b';\nconst b = bFactory({ a, b: 'c' }, 'd');";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test("const { a } = require('a');", t => {
    const before = "const { a } = require('a');";
    const after = "import { a } from 'a';";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test("const { b: c, c: d } = require('b');", t => {
    const before = "const { b: c, c: d } = require('b');";
    const after = "import { b as c, c as d } from 'b';";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test("const { c: { d: { e } = {} } } = require('c');", t => {
    const before = "const { c: { d: { e } = {} } } = require('c');";
    const after = "import { c as _c } from 'c';\nconst { d: { e } = {} } = _c;";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test("const { a: b = DefaultValue } = require('a');", t => {
    const before = "const { a: b = DefaultValue } = require('a');";
    const after = "import { a as _a } from 'a';\nconst b = _a || DefaultValue;";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test("(function() { const a = require('b')('c'); }());", t => {
    const before = "(function() { const a = require('b')('c'); }());";
    const after = "(function() { const a = require('b')('c'); }());";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test("const a = b(require('c'));", t => {
    const before = "const a = b(require('c'));";
    const after = "import _c from 'c';\nconst a = b(_c);";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test("const a = b({ c: require('c') });", t => {
    const before = "const a = b({ c: require('c') });";
    const after = "import _c from 'c';\nconst a = b({ c: _c });";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test("const a = b(c(require('d')()));", t => {
    const before = "const a = b(c(require('d')()));";
    const after = "import dFactory from 'd';\nconst a = b(c(dFactory()));";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test("const a = require('a');", t => {
    const before = "const a = require('a');";
    const after = "import a from 'a';";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test("let a = require('a');", t => {
    const before = "let a = require('a');";
    const after = "import _a from 'a';\nlet a = _a;";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test("var a = require('a');", t => {
    const before = "var a = require('a');";
    const after = "import _a from 'a';\nvar a = _a;";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test("const b = require('a').b", t => {
    const before = "const b = require('a').b";
    const after = "import { b } from 'a';";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test("const c = require('a').b", t => {
    const before = "const c = require('a').b";
    const after = "import { b as c } from 'a';";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test("const c = require('a').b.c", t => {
    const before = "const c = require('a').b.c";
    const after = "import _a from 'a';\nconst c = _a.b.c;";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test("const a = require('a.js')()", t => {
    const before = "const a = require('a.js')()";
    const after = "import aFactory from 'a';\nconst a = aFactory();";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test("const a = require('./a/b').b.c;\nconst b = require('./b/b').b.c;", t => {
    const before = "const a = require('./a/b').b.c;\nconst b = require('./b/b').b.c;";
    const after = "import _aB from './a/b';\nconst a = _aB.b.c;\nimport _bB from './b/b';\nconst b = _bB.b.c;";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

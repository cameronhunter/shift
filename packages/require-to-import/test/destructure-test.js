import test from 'ava';
import jscodeshift from 'jscodeshift';
import transform from '../src/index';

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

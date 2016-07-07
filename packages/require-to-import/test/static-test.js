import test from 'ava';
import jscodeshift from 'jscodeshift';
import transform from '../src/index';

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

import test from 'ava';
import jscodeshift from 'jscodeshift';
import transform from '../src/index';

test("const a = require('a')('b');", t => {
    const before = "const a = require('a')('b');";
    const after = "import _a from 'a';\nconst a = _a('b');";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test("const b = require('b')({ a, b: 'c' }, 'd');", t => {
    const before = "const b = require('b')({ a, b: 'c' }, 'd');";
    const after = "import _b from 'b';\n\nconst b = _b({\n  a,\n  b: 'c'\n},'d');";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

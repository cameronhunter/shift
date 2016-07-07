import test from 'ava';
import jscodeshift from 'jscodeshift';
import transform from '../src/index';

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

import test from 'ava';
import jscodeshift from 'jscodeshift';
import transform from '../src/index';

test("const a = b(require('c'));", t => {
    const before = "const a = b(require('c'));";
    const after = "const a = b(require('c'));";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

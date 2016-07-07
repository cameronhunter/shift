import test from 'ava';
import jscodeshift from 'jscodeshift';
import transform from '../src/index';

test("(function() { const a = require('b')('c'); }());", t => {
    const before = "(function() { const a = require('b')('c'); }());";
    const after = "(function() { const a = require('b')('c'); }());";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

import test from 'ava';
import fs from 'fs';
import path from 'path';
import jscodeshift from 'jscodeshift';
import transform from '../../src/index';

const file = (name) => fs.readFileSync(path.join(__dirname, name)).toString();

test(t => {
    var before = file('before.js');
    var after = file('after.js');

    t.is(transform({ source: before }, { jscodeshift }), after);
});

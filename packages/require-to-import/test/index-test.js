import test from 'ava';
import jscodeshift from 'jscodeshift';
import transform from '../src/index';

test(t => {
    const before = "/* Comment */\nconst a = require('a');";
    const after = "/* Comment */\nimport a from 'a';";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "const a = require('a')('b');";
    const after = "import aFactory from 'a';\nconst a = aFactory('b');";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "const b = require('b')({ a, b: 'c' }, 'd');";
    const after = "import bFactory from 'b';\nconst b = bFactory({ a, b: 'c' }, 'd');";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "const { a } = require('a');";
    const after = "import { a } from 'a';";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "const { b: c, c: d } = require('b');";
    const after = "import { b as c, c as d } from 'b';";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "const { c: { d: { e } = {} } } = require('c');";
    const after = "import { c } from 'c';\nconst { d: { e } = {} } = c;";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "const { a: b = DefaultValue } = require('a');";
    const after = "import { a } from 'a';\nconst b = a || DefaultValue;";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "(function() { const a = require('b')('c'); }());";
    const after = "(function() { const a = require('b')('c'); }());";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "const a = b(require('c'));";
    const after = "import c from 'c';\nconst a = b(c);";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "const a = b({ c: require('c') });";
    const after = "import c from 'c';\nconst a = b({ c: c });";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "const a = b(c(require('d')()));";
    const after = "import dFactory from 'd';\nconst a = b(c(dFactory()));";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "const a = require('a');";
    const after = "import a from 'a';";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "let a = require('a');";
    const after = "import _a from 'a';\nlet a = _a;";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "var a = require('a');";
    const after = "import _a from 'a';\nvar a = _a;";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "const b = require('a').b";
    const after = "import { b } from 'a';";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "const c = require('a').b";
    const after = "import { b as c } from 'a';";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "const c = require('a').b.c;";
    const after = "import { b } from 'a';\nconst c = b.c;";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "const a = require('a.js')();";
    const after = "import aFactory from 'a';\nconst a = aFactory();";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "const A = require('./a/b').b.c;\nconst B = require('./b/b').b.c;";
    const after = "import { b as _b } from './b/b';\nimport { b } from './a/b';\nconst A = b.c;\nconst B = _b.c;";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "const a = require('a').a;\nconst b = require('a').b;";
    const after = "import { b } from 'a';\nimport { a } from 'a';";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "const c = require('a').b.c;\nconst d = require('a').b.c.d;";
    const after = "import { b } from 'a';\nconst c = b.c;\nconst d = b.c.d;";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "const { a: { b } } = require('a');";
    const after = "import { a } from 'a';\nconst { b } = a;";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "const nrdp = require('nf-nrdp-normalization/nrdp');\nconst texttospeech = require('nf-tvui-speech')(nrdp.texttospeech);";
    const after = "import nfTvuiSpeechFactory from 'nf-tvui-speech';\nimport nrdp from 'nf-nrdp-normalization/nrdp';\nconst texttospeech = nfTvuiSpeechFactory(nrdp.texttospeech);";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

test(t => {
    const before = "const b = require('a/a')('b');\nconst c = require('a/a')('c');";
    const after = "import aFactory from 'a/a';\nconst b = aFactory('b');\nconst c = aFactory('c');";

    t.is(transform({ source: before }, { jscodeshift }), after);
});

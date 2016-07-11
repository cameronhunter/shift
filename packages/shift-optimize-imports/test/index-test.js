import test from 'ava';
import transform from '../src/index';

test(t => {
    const before = [
        "import b from 'b';",
        "import a from 'a';"
    ].join('\n');

    const after = [
        "import a from 'a';",
        "import b from 'b';"
    ].join('\n');

    t.is(transform({ source: before }), after);
});

test(t => {
    const before = [
        "import a from 'a';",
        "import A from 'A';"
    ].join('\n');

    const after = [
        "import A from 'A';",
        "import a from 'a';"
    ].join('\n');

    t.is(transform({ source: before }), after);
});

test(t => {
    const before = [
        "import {b} from 'b';",
        "import a from 'a';"
    ].join('\n');

    const after = [
        "import a from 'a';",
        "import {b} from 'b';"
    ].join('\n');

    t.is(transform({ source: before }), after);
});

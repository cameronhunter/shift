import j from 'jscodeshift';
import camelcase from 'camelcase';

export default (root) => ({
    exists(name) {
        return this.getAll().indexOf(name) >= 0;
    },

    getAll() {
        const destructuredDeclarations = root.find(j.VariableDeclarator).find('Property', { value: { type: j.Identifier } }).nodes().map(node => node.value.name);
        const variableDeclarations = root.find(j.VariableDeclarator).nodes().map(node => node.id.name);
        const imports = root.find(j.ImportDeclaration).nodes().reduce((state, node) => [...state, ...node.specifiers.map(s => s.local.name)], []);

        return [...destructuredDeclarations, ...variableDeclarations, ...imports].filter(Boolean);
    },

    getUniqueNameFor(path, i = 1) {
        const parts = path.replace(/[.]/g, '-').split('/');
        const prefix = i > parts.length ? '_'.repeat(i - parts.length) : '';
        const transform = (input) => (i > 1 || input.indexOf('-') >= 0) ? camelcase(input) : input;
        const name = prefix + transform(parts.slice(-1 * i).join('-'));

        return this.exists(name) ? this.getUniqueNameFor(path, i + 1) : name;
    }
});

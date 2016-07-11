import j from 'jscodeshift';

const entries = (object) => Object.keys(object).map(k => [k, object[k]]);

export default (root) => ({
    find(source, named) {
        const existingImport = this.getAll().filter(im => im.source === source && (!named || im.named[named]))[0];
        if (existingImport) {
            return named ? existingImport.named[named] : existingImport.default;
        } else {
            return null;
        }
    },

    getAll() {
        return root.find(j.ImportDeclaration).nodes().map(node => {
            const defaultImport = j(node).find(j.ImportDefaultSpecifier);
            const namedImports = j(node).find(j.ImportSpecifier).nodes().reduce((state, node) => ({ ...state, [node.imported.name]: node.local.name }), {});
            return {
                source: node.source.value,
                default: defaultImport.size() ? defaultImport.get().value.local.name : null,
                named: namedImports
            };
        });
    },

    insert(name, path, comments) {
        let imports;

        if (typeof name === 'string') {
            imports = [j.importDefaultSpecifier(j.identifier(name))];
        } else {
            imports = entries(name).map(([k, v]) => j.importSpecifier(j.identifier(k), j.identifier(v)));
        }

        const newImport = j.importDeclaration(imports, j.literal(path));
        newImport.comments = comments;

        const currentImports = root.find(j.ImportDeclaration);
        if (currentImports.size()) {
          currentImports.at(-1).insertAfter(newImport);
        } else {
          root.find(j.Program).get('body', 0).insertBefore(newImport);
        }

        return newImport;
    }
});

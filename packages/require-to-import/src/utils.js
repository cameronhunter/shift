import camelcase from 'camelcase';

export default (j, root) => {
  const variables = () => {
    const source = j(root.toSource());

    const destructuredDeclarations = source.find(j.VariableDeclarator).find('Property', { value: { type: 'Identifier' } }).nodes().map(node => node.value.name);
    const variableDeclarations = source.find(j.VariableDeclarator).nodes().map(node => node.id.name);
    const imports = source.find(j.ImportDeclaration).nodes().reduce((state, node) => state.concat(node.specifiers.map(s => s.local.name)), []);

    return [].concat(destructuredDeclarations, variableDeclarations, imports).filter(Boolean);
  };

  const getImportFor = (source, create = (name) => name) => {
    const existingImport = imports().filter(i => i.source === source)[0];
    if (existingImport) {
      return existingImport;
    } else {
      insertImport(getVariableNameFor(create(source)), source);
      return getImportFor(source);
    }
  };

  const findImport = (options = {}) => {
    const { source, defaultImport, namedImport } = options;
    return imports().filter(im => im.source === source && (!defaultImport || im.defaultImport === defaultImport) && (!namedImport || im.named.filter(named => named.imported === namedImport)[0]))[0];
  };

  const imports = () => {
    const source = j(root.toSource());

    return source.find(j.ImportDeclaration).nodes().map(node => {
      const defaultImport = j(node).find(j.ImportDefaultSpecifier);
      const namedImports = j(node).find(j.ImportSpecifier).nodes().map(node => ({ local: node.local.name, imported: node.imported.name }));
      return {
        source: node.source.value,
        defaultImport: defaultImport.size() ? defaultImport.get().value.local.name : null,
        named: namedImports
      };
    });
  };

  const variableExists = (name) => variables().indexOf(name) >= 0;

  const importExists = (name, source) => {
    return !!imports().filter(i => i.source === source && i.default === name).length;
  };

  const insertImport = (name, source) => {
    if (!importExists(name, source)) {
      root.find(j.Program).get('body', 0).insertBefore(`import ${name} from '${source}';`);
    }
  };

  const getVariableNameFor = (path, i = 1) => {
    const parts = path.split('/');
    const prefix = i > parts.length ? '_'.repeat(i - parts.length) : '';
    const transform = (input) => (i > 1 || input.indexOf('-') >= 0) ? camelcase(input) : input;
    const name = prefix + transform(parts.slice(-1 * i).join('-'));

    return variableExists(name) ? getVariableNameFor(path, i + 1) : name;
  };

  return {
    findImport,
    insertImport,
    getVariableNameFor,
    importExists,
    getImportFor
  };
};

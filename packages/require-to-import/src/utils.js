import camelcase from 'camelcase';

export default (j, root) => {
  const variables = () => {
    const source = j(root.toSource());

    const destructuredDeclarations = source.find(j.VariableDeclarator).find('Property', { value: { type: 'Identifier' } }).nodes().map(node => node.value.name);
    const variableDeclarations = source.find(j.VariableDeclarator).nodes().map(node => node.id.name);
    const imports = source.find(j.ImportDeclaration).nodes().reduce((state, node) => state.concat(node.specifiers.map(s => s.local.name)), []);

    return [].concat(destructuredDeclarations, variableDeclarations, imports).filter(Boolean);
  };

  const findImport = (source, named) => {
    const existingImport = imports().filter(im => im.source === source && (!named || im.named[named]))[0];

    if (existingImport) {
      return named ? existingImport.named[named] : existingImport.default;
    } else {
      return null;
    }
  };

  const imports = () => {
    const source = j(root.toSource());

    return source.find(j.ImportDeclaration).nodes().map(node => {
      const defaultImport = j(node).find(j.ImportDefaultSpecifier);
      const namedImports = j(node).find(j.ImportSpecifier).nodes().reduce((state, node) => ({ ...state, [node.imported.name]: node.local.name }), {});
      return {
        source: node.source.value,
        default: defaultImport.size() ? defaultImport.get().value.local.name : null,
        named: namedImports
      };
    });
  };

  const variableExists = (name) => variables().indexOf(name) >= 0;

  const insertImport = (name, source) => {
    root.find(j.Program).get('body', 0).insertBefore(`import ${name} from '${source}';`);
  };

  const getVariableNameFor = (path, i = 1) => {
    const parts = path.replace(/[.]/g, '-').split('/');
    const prefix = i > parts.length ? '_'.repeat(i - parts.length) : '';
    const transform = (input) => (i > 1 || input.indexOf('-') >= 0) ? camelcase(input) : input;
    const name = prefix + transform(parts.slice(-1 * i).join('-'));

    return variableExists(name) ? getVariableNameFor(path, i + 1) : name;
  };

  return {
    findImport,
    insertImport,
    getVariableNameFor
  };
};

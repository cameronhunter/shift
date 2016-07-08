import camelcase from 'camelcase';

export default (j, root) => {
  const variables = () => {
    const source = j(root.toSource());

    const destructuredDeclarations = source.find(j.VariableDeclarator).find('Property', { value: { type: 'Identifier' } }).nodes().map(node => node.value.name);
    const variableDeclarations = source.find(j.VariableDeclarator).nodes().map(node => node.id.name);
    const imports = source.find(j.ImportDeclaration).nodes().reduce((state, node) => state.concat(node.specifiers.map(s => s.local.name)), []);

    return [].concat(destructuredDeclarations, variableDeclarations, imports).filter(Boolean);
  };

  const variableExists = (name) => variables().indexOf(name) >= 0;

  const importExists = (name, source) => {
    return !!j(root.toSource())
              .find(j.ImportDeclaration, { source: { value: source } })
              .filter(path => path.value.specifiers.map(imp => imp.local.name).indexOf(name) >= 0)
              .size();
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
    insertImport,
    getVariableNameFor,
    importExists
  };
};

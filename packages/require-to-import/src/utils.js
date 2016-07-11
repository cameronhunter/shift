import camelcase from 'camelcase';

const entries = (object) => Object.keys(object).map(k => [k, object[k]]);

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
    return root.find(j.ImportDeclaration).nodes().map(node => {
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

  const insertImport = (name, path, comments) => {
    let newImport;

    if (typeof name === 'string') {
      newImport = j.importDeclaration([j.importDefaultSpecifier(j.identifier(name))], j.literal(path));
    } else {
      newImport = j.importDeclaration(entries(name).map(([k, v]) => j.importSpecifier(j.identifier(k), j.identifier(v))), j.literal(path));
    }

    newImport.comments = comments;

    const currentImports = root.find(j.ImportDeclaration);
    if (currentImports.size()) {
      currentImports.at(-1).insertAfter(newImport);
    } else {
      root.find(j.Program).get('body', 0).insertBefore(newImport);
    }
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

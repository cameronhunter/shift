import camelcase from 'camelcase';

const Utils = (j, root) => {
  const variableExists = (name) => {
    const destructuredDeclarations = root.find(j.VariableDeclarator).find('Property', { value: { type: 'Identifier' } }).nodes().map(node => node.value.name);
    const variables = root.find(j.VariableDeclarator).nodes().map(node => node.id.name);
    const imports = root.find(j.ImportDeclaration).nodes().reduce((state, node) => state.concat(node.specifiers.map(s => s.local.name)), []);

    const results = [].concat(destructuredDeclarations, variables, imports).filter(Boolean);

    return results.indexOf(name) >= 0;
  };

  const importExists = (name, source) => {
    return !!j(root.toSource())
              .find(j.ImportDeclaration, { source: { value: source } })
              .filter(path => path.value.specifiers.map(imp => imp.local.name).indexOf(name) >= 0)
              .size();
  };

  const insertImport = (name, source) => {
    if (!importExists(name, source)) {
      root.find(j.Program).get('body', 0).insertBefore(`import ${name} from '${source}';`)
    }
  };

  const getVariableNameFor = (path, i = 1) => {
    const parts = path.split('/');
    const prefix = i > parts.length ? '_' : '';
    const name = prefix + camelcase(parts.slice(-1 * i).join('-'));

    return variableExists(name) ? getVariableNameFor(path, i + 1) : name;
  };

  return {
    insertImport,
    getVariableNameFor
  };
};

export default ({ source }, { jscodeshift: j }) => {
  const root = j(source);
  const { insertImport, getVariableNameFor } = Utils(j, root);

  const { leadingComments } = root.find(j.Program).get('body', 0).node;

  root
    .find(j.CallExpression, { callee: { name: 'require' } })
    .forEach(node => {
      const parentDeclaration = findParentDeclaration(node);

      // e.g. require('a');
      if (!parentDeclaration || !parentDeclaration.scope.isGlobal) {
        return;
      }

      const $parentDeclaration = j(parentDeclaration);
      const importPath = node.value.arguments[0].value.replace(/\.js$/, '');

      if (node.name !== 'init') {
        if (node.name === 'object') {
          const [declaration] = parentDeclaration.value.declarations;
          const properties = findProperties(declaration.init);
          if (properties.length === 1) {
            const [name] = properties;
            const importName = name === declaration.id.name ? name : `${name} as ${declaration.id.name}`;
            insertImport(`{ ${importName} }`, importPath);
            $parentDeclaration.remove();
            return;
          }
        }

        const importName = getVariableNameFor(importPath + (node.name === 'callee' ? 'Factory' : ''));

        insertImport(importName, importPath);
        j(node).replaceWith(importName);

        if (!$parentDeclaration.toSource().endsWith(';')) {
          $parentDeclaration.replaceWith($parentDeclaration.toSource() + ';');
        }

        return;
      }

      // e.g. const a = require('a');
      if (isSingleVariableDeclaration(parentDeclaration)) {
        const [declaration] = parentDeclaration.value.declarations;

        // e.g. const a = require('a');
        if (declaration.init.callee && declaration.init.callee.type === 'Identifier') {
          if (parentDeclaration.value.kind === 'const') {
            insertImport(declaration.id.name, importPath);
            $parentDeclaration.remove();
            return;
          }

          if (parentDeclaration.value.kind === 'let' || parentDeclaration.value.kind === 'var') {
            const kind = parentDeclaration.value.kind;
            const importName = `_${declaration.id.name}`;
            insertImport(importName, importPath);
            $parentDeclaration.insertAfter(`${kind} ${declaration.id.name} = ${importName};`);
            $parentDeclaration.remove();
            return;
          }
        }
      }

      // e.g. const { a, b } = require('a');
      if (isDestructuredDeclaration(parentDeclaration)) {
        const [declaration] = parentDeclaration.value.declarations;
        const kind = parentDeclaration.value.kind;
        const { imports, statements } = buildDestructuredImports(j, root, kind, declaration.id.properties);

        insertImport(`{ ${imports.join(', ')} }`, importPath);
        statements.length && j(parentDeclaration).insertAfter(statements.join(''));
        $parentDeclaration.remove();
        return;
      }
    });

  root.get().node.comments = leadingComments;

  return root.toSource();
};

function isSingleVariableDeclaration(variableDeclaration) {
  const [first] = variableDeclaration.value.declarations || [];
  return first && first.id.type === 'Identifier';
}

function isDestructuredDeclaration(variableDeclaration) {
  const [first] = variableDeclaration.value.declarations || [];
  return first && first.id.type === 'ObjectPattern';
}

function findParentDeclaration(node) {
  const parent = node.parentPath;

  if (!parent) {
    return null;
  }

  if (parent.value.type === 'VariableDeclaration') {
    return parent;
  }

  return findParentDeclaration(node.parentPath);
}

function buildDestructuredImports(j, root, kind, properties) {
  const { getVariableNameFor } = Utils(j, root);

  return properties.reduce((state, { key, value }) => {
    if (key.name === value.name) {
      // e.g. const { a } = require('a');
      return { ...state, imports: [...state.imports, key.name] };
    } else if (value.type === 'Identifier') {
      // e.g. const { a: b } = require('a');
      return { ...state, imports: [...state.imports, `${key.name} as ${value.name}`] };
    } else if (value.type === 'AssignmentPattern') {
      // e.g. const { a: b = {} } = require('a');
      const name = getVariableNameFor(key.name);
      const importName = key.name === name ? name : `${key.name} as ${name}`;
      return {
        imports: [...state.imports, importName],
        statements: [...state.statements, `${kind} ${j(value.left).toSource()} = ${name} || ${j(value.right).toSource()};`]
      };
    } else {
      // Nested destructure e.g. const { a: { b } } = require('a');
      const name = getVariableNameFor(key.name);
      const importName = key.name === name ? name : `${key.name} as ${name}`;
      return {
        imports: [...state.imports, importName],
        statements: [...state.statements, `${kind} ${j(value).toSource()} = ${name};`]
      };
    }
  }, { imports: [], statements: [] });
}

function findProperties(node, result = []) {
  const property = node.property && node.property.name;
  if (node.object) {
    return findProperties(node.object, result.concat(property));
  } else {
    return result.concat(property).filter(Boolean).reverse();
  }
}

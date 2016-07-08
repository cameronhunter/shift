import Utils from './utils';

export default ({ source }, { jscodeshift: j }) => {
  const root = j(source);
  const { importExists, insertImport, getVariableNameFor } = Utils(j, root);

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
            const alreadyExists = importExists(name, importPath);

            if (!alreadyExists) {
              const importName = name === declaration.id.name ? name : `${name} as ${declaration.id.name}`;
              insertImport(`{ ${importName} }`, importPath);
            }

            $parentDeclaration.remove();
            return;
          } else {
            const [name] = properties;
            const alreadyExists = importExists(name, importPath);
            const importName = alreadyExists ? name : getVariableNameFor(name);

            if (!alreadyExists) {
              insertImport(`{ ${name === importName ? name : `${name} as ${importName}`} }`, importPath);
            }

            const parent = node.parentPath;
            j(node).remove();
            j(parent).replaceWith(importName);
            return;
          }
        }

        const name = importPath + (node.name === 'callee' ? 'Factory' : '');
        const alreadyExists = importExists(name, importPath);
        const importName = alreadyExists ? name : getVariableNameFor(name);

        if (!alreadyExists) {
          insertImport(importName, importPath);
        }

        j(node).replaceWith(importName);

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

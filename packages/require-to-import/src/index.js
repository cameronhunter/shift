import Utils from './utils';

export default ({ source }, { jscodeshift: j }) => {
  const root = j(source);
  const { findImport, insertImport, getVariableNameFor } = Utils(j, root);

  // const { leadingComments } = root.find(j.Program).get('body', 0).node;
  let fileChanged = false;

  root
    .find(j.CallExpression, { callee: { name: 'require' } })
    .forEach(node => {
      const parentDeclaration = findParentDeclaration(node);
      const comments = parentDeclaration.node.comments;

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
            if (!findImport(importPath, name)) {
              const importName = name === declaration.id.name ? name : `${name} as ${declaration.id.name}`;
              insertImport({ [name]: declaration.id.name }, importPath, comments);
            }
            $parentDeclaration.remove();
            fileChanged = true;
            return;
          } else {
            const [name] = properties;
            const existingImport = findImport(importPath, name);
            const importName = existingImport || getVariableNameFor(name);

            if (!existingImport) {
              insertImport({ [name]: importName }, importPath, comments);
            }

            const parent = node.parentPath;
            j(node).remove();
            j(parent).replaceWith(importName);

            fileChanged = true;
            return;
          }
        }

        const existingImport = findImport(importPath);

        if (!existingImport) {
          const importName = getVariableNameFor(importPath + (node.name === 'callee' ? 'Factory' : ''));
          insertImport(importName, importPath, comments);
          j(node).replaceWith(importName);
        } else {
          j(node).replaceWith(existingImport);
        }

        fileChanged = true;
        return;
      }

      // e.g. const a = require('a');
      if (isSingleVariableDeclaration(parentDeclaration)) {
        const [declaration] = parentDeclaration.value.declarations;

        // e.g. const a = require('a');
        if (declaration.init.callee && declaration.init.callee.type === 'Identifier') {
          if (parentDeclaration.value.kind === 'const') {
            insertImport(declaration.id.name, importPath, comments);
            $parentDeclaration.remove();
            fileChanged = true;
            return;
          }

          if (parentDeclaration.value.kind === 'let' || parentDeclaration.value.kind === 'var') {
            const kind = parentDeclaration.value.kind;
            const importName = `_${declaration.id.name}`;
            insertImport(importName, importPath, comments);
            $parentDeclaration.insertAfter(`${kind} ${declaration.id.name} = ${importName};`);
            $parentDeclaration.remove();
            fileChanged = true;
            return;
          }
        }
      }

      // e.g. const { a, b } = require('a');
      if (isDestructuredDeclaration(parentDeclaration)) {
        const [declaration] = parentDeclaration.value.declarations;
        const kind = parentDeclaration.value.kind;
        const { imports, statements } = buildDestructuredImports(j, root, kind, declaration.id.properties);

        insertImport(imports, importPath, comments);
        statements.length && $parentDeclaration.insertAfter(statements.join(''));
        $parentDeclaration.remove();
        fileChanged = true;
        return;
      }
    });

  if (fileChanged) {
    // root.get().node.comments = leadingComments;
    const newSource = root.toSource({ quote: 'single' });
    return !newSource.endsWith('\n') && source.endsWith('\n') ? newSource + '\n' : newSource;
  } else {
    return source;
  }
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
      return { ...state, imports: { ...state.imports, [key.name]: key.name } };
    } else if (value.type === 'Identifier') {
      // e.g. const { a: b } = require('a');
      return { ...state, imports: { ...state.imports, [key.name]: value.name } };
    } else if (value.type === 'AssignmentPattern') {
      // e.g. const { a: b = {} } = require('a');
      const name = getVariableNameFor(key.name);
      return {
        imports: { ...state.imports, [key.name]: name },
        statements: [...state.statements, `${kind} ${j(value.left).toSource()} = ${name} || ${j(value.right).toSource()};`]
      };
    } else {
      // Nested destructure e.g. const { a: { b } } = require('a');
      const name = getVariableNameFor(key.name);
      return {
        imports: { ...state.imports, [key.name]: name },
        statements: [...state.statements, `${kind} ${j(value).toSource()} = ${name};`]
      };
    }
  }, { imports: {}, statements: [] });
}

function findProperties(node, result = []) {
  const property = node.property && node.property.name;
  if (node.object) {
    return findProperties(node.object, result.concat(property));
  } else {
    return result.concat(property).filter(Boolean).reverse();
  }
}

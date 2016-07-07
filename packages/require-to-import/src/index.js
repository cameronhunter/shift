export default ({ source }, { jscodeshift: j }) => {
  const root = j(source);

  root
    .find(j.CallExpression, { callee: { name: 'require' } })
    .forEach(node => {
      const parentDeclaration = findParentDeclaration(node);

      // e.g. require('a');
      if (!parentDeclaration) {
        return;
      }

      const importPath = node.value.arguments[0].value;

      // e.g. const a = require('a'); or const a = require('a')('b');
      if (isSingleVariableDeclaration(parentDeclaration)) {
        const [declaration] = parentDeclaration.value.declarations;

        // e.g. const b = require('a').b;
        if (declaration.init.type === 'MemberExpression') {
          const properties = findProperties(declaration.init);

          if (properties.length === 1) {
            const [name] = properties;
            const importName = name === declaration.id.name ? name : `${name} as ${declaration.id.name}`;
            j(parentDeclaration).replaceWith(`import { ${importName} } from '${importPath}';`);
          } else {
            const importName = `_${node.value.arguments[0].value}`; // TODO: handle paths
            j(parentDeclaration).replaceWith(`import ${importName} from '${importPath}';`);
            j(parentDeclaration).insertAfter(`const ${declaration.id.name} = ${importName}.${properties.join('.')};`);
          }
          return;
        }

        // e.g. const a = require('a');
        if (declaration.init.callee.type === 'Identifier') {
          const importName = declaration.id.name;
          j(parentDeclaration).replaceWith(`import ${importName} from '${importPath}';`);
          return;
        }

        // e.g. const a = require('a')('b');
        if (declaration.init.callee.type === 'CallExpression') {
          const importName = `_${declaration.id.name}`;
          j(parentDeclaration).replaceWith(`import ${importName} from '${importPath}';`);
          j(parentDeclaration).insertAfter(`const ${declaration.id.name} = ${importName}(${j(declaration.init.arguments).toSource()});`);
          return;
        }
      }

      // e.g. const { a, b } = require('a');
      if (isDestructuredDeclaration(parentDeclaration)) {
        const [declaration] = parentDeclaration.value.declarations;
        const { imports, statements } = buildDestructuredImports(j, declaration.id.properties);

        j(parentDeclaration).replaceWith(`import { ${imports.join(', ')} } from '${importPath}';`);
        statements.length && j(parentDeclaration).insertAfter(statements.join(''));
        return;
      }
    });

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

function buildDestructuredImports(j, properties) {
  return properties.reduce((state, { key, value }) => {
    if (key.name === value.name) {
      // Simple destructure e.g. const { a } = require('a');
      return { ...state, imports: [...state.imports, key.name] };
    } else if (value.name) {
      // Destructure with rename e.g. const { a: b } = require('a');
      return { ...state, imports: [...state.imports, `${key.name} as ${value.name}`] };
    } else {
      // Nested destructure e.g. const { a: { b } } = require('a');
      return {
        imports: [...state.imports, `${key.name} as _${key.name}`],
        statements: [...state.statements, `const ${j(value).toSource()} = _${key.name};`]
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

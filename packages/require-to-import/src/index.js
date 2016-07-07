export default ({ source }, { jscodeshift: j }) => {
  const root = j(source);

  root
    .find(j.CallExpression, { callee: { name: 'require' } })
    .forEach(node => {
      const parentDeclaration = findParentDeclaration(node);

      // require with side-effects
      if (!parentDeclaration) {
        return;
      }

      // require with single-variable
      if (isSingleVariableDeclaration(parentDeclaration)) {
        const [declaration] = parentDeclaration.value.declarations;
        const importName = declaration.id.name;
        const importPath = declaration.init.arguments[0].value;

        j(parentDeclaration).replaceWith(`import ${importName} from '${importPath}';`);
        return;
      }

      function foo(properties) {
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

      // require with destructuring
      if (isDestructuredDeclaration(parentDeclaration)) {
        const [declaration] = parentDeclaration.value.declarations;
        const { imports, statements } = foo(declaration.id.properties);
        const importPath = declaration.init.arguments[0].value;

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

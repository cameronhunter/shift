const AllowedParentTypes = ['VariableDeclarator', 'CallExpression', 'MemberExpression'];

export default ({ source }, { jscodeshift: j }) => {
  const root = j(source);

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
            const comments = parentDeclaration.node.comments;
            $parentDeclaration.replaceWith(`import { ${importName} } from '${importPath}';`);
            parentDeclaration.node.comments = comments;
            return;
          }
        }

        const importNamePrefix = importPath.split('/').pop();
        const importName = node.name === 'callee' ? `${importNamePrefix}Factory` : `_${importNamePrefix}`;

        $parentDeclaration.insertBefore(`import ${importName} from '${importPath}';`);
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
            const comments = parentDeclaration.node.comments;
            $parentDeclaration.replaceWith(`import ${declaration.id.name} from '${importPath}';`);
            parentDeclaration.node.comments = comments;
            return;
          }

          if (parentDeclaration.value.kind === 'let' || parentDeclaration.value.kind === 'var') {
            const kind = parentDeclaration.value.kind;
            const importName = `_${declaration.id.name}`;
            const comments = parentDeclaration.node.comments;
            $parentDeclaration.replaceWith(`import ${importName} from '${importPath}';`);
            parentDeclaration.node.comments = comments;
            $parentDeclaration.insertAfter(`${kind} ${declaration.id.name} = ${importName};`);
            return;
          }
        }
      }

      // e.g. const { a, b } = require('a');
      if (isDestructuredDeclaration(parentDeclaration)) {
        const [declaration] = parentDeclaration.value.declarations;
        const kind = parentDeclaration.value.kind;
        const { imports, statements } = buildDestructuredImports(j, kind, declaration.id.properties);

        const comments = parentDeclaration.node.comments;
        $parentDeclaration.replaceWith(`import { ${imports.join(', ')} } from '${importPath}';`);
        parentDeclaration.node.comments = comments;
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

function buildDestructuredImports(j, kind, properties) {
  return properties.reduce((state, { key, value }) => {
    if (key.name === value.name) {
      // e.g. const { a } = require('a');
      return { ...state, imports: [...state.imports, key.name] };
    } else if (value.type === 'Identifier') {
      // e.g. const { a: b } = require('a');
      return { ...state, imports: [...state.imports, `${key.name} as ${value.name}`] };
    } else if (value.type === 'AssignmentPattern') {
      // e.g. const { a: b = {} } = require('a');
      return {
        imports: [...state.imports, `${key.name} as _${key.name}`],
        statements: [...state.statements, `${kind} ${j(value.left).toSource()} = _${key.name} || ${j(value.right).toSource()};`]
      };
    } else {
      // Nested destructure e.g. const { a: { b } } = require('a');
      return {
        imports: [...state.imports, `${key.name} as _${key.name}`],
        statements: [...state.statements, `${kind} ${j(value).toSource()} = _${key.name};`]
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

import j from 'jscodeshift';
import Utils from 'shift-utils';

export default ({ source }) => {
  const root = j(source);

  const { Imports, Variables } = Utils(root);

  let invariant = null;
  let modified = false;

  const ast = root
    .find(j.IfStatement, {
      consequent: {
        body: [{ type: 'ThrowStatement', argument: { callee: { name: 'Error' } } }]
      }
    })
    .filter(path => path.value.consequent.body.length === 1 && !path.value.alternate)
    .forEach(path => {
      const error = path.value.consequent.body[0];
      const args = [...error.argument.arguments];
      const importName = Variables.getUniqueNameFor('invariant');

      if (!invariant) {
        invariant = Variables.getUniqueNameFor('invariant');
        Imports.insertRequire(invariant, 'invariant');
      }

      const invariantStatement = j.callExpression(j.identifier(invariant), [path.value.test, ...args]);
      invariantStatement.comments = path.value.comments;

      j(path).replaceWith(j.expressionStatement(invariantStatement));

      modified = true;
    })

    return modified ? ast.toSource({ quote: 'single' }) : source;
};

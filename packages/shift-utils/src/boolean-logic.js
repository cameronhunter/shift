import j from 'jscodeshift';

export default {
  coerceToBoolean(expression) {
    return j.unaryExpression('!', j.unaryExpression('!', expression));
  },

  invert(expression) {
    if (isNot(expression)) {
      const { count, expression: last } = countNots(expression);
      return count % 2 === 0 ? this.invert(last) : last;
    }

    if (expression.type === 'BinaryExpression') {
      switch (expression.operator) {
        case '==':
          return j.binaryExpression('!=', expression.left, expression.right);
        case '===':
          return j.binaryExpression('!==', expression.left, expression.right);
        case '!=':
          return j.binaryExpression('==', expression.left, expression.right);
        case '!==':
          return j.binaryExpression('===', expression.left, expression.right);
        case '>':
          return j.binaryExpression('<=', expression.left, expression.right);
        case '<':
          return j.binaryExpression('>=', expression.left, expression.right);
        case '>=':
          return j.binaryExpression('<', expression.left, expression.right);
        case '<=':
          return j.binaryExpression('>', expression.left, expression.right);
      }
    }

    if (expression.type === 'LogicalExpression') {
      switch (expression.operator) {
        case '||':
          return j.logicalExpression('&&', this.invert(expression.left), this.invert(expression.right));
        case '&&':
          return j.logicalExpression('||', this.invert(expression.left), this.invert(expression.right));
      }
    }

    return j.unaryExpression('!', expression);
  }
};

function isNot(expression) {
    return expression.type === 'UnaryExpression' && expression.operator === '!';
}

function countNots(expression, count = 0) {
  if (isNot(expression)) {
    return countNots(expression.argument, count + 1);
  } else {
    return { count, expression };
  }
}

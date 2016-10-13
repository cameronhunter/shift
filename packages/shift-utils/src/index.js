import Imports from './imports';
import Variables from './variables';
import BooleanLogic from './boolean-logic';

export default (root) => ({
  Imports: Imports(root),
  Variables: Variables(root),
  BooleanLogic
});

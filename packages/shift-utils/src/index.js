import Imports from './imports';
import Variables from './variables';

export default (root) => ({
  Imports: Imports(root),
  Variables: Variables(root)
});

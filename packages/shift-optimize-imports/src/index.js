import j from 'jscodeshift';
import Utils from 'shift-utils';
import sortBy from 'sort-order';

const alphabetical = (field) => (a, b) => {
  if (a[field] === b[field]) {
    return 0;
  }

  return a[field] < b[field] ? -1 : 1;
};

export default ({ source }) => {
  const root = j(source);
  const { Imports } = Utils(root);

  const ordering = sortBy(alphabetical('default'), alphabetical('source'));

  const imports = Imports.getAll().sort(ordering);

  root.find(j.ImportDeclaration).forEach((node, i) => {
    j(node).remove();
    Imports.insert(imports[i].default || imports[i].named, imports[i].source, imports[i].comments);
  });

  return root.toSource({ quote: 'single' });
};

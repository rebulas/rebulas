let commonTests = require('./lib/common-tests'),
    model = require('backend/model'),
    Util = require('extra/util');

let index;
module.exports = {
  setUp: function(cb) {
    commonTests.setUp();

    commonTests.someIndex().then((someIndex) => {
      index = someIndex;
      cb();
    });
  },
  tearDown: function(cb) {
    commonTests.tearDown();
    index = null;
    cb();
  },
  emptyHeadings: async function(test) {
    try {
      await index.saveItem({
        rawContent: '# Description\n\n\n'
      });
      await index.saveItem({
        rawContent: '# Description'
      });
    } catch(e) { console.log(e); test.fail(); }

    test.done();
  },
  facetedSearch: async function(test) {
    await Promise.all([
      index.saveItem({
        rawContent: `# Name
item1
# Facet2
facetval22
# Facet1
facetval11`
      }),
      index.saveItem({
        rawContent: `# Name
item2
# Facet2
facetval22
# Facet1
facetval12`
      }),
      index.saveItem({
        rawContent: `# Name
item3
# Facet2
facetval21
# Facet1
facetval12`
      }),
      index.saveItem({
        rawContent: `# Name
item4
# Facet2
facetval21
# Facet1
facetval12`
      }),
    ]);

    let results = index.search({ q: 'facet2=facetval22' });
    test.equal(2, results.items.length);
    console.log(results.facets);

    let facet1Values = {
      field: 'facet1',
      title: 'facet1',
      values: [
        {
          count: 1,
          id: 'facetval11',
          title: 'facetval11',
          link: 'facet1=facetval11'
        }, {
          count: 1,
          id: 'facetval12',
          title: 'facetval12',
          link: 'facet1=facetval12'
        }
      ]
    };
    test.deepEqual(results.facets.find((f) => f.field === 'facet1'),
                   facet1Values);
    test.done();
  },
  itemAnalysis: function(test) {
    let md = `
# Name
Publishing UI improvements

# Description
This is sentence 1.
This is sentence 2.

# Empty

# Some List
- item1
- item2
`;

    let analyzed = new model.AnalyzedItem(null, md);
    test.deepEqual(analyzed.fields.map((field) => field.name),
                   ['name', 'description', 'empty', 'some list']);

    let hasFieldValue = (fieldName, value) =>
        test.equal(
          analyzed.fields.find((f) => f.name === fieldName).textValue,
          value);

    hasFieldValue('empty', '');
    hasFieldValue('name', 'Publishing UI improvements');
    hasFieldValue('description', `This is sentence 1.
This is sentence 2.`);
    // TODO: plain lists...
    test.done();
  }
};

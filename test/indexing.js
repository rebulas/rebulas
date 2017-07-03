let commonTests = require('./lib/common-tests'),
    model = require('backend/model');

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
        _md: '# Description\n\n\n'
      });
      await index.saveItem({
        _md: '# Description'
      });
    } catch(e) { console.log(e); test.fail(); }

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

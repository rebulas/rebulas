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
  }
};

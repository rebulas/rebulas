let commonTests = require('./lib/common-tests'),
    model = require('backend/model');

let localCatalog = {
  id: 2,
  uri: 'empty',
  path: 'default'
};

module.exports = {
  setUp : function(cb) {
    commonTests.setUp();
    cb();
  },

  tearDown : function(cb) {
    commonTests.tearDown();
    cb();
  },

  testLocalIndex : async function(test) {
    await commonTests.verifyCatalog(test, localCatalog);
    test.done();
  },

  testLocalWrapper : async function(test) {
    try {
      await commonTests.verifyLocalWrapper(test, localCatalog);
    } catch(e) {
      console.log(e);
      test.fail(e);
    }

    test.done();
  },

  testLocalIndexReload : async function(test) {
    await commonTests.verifyIndexReload(test, localCatalog);
    test.done();
  },
};

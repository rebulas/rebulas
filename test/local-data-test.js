let commonTests = require('./lib/common-tests'),
    model = require('backend/model');

let dropboxCatalog = {
  id: 1,
  uri: 'dropbox.com',
  path: 'unittest',
}, localCatalog = {
  id: 2,
  uri: 'localhost',
  path: 'default'
};

module.exports = {
  setUp : function(cb) {
    commonTests.setUp(cb);
  },

  tearDown : function(cb) {
    commonTests.tearDown(cb);
    localCatalog.searchIndex = null;
    dropboxCatalog.searchIndex = null;
  },

  testLocalIndex : async function(test) {
    await commonTests.verifyCatalog(test, localCatalog);
    test.done();
  },

  testDropboxIndex : async function(test) {
    try {
      if(dropboxCatalog.token) {
        await commonTests.verifyCatalog(test, dropboxCatalog);
      }
    } catch(e) {
      test.fail(e);
    }
    test.done();
  },

  testLocalWrapper : async function(test) {
    try {
      await commonTests.verifyLocalWrapper(test, localCatalog);
    } catch(e) {
      test.fail(e);
    }

    test.done();
  },

  testDropboxLocalWrapper : async function(test) {
    try {
      if(dropboxCatalog.token) {
        await commonTests.verifyLocalWrapper(test, dropboxCatalog);
      }
    } catch(e) {
      test.fail(e);
    }

    test.done();
  },

  testLocalIndexReload : async function(test) {
    await commonTests.verifyIndexReload(test, localCatalog);
    test.done();
  },

  testDropboxIndexReload : async function(test) {
    try {
      if(dropboxCatalog.token) {
        await commonTests.verifyIndexReload(test, dropboxCatalog);
      }
    } catch(e) {
      test.fail(e);
    }
    test.done();
  }
};

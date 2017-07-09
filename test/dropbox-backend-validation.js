let Dropbox = require('dropbox'),
    commonTests = require('./lib/common-tests'),
    model = require('backend/model');

let dropboxCatalog = {
  id: 1,
  uri: 'dropbox.com',
  path: 'rebulas-unittest',
};

async function clearDropboxFolder() {
  let path = '/' + dropboxCatalog.path;
  console.log('Deleting', path);
  try {
    await new Dropbox({ accessToken: dropboxCatalog.token })
      .filesDelete({ path: path });
  } catch(e) {}
}

module.exports = {
  setUp : function(cb) {
    commonTests.setUp();
    cb();
  },

  tearDown : function(cb) {
    commonTests.tearDown();
    cb();
  },

  testDropboxIndex : async function(test) {
    try {
      if(dropboxCatalog.token) {
        await clearDropboxFolder();
        await commonTests.verifyCatalog(test, dropboxCatalog);
      }
    } catch(e) {
      console.log(e);
      test.fail(e);
    }
    test.done();
  },

  testDropboxInitialLoad: async function(test) {
    try {
      if(dropboxCatalog.token) {
        await clearDropboxFolder();
        let ops = commonTests.RebulasBackend().getIndexBackend(dropboxCatalog).delegate;
        await ops.saveItem(new model.CatalogItem('/rebulas-unittest/initial.txt', null,
                                           `# Name\ninitial item`));
        let index = await commonTests.RebulasBackend().getCatalogIndex(dropboxCatalog);
        let results = index.search('initial');
        test.equal(results.items.length, 1);
      }
    } catch(e) {
      console.log(e);
      test.fail(e);
    }
    test.done();
  },

  testDropboxLocalWrapper : async function(test) {
    try {
      if(dropboxCatalog.token) {
        await clearDropboxFolder();
        await commonTests.verifyLocalWrapper(test, dropboxCatalog);
      }
    } catch(e) {
      console.log(e);
      test.fail(e);
    }

    test.done();
  },

  testDropboxIndexReload : async function(test) {
    try {
      if(dropboxCatalog.token) {
        await clearDropboxFolder();
        await commonTests.verifyIndexReload(test, dropboxCatalog);
      }
    } catch(e) {
      console.log(e);
      test.fail(e);
    }
    test.done();
  }
};

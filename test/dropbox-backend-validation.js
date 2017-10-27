let Dropbox = require('dropbox'),
    commonTests = require('./lib/common-tests'),
    model = require('backend/model');

let dropboxCatalog = {
  id: 1,
  uri: 'dropbox.com',
  path: 'rebulas-unittest',
<<<<<<< HEAD
=======
>>>>>>> 4dcf2e127680fa55341a3ff214bc16a38b05177b
};

async function clearDropboxFolder() {
  let path = '/' + dropboxCatalog.path;
  console.log('Deleting', path);
  try {
    await new Dropbox({ accessToken: dropboxCatalog.token })
      .filesDelete({ path: path });
  } catch(e) {}
}

let tests = {
  setUp : async function(cb) {
    commonTests.setUp();
    await clearDropboxFolder();
    cb();
  },

  tearDown : async function(cb) {
    commonTests.tearDown();
    await clearDropboxFolder();
    cb();
  },

  testDropboxIndex : async function(test) {
    try {
      await commonTests.verifyCatalog(test, dropboxCatalog);
    } catch(e) {
      console.log(e);
      test.fail(e);
    }
    test.done();
  },

  testDropboxInitialLoad: async function(test) {
    try {
      let ops = commonTests.RebulasBackend().getIndexBackend(dropboxCatalog).delegate;
      await ops.saveItem(new model.CatalogItem('/rebulas-unittest/initial.txt', `# Name\ninitial item`));
      let index = await commonTests.RebulasBackend().getCatalogIndex(dropboxCatalog);
      let results = index.search('initial');
      test.equal(results.items.length, 1);
    } catch(e) {
      console.log(e);
      test.fail(e);
    }
    test.done();
  },

  testDropboxLocalWrapper : async function(test) {
    try {
      await commonTests.verifyLocalWrapper(test, dropboxCatalog);
    } catch(e) {
      console.log(e);
      test.fail(e);
    }
    test.done();
  },

  testDropboxIndexReload : async function(test) {
    try {
      await commonTests.verifyIndexReload(test, dropboxCatalog);
    } catch(e) {
      console.log(e);
      test.fail(e);
    }
    test.done();
  },

  testDropboxDelete : async function(test) {
    try {
      await commonTests.verifyDelete(test, dropboxCatalog);
    } catch(e) {
      console.log(e);
      test.fail(e);
    }
    test.done();
  }
};

if(dropboxCatalog.token) {
  module.exports.dropbox = tests;
}

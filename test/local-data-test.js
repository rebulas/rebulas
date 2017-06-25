let fs = require('fs'),
    dataload = require('../js/backend/dataload.js'),
    testStorage = require('../testlib/localstorage');

let dummyItem = {
  _md: '# Name\nDummy Item'
};

let dropboxCatalog = {
  id: 1,
  uri: 'dropbox.com',
  path: 'default',
};

let localCatalog = {
  id: 2,
  uri: 'localhost',
  path: 'default'
};

async function verifyCatalog(test, catalog) {
  try {
    let catalogIndex = await dataload.RebulasBackend.getCatalogIndex(catalog);
    await catalogIndex.saveItem(dummyItem);
    let result = catalogIndex.search('dummy');
    test.ok(result.items.length >= 1, 'Has result');
  } catch(e) {
    console.error(e);
    test.ok(false, e);
  }
  test.done();
}

module.exports.testLocalIndex = async (test) => verifyCatalog(test, localCatalog);

module.exports.testDropboxIndex = async (test) => {
  if(dropboxCatalog.token)
    verifyCatalog(test, dropboxCatalog);
  else
    test.done();
};

module.exports.setUp = (cb) => {
  testStorage.setUp();
  cb();
};
module.exports.tearDown = (cb) => {
  testStorage.LocalStorage.clear();
  testStorage.tearDown();
  cb();
};

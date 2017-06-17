let fs = require('fs'),
    dataload = require('../js/backend/dataload.js'),
    testStorage = require('../testlib/localstorage');

let catalog = {
  id: 1,
  uri: 'dropbox.com',
  path: 'default',
  token: ''
};

module.exports.testGetDropboxIndex = async (test) => {
  try {
    let catalogIndex = await dataload.RebulasBackend.getCatalogIndex(catalog);
    console.log('Built index', catalogIndex);
  } catch(e) {
    test.fail(e);
  }
  test.done();
};

module.exports.tearDown = (cb) => {
  testStorage.LocalStorage.clear();
  testStorage.tearDown();
  cb();
};

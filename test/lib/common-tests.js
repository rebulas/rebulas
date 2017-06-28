let fs = require('fs'),
    os = require('os'),
    path = require('path'),
    mock = require('mock-require'),
    LocalStorage = require('node-localstorage').LocalStorage,
    model = require('backend/model');;

var localforageMock = require('./localforage-mock');

var localMock;
var localhost;
var dataload;
var RebulasBackend;

let dummyItem = {
  _md: '# Name\nDummy Item'
}, dummyItem2 = {
  _md: '# Name\nDummy Item 2'
};

module.exports.setUp = (cb) => {
  let tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testdata-'));
  localMock = new LocalStorage(tempDir);
  mock('backend/local-storage', localMock);
  mock('localforage', localforageMock);

  dataload = require('backend/dataload.js');
  RebulasBackend = dataload.RebulasBackend;
  localhost = require('backend/localhost');

  cb();
};

module.exports.tearDown = (cb) => {
  console.log('Clear localStorage');
  localMock.clear();

  RebulasBackend.clearIndexCache();

  cb();
};

module.exports.verifyIndexReload = async (test, catalog) => {
  await module.exports.verifyCatalog(test, catalog);

  let oldIndex = catalog.searchIndex;
  RebulasBackend.clearIndexCache();
  catalog.searchIndex = null;

  await RebulasBackend.getCatalogIndex(catalog);

  let newIndex = catalog.searchIndex;

  let newJson = newIndex.index.toJSON(),
      oldJson = oldIndex.index.toJSON();

  test.deepEqual(newIndex.date, oldIndex.date, 'Unequal dates');
  test.deepEqual(newJson.fields, oldJson.fields, 'Unequal fields');
  test.deepEqual(newJson.documentStore.docs, oldJson.documentStore.docs, 'Unequal docs');
  test.deepEqual(newJson.documentStore.docInfo, oldJson.documentStore.docInfo, 'Unequal docInfo');

  test.deepEqual(newIndex.features, oldIndex.features, 'Unequal features');
};

module.exports.verifyCatalog = async (test, catalog) => {
  try {
    let catalogIndex = await RebulasBackend.getCatalogIndex(catalog);
    let savedItem = await catalogIndex.saveItem(dummyItem);
    test.ok(savedItem.id, 'Has no id');
    let result = catalogIndex.search('dummy');
    test.ok(result.items.length >= 1, 'Not found in result');
    test.ok(result.items.find(
      (e) => e._md === dummyItem._md, 'Dummy not found in result'));

    test.ok(catalogIndex.index.documentStore.getDoc(savedItem.id), 'Has saved item in store');
  } catch(e) {
    console.error(e);
    test.ok(false, e);
  }
};

module.exports.verifyLocalWrapper = async (test, catalog) => {
  let indexOps = RebulasBackend.getIndexBackend(catalog),
      originalOps = indexOps,
      failingOps = new model.BaseCatalogOperations(catalog);

  indexOps = new localhost.LocalWrapperOperations(catalog, indexOps);

  let index = await RebulasBackend.loadIndex(indexOps, catalog),
      firstSavedItem = await index.saveItem(dummyItem),
      secondSavedItem,
      searchResult = index.search('dummy'),
      allFiles,
      dirtyItems;

  test.ok(searchResult.items.length >= 1, 'No result');
  test.ok(searchResult.items.find(
    (e) => e._md === dummyItem._md, 'No dummy item as result'));

  // Swap out with a backend that will reject all operations
  indexOps.delegate = failingOps;
  secondSavedItem = await index.saveItem(dummyItem2);

  searchResult = index.search('dummy');
  test.ok(searchResult.items.length >= 2, 'Empty result');
  test.ok(searchResult.items.find(
    (e) => e._md === dummyItem._md, 'No dummy item in result'));
  test.ok(searchResult.items.find(
    (e) => e._md === dummyItem2._md, 'No dummy item 2 in result'));

  // Check that indeed we don't have the saved item in the original backend
  allFiles = await originalOps.listItems();
  test.ok(!allFiles.find((e) => e.name === secondSavedItem.name), 'Item 2 found in original');
  // Restore backend and sync
  indexOps.delegate = originalOps;

  dirtyItems = await indexOps.dirtyItems();
  test.ok(dirtyItems.length > 0, 'Not dirty after failing save');
  console.log(secondSavedItem);
  //test.ok(await indexOps.isDirtyItem(secondSavedItem), 'Item not reported dirty');

  console.log('Syncing');
  await indexOps.sync();

  dirtyItems = await indexOps.dirtyItems();
  test.ok(dirtyItems.length === 0, 'Has dirty items after sync');

  // Verify it's synced now, loop to account for not immediate consistency
  let found = false;
  for (let i = 0; i < 5 && !found; i++) {
    allFiles = await originalOps.listItems();
    found = allFiles.find((e) => e.name === secondSavedItem.name);
  }
  test.ok(found, 'Item 2 not found in original after sync');
};

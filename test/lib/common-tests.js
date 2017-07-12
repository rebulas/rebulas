let fs = require('fs'),
    os = require('os'),
    path = require('path'),
    mock = require('mock-require'),
    LocalStorage = require('node-localstorage').LocalStorage,
    model = require('backend/model');

var localforageMock = require('./localforage-mock');

var localMock;
var localhost;
var dataload;
var RebulasBackend;

let dummyItem = {
  rawContent: '# Name\nDummy Item'
}, dummyItem2 = {
  rawContent: '# Name\nDummy Item 2'
}, dummyItem3 = {
  rawContent: '# Name\nDummy Item 3'
};

module.exports.someIndex = async () =>
  await RebulasBackend.getCatalogIndex({
    id: 3,
    uri: 'empty',
    path: 'default'
  });
;

module.exports.setUp = () => {
  let tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testdata-'));
  localMock = new LocalStorage(tempDir);
  mock('backend/local-storage', localMock);
  mock('localforage', localforageMock);

  dataload = require('backend/dataload.js');
  dataload.indexCache.clear();
  RebulasBackend = dataload.RebulasBackend;
  localhost = require('backend/localhost');
  localforageMock.clear();
};

module.exports.tearDown = () => {
  console.log('Clear localStorage');
  localMock.clear();
};

module.exports.verifyIndexReload = async (test, catalog) => {
  await module.exports.verifyCatalog(test, catalog);

  let oldIndex = catalog.searchIndex;
  catalog.searchIndex = null;

  dataload.indexCache.clear();
  await RebulasBackend.getCatalogIndex(catalog);

  let newIndex = catalog.searchIndex;

  let newJson = newIndex.index.toJSON(),
      oldJson = oldIndex.index.toJSON();

  test.deepEqual(newJson.fields, oldJson.fields, 'Unequal fields');
  test.deepEqual(newJson.documentStore.docs, oldJson.documentStore.docs, 'Unequal docs');
  test.deepEqual(newJson.documentStore.docInfo, oldJson.documentStore.docInfo, 'Unequal docInfo');

  test.deepEqual(newIndex.features, oldIndex.features, 'Unequal features');
};

module.exports.verifyCatalog = async (test, catalog) => {
  try {
    let catalogIndex = await RebulasBackend.getCatalogIndex(catalog);
    catalogIndex.indexOperations = catalogIndex.indexOperations.delegate;
    let savedItem = await catalogIndex.saveItem(dummyItem);
    test.ok(savedItem.id, 'Has no id');
    let result = catalogIndex.search('dummy');
    test.ok(result.items.length >= 1, 'Not found in result');
    test.ok(result.items.find(
      (e) => e.rawContent === dummyItem.rawContent, 'Dummy not found in result'));

    test.ok(catalogIndex.index.documentStore.getDoc(savedItem.id), 'Has saved item in store');
    let remoteItem = await catalogIndex.indexOperations.getItem(savedItem);
    test.deepEqual(remoteItem, savedItem);
    test.ok((await catalogIndex.indexOperations.listItems()).length >= 1);
  } catch(e) {
    console.error(e);
    test.ok(false, e);
  }
};

module.exports.verifyLocalWrapper = async (test, catalog) => {
  let index = await RebulasBackend.getCatalogIndex(catalog),
      indexOps = index.indexOperations,
      originalOps = index.indexOperations.delegate,
      firstSavedItem = await index.saveItem(dummyItem),
      secondSavedItem,
      searchResult = index.search('dummy'),
      allFiles,
      dirtyItems;

  test.ok(searchResult.items.length >= 1, 'No result');
  test.ok(searchResult.items.find(
    (e) => e.rawContent === dummyItem.rawContent, 'No dummy item as result'));

  // Swap out with a backend that will reject all operations
  secondSavedItem = await index.saveItem(dummyItem2);

  searchResult = index.search('dummy');
  test.ok(searchResult.items.length >= 2, 'Empty result');
  test.ok(searchResult.items.find(
    (e) => e.rawContent === dummyItem.rawContent, 'No dummy item in result'));
  test.ok(searchResult.items.find(
    (e) => e.rawContent === dummyItem2.rawContent, 'No dummy item 2 in result'));

  let localSecondItem = await indexOps.getItem(secondSavedItem);
  test.deepEqual(secondSavedItem, localSecondItem, 'Not equal saved item in local store');

  // Check that indeed we don't have the saved item in the original backend
  allFiles = await originalOps.listItems();
  test.ok(!allFiles.find((e) => e.name === secondSavedItem.name), 'Item 2 found in original');

  await index.sync();

  let remoteSecondSavedItem = await originalOps.getItem(secondSavedItem);
  secondSavedItem.rev = remoteSecondSavedItem.rev;
  test.deepEqual(secondSavedItem, remoteSecondSavedItem,
                 'Not equal saved item in remote store');

  // Verify it's synced now, loop to account for not immediate consistency
  let found = false;
  for (let i = 0; i < 5 && !found; i++) {
    allFiles = await originalOps.listItems();
    found = allFiles.find((e) => e.id === secondSavedItem.id);
  }
  test.ok(found, 'Item 2 not found in original after sync');

  let oldIndex = catalog.searchIndex;

  dataload.indexCache.clear();
  await RebulasBackend.getCatalogIndex(catalog);

  let newIndex = catalog.searchIndex;

  let newJson = newIndex.index.toJSON(),
      oldJson = oldIndex.index.toJSON();

  test.deepEqual(newJson.fields, oldJson.fields, 'Unequal fields');
  test.deepEqual(newJson.documentStore.docs, oldJson.documentStore.docs, 'Unequal docs');
  test.deepEqual(newJson.documentStore.docInfo, oldJson.documentStore.docInfo, 'Unequal docInfo');

  test.deepEqual(newIndex.features, oldIndex.features, 'Unequal features');
};

module.exports.RebulasBackend = () => RebulasBackend;

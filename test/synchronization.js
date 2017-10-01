let commonTests = require('./lib/common-tests'),
    model = require('backend/model');

let localCatalog = {
  id: 234,
  uri: 'empty',
  path: '/default'
};

let itemId = 0;
function generateItemId() {
  return `${localCatalog.path}/${itemId++}`;
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
  
  testDeleteUndo: async function(test) {
    try {
      let item = new model.CatalogItem(generateItemId(), 'local'),
          index = await commonTests.RebulasBackend().getCatalogIndex(localCatalog),
          remoteBackend = index.indexOperations.delegate, // LocalOnlyWrapper
          localBackend = index.indexOperations, // LocalWrapperOperations
          event;

      await index.pull();
      index.state.addListener((e) => {
        event = e;
      });

      item = await localBackend.saveItem(item);
      await index.push();

      await localBackend.deleteItem(item);

      test.deepEqual(item, event.item);
      test.equal('deleted', event.state);

      await localBackend.undeleteItem(item);

      test.deepEqual(item, event.item);
      test.equal('not-deleted', event.state);

      await index.push();

      // make sure no info available for it anymore
      test.ok(!index.state.isDeleted(item));
      test.ok(index.state.remoteRev(item));

      test.ok(await remoteBackend.getItem(item));
      test.ok(await localBackend.getItem(item));

    } catch(e) {
      test.fail('error', e);
      console.error(e);
    }
    test.done();
  },

  testDeletePush: async function(test) {
    try {
      let item = new model.CatalogItem(generateItemId(), 'local'),
          index = await commonTests.RebulasBackend().getCatalogIndex(localCatalog),
          remoteBackend = index.indexOperations.delegate, // LocalOnlyWrapper
          localBackend = index.indexOperations, // LocalWrapperOperations
          event;

      await index.pull();
      index.state.addListener(e => event = e);

      item = await localBackend.saveItem(item);
      await index.push();
      test.ok(await remoteBackend.getItem(item));

      await localBackend.deleteItem(item);
      test.deepEqual(item, event.item);
      test.equal('deleted', event.state);
      test.ok(await localBackend.state.isDeleted(item));

      await index.push();
      test.ok(!index.state.isDeleted(item));
      test.ok(!index.state.remoteRev(item));

      let missing;
      missing = await remoteBackend.getItem(item);
      test.ok(!missing);

      missing = await localBackend.getItem(item);
      test.ok(!missing);

    } catch(e) {
      test.fail('Error', e);
      console.error(e);
    }
    test.done();
  },

  testCatalogSynchronization: async function(test) {
    try {
      let index = await commonTests.RebulasBackend().getCatalogIndex(localCatalog),
          itemId = generateItemId(),
          local1 = new model.CatalogItem(itemId, 'local'),
          remote1 = new model.CatalogItem(itemId, 'remote'),
          remoteBackend = index.indexOperations.delegate, // LocalOnlyWrapper
          localBackend = index.indexOperations, // LocalCacheWrapper
          event;

      await index.pull();
      index.state.addListener((e) => {
        event = e;
      });

      local1 = await localBackend.saveItem(local1); // Marks it dirty, throws dirty event
      test.deepEqual(local1, event.item);
      test.equal('dirty', event.state);
      test.ok(localBackend.state.isDirty(local1)); // Check marked as dirty in internal state

      remote1 = await remoteBackend.saveItem(remote1); // remoteBackend uses EmptyState, does not fire events
      let localItems = await localBackend.listItems(),
          remoteItems = await remoteBackend.listItems();

      test.equal(localItems.length, 1);
      test.equal(localItems.length, remoteItems.length);

      // Should get planned as local to remote, local has state dirty i.e. rev = 0, remote reports rev as undefined
      // The save to remote should assign a revision to the item, a subsequent call to save on local should store the item
      // with the revision and remove the dirty mark
      event = null;
      await index.push();

      local1 = await localBackend.getItem(local1);

      test.deepEqual(local1, event.item);
      test.deepEqual('not-dirty', event.state);
      test.ok(!localBackend.state.isDirty(local1));

      local1 = new model.CatalogItem(itemId, 'local2');
      local1 = await localBackend.saveItem(local1);
      test.deepEqual(local1, event.item);
      test.deepEqual('dirty', event.state);
      test.ok(localBackend.state.isDirty(local1));
    } catch(e) {
      test.fail('Error', e);
      console.error(e);
    }
    test.done();
  },

  testRemoteDeletionPull: async function(test) {
    let cat1 = Object.assign({}, localCatalog),
        cat2 = Object.assign({}, localCatalog);
    cat1.id = 1111;
    cat2.id = 2222;

    let index1 = await commonTests.RebulasBackend().getCatalogIndex(cat1),
        index2 = await commonTests.RebulasBackend().getCatalogIndex(cat2);

    let itemId = generateItemId(),
        item = new model.DisplayItem(null, 'local');

    try {
      let savedItem = await index1.saveItem(item);

      item = savedItem;
      test.ok(item);
      await index1.push();
      await index2.pull();

      test.ok(await index1.indexOperations.getItem(item));
      test.ok(await index2.indexOperations.getItem(item));

      await index2.deleteItem(item);

      debugger;
      await index2.push();
      await index1.pull();

      item = await index1.indexOperations.getItem(item);
      test.ok(!item);
      test.done(); return;

      // now verify we no longer reference it anywhere
      await index1.push();
      await index2.pull();

      test.ok(!(await index1.indexOperations.getItem(item)));
      test.ok(!(await index2.indexOperations.getItem(item)));

      let isReferenced = index => {
        console.log(index.state.toJson());
        return JSON.stringify(index.state.toJson()).indexOf(savedItem.id) >= 0;
      };
      test.ok(!isReferenced(index1));
      test.ok(!isReferenced(index2));
    } catch(e) {
      console.error(e);
      test.ok(false);
    }

    test.done();
  }
};

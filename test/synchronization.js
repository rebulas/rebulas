let commonTests = require('./lib/common-tests'),
    model = require('backend/model');

let localCatalog = {
  id: 234,
  uri: 'empty',
  path: '/default'
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

  testDeleteUndo: async function(test) {
    try {
      let item = new model.CatalogItem('1', 'local'),
          index = await commonTests.RebulasBackend().getCatalogIndex(localCatalog),
          remoteBackend = index.indexOperations.delegate, // LocalOnlyWrapper
          localBackend = index.indexOperations, // LocalWrapperOperations
          event;

      await index.sync();
      index.state.addListener((e) => {
        event = e;
      });

      item = await localBackend.saveItem(item);
      await index.sync();

      await localBackend.deleteItem(item);

      test.deepEqual(item, event.item);
      test.equal('deleted', event.state);

      await localBackend.undeleteItem(item);

      test.deepEqual(item, event.item);
      test.equal('not-deleted', event.state);

      await index.sync();

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

  testDeleteSynchronization: async function(test) {
    try {
      let item = new model.CatalogItem('1', 'local'),
          index = await commonTests.RebulasBackend().getCatalogIndex(localCatalog),
          remoteBackend = index.indexOperations.delegate, // LocalOnlyWrapper
          localBackend = index.indexOperations, // LocalWrapperOperations
          event;

      await index.sync();
      index.state.addListener((e) => {
        event = e;
      });

      item = await localBackend.saveItem(item);
      await index.sync();

      await localBackend.deleteItem(item);

      test.deepEqual(item, event.item);
      test.equal('deleted', event.state);

      await index.sync();

      // make sure no info available for it anymore
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
      let local1 = new model.CatalogItem('1', 'local'),
          remote1 = new model.CatalogItem('1', 'remote'),
          index = await commonTests.RebulasBackend().getCatalogIndex(localCatalog),
          remoteBackend = index.indexOperations.delegate, // LocalOnlyWrapper
          localBackend = index.indexOperations, // LocalCacheWrapper
          event;

      await index.sync();
      index.state.addListener((e) => {
        event = e;
      });

      local1 = await localBackend.saveItem(local1); // Marks it dirty, throws dirty event
      test.deepEqual(local1, event.item);
      test.equal('dirty', event.state);
      test.equal(0, localBackend.state.state.remoteRevs[local1.id]); // Check marked as dirty in internal state
      event = null;

      remote1 = await remoteBackend.saveItem(remote1); // remoteBackend uses EmptyState, does not fire events
      let localItems = await localBackend.listItems(),
          remoteItems = await remoteBackend.listItems();

      test.equal(localItems.length, 1);
      test.equal(localItems.length, remoteItems.length);

      // Should get planned as local to remote, local has state dirty i.e. rev = 0, remote reports rev as undefined
      // The save to remote should assign a revision to the item, a subsequent call to save on local should store the item
      // with the revision and remove the dirty mark
      await index.sync();

      local1 = await localBackend.getItem(local1);
      test.deepEqual(local1, event.item);
      test.deepEqual('not-dirty', event.state);
      test.ok(!localBackend.state.isDirty(local1));

      local1 = new model.CatalogItem('1', 'local2');
      local1 = await localBackend.saveItem(local1);
      test.deepEqual(local1, event.item);
      test.deepEqual('dirty', event.state);
      test.ok(localBackend.state.isDirty(local1));
    } catch(e) {
      test.fail('Error', e);
      console.error(e);
    }
    test.done();
  }
};

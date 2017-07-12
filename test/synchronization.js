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

  testCatalogSynchronization: async function(test) {
    try {
      let local1 = new model.CatalogItem('1', 'local'),
          remote1 = new model.CatalogItem('1', 'remote'),
          index = await commonTests.RebulasBackend().getCatalogIndex(localCatalog),
          remoteBackend = index.indexOperations.delegate,
          localBackend = index.indexOperations,
          event;

      await index.sync();
      index.state.addListener((e) => {
        event = e;
      });

      local1 = await localBackend.saveItem(local1);
      test.deepEqual(local1, event.item);
      test.equal('dirty', event.state);
      event = null;

      remote1 = await remoteBackend.saveItem(remote1);
      let localItems = await localBackend.listItems(),
          remoteItems = await remoteBackend.listItems();

      test.equal(localItems.length, 1);
      test.equal(localItems.length, remoteItems.length);
      await index.sync();

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

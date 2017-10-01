let DefaultPlanner = require('../js/backend/sync/catalog-synchronization.js').DefaultPlanner,
    CatalogState = require('../js/backend/sync/catalog-state.js').CatalogState,
    model = require('../js/backend/model.js');

async function prepare(config) {
  let localState = new CatalogState(),
      remoteState = new CatalogState();

  async function setItemState(state, item) {
    switch (item.rev) {
    case 'dirty':
      return state.markDirty(item);
    case 'not-dirty':
      return state.unmarkDirty(item);
    case 'deleted':
      return state.markDeleted(item);
    case 'none':
      return Promise.resolve();
    default:
      throw new Error('Bad test config ' + item.rev);
    }
  }

  let localItem = new model.CatalogItemEntry('1', config.localItemState),
      remoteItem = new model.CatalogItemEntry('1', config.remoteItemState);

  localState.state.remoteRevs[localItem.id] = 'not-dirty';

  await setItemState(localState, localItem);
  await setItemState(remoteState, remoteItem);

  return [ localState , remoteState, new DefaultPlanner(localState), localItem, remoteItem ];
}

async function runTest(test, config, expectedPlan) {
  try {
    let [ localState, remoteState, planner, localItem, remoteItem ] = await prepare(config);

    function planDescriptionReplacement(item) {
      switch (item) {
      case 'local':
        return localItem;
      case 'remote':
        return remoteItem;
      default:
        return item;
      }
    }

    expectedPlan.forEach(action => {
      if(action.item) {
        action.item = planDescriptionReplacement(action.item);
      }
      if(action.srcItem) {
        action.srcItem = planDescriptionReplacement(action.srcItem);
      }
      if(action.destItem) {
        action.destItem = planDescriptionReplacement(action.srcItem);
      }
    });

    let localItems = (localState.isDeleted(localItem) || config.localItemState === 'none')
        ? [] : [ localItem ];
    let remoteItems = (remoteState.isDeleted(remoteItem) || config.remoteItemState === 'none')
        ? [] : [ remoteItem ];

    let plan = planner.planActions(localItems, remoteItems, remoteState);

    test.deepEqual(expectedPlan, plan);
  } catch(e) {
    console.log(e);
    test.ok(false);
  }
  test.done();
}

module.exports = {
  // Some item is in remote, no matching local
  testNoMatchingLocal: test => runTest(test, {
    localItemState: 'none',
    remoteItemState: 'not-dirty'
  }, [{
    action: 'to-local',
    item: 'remote'
  }], test),

  testNoMatchingRemote: test => runTest(test, {
    localItemState: 'not-dirty',
    remoteItemState: 'none'
  }, [{
    action: 'to-remote',
    item: 'local'
  }], test),

  testLocalModifiedRemoteUnmodified: test => runTest(test, {
    localItemState: 'dirty',
    remoteItemState: 'not-dirty'
  }, [{
    action: 'to-remote',
    item: 'local'
  }], test),

  testLocalUnmodifiedRemoteModified: test => runTest(test, {
    localItemState: 'not-dirty',
    remoteItemState: 'dirty'
  }, [{
    action: 'to-local',
    item: 'remote'
  }], test),

  testLocalModifiedRemoteModified: test => runTest(test, {
    localItemState: 'dirty',
    remoteItemState: 'dirty'
  }, [{
    action: 'conflict',
    srcItem: 'local',
    destItem: 'remote'
  }], test),

  testLocalDeletedRemoteNone: test => runTest(test, {
    localItemState: 'deleted',
    remoteItemState: 'none'
  }, [], test),

  testLocalDeletedRemoteDeleted: test => runTest(test, {
    localItemState: 'deleted',
    remoteItemState: 'deleted'
  }, [], test),

  testLocalUnmodifiedRemoteDeleted: test => runTest(test, {
    localItemState: 'not-dirty',
    remoteItemState: 'deleted'
  }, [{
    action: 'delete-local',
    item: 'local'
  }], test),

  // TODO:
  testLocalDeletedRemoteModified: test => runTest(test, {
    localItemState: 'deleted',
    remoteItemState: 'dirty'
  }, [{
    action: 'delete-remote',
    item: 'local'
  }], test),

  // TODO: rename local item, instead of delete
  testLocalModifiedRemoteDeleted: test => runTest(test, {
    localItemState: 'dirty',
    remoteItemState: 'deleted'
  }, [{
    action: 'delete-local',
    item: 'local'
  }], test),

  testCleanUp: async test => {
    // If no more references in remote, local ref is deleted
    let localState = new CatalogState(),
        remoteState = new CatalogState(),
        localItemNotReferenced = new model.CatalogItemEntry('1', 'bla'),
        localItemReferenced = new model.CatalogItemEntry('2', 'bla');

    await localState.markDeleted(localItemNotReferenced);

    remoteState.state.remoteRevs[localItemReferenced.id] = '2';
    await localState.markDeleted(localItemReferenced);

    await localState.cleanUp([], remoteState);

    test.ok(!localState.isDeleted(localItemNotReferenced));
    test.ok(localState.isDeleted(localItemReferenced));

    test.done();
  }
};

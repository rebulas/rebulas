var Util = require("extra/util"),
    model = require('../model');

class CatalogSynchronization {
  constructor(conflictResolve, localStore) {
    this.conflictResolve = conflictResolve;
    this.localStore = localStore;
  }

  get stateItemId() {
    return `${this.remoteStatesPath}/${this.localState.id}`;
  }

  get remoteStatesPath() {
    return `${this.localStore.path}/.rebulas`;
  }

  get localState() {
    return this.localStore.state;
  }

  planActions(localItems, toDelete, remoteItems) {
    // Fetch all items that are not found locally but exist on remote unless they are scheduled for deletion
    let actions = remoteItems.filter(
      item => !(localItems.find(src => src.id === item.id)) &&
        !(toDelete.find(itemToDelete => itemToDelete.id === item.id))
    ).map(newItem => ({
      action: 'to-local',
      item: newItem
    }));

    Util.log('New items', actions.map(a => ({
      itemRev: a.item.rev
    })));

    localItems.forEach(localItem => {
      let remoteItem = remoteItems.find(remoteItem => localItem.id === remoteItem.id),
          localItemDirty = this.localState.isDirty(localItem),
          knownRemoteRev = this.localState.remoteRev(localItem),
          actionDetailsString = JSON.stringify({
            itemId: localItem.id,
            remoteItemRev: (remoteItem || {}).rev,
            knownRemoteRev: knownRemoteRev,
            localItemDirty: localItemDirty
          }, null, 2);

      if (!remoteItem || (localItemDirty && knownRemoteRev == remoteItem.rev)) {
        // The item does not exist on the remote or it's unchanged on remote and we've changed it locally
        // Push
        actions.push({
          action: 'to-remote',
          item: localItem
        });
        Util.log('Plan', 'to-remote', actionDetailsString);
      } else if (!localItemDirty && knownRemoteRev !== remoteItem.rev) {
        // No local changes but there seems to be remote changes
        // Fetch
        actions.push({
          action: 'to-local',
          item: remoteItem
        });
        Util.log('Plan', 'to-local', actionDetailsString);
      } else if (localItemDirty && knownRemoteRev !== remoteItem.rev) {
        // We've changed the item locally but the remote revision differs from the local one
        // We have a conflict to resolve
        actions.push({
          action: 'conflict',
          srcItem: localItem,
          destItem: remoteItem
        });
        Util.log('Plan', 'conflict', actionDetailsString);
      }
    });

    toDelete.forEach(item => actions.push({
      item: item,
      action: 'delete-remote'
    }));
    Util.log('Local deleted items in remote', toDelete.map(item => item.id));

    return actions;
  }

  async refreshState(remote) {
    Util.debug('Loading remote states');
    return this.localState.load()
      .then(() => remote.listItems(`${this.localStore.path}/.rebulas`))
      .then(remoteStates => Promise.all(remoteStates.map(remoteState => remote.getItem(remoteState))))
      .then(remoteStates => {
        console.log('Remote states', remoteStates);
      });
  }

  async plan(remote) {
    let self = this;
    try {
      await this.refreshState(remote);

      let [ allRemote, allLocal, deletedLocal ] = await Promise.all([
        remote.listItems(),
        this.localStore.listItems(),
        this.localStore.listDeletedItems()
      ]);

      let plan = this.planActions(allLocal, deletedLocal, allRemote);
      plan = await Promise.all(
        plan.map(action => action.action === 'conflict' ? self.conflictResolve(action) : action)
      );

      Util.debugUtil('lastPlan', plan);
      Util.debugUtil('lastPlanInput', {
        localItems: allLocal,
        remoteItems: allRemote,
        localDeleted: deletedLocal
      });

      return plan;
    } catch(e) {
      Util.error(e);
    }

    return [];
  }

  async push(remote) {
    let plan = await this.plan(remote);
    plan = plan.filter(
      action => ['to-remote', 'delete-remote'].indexOf(action.action) >= 0
    );
    return this.apply(remote, plan).then(
      () => remote.saveItem(new model.CatalogItem(
        this.stateItemId, JSON.stringify(this.localState.toJson(), null, 2)))
    );
  }

  async pull(remote) {
    let plan = await this.plan(remote);
    plan = plan.filter(
      action => ['to-local'].indexOf(action.action) >= 0
    );
    return this.apply(remote, plan);
  }

  apply(remote, plan) {
    let self = this,
        local = this.localStore;

    function save(from, to, item) {
      return from.getItem(item)
        .then(item => to.saveItem(item));
    }

    function executeAction(action) {
      switch(action.action) {
        case 'to-local':
          Util.log(action.item.id, 'remote -> local');
          return save(remote, local, action.item)
                  .then(item => self.localState.unmarkDirty(item));
        case 'to-remote':
          Util.log(action.item.id, 'local -> remote');
          return save(local, remote, action.item)
            .then(item => {
                local.saveItem(item);
                self.localState.unmarkDirty(item);
            })
            .catch(e => {
              Util.log("Error saving " + action.item.id + " from local to remote, error " + e + ". Leaving item marked as dirty.");
              self.localState.markDirty(action.item);
            });
        case 'delete-remote':
          return remote.deleteItem(action.item)
            .then(() => {
              local.realDeleteItem(action.item);
              self.localState.clearDirty(action.item);
            });
        default:
          return Promise.resolve();
      }
    }

    return Promise.all(plan.map(executeAction));
  }
}

module.exports = CatalogSynchronization;

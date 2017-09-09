var Util = require("extra/util");

class CatalogSynchronization {

  constructor(conflictResolve, state) {
    this.conflictResolve = conflictResolve;
    this.state = state;
  }

  planActions(srcItems, toDelete, destItems) {
    // Fetch all items that are not found locally but exist on remote unless they are scheduled for deletion
    let actions = destItems.filter(
      item => !(srcItems.find(src => src.id === item.id)) &&
        !(toDelete.find(itemToDelete => itemToDelete.id === item.id))
    ).map(newItem => ({
      action: 'to-local',
      item: newItem
    }));

    Util.log('New items', actions.map(a => ({
      itemRev: a.item.rev
    })));

    srcItems.forEach(srcItem => {
      let destItem = destItems.find(destItem => srcItem.id === destItem.id),
          localItemDirty = this.state.isDirty(srcItem),
          knownRemoteRev = this.state.remoteRev(srcItem),
          actionDetailsString = JSON.stringify({
            itemId: srcItem.id,
            remoteItemRev: (destItem || {}).rev,
            knownRemoteRev: knownRemoteRev,
            localItemDirty: localItemDirty
          }, null, 2);

      if (!destItem || (localItemDirty && knownRemoteRev == destItem.rev)) {
        // The item does not exist on the remote or it's unchanged on remote and we've changed it locally
        // Push
        actions.push({
          action: 'to-remote',
          item: srcItem
        });
        Util.log('Plan', 'to-remote', actionDetailsString);
      } else if (!localItemDirty && knownRemoteRev !== destItem.rev) {
        // No local changes but there seems to be remote changes
        // Fetch
        actions.push({
          action: 'to-local',
          item: destItem
        });
        Util.log('Plan', 'to-local', actionDetailsString);
      } else if (localItemDirty && knownRemoteRev !== destItem.rev) {
        // We've changed the item locally but the remote revision differs from the local one
        // We have a conflict to resolve
        actions.push({
          action: 'conflict',
          srcItem: srcItem,
          destItem: destItem
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

  async plan(local, remote) {
    let self = this;
    try {
      await this.state.load();

      let allRemote = await remote.listItems();
      let allLocal = await local.listItems();
      let deletedLocal = await local.listDeletedItems();

      let plan = this.planActions(allLocal, deletedLocal, allRemote);
      plan = await Promise.all(plan.map(action => {
        if (action.action === 'conflict') {
          return self.conflictResolve(action);
        } else {
          return action;
        }
      }));
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

  async push(local, remote) {
    let plan = await this.plan(local, remote);
    plan = plan.filter(
      action => ['to-remote', 'delete-remote'].indexOf(action.action) >= 0);
    return this.apply(local, remote, plan);
  }

  async pull(local, remote) {
    let plan = await this.plan(local, remote);
    plan = plan.filter(
      action => ['to-local'].indexOf(action.action) >= 0);
    return this.apply(local, remote, plan);
  }

  apply(local, remote, plan) {
    let self = this;

    function save(from, to, item) {
      return from.getItem(item)
        .then(item => to.saveItem(item));
    }

    function executeAction(action) {
      switch(action.action) {
        case 'to-local':
          Util.log(action.item.id, 'remote -> local');
          return save(remote, local, action.item)
                  .then(item => self.state.unmarkDirty(item));
        case 'to-remote':
          Util.log(action.item.id, 'local -> remote');
          return save(local, remote, action.item)
            .then(item => {
                local.saveItem(item);
                self.state.unmarkDirty(item);
            })
            .catch(e => {
              Util.log("Error saving " + action.item.id + " from local to remote, error " + e + ". Leaving item marked as dirty.");
              self.state.markDirty(action.item);
            });
        case 'delete-remote':
          return remote.deleteItem(action.item)
            .then(() => {
              local.realDeleteItem(action.item);
              self.state.clearDirty(action.item);
            });
        default:
          return Promise.resolve();
      }
    }

    return Promise.all(plan.map(executeAction));
  }
}

module.exports = CatalogSynchronization;

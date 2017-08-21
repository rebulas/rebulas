var Util = require("extra/util");

class CatalogSynchronization {

  constructor(conflictResolve, state) {
    this.conflictResolve = conflictResolve;
    this.state = state;
  }

  planActions(srcItems, toDelete, destItems) {
    let actions = destItems.filter(
      item => !(srcItems.find(src => src.id === item.id)) &&
        !(toDelete.find(itemToDelete => itemToDelete.id === item.id))
    ).map(newItem => ({
      action: 'to-local',
      item: newItem
    }));

    srcItems.forEach(
      srcItem => {
        let destItem = destItems.find(destItem => srcItem.id === destItem.id);
        // No remote item, so just save
        let remoteUnchanged = !destItem || this.state.remoteRev(srcItem) !== destItem.rev,
            localChanged = this.state.isDirty(srcItem);

        if(remoteUnchanged) {
          actions.push({
            action: 'to-remote',
            item: srcItem
          });
        } else if (localChanged) {
          actions.push({
            action: 'conflict',
            sourceItem: srcItem,
            destItem: destItem
          });
        }
      }
    );

    toDelete.forEach(item => actions.push({
      item: item,
      action: 'delete-remote'
    }));

    return actions;
  }

  async plan(local, remote) {
    try {
      await this.state.load();

      let allRemote = await remote.listItems();
      let allLocal = await local.listItems();
      let deletedLocal = await local.listDeletedItems();

      let plan = this.planActions(allLocal, deletedLocal, allRemote);
      plan = await Promise.all(plan.map(
        action => {
          if(action.action === 'conflict') {
            return self.conflictResolve(action);
          } else {
            return action;
          }
        }));
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
        return save(remote, local, action.item);
      case 'to-remote':
        Util.log(action.item.id, 'local -> remote');
        return save(local, remote, action.item)
          .then(item => local.saveItem(item))
          .catch(e => {
            Util.log("Error saving " + action.item.id + " from local to remote, error " + e + ". Leaving item marked as dirty.");
            self.state.markDirty(action.item);
          });
      case 'delete-remote':
        return remote.deleteItem(action.item)
          .then(() => local.realDeleteItem(action.item));
      default:
        return Promise.resolve();
      }
    }

    return Promise.all(plan.map(executeAction));
  }
}

module.exports = CatalogSynchronization;

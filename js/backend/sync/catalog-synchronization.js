var Util = require("extra/util");

class CatalogSynchronization {

  constructor(conflictResolve, state) {
    this.conflictResolve = conflictResolve;
    this.state = state;
  }

  plan(srcItems, destItems) {
    let actions = destItems.filter(
      item => !(srcItems.find(src => src.id === item.id))
    ).map(newItem => ({
      action: 'to-local',
      item: newItem
    }));

    srcItems.forEach(
      srcItem => {
        let destItem = destItems.find(destItem => srcItem.id === destItem.id);
        // No remote item, so just save
        if(!destItem || this.state.remoteRev(srcItem) !== destItem.rev) {
          actions.push({
            action: 'to-remote',
            item: srcItem
          });
        } else if (this.state.isDirty(srcItem)) {
          actions.push({
            action: 'conflict',
            sourceItem: srcItem,
            destItem: destItem
          });
        }
      }
    );

    return actions;
  }

  async sync(local, remote) {
    let self = this,
        plan = [];
    try {
      await self.state.load();
      let allRemote = await remote.listItems();
      let allLocal = await local.listItems();
      plan = this.plan(allLocal, allRemote);
    } catch(e) {
      Util.error(e);
    }

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
          .then((item) => local.saveItem(item))
          .catch(() => self.state.markDirty(action.item));
      case 'conflict':
        return self.conflictResolve(action.sourceItem, action.destItem)
          .then(executeAction);
      default:
        return Promise.resolve();
      }
    }

    return Promise.all(plan.map(executeAction));
  }
}

module.exports = CatalogSynchronization;

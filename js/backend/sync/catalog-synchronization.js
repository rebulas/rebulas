var Util = require("extra/util"),
    CatalogState = require('./catalog-state').CatalogState,
    model = require('../model');

class DefaultPlanner {
  constructor(localState) {
    this.localState = localState;
  }

  planActions(localItems, remoteItems, remoteState) {
    let localState = this.localState;

    // Fetch all items that are not found locally but exist on remote unless they are scheduled for deletion

    let deletedLocally = localState.listDeleted();
    let actions = remoteItems.filter(
      item => !(localItems.find(src => src.id === item.id)) &&
        !(deletedLocally.find(itemToDelete => itemToDelete.id === item.id))
    ).map(newItem => ({
      action: 'to-local',
      item: newItem
    }));

    Util.log('New items', actions.map(a => ({
      itemRev: a.item.rev
    })));

    localItems.forEach(localItem => {
      let remoteItem = remoteItems.find(remoteItem => localItem.id === remoteItem.id),
          localItemDirty = localState.isDirty(localItem),
          remoteItemDirty = () => localState.remoteRev(localItem) !== remoteItem.rev,
          remoteItemDeleted = remoteState.isDeleted(localItem),
          actionDetailsString = JSON.stringify({
            itemId: localItem.id,
            remoteItemRev: (remoteItem || {}).rev,
            knownRemoteRev: localState.remoteRev(localItem),
            localItemDirty: localItemDirty
          }, null, 2);

      if ((!remoteItem && !remoteItemDeleted) ||
          (localItemDirty && remoteItem && !remoteItemDirty())) {
        // The item does not exist on the remote and not deleted remotely or
        // it's unchanged on remote and we've changed it locally
        // Push
        actions.push({
          action: 'to-remote',
          item: localItem
        });
        Util.log('Plan', 'to-remote', actionDetailsString);
      } else if (!(remoteItemDeleted || localItemDirty || !remoteItemDirty())) {
        // No local changes but there seems to be remote changes
        // Pull
        actions.push({
          action: 'to-local',
          item: remoteItem
        });
        Util.log('Plan', 'to-local', actionDetailsString);
      } else if (remoteItemDeleted && localItemDirty) {
        actions.push({
          action: 'rename-local',
          item: localItem
        });
        Util.log('Plan', 'rename-local', actionDetailsString);
      } else if (remoteItemDeleted) {
        actions.push({
          action: 'delete-local',
          item: localItem
        });
        Util.log('Plan', 'delete-local', actionDetailsString);
      } else if (localItemDirty && remoteItemDirty()) {
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

    deletedLocally.filter(
      locallyDeletedItem => remoteItems.find(remoteItem => locallyDeletedItem.id === remoteItem.id)
    ).forEach(item => {
      let action = {
        item: new model.CatalogItemEntry(item.id, item.rev),
        action: 'delete-remote'
      };
      Util.log('Plan', 'delete-remote', JSON.stringify(action, null, 2));
      actions.push(action);
    });

    return actions;
  }
}

class CatalogSynchronization {
  constructor(conflictResolve, localStore, planner) {
    this.planner = planner || new DefaultPlanner(localStore.state);
    this.conflictResolve = conflictResolve;
    this.localStore = localStore;
  }

  get localState() {
    return this.planner.localState;
  }

  get stateItemId() {
    return `${this.remoteStatesPath}/${this.localState.id}.json`;
  }

  get remoteStatesPath() {
    return `${this.localStore.path}/.rebulas`;
  }

  async refreshRemoteStateAggregation(remote) {
    Util.debug('Loading remote states');
    let stateEntryToObject = state => {
      try {
        return JSON.parse(state.content);
      } catch(e) {
        Util.log('Error parsing remote client state, ignoring: ', state.content);
        return null;
      }
    };

    return remote.listItems(`${this.localStore.path}/.rebulas/`)
      .then(
        remoteStateItems => remoteStateItems.filter(item => item.id !== this.stateItemId)
      ).then(
        remoteStates => Promise.all(remoteStates.map(remoteState => remote.getItem(remoteState)))
      ).then(
        remoteStates => remoteStates.map(state => JSON.parse(state.content)).filter(s => s)
      ).then(remoteStates => {
        let remoteState = new CatalogState(),
            deleted = {},
            remoteRevs = {};

        remoteStates.forEach(
          state => {
            state.deleted.forEach(
              item => deleted[item.id] = item.rev
            );
            Object.keys(state.remoteRevs).forEach(
              itemId => remoteRevs[itemId] = state.remoteRevs[itemId]
            );
          }
        );

        // This will only use the last remoteRev, i.e.
        // the remoteRev will not be meaningful,
        // not yet sure whether we need it
        remoteState.state.deleted = Object.keys(deleted).map(
          id => ({
            id: id,
            rev: deleted[id]
          })
        );
        remoteState.state.remoteRevs = remoteRevs;

        Util.log(`Loaded ${remoteStates.length} remote states`);
        Util.log(remoteState);
        return remoteState;
      });
  }

  async plan(remote) {
    let self = this;
    try {
      await this.localState.refresh();
      let remoteStateAggregation = await this.refreshRemoteStateAggregation(remote);

      let [ allRemote, allLocal ] = await Promise.all([
        remote.listItems(),
        this.localStore.listItems()
      ]);

      let plan = this.planner.planActions(allLocal, allRemote, remoteStateAggregation);

      plan = await Promise.all(
        plan.map(action => action.action === 'conflict' ? self.conflictResolve(action) : action)
      );

      Util.debugUtil('lastPlan', plan);
      Util.debugUtil('lastPlanInput', {
        localItems: allLocal,
        remoteItems: allRemote,
        localDeleted: this.localState.listDeleted()
      });

      return {
        actions: plan,
        remoteItems: allRemote,
        remoteState: remoteStateAggregation
      };
    } catch(e) {
      Util.error(e);
    }

    return {
      actions: [],
      remoteItems: []
    };
  }

  async _pushLocalState(remote, remoteState) {
    await remote.listItems().then(
      remoteItems => this.localState.cleanUp(remoteItems, remoteState)
    ).then(() => {
      let stateItem = new model.CatalogItem(
        this.stateItemId,
        JSON.stringify(this.localState.toJson(), null, 2)
      );
      Util.log('pushing state to remote', this.localState);
      return remote.saveItem(stateItem);
    });
  }

  async _sync(remote, allowedActions) {
    let syncPlan = await this.plan(remote);
    syncPlan.actions = syncPlan.actions.filter(
      action => allowedActions.indexOf(action.action) >= 0
    );
    return this.apply(remote, syncPlan.actions).then(
      () => this._pushLocalState(remote, syncPlan.remoteState)
    );
  }

  push(remote) {
    return this._sync(remote, ['to-remote', 'delete-remote']);
  }

  pull(remote) {
    return this._sync(remote, ['to-local', 'delete-local', 'rename-local']);
  }

  apply(remote, plan) {
    let self = this,
        local = this.localStore;

    function save(from, to, item) {
      return from.getItem(item)
        .then(item => to.saveItem(item));
    }

    function executeAction(action) {
      switch (action.action) {
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
            Util.log("Error saving", action.item.id,
                     "from local to remote, error", e,
                     ". Leaving item marked as dirty.");
            self.localState.markDirty(action.item);
          });
      case 'delete-remote':
        return remote.deleteItem(action.item)
          .then(() => {
            local.realDeleteItem(action.item);
          });
      case 'delete-local':
        return local.deleteItem(action.item)
          .then(() => {
            local.realDeleteItem(action.item);
          });
      case 'rename-local':
        return local.deleteItem(action.item)
          .then(() => local.realDeleteItem(action.item))
          .then(() => {
            action.item.id = model.generateItemId(action.item, remote);
            return local.saveItem(action.item);
          });
      default:
        return Promise.resolve();
      }
    }

    return Promise.all(plan.map(executeAction));
  }
}

module.exports = {
  CatalogSynchronization: CatalogSynchronization,
  DefaultPlanner: DefaultPlanner
};

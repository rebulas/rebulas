var Util = require("extra/util");
var localforage = require('localforage');
var lc = require("backend/local-storage"),
    model = require('./model');
var hasher = require('sha.js');

class ItemState {
  constructor(item, state) {
    this.item = item;
    this.state = state;
  }
}

class EmptyState {
  constructor() {}
  load(){}
  isDirty(item) { return false; }
  markDirty(item) {}
  unmarkDirty(item) {}
  fire(event) {}
  addListener(listener) {}
  removeAllListeners() {}
  removeListener(listener) {}
}

class CatalogState extends EmptyState {
  constructor(storage, storageId) {
    super();
    this.itemKey = '__catalog_state_' + storageId;
    this.listeners = [(e) => Util.log(e.item.id, e.state, e.item.rev) ];
    this.state = {
      remoteRevs: new Map()
    };
    this.storage = storage;
    this.queue = new Util.PromiseQueue();
  }

  load() {
    return this.queue.exec(() => {
      return this.storage.getItem(this.itemKey)
        .then((state) => {
          this.state = state || this.state;
        });
    });
  }

  save() {
    return this.queue.exec(() => {
      return this.storage.setItem(this.itemKey, this.state);
    });
  }

  isDirty(item) {
    return !item.rev || this.state.remoteRevs.get(item.id) !== item.rev;
  }

  remoteRev(item) {
    return this.state.remoteRevs.get(item.id);
  }

  markDirty(item) {
    return this.queue.exec(() => {
      this.fire(new ItemState(item, 'dirty'));
      return this.save().then(() => item);
    });
  }

  unmarkDirty(item) {
    return this.queue.exec(() => {
      if(this.isDirty(item)) {
        this.state.remoteRevs.set(item.id, item.rev);
        this.fire(new ItemState(item, 'not-dirty'));
      }
      return this.save().then(() => item);
    });
  }

  fire(event) {
    this.listeners.forEach(listener => listener(event));
  }

  addListener(listener) {
    let index = this.listeners.indexOf(listener);
    if(index < 0)
      this.listeners.push(listener);
  }

  removeAllListeners() {
    this.listeners = [];
  }

  removeListener(listener) {
    let index = this.listeners.indexOf(listener);
    if(index >= 0)
      this.listeners.splice(index, 1);
  }
}

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

class LocalWrapperOperations extends model.BaseCatalogOperations {
  constructor(catalog, delegate) {
    super(catalog);
    this.delegate = delegate;
    this.storageId = "rebulas_local_" + catalog.id;
    this.storage = localforage.createInstance({
      name: this.storageId
    });
    this.state = new CatalogState(this.storage, this.storageId);
  }

  async listItems() {
    let self = this,
        keys = await this.storage.keys();
    keys = keys.filter(key => key !== self.state.itemKey);

    let entries = keys.map((key) => new model.CatalogItemEntry(key));
    return Promise.all(entries.map(
      entry => self.getItem(entry)
    ));
  }

  isItemChanged(catalogItem) {
    return !catalogItem.rev || catalogItem.rev === this.storageId;
  }

  saveItem(catalogItem) {
    if(this.isItemChanged(catalogItem)) {
      catalogItem.rev = hasher('sha256')
        .update(catalogItem.content).digest('hex');
      this.state.markDirty(catalogItem);
    } else {
      this.state.unmarkDirty(catalogItem);
    }
    return this.storage.setItem(catalogItem.id, catalogItem.toJSON())
      .then(() => catalogItem)
      .catch((err) => {
        Util.log('Failed to save locally', catalogItem.id, ':', err);
        return catalogItem;
      });
  }

  getItem(catalogItem) {
    return this.storage.getItem(catalogItem.id)
      .then((localItem) => new model.CatalogItem().fromJSON(localItem));
  }

  sync(conflictResolve) {
    return new CatalogSynchronization(conflictResolve, this.state)
      .sync(this, this.delegate);
  }
}

class LocalOnlyOperations extends LocalWrapperOperations {
  constructor(catalog) {
    super(catalog);
    this.state = new EmptyState();
  }

  isItemChanged(item) { return true; }
}

class LocalhostOperations extends model.BaseCatalogOperations {
  constructor(catalog) {
    super(catalog);
    this.storageId = "rebulas_localhost_storage_" + catalog.id;

    var list = lc.getItem(this.storageId);
    if (!list) {
      list = {
        "/improved-authentication-merchanism.md" : "# Name\nImproved Authentication mechanism\n\n# Description\nIn our cloud we require multiple logins while we could centralise the auth via LDAP across all login channels\n\n# Clients\nWaitrose, Cloud Team\n\n## Releases\nFAS 8.3",

        "/publishing-ui-imporovements.md" : "# Name\nPublishing UI improvements\n\n# Description\nThe UI for the punlishing went from not-granular at all to too granular all too quickly. We need improvements that allow for less input when publishing (auto-fill publish names) and ability to publish all - relevant for smaller customers that don't have large teams to collaborate.\n\n# Clients\nScrewfix, Hema, Intergramma\n\n# Releases\nFAS 8.3\n\n# People\nVincent, Tim, Kees"
      };
      lc.setItem(this.storageId, JSON.stringify(list));
    }
  }

  async listItems() {
    var list = JSON.parse(lc.getItem(this.storageId));
    return Object.keys(list).map((path) => new model.CatalogItemEntry(path));
  }

  saveItem(catalogItem) {
    var list = JSON.parse(lc.getItem(this.storageId));
    list[catalogItem.id] = catalogItem.content;
    lc.setItem(this.storageId, JSON.stringify(list));

    return Promise.resolve(new model.CatalogItem(catalogItem.id,
                                                 catalogItem.content));
  }

  getItem(entry) {
    var list = JSON.parse(lc.getItem(this.storageId));
    return Promise.resolve(new model.CatalogItem(entry.id, list[entry.id]));
  }
}

module.exports.LocalhostOperations = LocalhostOperations;
module.exports.LocalWrapperOperations = LocalWrapperOperations;
module.exports.LocalOnlyOperations = LocalOnlyOperations;

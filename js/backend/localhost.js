var Util = require("extra/util");
var localforage = require('localforage');
var lc = require("backend/local-storage"),
    model = require('./model');

class CatalogSynchronization {
  constructor(conflictResolve) {
    this.conflictResolve = conflictResolve;
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
        if(!destItem) {
          actions.push({
            action: 'to-remote',
            item: srcItem
          });
        } else if (!srcItem.remoteRev || destItem.rev !== srcItem.remoteRev) {
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
      let allRemote = await remote.listItems();
      let allLocal = await local.listItems();
      plan = this.plan(allLocal, allRemote);
    } catch(e) {
      Util.log(e);
    }

    function save(from, to, item) {
      return from.getItem(item)
        .then(item => to.saveItem(item))
        .then(toSaved => {
          toSaved.remoteRev = toSaved.rev;
          return from.saveItem(toSaved);
        }
      );
    }

    function executeAction(action) {
      if(action.action === 'to-local') {
        return save(remote, local, action.item);
      } else if(action.action === 'to-remote') {
        return save(local, remote, action.item);
      } else if(action.sourceItem && action.destItem) {
        return self.conflictResolve(action.sourceItem, action.destItem)
          .then(executeAction);
      }
      return Promise.resolve();
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
  }

  toDelegatePath(path) {
    return path.substring(this.storageId.length);
  }

  isLocalPath(path) {
    return path.startsWith(this.storageId + '/');
  }

  toLocalPath(path) {
    return this.storageId + path;
  }

  async listItems() {
    let self = this;
    let entries = await this.storage.keys()
        .then(
          keys => keys.filter((key) => self.isLocalPath(key)).
            map((key) => self.toDelegatePath(key)).
            map((key) => new model.CatalogItemEntry(key))
        );
    return Promise.all(entries.map(entry => self.getItem(entry)));
  }

  saveItem(catalogItem) {
    catalogItem.rev = this.storageId;
    return this.storage.setItem(this.toLocalPath(catalogItem.id), catalogItem.toJSON())
      .then(() => catalogItem)
      .catch((err) => {
        Util.log('Failed to save locally', catalogItem.id, ':', err);
        return catalogItem;
      });
  }

  getItem(catalogItem) {
    let localPath = this.toLocalPath(catalogItem.id);
    return this.storage.getItem(localPath)
      .then((localItem) => new model.CatalogItem().fromJSON(localItem));
  }

  sync(conflictResolve) {
    return new CatalogSynchronization(conflictResolve).sync(this, this.delegate);
  }
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
    return Object.keys(list).map((path) => new model.CatalogItemEntry(path, 'localhost'));
  }

  saveItem(catalogItem) {
    var list = JSON.parse(lc.getItem(this.storageId));
    list[catalogItem.id] = catalogItem.content;
    lc.setItem(this.storageId, JSON.stringify(list));

    return Promise.resolve(new model.CatalogItem(catalogItem.id,
                                                 'localhost',
                                                 catalogItem.content));
  }

  getItem(entry) {
    var list = JSON.parse(lc.getItem(this.storageId));
    return Promise.resolve(new model.CatalogItem(entry.id, 'localhost', list[entry.id]));
  }
}

module.exports.LocalhostOperations = LocalhostOperations;
module.exports.LocalWrapperOperations = LocalWrapperOperations;

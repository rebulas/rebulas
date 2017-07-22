var Util = require("extra/util");
var model = require('backend/model');
var CatalogSynchronization = require("backend/sync/catalog-synchronization");
var CatalogState = require("backend/sync/catalog-state");
var localforage = require('localforage');
var hasher = require("sha.js");

class LocalCacheWrapper extends model.BaseCatalogOperations {

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
    var localItem = this.getItem(catalogItem);

    // Special case handling for the initial store cycle - the item has entered the system without rev, once it
    // goes through the sync cycle, the storage issues a rev. Having nothing to compare it to, should mean we're
    // just saving the revisioned item and should not consider this a change since no content is supposed to be changed
    if (catalogItem.rev && !localItem.rev) {
      return false;
    } else {
      return !catalogItem.rev || catalogItem.rev !== localItem.rev;
    }
  }

  saveItem(catalogItem) {
    if (this.isItemChanged(catalogItem)) {
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
module.exports = LocalCacheWrapper;
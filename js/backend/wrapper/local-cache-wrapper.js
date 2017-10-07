var Util = require("extra/util");
var model = require("backend/model");
var CatalogSynchronization = require("backend/sync/catalog-synchronization").CatalogSynchronization;
var CatalogState = require("backend/sync/catalog-state");
var localforage = require("localforage");
var hasher = require("sha.js");

class LocalWrapperOperations extends model.BaseCatalogOperations {

  constructor(catalog, delegate) {
    super(catalog);
    this.delegate = delegate;
    this.storageId = "rebulas_local_" + catalog.id;
    this.storage = localforage.createInstance({
      name: this.storageId
    });
    this.state = CatalogState.fromStorage(this.storage, this.storageId);
  }

  async _listItems(listPath, filter) {
    let self = this,
        keys = await this.storage.keys();

    keys = keys.filter(key => key !== self.state.itemKey);

    if (listPath) {
      keys = keys.filter(key => key.startsWith(listPath))
        .filter(key => !key.startsWith(listPath + '/'));
    } else {
      keys = keys.filter(
        key => key.startsWith(this.path) &&
          key.substring(this.path.length + 1).indexOf('/') < 0
      );
    }

    let entries = keys.map(key => new model.CatalogItemEntry(key))
        .filter(filter || (() => true));
    return Promise.all(entries.map(
      entry => self.getItem(entry)
    ));
  }

  listItems(listPath) {
    return this._listItems(listPath, item => !this.state.isDeleted(item));
  }

  _isItemChanged(catalogItem) {
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
    if(!catalogItem.id.startsWith(this.path)) {
      throw new Error(`Cannot save item with id ${catalogItem.id}`);
    }

    if (this._isItemChanged(catalogItem)) {
      this.state.markDirty(catalogItem);
    } else {
      this.state.unmarkDirty(catalogItem);
    }
    return this.storage.setItem(catalogItem.id, catalogItem.toJSON())
      .then(() => catalogItem)
      .catch((err) => {
        Util.error('Failed to save locally', catalogItem.id, ':', err);
        return catalogItem;
      });
  }

  getItem(catalogItem) {
    return this.storage.getItem(catalogItem.id)
      .then(localItem => localItem ? new model.CatalogItem().fromJSON(localItem) : null);
  }

  deleteItem(catalogItem) {
    return this.state.markDeleted(catalogItem);
  }

  undeleteItem(catalogItem) {
    return this.state.unmarkDeleted(catalogItem);
  }

  realDeleteItem(catalogItem) {
    return this.state.deleteItem(catalogItem)
      .then(() => this.storage.removeItem(catalogItem.id));
  }

  push(conflictResolve) {
    let synchronization = new CatalogSynchronization(conflictResolve, this);
    return synchronization.push(this.delegate);
  }

  pull(conflictResolve) {
    let synchronization = new CatalogSynchronization(conflictResolve, this);
    return synchronization.pull(this.delegate);
  }

  restoreItem(catalogItem) {
    return this.state.unmarkDeleted(catalogItem);
  }
}

module.exports = LocalWrapperOperations;

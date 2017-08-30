var Util = require("extra/util");
var model = require('backend/model');

class CatalogState extends model.EmptyState {
  constructor(storage, storageId) {
    super();
    this.itemKey = '__catalog_state_' + storageId;
    this.listeners = [(e) => Util.log(e.item.id, e.state, e.item.rev) ];
    this.state = {
      remoteRevs : {},
      deleted : [],
      dirty : []
    };
    this.storage = storage;
    this.queue = new Util.PromiseQueue();
  }

  load() {
    return this.queue.exec(() => {
      return this.storage.getItem(this.itemKey)
        .then((state) => {
          this.state = state || this.state;
          // Backwards compatibility
          this.state.deleted = this.state.deleted || [];
          this.state.dirty = this.state.dirty || [];
        });
    });
  }

  save() {
    return this.queue.exec(() => {
      return this.storage.setItem(this.itemKey, this.state);
    });
  }

  remoteRev(item) {
     return this.state.remoteRevs[item.id];
  }

  isDirty(item) {
    return this.state.dirty.indexOf(item.id) != -1
  }

  markDirty(item) {
    return this.queue.exec(() => {
      if (!this.isDirty(item)) {
          this.state.dirty.push(item.id);
          this.fire(new model.ItemState(item, 'dirty'));
      };

      return this.save().then(() => item);
    });
  }

  /* TODO Fix naming, unmarkDirty has side effects of storing remoteRevs */
  unmarkDirty(item) {
    return this.queue.exec(() => {
      this.clearDirty(item);

      this.state.remoteRevs[item.id] = item.rev;
      this.fire(new model.ItemState(item, 'not-dirty'));

      return this.save().then(() => item);
    });
  }

  clearDirty(item) {
    var index = this.state.dirty.indexOf(item.id);
    if (index > -1) {
      Util.arrayRemove(this.state.dirty, index);
    }
  }

  markDeleted(item) {
    return this.queue.exec(() => {
      if(!this.isDeleted(item)) {
        this.state.deleted.push(item.id);
        this.fire(new model.ItemState(item, 'deleted'));
      }
      return this.save().then(() => item);
    });
  }

  deleteItem(item) {
    return this.queue.exec(() => {
      let index = this.state.deleted.indexOf(item.id);
      if(index >= 0) {
        this.state.deleted.splice(index, 1);
      }
      delete this.state.remoteRevs[item.id];
      return this.save().then(() => item);
    });
  }

  unmarkDeleted(item) {
    return this.queue.exec(() => {
      let index = this.state.deleted.indexOf(item.id);
      if(index >= 0) {
        this.state.deleted.splice(index, 1);
        this.fire(new model.ItemState(item, 'not-deleted'));
      }
      return this.save().then(() => item);
    });
  }

  isDeleted(item) {
    return this.state.deleted.indexOf(item.id) >= 0;
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

module.exports = CatalogState;

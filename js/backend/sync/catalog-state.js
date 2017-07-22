var Util = require("extra/util");
var model = require('backend/model');

class CatalogState extends model.EmptyState {
  constructor(storage, storageId) {
    super();
    this.itemKey = '__catalog_state_' + storageId;
    this.listeners = [(e) => Util.log(e.item.id, e.state, e.item.rev) ];
    this.state = {
      remoteRevs : {},
      deleted : []
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

  remoteRev(item) {
     return this.state.remoteRevs[item.id];
  }

  isDirty(item) {
    let id = item.id;
    let remoteRev = this.state.remoteRevs[id];
    console.log("Item id " + id + ", remote rev " + remoteRev + ", current rev " + item.rev);
    return !item.rev || remoteRev !== item.rev;
  }

  markDirty(item) {
    return this.queue.exec(() => {
      this.fire(new model.ItemState(item, 'dirty'));
      this.state.remoteRevs[item.id] = 0;
      return this.save().then(() => item);
    });
  }

  unmarkDirty(item) {
    return this.queue.exec(() => {
      if(this.isDirty(item)) {
        this.state.remoteRevs[item.id] = item.rev;
        this.fire(new model.ItemState(item, 'not-dirty'));
      }
      return this.save().then(() => item);
    });
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
        this.fire(new model.ItemState(item, 'restored'));
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

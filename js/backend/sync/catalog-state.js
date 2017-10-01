let Util = require("extra/util"),
    model = require('backend/model'),
    uuid = require('uuid');

class CatalogState extends model.EmptyState {
  constructor() {
    super();
    this.listeners = [
      (e) => Util.log(e.item.id, 'in state', e.state,
                      'rev', e.item.rev,
                      'remoteRev', this.remoteRev(e.item))
    ];
    this.state = {
      id: uuid.v4(),
      remoteRevs : {},
      deleted : [],
      dirty : []
    };
    this.queue = new Util.PromiseQueue();
  }

  toJson() {
    return this.state;
  }

  // TODO: Figure out how not to have save/refresh here...
  save() {
    return Promise.resolve();
  }
  refresh() {
    return Promise.resolve();
  }

  get id() {
    return this.state.id;
  }

  remoteRev(item) {
     return this.state.remoteRevs[item.id];
  }

  isDirty(item) {
    return this.state.dirty.indexOf(item.id) != -1;
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
        this.state.deleted.push({
          id: item.id,
          rev: item.rev
        });
        this.fire(new model.ItemState(item, 'deleted'));
      }
      return this.save().then(() => item);
    });
  }

  listDeleted() {
    return this.state.deleted;
  }

  deleteItem(item) {
    return this.queue.exec(() => {
      delete this.state.remoteRevs[item.id];
      return this.clearDirty(item);
    });
  }

  unmarkDeleted(item) {
    return this.queue.exec(() => {
      let index = this.state.deleted.findIndex(e => e.id === item.id);
      if(index >= 0) {
        this.state.deleted.splice(index, 1);
        this.fire(new model.ItemState(item, 'not-deleted'));
      }
      return this.save().then(() => item);
    });
  }

  isDeleted(item) {
    return this.state.deleted.findIndex(e => e.id === item.id) >= 0;
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

  async cleanUp(remoteItems, remoteState) {
    return this.queue.exec(() => {
      // keep deleted reference to items still in remote,
      // or referenced somewhere else
      let referencedDeleted = this.state.deleted.filter(item => {
        return remoteItems.find(remoteItem => remoteItem.id === item.id)
          || remoteState.remoteRev(item);
      });
      this.state.deleted = referencedDeleted;
      return this.save();
    });
  }
}

class StorageBackedState extends CatalogState {
  constructor(storage, storageId) {
    super();
    this.storage = storage;
    this.itemKey = '__catalog_state_' + storageId;
  }

  refresh() {
    return this.queue.exec(
      () => this.storage.getItem(this.itemKey)
        .then(savedState => {
          if(!savedState) {
            return;
          }

          this.state = savedState || this.state;
          this.state.id = savedState.id || this.state.id;
          this.state.deleted = this.state.deleted || [];
          this.state.dirty = this.state.dirty || [];
        })
    );
  }

  save() {
    return this.queue.exec(() => {
      return this.storage.setItem(this.itemKey, this.state);
    });
  }
}

function createStorageBackedState(storage, storageId) {
  return new StorageBackedState(storage, storageId);
}

module.exports = {
  CatalogState: CatalogState,
  fromStorage: createStorageBackedState
};

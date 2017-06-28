var Util = require("extra/util");
var localforage = require('localforage');
var lc = require("backend/local-storage"),
    model = require('./model');

class LocalWrapperOperations extends model.BaseCatalogOperations {
  constructor(catalog, delegate) {
    super(catalog);
    this.delegate = delegate;
    this.storageId = "rebulas_local_storage_" + catalog.id;
  }

  toDelegatePath(path) {
    return path.substring(this.storageId.length + 1);
  }

  isLocalPath(path) {
    return path.startsWith(this.storageId + '/');
  }

  toLocalPath(path) {
    return this.storageId + '/' + path;
  }

  async listItems() {
    try {
      return await this.delegate.listItems();
    } catch(e) {
      Util.error(e);
    }

    let self = this,
        allKeys = await localforage.keys();

    return allKeys.
      filter((key) => self.isLocalPath(key)).
      map((key) => self.toDelegatePath(key)).
      map((key) => new model.CatalogItemEntry(key, '0'));
  }

  saveDocument(path, content) {
    let self = this;

    function onLocalSaveReject(errLocal) {
      Util.error(errLocal);
      return saveRemote().then(null, (errRemote) => {
        Util.error(errRemote);
        return Promise.reject(new Error([errLocal, errRemote]));
      });
    }

    function saveRemote() {
      Util.log('Saving', path);
      return self.delegate.saveDocument(path, content).catch((err) => {
        Util.log('Failed to save', path, ':', err);
        let localItem = {
          id: path,
          name: model.toEntryName(path),
          rev: '',
          content: content
        };
        return self.addDirty(self.toLocalPath(path)).then(() => localItem, (err) => {
          Util.error(err);
          return err;
        });
      });
    }

    return localforage.setItem(self.toLocalPath(path), content)
      .then(saveRemote, onLocalSaveReject);
  }

  getEntryContent(entry) {
    let self = this,
        localPath = self.toLocalPath(entry.path);

    return self.delegate.getEntryContent(entry).then(
      (content) => localforage.setItem(localPath, content)
    ).catch((err) => {
      Util.error(err);
      return localforage.getItem(localPath);
    });
  }

  saveIndexContent(index) {
    Util.log('Saving index', this.delegate.indexFile);
    return this.saveDocument(this.delegate.indexFile, JSON.stringify(index));
  }

  async sync() {
    let self = this,
        dirty = await this.dirtyItems();
    let promises = dirty.map(
      (entryPath) =>
        localforage.getItem(entryPath)
        .then((entryContent) => {
          Util.log('Saving remote', entryPath);
          return self.delegate.saveDocument(self.toDelegatePath(entryPath), entryContent);
        })
        .then((savedItem) => {
          let index = dirty.indexOf(entryPath);
          dirty.splice(index, 1);
        }).catch((err) => Util.log(err))
    );
    return Promise.all(promises)
        .then(() => self.saveDirtyItems(dirty));
  }

  async addDirty(item) {
    let dirty = await this.dirtyItems(),
    index = dirty.indexOf(item);
    if(index < 0) {
      dirty.push(item);
    }
    return this.saveDirtyItems(dirty);
  }

  saveDirtyItems(dirty) {
    Util.log('Saving dirty:', dirty);
    return localforage.setItem('dirty_items_' + this.storageId, dirty);
  }

  dirtyItems() {
    return localforage.getItem('dirty_items_' + this.storageId)
      .then((items) => items || [], (err) => { Util.log(err); return []; });
  }

  isDirty() {
    return this.dirtyItems();
  }

  isDirtyItem(item) {
    return this.dirtyItems()
      .then((items) => items.indexOf(this.toLocalPath(item.path)) > 0);
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
    return Object.keys(list).map((path) => new model.CatalogItemEntry(path));
  }

  saveDocument(path, content) {
    var list = JSON.parse(lc.getItem(this.storageId));
    list[path] = content;
    lc.setItem(this.storageId, JSON.stringify(list));

    return Promise.resolve({
      "id": path,
      "name": model.toEntryName(path),
      "content": content,
      "rev": "1"
    });
  }

  getEntryContent(entry) {
    var list = JSON.parse(lc.getItem(this.storageId));
    return Promise.resolve(list[entry.id]);
  }

  saveIndexContent(index) {
    Util.log('Saving index', this.indexFile);
    return this.saveDocument(this.indexFile, JSON.stringify(index));
  }
}

module.exports.LocalhostOperations = LocalhostOperations;
module.exports.LocalWrapperOperations = LocalWrapperOperations;

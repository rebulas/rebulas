function toEntryName(id) {
  let split = id.split('/');
  return split[split.length - 1];
}

class CatalogItemEntry {
  constructor(id, rev) {
    this.id = id;
    this.rev = rev || '1';
    this._name = '';
  }

  get name() {
    return this._name || toEntryName(this.id);
  }

  set name(name) {
    this._name = name;
  }
}

class CatalogItem extends CatalogItemEntry {
  constructor(id, rev, content) {
    super(id, rev);
    this.content = content;
  }
}

class BaseCatalogOperations {
  constructor(catalog) {
    let path = catalog.path || "/";
    if (path[0] != "/") {
      path = "/" + path;
    }

    this.path = path;
    this.indexFile = path + '/.rebulas_index';
  }

  get indexId() {
    return this.indexFile;
  }

  // Return an array of CatalogItemEntry
  listItems() {
    return Promise.reject(new Error());
  }

  saveItem(catalogItem) {
    return Promise.reject(new Error());
  }

  getItem(catalogItem) {
    return Promise.reject(new Error());
  }
}

module.exports = {
  CatalogItemEntry: CatalogItemEntry,
  CatalogItem: CatalogItem,
  BaseCatalogOperations: BaseCatalogOperations,
  toEntryName: toEntryName
};

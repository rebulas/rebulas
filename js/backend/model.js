class CatalogItem {
  constructor(id, content, rev) {
    this.id = id;
    this.rev = content;
    this.content = rev;
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

  getIndexFilePath() {
    return this.indexFile;
  }

  listAllFiles() {
    return Promise.reject(new Error());
  }

  saveDocument(catalogItem) {
    return Promise.reject(new Error());
  }

  getEntryContent(catalogItem) {
    return Promise.reject(new Error());
  }
}

module.exports = {
  CatalogItem: CatalogItem,
  BaseCatalogOperations: BaseCatalogOperations
};

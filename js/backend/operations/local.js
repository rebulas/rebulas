var lc = require("backend/operations/local-storage");
var model = require("backend/model");
var hasher = require("sha.js");

class LocalStorageOperations extends model.BaseCatalogOperations {
  constructor(catalog) {
    super(catalog);
    this.storageId = "rebulas_localhost_storage_" + catalog.id;

    var list = lc.getItem(this.storageId);
    if (!list) {
      list = {};

      let id = "/improved-authentication-merchanism.md";
      let content = "# Name\nImproved Authentication mechanism\n\n# Description\nIn our cloud we require multiple logins while we could centralise the auth via LDAP across all login channels\n\n# Clients\nWaitrose, Cloud Team\n\n## Releases\nFAS 8.3";
      let rev = hasher('sha256').update(content).digest('hex');
      list[id] = new model.CatalogItem(id, content, rev).toJSON();

      id = "/publishing-ui-imporovements.md";
      content = "# Name\nPublishing UI improvements\n\n# Description\nThe UI for the punlishing went from not-granular at all to too granular all too quickly. We need improvements that allow for less input when publishing (auto-fill publish names) and ability to publish all - relevant for smaller customers that don't have large teams to collaborate.\n\n# Clients\nScrewfix, Hema, Intergramma\n\n# Releases\nFAS 8.3\n\n# People\nVincent, Tim, Kees";
      rev = hasher('sha256').update(content).digest('hex');
      list[id] = new model.CatalogItem(id, content, rev).toJSON();

      lc.setItem(this.storageId, JSON.stringify(list));
    }
  }

  async listItems() {
    var list = JSON.parse(lc.getItem(this.storageId));
    return Object.keys(list).map((path) => new model.CatalogItemEntry(path));
  }

  saveItem(catalogItem) {
    var list = JSON.parse(lc.getItem(this.storageId));
    catalogItem.rev = hasher('sha256').update(catalogItem.content).digest('hex');

    list[catalogItem.id] = catalogItem.toJSON();
    lc.setItem(this.storageId, JSON.stringify(list));

    return Promise.resolve(catalogItem);
  }

  getItem(entry) {
    var list = JSON.parse(lc.getItem(this.storageId));
    var content = list[entry.id];
    return Promise.resolve(new model.CatalogItem().fromJSON(content));
  }
}

module.exports = LocalStorageOperations;

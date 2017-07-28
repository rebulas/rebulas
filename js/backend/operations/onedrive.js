var Util = require("extra/util");
var model = require("backend/model");

class OneDriveOperations extends model.BaseCatalogOperations {
  listItems() {
    return [];
  }

  saveItem(catalogItem) {
    return Promise.resolve(catalogItem);
  }

  getItem(catalogItem) {
    return Promise.resolve(catalogItem);
  }
}

module.exports = OneDriveOperations;

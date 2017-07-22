var LocalWrapperOperations = require("backend/wrapper/local-cache-wrapper");
var model = require("backend/model");
var hasher = require("sha.js");

class LocalOnlyWrapper extends LocalWrapperOperations {

  constructor(catalog) {
    super(catalog);
    this.state = new model.EmptyState();
  }

  _isItemChanged(item) { return true; }

  // We're using EmptyState so no need of firing events
  saveItem(item) {
    // LocalOnlyWrapper is used as a local operations backend i.e. as a remote repository in tests
    // Remote repos are responsible for issuing a revision for items stored
    item.rev = hasher('sha256').update(item.content).digest('hex');
    return super.saveItem(item);
  }

  deleteItem(catalogItem) {
    return this.storage.removeItem(catalogItem.id);
  }
}

module.exports = LocalOnlyWrapper;

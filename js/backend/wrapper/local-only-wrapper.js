var LocalCacheWrapper = require("backend/wrapper/local-cache-wrapper");
var model = require("backend/model");
var hasher = require("sha.js");

class LocalOnlyWrapper extends LocalCacheWrapper {

  constructor(catalog) {
    super(catalog);
    this.state = new model.EmptyState();
  }

  isItemChanged(item) { return true; }

  // We're using EmptyState so no need of firing events
  saveItem(item) {
    // LocalOnlyWrapper is used as a local operations backend i.e. as a remote repository in tests
    // Remote repos are responsible for issuing a revision for items stored
    item.rev = hasher('sha256').update(item.content).digest('hex');
    return super.saveItem(item);
  }
}

module.exports = LocalOnlyWrapper;

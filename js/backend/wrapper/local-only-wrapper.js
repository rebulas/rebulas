var LocalWrapperOperations = require("backend/wrapper/local-cache-wrapper");
var model = require("backend/model");

class LocalOnlyWrapper extends LocalWrapperOperations {

  constructor(catalog) {
    super(catalog);
    this.state = new model.EmptyState();
  }

  isItemChanged(item) { return true; }
}
module.exports = LocalOnlyWrapper;

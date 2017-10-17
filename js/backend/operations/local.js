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

      let id = "/flying-spaghetti-saucer.md";
      let content = "# Name\nFlying spaghetti saucer\n\n# Content\nAdd a flying spaghetti saucer to the Mothership. Should be able to hold enough spaghetti to feed 4 crew members for a week, plus additional compartments for parmesan cheese and sauce ingredients. Should be able to fly autonomously for a week, no hibernation pods though.\n\n# Clients\nAsteroid Inc., Chipotle Space Catering\n\n## Releases\nv7\n\n# People\nPrivate Public";
      let rev = hasher('sha256').update(content).digest('hex');
      list[id] = new model.CatalogItem(id, content, rev).toJSON();

      id = "/emergency-meatballs-for-fighter-co-pilots.md";
      content = "# Name\nEmergency meatballs for Fighter co-pilots\n\n# Content\nIn the previous release, the Fighter design included additional compartment in the pilot cockpit holding 4 emergency meatballs. In case of long battles, ambushes or other time-consuming activities, this backup nutrition proves invaluable. We should add the same compartment for the co-pilot cockpit as well.\n\n# Clients\nEmpire Space corps, Rebel Alliance, Chipotle Space Catering\n\n# Releases\nv7, v6.5\n\n# People\nGeneral Specific, Major Disaster";
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

var RepositoryManager = {

  "default" : {"id" : 0, "uri" : "localhost", "path" : "default"},

  "getCatalogs" : function() {
    var catalogs = [this.default];
    var storedCatalogs = localStorage.getItem("catalogs");

    return storedCatalogs ? catalogs.concat(JSON.parse(storedCatalogs)) : catalogs;
  },

  "getCatalog" : function(id) {
    return this.getCatalogs().find(c => c.id == id);
  },

  "addCatalog" : function(id, type, token, path) {
    var p = path ? "rebulas/" + path : "rebulas";
    var uri = type == "dropbox" ? "dropbox.com/" + p : "localhost";

    var c = localStorage.getItem("catalogs");
    var storedCatalogs = c ? JSON.parse(c) : [];

    // TODO check if the id exists already. If it does we need to display a warning to the user
    // For now leave the user to add multiple times the same repository
    storedCatalogs.push({
      "id" : id,
      "uri" : uri,
      "token" : token,
      "path" : path ? path : "default"
    });

    localStorage.setItem("catalogs", JSON.stringify(storedCatalogs));
  },

  "removeCatalog" : function(id) {
    var catalogs = localStorage.getItem("catalogs");

    if (catalogs) {
      var storedCatalogs = JSON.parse(catalogs);
      var filtered = storedCatalogs.filter(c => c.id != id);

      localStorage.setItem("catalogs", JSON.stringify(filtered));
    }
  }
}

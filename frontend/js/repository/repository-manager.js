var RepositoryManager = {

  "default" : {"id" : 0, "uri" : "localhost", "type" : "stat"},

  "getCatalogs" : function() {
    var catalogs = [this.default];

    var storedCatalogsRaw = localStorage.getItem("catalogs");
    if (storedCatalogsRaw) {
      var storedCatalogs = JSON.parse(storedCatalogsRaw);
      
	  storedCatalogs.forEach(function(catalog) {
        catalogs.push(catalog);
      });
    }

    return catalogs;
  },

  "getCatalog" : function(id) {
    var catalog = undefined;

    this.getCatalogs().forEach(function(c) {
      if (id == c.id) {
        catalog = c;
      }
    });

    return catalog;
  },

  "addCatalog" : function(id, type, token) {
    var uri = type == "dropbox" ? "dropbox.com/rebulas" : "localhost";

    var storedCatalogs = [];

    var storedCatalogsRaw = localStorage.getItem("catalogs");
    if (storedCatalogsRaw) {
      storedCatalogs = JSON.parse(storedCatalogsRaw);
    }
	
	// TODO check if the id exists already. If it does we need to display a warning to the user
	// For now leave the user to add multiple times the same repository
	
	storedCatalogs.push({
      "id" : id,
      "uri" : uri,
      "token" : token
    });

    localStorage.setItem("catalogs", JSON.stringify(storedCatalogs));
  },

  "removeCatalog" : function(id) {
    var storedCatalogsRaw = localStorage.getItem("catalogs");
    if (storedCatalogsRaw) {
      storedCatalogs = JSON.parse(storedCatalogsRaw);

      var index = -1;
      for (var i = 0; i < storedCatalogs.length; i++) {
        var c = storedCatalogs[i];
        if (c.id == id) {
          index = i;
        }
      }

      if (index > -1) {
          Util.arrayRemove(storedCatalogs, index);
          localStorage.setItem("catalogs", JSON.stringify(storedCatalogs));
      }
    }
  }
}

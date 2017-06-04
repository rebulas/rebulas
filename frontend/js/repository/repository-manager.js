var Repositories = {

    "defaultRepository" : {"id" : 0, "uri" : "localhost", "catalogs" : [
      {"id" : 0, "path" : ""}
    ]},

    add : function(id, type, token) {
      var uri;

      switch (type) {
        case "dropbox" : uri = "dropbox.com/rebulas"; break;
        default : uri = "localhost";
      }

      var defaultCatalogPath = "default";
      var catalogId = Util.hash(uri + "/" + defaultCatalogPath);

      // TODO invoke storage methods to create the default path


      var repository = {
        "id" : id,
        "uri" : uri,
        "token" : token,
        "catalogs" : [{
          "id" : catalogId,
          "path" : defaultCatalogPath
        }]
      }

      var data = localStorage.getItem("repositories");
      var repos = data ? JSON.parse(data) : [];

      // TODO check if the id exists already. If it does we need to display a warning to the user
      // For now leave the user to add multiple times the same repository
      repos.push(repository);
      localStorage.setItem("repositories", JSON.stringify(repos));

      return repository;
    },

    get : function(id) {
      return this.getAll().find(r => r.id == id);
    },

    getAll : function() {
      var stored = localStorage.getItem("repositories");

      var repositories = [this.defaultRepository];
      repositories = stored ? repositories.concat(JSON.parse(stored)) : repositories;

      return repositories;
    },

    remove : function(id) {
      var stored = localStorage.getItem("repositories");

      if (stored) {
        var repositories = JSON.parse(stored);
        var filtered = repositories.filter(r => r.id != id);

        localStorage.setItem("repositories", JSON.stringify(filtered));
      }
    },

    supportsPaths : function(repository) {
      return repository.uri.indexOf("dropbox.com") != -1;
    }
}

var Catalogs = {

    add : function(repositoryId, path) {
      var r = Repositories.get(repositoryId);
      if (r) {
        r.catalogs.push({
          "id" : Util.hash(uri),
          "path" : path
        });
      }
    },

    get : function(id) {
      var catalog;
      var repository;

      Repositories.getAll().forEach(r => {
        let found = r.catalogs.find(c => c.id == id);
        if (found) {
          catalog = found;
          repository = r;
        }
      });

      return repository && catalog ? this.denormalize(repository, catalog) : undefined;
    },

    getAll : function() {
      var results = [];

      Repositories.getAll().forEach(r => {
        r.catalogs.forEach(c => {
          results.push(this.denormalize(r, c));
        })
      });

      return results;
    },

    remove : function(id) {

    },

    denormalize : function(repository, catalog) {
      return {
        "id" : catalog.id,
        "path" : catalog.path,
        "uri" :  repository.uri + (catalog.path ? "/" + catalog.path : ""),
        "token" : repository.token,
        "repository" : {
          "id" : repository.id,
          "uri" : repository.uri
        }
      }
    }
}

var Util = require("extra/util");

var Repositories = {

    "defaultRepository" : {"id" : 0, "uri" : "localhost", "catalogs" : [
      {"id" : 0, "path" : "default"}
    ]},

    add : function(id, type, token) {
      var uri;

      switch (type) {
        case "dropbox" : uri = "dropbox.com/rebulas"; break;
        case "onedrive" : uri = "onedrive.live.com/rebulas"; break;
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
          "path" : defaultCatalogPath,
          "token" : token
        }]
      };

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
      return repository.uri.indexOf("dropbox.com") != -1
        || repository.uri.indexOf("onedrive.live.com") != -1;
    }
};

class Catalogs {
  static add(repositoryId, path) {
    var stored = localStorage.getItem("repositories");

    var repositories = [];
    repositories = stored ? repositories.concat(JSON.parse(stored)) : repositories;

    var r = repositories.find(repo => repo.id === repositoryId);
    if (r) {
      r.catalogs.push({
        "id" : Util.hash(r.uri + "/" + path),
        "path" : path
      });

      localStorage.setItem("repositories", JSON.stringify(repositories));
    }
  }

  static get(id) {
    var catalog;
    var repository;

    Repositories.getAll().forEach(r => {
      let found = r.catalogs.find(c => c.id == id);
      if (found) {
        catalog = found;
        repository = r;
      }
    });

    return repository && catalog ? Catalogs.denormalize(repository, catalog) : undefined;
  }

  static getAll() {
    let results = [];

    Repositories.getAll().forEach(r => {
      r.catalogs.forEach(
        c => results.push(this.denormalize(r, c))
      );
    });

    return results;
  }

  static getByURI(uri) {
    if (!uri) {
      return undefined;
    }

    var catalog;
    var repository;

    if (uri[uri.length - 1] == "/") {
      uri = uri.slice(0, -1);
    }

    Repositories.getAll().forEach(r => {
      r.catalogs.forEach(c => {
        var u = r.uri + "/" + c.path;
        if (u[u.length - 1] == "/") {
          u = u.slice(0, -1);
        }

        if (u == uri) {
          catalog = c;
          repository = r;
        }
      });
    });

    return repository && catalog ? Catalogs.denormalize(repository, catalog) : undefined;
  }

  static remove(id) {
    var stored = localStorage.getItem("repositories");

    var repositories = [];
    repositories = stored ? repositories.concat(JSON.parse(stored)) : repositories;

    repositories.forEach(r => {
      var catalogs = r.catalogs.filter(c => c.id != id);
      r.catalogs = catalogs;
    });

    localStorage.setItem("repositories", JSON.stringify(repositories));
  }

  static denormalize(repository, catalog) {
    return {
      "id" : catalog.id,
      "path" : catalog.path,
      "uri" :  repository.uri + (catalog.path ? "/" + catalog.path : ""),
      "token" : repository.token,
      "repository" : {
        "id" : repository.id,
        "uri" : repository.uri
      }
    };
  }
}

module.exports.Catalogs = Catalogs;
module.exports.Repositories = Repositories;

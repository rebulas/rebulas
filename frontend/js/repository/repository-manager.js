var RepositoryManager = {

  "catalogs" : [{"id" : 12398, "uri" : "github:github.com/rebulas"}, {"id" : 99283, "uri" : "dropbox:dropbox.com"}],

  "getCatalogs" : function() {

    // TODO get these from local storage and OAUTH sessions
    return this.catalogs;
  },

  "getCatalog" : function(id) {
    var catalog = undefined;

    this.catalogs.forEach(function(c) {
      if (id == c.id) {
        catalog = c;
      }
    });

    return catalog;
  }
}


var RepositoryConfigurator = {

		"render" : function(args) {
			var container = args.container;
			var queryExecutor = args.queryExecutor;
			var catalogs = RepositoryManager.getCatalogs();

			var currentCatalogContainer = container.find(".current-repository").first();
			var q = Util.parseQueryString();
			
			// TODO alter once we start remembering the last used repository
			var currentCatalog = q.catalog ? RepositoryManager.getCatalog(q.catalog) : RepositoryManager.getCatalogs()[0];
			currentCatalogContainer.empty().append("Repository " + currentCatalog.uri);
			
			var listContainer = container.find(".repositories-container").first();
			listContainer.empty();

			// Line for each repository/catalog, click changes the current catalog
			catalogs.forEach(function(c) {
				var li = $(document.createElement("li"));
				li.css("cursor", "default");
				var div = $(document.createElement("div"));

				var a = $(document.createElement("a"));
				a.append(c.uri);
				a.css("cursor", "pointer");
				a.click({"catalogId" : c.id}, function(event) {
					var q = Util.parseQueryString();
					q.catalog = event.data.catalogId;

					// Changing the catalog requires us to drop all other selections so far
					delete q.q;

					queryExecutor.navigate("?" + Util.queryObjectToString(q));
				});
				div.append(a);

				var remove = $(document.createElement("span"));
				remove.addClass("glyphicon glyphicon-remove pull-right");
				remove.click({"catalogId" : c.id}, function(event) {
					RepositoryManager.removeCatalog(event.data.catalogId);

					queryExecutor.navigate("?", function(result) {
						RepositoryConfigurator.render(args);
					});
				});
				remove.css("cursor", "pointer");
				div.append(remove);
				li.append(div);
				listContainer.append(li);
			});
			listContainer.append($(document.createElement("li")).attr("role", "separator").addClass("divider"));

			var li = $(document.createElement("li"));
			li.append("Link repository ");
			li.css("cursor", "default");
			
			// Dropbox
			var a = $(document.createElement("a"));
			a.append("Dropbox");
			a.addClass("add-repository-link");
			a.click(function() {
				RepositoryController.initDropboxOAuth(function(catalogId) {
					queryExecutor.navigate("?catalog=" + catalogId, function(result) {
						RepositoryConfigurator.render(args);
					});
				})
			});
			li.append(a);
			
			// GitHub
			a = $(document.createElement("a"));
			a.append("GitHub");
			a.addClass("add-repository-link");
			li.append(a);

			listContainer.append(li);
			
			container.fadeIn();
		}
};

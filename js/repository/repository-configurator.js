var Catalogs = require("repository/repository-manager").Catalogs;
var Repositories = require("repository/repository-manager").Repositories;
var Util = require("extra/util");
var Elements = require("ui/elements");
var RepositoryController = require("repository/repository-controller");

module.exports = {

		"render" : function(args) {
			var self = this;
			var repositoryContainer = args.repositoryContainer;
			var catalogContainer = args.catalogContainer;
			var queryExecutor = args.queryExecutor;

			var currentCatalogContainer = repositoryContainer.find(".current-repository").first();
			var q = Util.parseQueryString();

			var catalogs = Catalogs.getAll();

			// TODO alter once we start remembering the last used repository
			var currentCatalog = catalogs[0];
			if (q.catalog) {
				let c = Catalogs.get(q.catalog);
				if (c) {
					currentCatalog = c;
				}
			}

			currentCatalogContainer.empty().append("Repository " + currentCatalog.repository.uri);

			var listContainer = repositoryContainer.find(".repositories-container").first();
			listContainer.empty();

			// Line for each repository/catalog, click changes the current catalog
			Repositories.getAll().forEach(r => {
				var li = Elements.li().css("cursor", "default");

				var a =  Elements.a().append(r.uri).css("cursor", "pointer");
				a.click({"repository" : r}, function(event) {
					var q = Util.parseQueryString();

					var repository = event.data.repository;
					if (repository.catalogs) {
						// When switching the repository select the first catalog from that repository
						q.catalog = repository.catalogs[0].id;
					} else {
						Util.log("Repository without catalogs, please add a catalog");
					}

					// Changing the catalog requires us to drop all other selections so far
					delete q.q;

					queryExecutor.navigate("?" + Util.queryObjectToString(q), function(result) {
						self.render(args);
					});
				});
				var div = Elements.div();
				div.append(a);

				var remove = Elements.span("glyphicon glyphicon-remove pull-right").css("cursor", "pointer");
				remove.click({"id" : r.id}, function(event) {
					Repositories.remove(event.data.id);

					queryExecutor.navigate("?", function(result) {
						self.render(args);
					});
				});

				div.append(remove);
				li.append(div);
				listContainer.append(li);
			});
			listContainer.append(Elements.li("divider").attr("role", "separator"));

			var li = Elements.li().append("Link repository ").css("cursor", "default");

			// Dropbox
			var a = Elements.a("add-repository-link").append("Dropbox");
			a.click(function() {
				RepositoryController.initDropboxOAuth(function(repository) {
					var catalogId = repository.catalogs[0].id;
					queryExecutor.navigate("?catalog=" + catalogId, function(result) {
						self.render(args);
					});
				})
			});
			li.append(a);

			// OneDrive
			a = Elements.a("add-repository-link").append("OneDrive");
			a.click(function() {
				RepositoryController.OneDrive.createRepository(function(repository) {
					var catalogId = repository.catalogs[0].id;
					queryExecutor.navigate("?catalog=" + catalogId, function(result) {
						self.render(args);
					});
				})
			});
			li.append(a);

			// GitHub
			a = Elements.a("add-repository-link").append("GitHub");
      // No support for github yet
			//li.append(a);
			listContainer.append(li);

			repositoryContainer.fadeIn();

			var repository = Repositories.get(currentCatalog.repository.id);
			if (Repositories.supportsPaths(repository)) {

				this.buildCatalogDropdown(args, currentCatalog, repository);
				catalogContainer.fadeIn();
			} else {
				catalogContainer.hide();
			}
		},

		buildCatalogDropdown : function(args, currentCatalog, repository) {
				var self = this;
				var catalogContainer = args.catalogContainer;
				var queryExecutor = args.queryExecutor;

				var currentCatalogContainer = catalogContainer.find(".current-catalog").first();
				currentCatalogContainer.empty().append("Catalog " + currentCatalog.path);

				var listContainer = catalogContainer.find(".catalog-container").first();
				listContainer.empty();

				// Line for each repository/catalog, click changes the current catalog
				repository.catalogs.forEach(c => {
					var li = Elements.li().css("cursor", "default");

					var a =  Elements.a().append(c.path).css("cursor", "pointer");
					a.click({"catalog" : c}, function(event) {
						var q = Util.parseQueryString();

						var catalog = event.data.catalog;
						q.catalog = catalog.id;

						// Changing the catalog requires us to drop all other selections so far
						delete q.q;

						queryExecutor.navigate("?" + Util.queryObjectToString(q), function(result) {
							self.render(args);
						});
					});
					var div = Elements.div();
					div.append(a);

					var remove = Elements.span("glyphicon glyphicon-remove pull-right").css("cursor", "pointer");
					remove.click({"id" : c.id}, function(event) {
						if (confirm("Are you sure you want to remove this catalog? The data in it will be erased.")) {
							Catalogs.remove(event.data.id);

							var q = Util.parseQueryString();
							if (q.catalog == event.data.id) {
								queryExecutor.navigate("?", function(result) {
									self.render(args);
								});
							} else {
								self.render(args);
							}
						}
					});

					div.append(remove);
					li.append(div);
					listContainer.append(li);
				});
				listContainer.append(Elements.li("divider").attr("role", "separator"));

				var catalogName = Elements.textInput("add-catalog-input");
				catalogName.attr("placeholder", "Catalog name");

				var button = Elements.button("btn btn-success").append("Add");
				button.click(function() {
					var path = catalogName.val();
					Catalogs.add(repository.id, path);
					self.render(args);
				});
				var li = Elements.li().append(catalogName).append(button);
				listContainer.append(li);
		}
};

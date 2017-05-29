var QueryExecutor = {

		create : function(args) {
			var waitStatePlaceholder = args.waitStatePlaceholder;

			var staticResult = {
				"count" : 2,
				"catalog" : {
					"id" : 0,
					"name" : ""
				},
				"breadcrumbs" : [
					{"field" : "tag", "valueLocalized" : "Important", "query" : "tag=important"}
				],
				"facets" : [
					{"id" : 1, "title" : "Clients", "field" : "clients", "values" : [
						{"id" : "waitrose", "title" : "Waitrose", "link" : "client=waitrose", "count": 2},
						{"id" : "hema", "title" : "Hema", "link" : "client=hema", "count": 1},
						{"id" : "intergamma", "title" : "Intergamma", "link" : "client=intergamma", "count": 1},
						{"id" : "screwfix", "title" : "Screwfix", "link" : "client=screwfix", "count" : 1}
					]},
					{"id" : 2, "title" : "Releases", "field" : "releases", "values" : [
						{"id" : "fas8.2", "title" : "FAS 8.2", "link" : "release=8.2", "count": 1},
						{"id" : "fas8.3", "title" : "FAS 8.3", "link" : "release=8.3", "count" : 1}
					]}
				],
				"items" : [
					{"id" : "improved-authentication-merchanism.md", "name" : "Improved Authentication Merchanism", "description" : "In our cloud we require multiple logins while we could centralise the auth via LDAP across all login channels", "clients" : "Waitrose, Cloud Team", "releases" : "FAS 8.3", "_md" : "# Name\nImproved Authentication mechanism\n\n# Description\nIn our cloud we require multiple logins while we could centralise the auth via LDAP across all login channels\n\n# Clients\nWaitrose, Cloud Team\n\n## Releases\nFAS 8.3"},
					{"id" : "publishing-ui-imporovements.md", "name" : "Publishing UI improvements", "description" : "The UI for the punlishing went from not-granular at all to too granular all too quickly. We need improvements that allow for less input when publishing (auto-fill publish names) and ability to publish all - relevant for smaller customers that don't have large teams to collaborate.", "clients" : "Screwfix, Hema, Intergramma", "releases" : "FAS 8.2", "people" : "Tim, Vincent, Kees", "_md" : "# Name\nPublishing UI improvements\n\n# Description\nThe UI for the punlishing went from not-granular at all to too granular all too quickly. We need improvements that allow for less input when publishing (auto-fill publish names) and ability to publish all - relevant for smaller customers that don't have large teams to collaborate.\n\n# Clients\nScrewfix, Hema, Intergramma\n\n# Releases\nFAS 8.3\n\n# People\nVincent, Tim, Kees"}
				]
			};

			return {
				"listeners" : [],

				"navigate" : function(queryString, callback) {
					var queryObject = Util.parseQueryString(queryString);

					this.execute(queryObject, function(result) {
						history.pushState({"queryObject" : queryObject}, "Title", queryString);

						if (callback) {
							callback(result);
						}
					});
				},

				"addListener" : function(object) {
						this.listeners.push(object);
				},

				"execute" : async function(queryObject, callback) {

					waitStatePlaceholder.empty().append("Loading data, please wait...").show();

					// Ahem...clone
					var result = JSON.parse(JSON.stringify(staticResult));

					// Temporary breadcrumb composition based on the query
					result.breadcrumbs = [];
					var q = new Query(queryObject.q);
					q.getSelections().forEach(function(selection) {
						var value = selection.field + selection.operation + selection.value;
						result.breadcrumbs.push({"field" : selection.field, "valueLocalized" : value, "query" : value});
					});

					// TODO handle initial state i.e. no catalogs
					// TODO handle non existing catalogs with a warning instead of silent fallback to default
					// TODO alter once we start remembering the last used repository
					var defaultCatalog = RepositoryManager.getCatalogs()[0];
					var catalog = queryObject.catalog ? RepositoryManager.getCatalog(queryObject.catalog) : defaultCatalog;

					// TODO are we going to index items added to a local/static catalog
					if (catalog.id != defaultCatalog.id) {
						let index = await RebulasBackend.getCatalogIndex(catalog);
            let searchResult = index.search(queryObject);
            result.items = searchResult.items;
            result.facets = searchResult.facets;
					}

					result.count = result.items.length;
          result.catalog.id = catalog.id;
					result.catalog.name = catalog.uri;
					result.catalog.searchIndex = catalog.searchIndex;

					waitStatePlaceholder.empty().hide();

					this.listeners.forEach(function(listener) {
						if (listener.onResultChange) {
							listener.onResultChange(result);
						}
					});

					if (callback) {
						callback(result);
					}
				}
			}
		}
}

var RebulasBackend = require("backend/rebulas-backend");
var Query = require("query/query");
var Catalogs = require("repository/repository-manager").Catalogs;
var Util = require("extra/util");

module.exports = {

		create : function(args) {
			var waitStatePlaceholder = args.waitStatePlaceholder;

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
					$(document.body).css("cursor", "wait");

					var result = {
						"count" : 0,
						"catalog" : {
							"id" : 0,
							"name" : ""
						},
						"breadcrumbs" : [],
						"facets" : [],
						"items" : []
					}

					// Temporary breadcrumb composition based on the query
					var q = new Query(queryObject.q);
					q.getSelections().forEach(function(selection) {
						var value = selection.field + selection.operation + selection.value;
						result.breadcrumbs.push({"field" : selection.field, "valueLocalized" : value, "query" : value});
					});

					// TODO handle initial state i.e. no catalogs
					// TODO handle non existing catalogs with a warning instead of silent fallback to default
					// TODO alter once we start remembering the last used repository
					var defaultCatalog = Catalogs.getAll()[0];
					var catalog = defaultCatalog;
					if (queryObject.catalog) {
						var c = Catalogs.get(queryObject.catalog);
						if (c) {
							catalog = c;
						}
					}

					let index = await RebulasBackend.getCatalogIndex(catalog);
					let searchResult = index.search(queryObject.q);
					result.facets = searchResult.facets;
					result.items = searchResult.items;
					result.count = result.items.length;
					result.catalog.id = catalog.id;
					result.catalog.name = catalog.uri;
					result.catalog.searchIndex = catalog.searchIndex;

					waitStatePlaceholder.empty().hide();
					$(document.body).css("cursor", "default");

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

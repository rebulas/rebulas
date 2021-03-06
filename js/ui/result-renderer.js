var ItemRenderer = require("ui/item-renderer");
var FacetRenderer = require("ui/facet-renderer");
var Elements = require("ui/elements");
var Util = require("extra/util");
var model = require("backend/model");

module.exports = {

	"create" : function(args) {
		var queryExecutor = args.queryExecutor;
		var facetsContainer = args.facetsContainer;
		var countContainer = args.countContainer;
		var itemsContainer = args.itemsContainer;
		var detailsContainer = args.detailsContainer;
		var hintPlaceholder = args.hintPlaceholder;

		return {

			"onResultChange" : function(result) {
				this.render(result);
			},

			"render" : function(result) {
				if (!result) {
					return;
				}

				var catalog = result.catalog;

				FacetRenderer.renderFacets({
					"container" : facetsContainer,
					"facets" : result.facets,
					"catalog" : catalog,
					"queryExecutor" : queryExecutor
				});

				countContainer.empty().append(result.count + " results");
				result.count > 0 ? countContainer.show() : countContainer.hide();

				var container = Elements.div();
				ItemRenderer.renderList({
					"container" : container,
					"items" : result.items,
					"catalog" : catalog,
					"clickListener" : this.details
				});

				itemsContainer.empty();
				itemsContainer.append(container);

				detailsContainer.hide();
				hintPlaceholder.empty().append(result.count > 0 ? "Select element to show details" : "No elements to show").show();
			},

			"details" : function(existingItem, catalog) {
				var item = existingItem ? existingItem : {};

				var saveCallback = function(item, newContent, close = true) {
					if (close) {
						detailsContainer.empty().hide();
						itemsContainer.fadeIn();
					}

					if (newContent) {
						item.setContent(newContent);
						catalog.searchIndex.saveItem(item);

						if (close) {
							hintPlaceholder.empty().append("Item saved").show();

							setTimeout(function() {
								hintPlaceholder.empty().append("Select element to show details");

								// Reload the current result set with the new item in it
								var q = Util.parseQueryString();
								queryExecutor.navigate("?" + Util.queryObjectToString(q));
							}, 2000);
						}
					} else if (close) {
						hintPlaceholder.empty().append("Select element to show details").show();
					}
				};

				var deleteCallback = function(item) {
					if (confirm("Are you sure you want to delete this item")) {
						detailsContainer.empty().hide();
						itemsContainer.fadeIn();

						catalog.searchIndex.deleteItem(item);
						hintPlaceholder.empty().append("Item deleted").show();

						setTimeout(function() {
							hintPlaceholder.empty().append("Select element to show details");

							// Reload the current result set with the new item in it
							var q = Util.parseQueryString();
							queryExecutor.navigate("?" + Util.queryObjectToString(q));
						}, 2000);
					}
				};

				ItemRenderer.renderDetails({
					"container" : detailsContainer,
					"item" : item,
					"catalog" : catalog,
					"saveCallback" : saveCallback.bind(null, item),
					"cancelCallback" : saveCallback,
					"deleteCallback" : deleteCallback.bind(null, item)
				});

				hintPlaceholder.empty().hide();
				detailsContainer.fadeIn();
			},

			"newItem" : function(catalog) {

				// Pre-load the item with the most probably heading sections based on
				// the existing documents in the index
				var fields = [];
				if (catalog.searchIndex) {
					Object.keys(catalog.searchIndex.features.fieldFeatures).forEach((key) => {
						let title = key.charAt(0).toUpperCase() + key.slice(1);
						fields.push(title);
					});
				}

        let initialContent = '';
				fields.forEach(field => {
						initialContent += "# " + field + String.fromCharCode(13).repeat(3);
				});
        var item = new model.DisplayItem(null, initialContent);

				this.details(item, catalog);
			}
		}
	}
}

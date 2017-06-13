var ResultRenderer = {

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

				var container = $(document.createElement("div"));
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

				var saveCallback = function(item, newContent) {
					detailsContainer.empty().hide();
					itemsContainer.fadeIn();

					if (newContent) {
						item._md = newContent;
						catalog.searchIndex.saveItem(item);
					}
				};

				ItemRenderer.renderDetails({
					"container" : detailsContainer,
					"item" : item,
					"catalog" : catalog,
					"saveCallback" : saveCallback.bind(null, item),
					"cancelCallback" : saveCallback
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

				var item = {
					"_md" : ""
				};

				fields.forEach(field => {
						item._md += "# " + field + String.fromCharCode(13).repeat(3);
				});

				this.details(item, catalog);
			}
		}
	}
}

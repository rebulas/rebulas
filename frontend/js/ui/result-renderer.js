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

				// Render the items
				countContainer.empty();
				var listerSize = result.catalog.listerSize || 40;
				if (result.count > listerSize) {
					countContainer.append("Showing " + listerSize + " out of " + result.count + " results");
				} else {
					countContainer.append("Showing " + result.count + " results");
				}

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
				hintPlaceholder.empty().append("Select element to show details").show();
			},

			"details" : function(existingItem, catalog) {
				var item = existingItem ? existingItem : {"id" : Util.uniqueId()};

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
				this.details(null, catalog);
			}
		}
	}
}

var ResultRenderer = {

	"create" : function(args) {
		var queryExecutor = args.queryExecutor;
		var facetsContainer = args.facetsContainer;
		var countContainer = args.countContainer;
		var itemsContainer = args.itemsContainer;
		var detailsContainer = args.detailsContainer;

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

				var saveCallback = function() {
					detailsContainer.empty().hide();
					itemsContainer.fadeIn();
				};

				// TODO Extract as a separate file
				var renderDetails = function(item, catalog) {
					ItemRenderer.renderDetails({
						"container" : detailsContainer,
						"item" : item,
						"catalog" : catalog,
						"saveCallback" : saveCallback,
						"cancelCallback" : saveCallback
					});

					itemsContainer.hide();
					detailsContainer.fadeIn();
				}

				var container = $(document.createElement("div"));
				ItemRenderer.renderList({
					"container" : container,
					"items" : result.items,
					"fields" : result.fields,
					"catalog" : catalog,
					"clickListener" : renderDetails
				});

				itemsContainer.empty();
				itemsContainer.append(container);
			}
		}
	}
}

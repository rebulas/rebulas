var RepositoryConfigurator = {

		"render" : function(args) {
			var container = args.container;
			var queryExecutor = args.queryExecutor;
			var catalogs = args.catalogs;

			var listContainer = container.find(".repositories-container").first();
			listContainer.empty();

			catalogs.forEach(function(c) {
				var li = $(document.createElement("li"));
				var a = $(document.createElement("a"));
				a.append(c.uri);

				a.click({"catalogId" : c.id}, function(event) {
					var q = Util.parseQueryString();
					q.catalog = event.data.catalogId;

					// Changing the catalog requires us to drop all other selections so far
					delete q.q;

					queryExecutor.navigate("?" + Util.queryObjectToString(q));
				});
				li.append(a);
				listContainer.append(li);
			});
			listContainer.append($(document.createElement("li")).attr("role", "separator").addClass("divider"));

			var li = $(document.createElement("li"));
			var a = $(document.createElement("a"));
			a.attr("href", "#").append("Link new repository");
			li.append(a);
			listContainer.append(li);
		}
};

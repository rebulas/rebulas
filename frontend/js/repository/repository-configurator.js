const rebulasDropboxClientID = "f0l5xgrg354cgs0";

var RepositoryConfigurator = {

		"render" : function(args) {
			var container = args.container;
			var queryExecutor = args.queryExecutor;
			var modalContainer = args.modalContainer;
			var catalogs = RepositoryManager.getCatalogs();

			var listContainer = container.find(".repositories-container").first();
			listContainer.empty();

			// Line for each repository/catalog, click changes the current catalog
			catalogs.forEach(function(c) {
				var li = $(document.createElement("li"));
				var div = $(document.createElement("div"));

				var a = $(document.createElement("a"));
				a.append(c.uri);

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

			// TODO open a modal window for configuration of new repositories
			var li = $(document.createElement("li"));
			var a = $(document.createElement("a"));
			a.append("Link new repository");
			li.append(a);
			listContainer.append(li);

			if (modalContainer) {
				a.click(function() {

					var redirectUri = window.location.hostname == "localhost" ? "http://localhost:8080/oauth/dropbox.html" : "https://rebulas.com/app/oauth/dropbox.html";
					var oauthUrl = "https://www.dropbox.com/1/oauth2/authorize?client_id=" + rebulasDropboxClientID;

					// TODO Once we have more providers we have to re-organize this code
					var catalogId = Util.hash(oauthUrl);
					var csrf = Util.uniqueId();

					oauthUrl += "&response_type=token&redirect_uri=" + redirectUri;
					oauthUrl += "&state=" + csrf;

					window.OAuthSessions[csrf] = function(oauthArgs) {
						RepositoryManager.addCatalog(catalogId, oauthArgs.origin, oauthArgs.token);

						queryExecutor.navigate("?catalog=" + catalogId, function(result) {
							RepositoryConfigurator.render(args);
						});
					};

					window.open(oauthUrl, "OAuth");

					/*
					modalContainer.modal({});

					var modalBody = modalContainer.find(".modal-body").first();
					var iframe = $(document.createElement("iframe"));
					iframe.attr("width", "100%");
					iframe.attr("height", "200px");
					iframe.attr("src", "http://rebulas.com/oauth/authorize.html");
					//iframe.attr("src", "https://www.dropbox.com/1/oauth2/authorize?client_id=f0l5xgrg354cgs0&response_type=token&redirect_uri=https://rebulas.com/oauth/dropbox.html&state=88sdf892834js");

					modalBody.append(iframe);
					*/
				});
			}
		}
};

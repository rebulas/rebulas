var BreadcrumbsRenderer = {
		
		render : function(container, catalog, crumbs, query, catalogs, linkCallback) {
			var homeCrumb = this.createHomeBreadcrumb(catalog, catalogs);
			container.append(homeCrumb);

			var self = this;
			for (var i = 0; i < crumbs.length; i++) {
				var crumb = crumbs[i];

				var value = crumb.valueLocalized;
				if ("$s" == crumb.field) {

					// FIXME this doesn't belong here
					// Fill the searchbox with the search term
					$("#search-box").val(value);

					value = "\"" + crumb.value + "\"";
				}

				var renderOr = false;
				var next = crumbs[i + 1];
				if (next && "or" == next.aggregation) {
					renderOr = true;
				}

				var breadcrumb = self.createBreadcrumb(value, self.createLink(catalog, crumb.query), renderOr, linkCallback);
				container.append(breadcrumb);
			}
		},
		
		createLink : function(catalog, q) {
			var result = "catalog=" + catalog.id;
			if (q) {
				result += "&q=" + q;
			}
			
			var queryString = Util.parseQueryString();
			delete queryString["q"];
			delete queryString["catalog"];
			
			var str = Util.queryObjectToString(queryString);
			if (str && str.length > 0) {
				result += "&" + str;
			}

			return result;
		},
		
		/**
		 * Create a DOM breadcrumb entry
		 * 
		 * @param value the value to display
		 * @param hrefLink the link to activate on click
		 *	
		 * @returns a DOM element
		 */
		createBreadcrumb : function(value, hrefLink, renderOr, linkCallback) {
			var li = $(document.createElement("li"));
			li.css("display", "inline");
			li.css("list-style-type", "none");
			if (renderOr) {
				li.addClass("or");
			}
			
			var link = $(document.createElement("a"));
			if (linkCallback) {
				link.css("cursor", "pointer");
				link.mouseup(function(ev) {
					QueryExecutor.navigate("?" + hrefLink, linkCallback);
				});				
			} else {
				link.attr("href", "browse.html?" + hrefLink);
			}
			link.append(value);
			li.append(link);
			
			return li;
		},

		createHomeBreadcrumb : function(catalog, catalogs) {
			var li = $(document.createElement("li"));
			li.css("display", "inline");
			li.css("list-style-type", "none");
			
			var link = $(document.createElement("a"));
			link.attr("href", "browse.html?" + this.createLink(catalog));
			link.append(catalogs ? "Catalog : " + catalog.name : catalog.name);
			li.append(link);

			if (catalogs) {
				var dropdown = $(document.createElement("div"));
				dropdown.addClass("dropdown");
				dropdown.css("display", "inline-block");
				li.append(dropdown);
				
				var a = $(document.createElement("a"));
				a.addClass("dropdown-toggle glyphicon glyphicon-chevron-down");
				a.attr("href", "#");
				a.attr("data-toggle", "dropdown");
				a.css("margin-left", "5px");
				a.css("text-decoration", "none");
				dropdown.append(a);
				
				var ul = $(document.createElement("ul"));
				ul.addClass("dropdown-menu");
				ul.attr("role", "menu");
				
				var self = this;
				catalogs.forEach(function(c) {
					var entry = $(document.createElement("li"));
					var href = $(document.createElement("a"));
					href.attr("href", "browse.html?" + self.createLink(c));
					href.attr("style", "text-transform: capitalize");
					href.append(c.name);
					
					entry.append(href);
					ul.append(entry);
				});
				dropdown.append(ul);
			}
			
			return li;
		}		
}

var BreadcrumbsRenderer = {

		render : function(crumbs) {
			var buffer = "";

			for (var i = 0; i < crumbs.length; i++) {
				var crumb = crumbs[i];
				var next = crumbs[i + 1];
				var value = crumb.valueLocalized;

				var renderOr = false;
				if (next && "or" == next.aggregation) {
					renderOr = true;
				}

				if (buffer.length > 0) {
					buffer += "/";
				}

				buffer += value;
			}

			return buffer;
		}
}

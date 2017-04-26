var catalogs = [];

var QueryExecutor = {

		navigate : function(queryString, callback, eventData) {
			var queryObject = Util.parseQueryString(queryString);

			this.execute(queryObject, function(result) {
				history.pushState({"queryObject" : queryObject}, "Title", queryString);

				var event = new CustomEvent("navigationStep", eventData ? {"detail" : eventData} : {});
				window.dispatchEvent(event);

				callback(result);
			});
		},

		execute : function(queryObject, callback) {
			var result = {
				"count" : 2,
				"catalog" : {
					"id" : 1,
					"displayFields" : [
						{"field" : "name", "type" : "text"},
						{"field" : "details", "type" : "text"}
					]
				},
				"breadcrumbs" : [
					{"field" : "tag", "valueLocalized" : "Important", "query" : "tag=important"}
				],
				"facets" : [
					{"id" : 1, "title" : "Tag", "field" : "tag", "values" : [
						{"id" : 1, "title" : "Important", "link" : "some link", "count": 3},
						{"id" : 2, "title" : "Relevant", "link" : "some link", "count" : 6}
					]},
					{"id" : 2, "title" : "Label", "field" : "label", "values" : [
						{"id" : 1, "title" : "Green", "link" : "green", "count": 3},
						{"id" : 2, "title" : "Blue", "link" : "blue", "count" : 6}
					]}
				],
				"items" : [
					{"id" : "123", "name" : "First note", "details" : "This is a much longer note"},
					{"id" : "766", "name" : "Second note", "details" : "This is a much longer second note"}
				]
			};
			callback(result);
		}
}

var ItemRenderer = {

	"Months" : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],

	"Mode" : {
		"THUMB" : "thumb",
		"MINI" : "mini",
		"DETAILS" : "details"
	},

	renderList : function(args) {
		args.catalog.displayFields.sort(function(a, b) {
			return a.position - b.position;
		});

		var items = args.items;
		for (var f in items) {
			var item = items[f];
			this.renderItemDetails(item, args);
		}
	},

	createSortFieldQuery : function(result, catalog, field) {
		var q = {
			"q" : result.query,
			"catalog" : catalog.id,
		}

		var sortFields = [];
		var found = false;
		if (result.sort) {
			result.sort.forEach(function(f) {
				if (f == field) {
					sortFields.push("-" + f);
					found = true;
				} else if (f.indexOf(field) == 1) {
					// Skip the field i.e. remove it from the sort fields
					// sortFields.push(ev.data.field);
					found = true;
				} else {
					sortFields.push(f);
				}
			});
		}

		if (!found) {
			sortFields.push(field);
		}

		if (sortFields.length > 0) {
			q.sort = sortFields.join(",");
		} else {
			delete q.sort;
		}

		return q;
	},

	getFieldValue : function(item, field) {
		for (a in item) {
			if (field == a) {
				return item[a];
			}
		}

		return undefined;
	},

	renderItemDetails : function(item, args) {
		var container = args.container;
		var catalog = args.catalog;
		var query = args.query;
		var mode = args.mode;
		var filterListener = args.filterListener;
		var clickListener = args.clickListener;
		var view = args.view;
		var fields = args.fields;
		var localizedValues = args.values;

		var width = 240;
		var height = 260;
		var font = "1em";

		if (mode && this.Mode.THUMB == mode) {
			width = 140;
			height = 180;
		} else if (mode && this.Mode.MINI == mode) {
			width = 100;
			height = 120;
			font = "0.9em";
		} else if (mode && this.Mode.DETAILS == mode) {
			width = 450;
			height = 700;
		}

		var detailContainer = $(document.createElement("div"));
		detailContainer.css("display", "inline-block");

		var well = $(document.createElement("div"));
		well.css("text-align", "center");
		well.css("margin-right", "15px");
		well.css("overflow", "hidden");
		well.css("font-size", font);
		well.height(height);
		well.width(width);
		detailContainer.append(well);

		var self = this;
		var counter = 0;

		var mainQueryObject = Util.parseQueryString();
		var mainQuery = new Query(mainQueryObject.q);

		var renderId = true;
		for (var a in catalog.displayFields) {
			if (mode != this.Mode.DETAILS && counter++ >= 4) {
				break;
			}

			var displayField = catalog.displayFields[a];
			var fieldContainer = $(document.createElement("div"));
			well.append(fieldContainer);

			var renderResult = this.renderField(fieldContainer, item, displayField, mainQuery, localizedValues, mode, width);
			if (renderResult) {
				renderId = false;
			}
		}

		if (renderId) {
			var idContainer = $(document.createElement("div"));
			well.append(idContainer);

			this.renderField(idContainer, item, {"type" : "text", "field" : "id"}, mainQuery, localizedValues, mode, width);
		}

		var id = this.getFieldValue(item, "id");
		var role = this.getFieldValue(item, "role");
		well.click({"id" : id}, function(event) {
			if (filterListener) {
				var filterQuery = role ? role + ":id=" + event.data.id : "id=" + event.data.id;
				filterListener.filter(filterQuery, view);
			} else if (clickListener) {
				var queryString = Util.parseQueryString();
				if (!queryString.catalog) {
					queryString.catalog = catalog.id;
				}

				var q = (query && !queryString.q) ? query : new Query(queryString.q);
				q.addSelection("id", "=", event.data.id);
				queryString.q = q.toString();

				QueryExecutor.navigate("?" + Util.queryObjectToString(queryString), clickListener);
			}
		});
		well.css("cursor", "pointer");

		// Required when rendering as part of a view
		well.addClass("view-data-element");
		well.attr("dimension", role + ":id");
		well.attr("id", id);

		container.append(detailContainer);
	},

	renderField : function(well, item, displayField, q, localizedValues, mode, width) {
		var value = this.getFieldValue(item, displayField.field);
		if (!value) {
			return false;
		}

		if ("image" != displayField.type && ItemRenderer.Mode.DETAILS == mode) {
			var fieldName = $(document.createElement("span"));
			fieldName.append(displayField.field + " : ");
			well.append(fieldName);
		}

		// Render the item attributes according to their type as configured in config.displayFields
		if ("image" == displayField.type) {
			var img = new Image();

			if (value) {
				img.src = value;
			}
			$(img).css("max-width", width - 50);

			well.append(img);
			well.append(document.createElement("br"));
		} else if ("text" == displayField.type) {
			var localizedValue = localizedValues ? localizedValues[value] : value;
			var txt = $(document.createElement("span"));
			txt.append(localizedValue ? localizedValue : value);

			well.append(txt);
			well.append(document.createElement("br"));
		} else if ("hierarchy" == displayField.type) {
			// Check how many query selections we've already added for this field
			var steps = 0;
			q.getSelections().forEach(function(selection) {
				if (selection.field == displayField.field) {
					steps++;
				}
			});
			var hierarchicalValue = this.getFieldValue(item, displayField.field + "_" + steps);

			var txt = $(document.createElement("span"));
			var finalValue = value;
			if (localizedValues) {
				finalValue = localizedValues[value] ? localizedValues[value] : value;
			}

			if (hierarchicalValue) {
				finalValue = localizedValues[hierarchicalValue] ? localizedValues[hierarchicalValue] : hierarchicalValue;
			}

			txt.append(finalValue);

			well.append(txt);
			well.append(document.createElement("br"));
		} else if ("price" == displayField.type) {
			var price = $(document.createElement("span"));
			price.append(document.createTextNode("€ " + value));

			well.append(price);
			well.append(document.createElement("br"));
		} else if ("date" == displayField.type) {
			var date = new Date(Number(value));
			var day = date.getDate();
			var month = this.Months[date.getMonth()];
			var year = date.getFullYear();

			well.append(day + " " + month + " " + year);
			well.append(document.createElement("br"));
		} else if ("set" == displayField.type) {
			var str = "";
			for (v in value) {
				str += value[v] + ", ";
			}

			var elem = $(document.createElement("span"));
			elem.append(document.createTextNode(str));
			well.append(elem);
			well.append(document.createElement("br"));
		} else if ("rank" == displayField.type) {
			var elem = $(document.createElement("span"));
			elem.css("font-weight", "bold");
			elem.append(value);
			well.append(elem);
			well.append(document.createElement("br"));
		}

		return true;
	}
}

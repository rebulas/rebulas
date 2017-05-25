var ItemRenderer = {

	"Months" : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],

	renderList : function(args) {
		args.catalog.displayFields.sort(function(a, b) {
			return a.position - b.position;
		});

		var container = args.container;
		var clickListener = args.clickListener;
		var fields = args.fields;
		var catalog = args.catalog;

		var ul = $(document.createElement("ul"));
		ul.addClass("item-list");

		var items = args.items;
		items.forEach((item) => {
			var li = $(document.createElement("li"));
			li.click({"item" : item, "catalog" : catalog}, function(event) {
				clickListener(event.data.item, event.data.catalog);

				$(this).siblings().css("font-style", "normal").css("font-weight", "normal");
				$(this).css("font-style", "italic").css("font-weight", "bold");
			});
			li.css("cursor", "pointer");
			ul.append(li);

			var counter = 0;
			for (var a in catalog.displayFields) {
				if (counter++ >= 1) {
					break;
				}

				var displayField = catalog.displayFields[a];
				var renderedField = this.renderField(item, displayField);
				li.append(renderedField);
			}
		});

		container.append(ul);
	},

	renderDetails : function(args) {
		var container = args.container;
		var catalog = args.catalog;
		var item = args.item;
		var saveCallback = args.saveCallback;
		var cancelCallback = args.cancelCallback;

		container.empty();

		var detailContainer = $(document.createElement("div"));
		detailContainer.css("display", "inline-block");
		detailContainer.css("width", "100%");
		detailContainer.css("height", "95%");

		var textarea = $(document.createElement("textarea"));
		textarea.addClass("item-details-textarea");
		textarea.append(item._md);
		detailContainer.append(textarea);

		container.append(detailContainer);

		var mdToggle = $(document.createElement("span"));
		mdToggle.addClass("glyphicon glyphicon-play-circle pull-left");
		mdToggle.css("font-size", "1.5em");
		mdToggle.css("cursor", "pointer");
		mdToggle.click(function() {
			if (mdToggle.hasClass("glyphicon-play-circle")) {
				var md = window.markdownit();
				detailContainer.html(md.render(item._md));
				mdToggle.removeClass("glyphicon-play-circle").addClass("glyphicon-edit");
			} else {
				detailContainer.empty();
				detailContainer.append(textarea);
				mdToggle.removeClass("glyphicon-edit").addClass("glyphicon-play-circle");

				setTimeout(function() {
						textarea.focus();
				},0);
			}
		});
		container.append(mdToggle);

		var saveButton = $(document.createElement("button"));
		saveButton.addClass("btn btn-success pull-right");
		saveButton.append("  Save  ");
		saveButton.click(() => saveCallback(textarea.val()));
		container.append(saveButton);

		var cancelButton = $(document.createElement("button"));
		cancelButton.addClass("btn btn-default pull-right");
		cancelButton.append("Cancel");
		cancelButton.click(cancelCallback);
		container.append(cancelButton);

		// Since renderDetails is called within the event chain of the click that triggered it
		// the focus here is overtaken by the focus of the element the event was attached to.
		// Use setTimeout, yes it's ugly but attaching to the mouseup event of the element
		// to focus the textarea is also not elegant.
		setTimeout(function() {
				textarea.focus();
		},0);

		detailContainer.keyup(function(e) {
			if (e.which == 27) {
				cancelCallback();
			}
		});
	},

	getFieldValue : function(item, field) {
		for (a in item) {
			if (field == a) {
				return item[a];
			}
		}

		return undefined;
	},

	renderField : function(item, displayField) {
		var value = this.getFieldValue(item, displayField.field);

		if (!value) {
			return false;
		}

		var renderedField = $(document.createElement("div"));

		if ("text" == displayField.type) {
			renderedField.append(value);
		} else if ("date" == displayField.type) {
			var date = new Date(Number(value));
			var day = date.getDate();
			var month = this.Months[date.getMonth()];
			var year = date.getFullYear();

			renderedField.append(day + " " + month + " " + year);
		} else if ("set" == displayField.type) {
			var str = "";
			for (v in value) {
				str += value[v] + ", ";
			}

			renderedField.append(str);
		}

		return renderedField;
	}
}

var Util = require("extra/util");
var marked = require("marked");

module.exports = {

	renderList : function(args) {

		var container = args.container;
		var clickListener = args.clickListener;
		var catalog = args.catalog;

		var ul = $(document.createElement("ul"));
		ul.addClass("item-list");

		var items = args.items;
		items.forEach((item) => {
			var li = $(document.createElement("li"));
			li.addClass("focusable-link"); // Virtual class used to identify links that can be activated by keyboard shortcust
			li.attr("id", Util.uniqueId()) // Used to identify and activate the link

			li.click({"item" : item, "catalog" : catalog}, function(event) {
				clickListener(event.data.item, event.data.catalog);

				$(this).siblings().css("font-style", "normal").css("font-weight", "normal");
				$(this).css("font-style", "italic").css("font-weight", "bold");
			});
			li.css("cursor", "pointer");
			ul.append(li);

			var renderedField = this.renderFirstField(item);
			li.append(renderedField);
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
		detailContainer.addClass("details-container-inner")

		var textarea = $(document.createElement("textarea"));
		textarea.addClass("item-details-textarea");
		textarea.append(item._md);

		// Remember the default state and initilize the screen with it
		var defaultState = localStorage.getItem("default-details-state");
		if (defaultState == "html") {
			detailContainer.html(marked(item._md));
		} else {
			detailContainer.append(textarea);
		}

		container.append(detailContainer);

		var saveButton = $(document.createElement("button"));
		saveButton.addClass("btn btn-success save-button disabled");
		saveButton.append("  Save & Close ");
		saveButton.click(() => saveCallback(textarea.val()));
		container.append(saveButton);


		// Handle Ctrl + S
		textarea.on('keydown', function(e){
			if (e.keyCode == 83 && (navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey))      {
				e.preventDefault();
				saveCallback(textarea.val(), false);
				saveButton.addClass("disabled");
				saveButton.off("click");
        return false;
	    }
		});

		textarea.on("input", function(e) {
				saveButton.removeClass("disabled");
		});

		var cancelButton = $(document.createElement("button"));
		cancelButton.addClass("btn btn-default cancel-button");
		cancelButton.append("Cancel");
		cancelButton.click(cancelCallback);
		container.append(cancelButton);

		var previewButton = $(document.createElement("button"));
		previewButton.addClass("btn btn-default");
		previewButton.addClass(defaultState == "html" ? "html" : "md");
		previewButton.append(defaultState == "html" ? "Markdown" : "Preview");
		previewButton.click(function() {
			if (previewButton.hasClass("md")) {
				detailContainer.empty().html(marked(textarea.val()));
				previewButton.removeClass("md").addClass("html");
				previewButton.empty().append("Markdown");

				localStorage.setItem("default-details-state", "html");
			} else {
				detailContainer.empty().append(textarea);
				previewButton.removeClass("html").addClass("md");
				previewButton.empty().append("Preview");

				localStorage.setItem("default-details-state", "md");
				setTimeout(function() {
						textarea.focus();
				},0);
			}
		});
		container.append(previewButton);

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

	renderFirstField : function(item) {
		var renderedField = $(document.createElement("div"));

		// TODO the order of the fields in item is not guaranteed
		// This needs fixing with either user input i.e. specifying which field to expose
		// or some clever heiristics determining which is the most important field. This might be
		// a challenge given that we do not impose any restriction on the consistency of the documents
		for (var key in item) {
				if (key != "id" && key != "_md") {
						renderedField.append(item[key]);
						return renderedField;
				}
		}
	}
}

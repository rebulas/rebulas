var Util = require("extra/util");
var Elements = require("ui/elements");
var marked = require("marked");

module.exports = {

	renderList : function(args) {

		var container = args.container;
		var clickListener = args.clickListener;
		var catalog = args.catalog;

		var ul = Elements.ul("item-list");

		var items = args.items;
		items.forEach((item) => {
			var li = Elements.li("focusable-link"); // Virtual class used to identify links that can be activated by keyboard shortcust
			li.attr("id", Util.uniqueId()) // Used to identify and activate the link

			li.click({"item" : item, "catalog" : catalog}, function(event) {
				clickListener(event.data.item, event.data.catalog);

				$(this).siblings().css("font-style", "normal").css("font-weight", "normal");
				$(this).css("font-style", "italic").css("font-weight", "bold");
			});
			li.css("cursor", "pointer");
			ul.append(li);

      if (catalog.searchIndex.state.isDirty(item)) {
        li.addClass("changed");
      }

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
		var deleteCallback = args.deleteCallback;

		container.empty();

		var detailContainer = Elements.div("details-container-inner");

		//var textarea = Elements.textArea("item-details-textarea");
		//textarea.append(item.rawContent);
		var textarea = Elements.div("item-details-textarea");
		textarea.attr("id", "texteditor");
		textarea.append(item.rawContent);

		// Remember the default state and initilize the screen with it
		var defaultState = localStorage.getItem("default-details-state");

		// Allow default to html only if the item exists, new items enter text mode
		if (defaultState == "html" && item.id) {
			detailContainer.html(marked(item.rawContent));
		} else {
			detailContainer.append(textarea);
		}

		container.append(detailContainer);

		var editor = ace.edit("texteditor");
    editor.setTheme("ace/theme/tomorrow");
    editor.getSession().setMode("ace/mode/markdown");
		editor.renderer.setShowGutter(false);
		editor.renderer.setOption("fontSize", 13);
		editor.renderer.setOption("fontFamily", "monospace");
		editor.getSession().setUseWrapMode(true);

		var saveButton = Elements.button("btn btn-success save-button disabled");
		saveButton.append("  Save & Close ");
		saveButton.click(() => saveCallback(editor.getValue()));
		container.append(saveButton);

		var changed = false;

		// Handle Ctrl + S
		textarea.on('keydown', function(e){
			if (e.keyCode == 83 && (navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey))      {
				e.preventDefault();
				saveCallback(editor.getValue(), false);
				saveButton.addClass("disabled");
				saveButton.off("click");
				changed = false;
        return false;
	    }
		});

		editor.getSession().on('change', function(e) {
			saveButton.removeClass("disabled");
			changed = true;
		});

		var cancelButton = Elements.button("btn btn-default cancel-button");
		cancelButton.append("Cancel");
		cancelButton.click(cancelCallback);
		container.append(cancelButton);

		var previewButton = Elements.button("btn btn-default");
		previewButton.addClass(defaultState == "html" ? "html" : "md");
		previewButton.append(defaultState == "html" ? "Markdown" : "Preview");
		previewButton.click(function() {
			if (previewButton.hasClass("md")) {
				detailContainer.empty().html(marked(editor.getValue()));
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

		var deleteButton = Elements.button("btn btn-default delete-button");
		deleteButton.append("Delete");
		deleteButton.click(deleteCallback);
		container.append(deleteButton);

		// Since renderDetails is called within the event chain of the click that triggered it
		// the focus here is overtaken by the focus of the element the event was attached to.
		// Use setTimeout, yes it's ugly but attaching to the mouseup event of the element
		// to focus the textarea is also not elegant.
		setTimeout(function() {
				textarea.focus();
		},0);

		detailContainer.keyup(function(e) {
			if (e.which == 27 && !changed) {
				cancelCallback();
			}
		});
	},

	renderFirstField : function(item) {
		var renderedField = Elements.div();

    let nameField = item.field('name');
    nameField = nameField || item.fields[0];
		renderedField.append(nameField.textValue);
    return renderedField;
	}
}

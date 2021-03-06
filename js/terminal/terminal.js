var Util = require("extra/util");
var Query = require("query/query");
var RebulasBackend = require("backend/rebulas-backend");
var Catalogs = require("repository/repository-manager").Catalogs;

module.exports = {

	"container" : undefined,

  "create" : function(args) {
    var queryExecutor = args.queryExecutor;

		this.currentResult = args.initialResult;
		this.container = args.container;
		this.helpListener = args.helpListener;
		this.newItemListener = args.newItemListener;
		this.introListener = args.introListener;
		this.catalog = args.initialResult.catalog;

		var settings = {
			"greetings" : 'Welcome to Rebulas. Enter [[i;;]help] for list of commands, [[i;;]intro] for a guide',
			"name" : 'rebulas',
			"prompt": this.calculatePrompt(this.currentResult)
		};

		var height = this.getHeight();
		if (!isNaN(height)) {
			this.container.height(height);
		}

    var self = this;

		// The Terminal
		// The listener is required for cases where commands require re-rendering of the result
		var terminal = this.container.terminal(function(command, term) {
      return new Promise((resolve, reject) => {
				self.processCommand(command, term, queryExecutor, resolve, reject);
			});
		}, settings);

    return {
      "onResultChange" : function(result) {
					self.currentResult = result;
					self.catalog = result.catalog;
          terminal.set_prompt(self.calculatePrompt(result));
      },

			"focus" : function() {
					terminal.focus(true);
			}
    };
  },

  "calculatePrompt" : function(result) {
		var base = 'rebulas@' + result.catalog.name;

    var crumbs = this.renderBreadcrumbs(result.breadcrumbs);
    if (crumbs) {
        base += "/" + crumbs;
    }
    base += "$ ";

    return base;
  },

	renderBreadcrumbs : function(crumbs) {
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
	},

  "processCommand" : async function(command, terminal, queryExecutor, resolve, reject) {
      var queryObject = Util.parseQueryString();
  		var q = new Query(queryObject.q);

      var c = this.parseCommand(command);
      if (c.command == "help") {
				this.helpListener();
				resolve();
			} else if (c.command == "intro") {
				this.introListener();
				resolve();
      } else if (c.command == "s") {
          var term = c.args.join(" ");

          if (term.length > 0) {
      			q.setSearch(term);
      			queryObject.q = q.toString();
      		} else if (q.hasSelection("$s")) {
      			q.removeSelection("$s");
      			queryObject.q = q.toString();
      		}

          queryExecutor.navigate("?" + Util.queryObjectToString(queryObject), function(result) {
						resolve(); // We may print search count or other stuff
					});
      } else  if (c.command == "cd") {
        if (c.args[0] == ".." || c.args[0] == "../") {
          q.removeSelectionAt(q.getSelections().length - 1);
          queryObject.q = q.toString();
          queryExecutor.navigate("?" + Util.queryObjectToString(queryObject), function(result) {
						resolve();
					});
				} else if (c.args.length == 0 || c.args[0] == '') {
					delete queryObject.q;
          queryExecutor.navigate("?" + Util.queryObjectToString(queryObject), function(result) {
						resolve();
					});
				} else if (c.args[0] == '-') {
					window.history.back();
					resolve();
        } else if (c.args.length == 2){
          q.addSelection(c.args[0], "=", c.args[1]);
          queryObject.q = q.toString();

          queryExecutor.navigate("?" + Util.queryObjectToString(queryObject), function(result) {
						resolve();
					});
        } else {
					resolve("Illegal selection");
				}
			} else if (c.command == "new") {
				// Give away the focus, the opening of the add/edit screen will capture it
				terminal.focus(false);
				this.newItemListener(this.catalog);
				resolve();
			} else if (c.command == "cp") {
				if (c.args[0] != "*") {
					resolve("Only bulk operations via the * are supported");
				} else {
					var result = this.currentResult;

					let uri = c.args[1];
					let catalog = Catalogs.getByURI(uri);

					if (!catalog) {
						resolve("No catalog " + uri + " found");
					} else {
						let index = await RebulasBackend.getCatalogIndex(catalog);
						result.items.forEach(item => {

							// At present the item.id contains path information
							// FIXME this should not be the case
							let clone = JSON.parse(JSON.stringify(item));
							delete clone.id;

							index.saveItem(clone);
						});
						resolve(result.count + " items copied");
					}
				}
      } else if (c.command == "height") {
				var height = parseInt(c.args[0]);
				if (!isNaN(height)) {
					this.container.height(height);
					this.setHeight(height);
				}
				resolve();
			} else if (['push', 'pull'].indexOf(c.command) >= 0) {
				let searchIndex = await RebulasBackend.getCatalogIndex(this.catalog);

				let counter = 0;
				let listener = function(ev) {
					if (ev.state == "not-dirty") {
						counter++;
					}
				};
				searchIndex.state.addListener(listener);

				if (c.command === 'push') {
				  await RebulasBackend.pushCatalog(this.catalog);
        } else {
          await RebulasBackend.pullCatalog(this.catalog);
        }
				searchIndex.state.removeListener(listener);

				if (counter > 0) {
					resolve(counter == 1  ? "1 item synchronized" : counter + " items synchronized");

					// FIXME this jquery thing should be taken out of the terminal code
					$("ul > li.changed").removeClass("changed");
				} else {
					resolve("No items to synchronize");
				}
      } else {
				resolve("Unknown command");
			}
  },

	"setHeight" : function(height) {
		localStorage.setItem("terminalHeight", height);
	},

	"getHeight" : function() {
		return localStorage.getItem("terminalHeight");
	},

  "parseCommand" : function(command) {
    var split = [];
    var buffer = "";

    for (var i = 0; i < command.length; i++) {
        var char = command[i];
        if (char == ' ' && buffer.length > 0) {
          split.push(buffer);
          buffer = "";
        } else {
          buffer += char;
        }
    }

    if (buffer.length > 0) {
        split.push(buffer);
    }

    var c = split.shift();
    return {
      "command" : c,
      "args" : split
    };
  }
}

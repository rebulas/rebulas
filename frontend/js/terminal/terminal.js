var Terminal = {
	"container" : undefined,

  "create" : function(args) {
    var queryExecutor = args.queryExecutor;
    var initialResult = args.initialResult;
		this.container = args.container;
		this.helpContainer = args.helpContainer;
		this.newItemListener = args.newItemListener;
		this.catalog = initialResult.catalog;

		var settings = {
			"greetings" : 'Welcome to Rebulas. Enter help or h for a list of commands.',
			"name" : 'rebulas',
			"prompt": this.calculatePrompt(initialResult)
		};

		var height = this.getHeight();
		if (!isNaN(height)) {
			this.container.height(height);
		}

    var self = this;

		// The Terminal
		// The listener is required for cases where commands require re-rendering of the result
		var terminal = this.container.terminal(function(command, term) {
      self.processCommand(command, term, queryExecutor);
		}, settings);

    return {
      "onResultChange" : function(result) {
					this.catalog = result.catalog;
          terminal.set_prompt(self.calculatePrompt(result));
      },

			"focus" : function() {
					terminal.focus(true);
			}
    }
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

  "processCommand" : function(command, terminal, queryExecutor) {
      var queryObject = Util.parseQueryString();
  		var q = new Query(queryObject.q);

      var c = this.parseCommand(command);
      if (c.command == "h" || c.command == "help") {
				this.helpContainer.fadeIn();
      } else if (c.command == "s") {
          var term = c.args.join(" ");

          if (term.length > 0) {
      			q.setSearch(term);
      			queryObject.q = q.toString();
      		} else if (q.hasSelection("$s")) {
      			q.removeSelection("$s");
      			queryObject.q = q.toString();
      		}

          queryExecutor.navigate("?" + Util.queryObjectToString(queryObject));
      } else  if (c.command == "cd") {
        if (c.args[0] == ".." || c.args[0] == "../") {
          q.removeSelectionAt(q.getSelections().length - 1);
          queryObject.q = q.toString();
          queryExecutor.navigate("?" + Util.queryObjectToString(queryObject));
				} else if (c.args.length == 0 || c.args[0] == '') {
					delete queryObject.q;
          queryExecutor.navigate("?" + Util.queryObjectToString(queryObject));
				} else if (c.args[0] == '-') {
					window.history.back();
        } else if (c.args.length == 2){
          q.addSelection(c.args[0], "=", c.args[1]);
          queryObject.q = q.toString();

          queryExecutor.navigate("?" + Util.queryObjectToString(queryObject));
        }
			} else if (c.command == "new") {
				// Give away the focus, the opening of the add/edit screen will capture it
				terminal.focus(false);
				this.newItemListener(this.catalog);
      } else if (c.command == "height") {
				var height = parseInt(c.args[0]);
				if (!isNaN(height)) {
					this.container.height(height);
					this.setHeight(height);
				}
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

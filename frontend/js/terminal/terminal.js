var Terminal = {
	"container" : undefined,

  "create" : function(args) {
    var queryExecutor = args.queryExecutor;
    var initialResult = args.initialResult;
		this.container = args.container;
		this.helpContainer = args.helpContainer;

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
          terminal.set_prompt(self.calculatePrompt(result));
      },

			"focus" : function() {
					terminal.focus(true);
			}
    }
  },

  "calculatePrompt" : function(result) {
		var base = 'rebulas@' + result.catalog.name;

    var crumbs = BreadcrumbsRenderer.render(result.breadcrumbs);
    if (crumbs) {
        base += "/" + crumbs;
    }
    base += "$ ";

    return base;
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

          queryExecutor.navigate("?" + Util.queryObjectToString(queryObject), function(result) {
            terminal.echo("Showing " + result.count + " results");
          });
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

          queryExecutor.navigate("?" + Util.queryObjectToString(queryObject), function(result) {
            terminal.echo("Showing " + result.count + " results");
          });
        }
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

  "printHelp" : function(terminal) {
		terminal.echo("Usage:");
    terminal.echo("\"s keywords\"\tSearch for the specified keywords within the catalog of documents");
    terminal.echo("\"cd field value\"\tFilter the result with the specified value for the given field");
    terminal.echo("\"cd ../\"\tRemove the last filtering step");
		terminal.echo("\"height x\tSet the height of the terminal in px");
    terminal.echo();
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

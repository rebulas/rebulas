var Terminal = {

  "create" : function(args) {
    var queryExecutor = args.queryExecutor;
    var initialResult = args.initialResult;

		var settings = {
			"greetings" : 'Welcome to Rebulas. Enter help or h for a list of commands.',
			"name" : 'rebulas',
			"prompt": this.calculatePrompt(initialResult)
		};

    var self = this;

		// The Terminal
		// The listener is required for cases where commands require re-rendering of the result
		var terminal = $("#terminal").terminal(function(command, term) {
      self.processCommand(command, term, queryExecutor);
		}, settings);

    return {
      "onResultChange" : function(result) {
          terminal.set_prompt(self.calculatePrompt(result));
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
        this.printHelp(terminal);
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

          queryExecutor.navigate("?" + Util.queryObjectToString(queryObject), function(result) {
            terminal.echo("Showing " + result.count + " results");
          });
        } else {
          q.addSelection(c.args[0], "=", c.args[1]);
          queryObject.q = q.toString();

          queryExecutor.navigate("?" + Util.queryObjectToString(queryObject), function(result) {
            terminal.echo("Showing " + result.count + " results");
          });
        }
      }
  },

  "printHelp" : function(terminal) {
    terminal.echo("Usage:");
    terminal.echo("\"s keywords\"\tSearch for the specified keywords within the catalog of documents");
    terminal.echo("\"cd field value\"\tFilter the result with the specified value for the given field");
    terminal.echo("\"cd ../\"\tRemove the last filtering step");
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

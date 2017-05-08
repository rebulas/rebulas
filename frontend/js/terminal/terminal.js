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

  		var term = command; // strip the leading s
  		if (term) {
  			q.setSearch(term);
  			queryObject.q = q.toString();
  		} else if (q.hasSelection("$s")) {
  			q.removeSelection("$s");
  			queryObject.q = q.toString();
  		}

  		queryExecutor.navigate("?" + Util.queryObjectToString(queryObject), function(result) {
        terminal.echo("Showing " + result.count + " results");
  		});
  }
}

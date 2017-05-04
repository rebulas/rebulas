var Terminal = {

  "create" : function(args) {
    var resultModel = args.resultModel;
    var resultRenderer = args.resultRenderer;
    var queryExecutor = args.queryExecutor;

    // Initial state
		// TODO must include the repository information, maybe reuse the catalog concept
		var currentPrompt = 'rebulas@github.com/rebulas$ ';

		// The terminal prompt should reflect the current result set
		var prompt = function(callback) {
				var result = resultModel.get();
				var current = currentPrompt;

				var evaluated = current;
				if (result) {
					//evaluated += BreadcrumbsRenderer.render(result.breadcrumbs);
				}

				callback(evaluated);
		};

		var settings = {
			"greetings" : 'Welcome to Rebulas. Enter help or h for a list of commands.',
			"name" : 'rebulas',
			"prompt": prompt
		};

    var self = this;

		// The Terminal
		// The listener is required for cases where commands require re-rendering of the result
		return $("#terminal").terminal(function(command, term) {
      self.processCommand(command, term, queryExecutor, resultRenderer.render);
		}, settings);
  },

  "processCommand" : function(command, terminal, queryExecutor, listener) {
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
  			listener(result);
  			terminal.echo("Showing 2 results");
  		});
  }
}

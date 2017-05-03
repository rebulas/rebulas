var CommandLineInterpreter = {

  "process" : function(args) {
    var command = args.command;
    var terminal = args.terminal;
    var queryExecutor = args.queryExecutor;
    var listener = args.listener;

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

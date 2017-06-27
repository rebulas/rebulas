var Util = require("extra/util");
var QueryExecutor = require("query/query-executor");
var Terminal = require("terminal/terminal");
var Keymap = require("ui/keymap");
var RepositoryConfigurator = require("repository/repository-configurator");
var ResultRenderer = require("ui/result-renderer");

$(document).ready(function() {

  	// Query parameters and the item query representation
  	var q = Util.parseQueryString();

  	// Register the current URL in the history stack in order to get a proper state in case of direct link
  	history.replaceState({"queryObject" : q}, "", "?" + Util.queryObjectToString(q));

  	// All changes in the result set go through the QueryExecutor. The query execution could be
  	// triggered from within UI components, this reference will be passed there.
  	var queryExecutor = QueryExecutor.create({
  		"waitStatePlaceholder" : $("#hintPlaceholder")
  	});

  	// Overarching renderer for the result, all these pieces need to be updated upon result update
  	var resultRenderer = ResultRenderer.create({
  		"queryExecutor" : queryExecutor,
  		"facetsContainer" : $("#facets-container"),
  		"countContainer" : $("#countContainer"),
  		"itemsContainer" : $("#itemsContainer"),
  		"detailsContainer" : $("#itemDetails"),
  		"hintPlaceholder" : $("#hintPlaceholder")
  	});


  	// React on back/forward when we have state enabled
  	window.onpopstate = function(event) {
  		if (event.state) {
  			// Does not alter the history state, does trigger the onResultChange listeners
  			queryExecutor.execute(event.state.queryObject);
  		}
  	};

  	queryExecutor.execute(q, function(result) {

  		var newItemListener = resultRenderer.newItem.bind(resultRenderer);
  		var terminal = Terminal.create({
  				"queryExecutor" : queryExecutor,
  				"initialResult" : result,
  				"container" : $("#terminal"),
  				"helpContainer" : $("#help"),
  				"newItemListener" : newItemListener
  		});

  		// Render the initial result
  		resultRenderer.render(result);

  		// Following the initial rendering, the rendering coordination will be done via listeners
  		// The listeners define onResultChange method triggered within queryExecutor
  		queryExecutor.addListener(terminal);
  		queryExecutor.addListener(resultRenderer);

  		$("#helpButton").click(function() {
  			setTimeout(terminal.focus, 100);
  			$("#help").fadeOut();
  		});

  		var keymap = Keymap.create({
  			"terminal" : terminal
  		});

  		// Remap the shortcuts when the result changes
  		queryExecutor.addListener(keymap);

  	});

  	RepositoryConfigurator.render({
  		"repositoryContainer" : $("#repository-button"),
  		"catalogContainer" : $("#catalog-button"),
  		"queryExecutor" : queryExecutor
  	});

  	// Offline support, disabled for now until the rest of the pieces are in place
  	/*
  	if ("serviceWorker" in navigator) {
  		navigator.serviceWorker
  			.register('/service-worker.js')
  			.then(function() {
  				Util.log("Service Worker Registered");
  			});
  	}
  	*/
});

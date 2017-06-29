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
});

if (window.location.hostname != "localhost") {
  // From https://github.com/GoogleChrome/sw-precache/blob/master/demo/app/js/service-worker-registration.js
  /**
   * Copyright 2015 Google Inc. All rights reserved.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  /* eslint-env browser */
  'use strict';

  if ('serviceWorker' in navigator) {
    // Delay registration until after the page has loaded, to ensure that our
    // precaching requests don't degrade the first visit experience.
    // See https://developers.google.com/web/fundamentals/instant-and-offline/service-worker/registration
    window.addEventListener('load', function() {
      // Your service-worker.js *must* be located at the top-level directory relative to your site.
      // It won't be able to control pages unless it's located at the same level or higher than them.
      // *Don't* register service worker file in, e.g., a scripts/ sub-directory!
      // See https://github.com/slightlyoff/ServiceWorker/issues/468
      navigator.serviceWorker.register('service-worker.js').then(function(reg) {
        // updatefound is fired if service-worker.js changes.
        reg.onupdatefound = function() {
          // The updatefound event implies that reg.installing is set; see
          // https://w3c.github.io/ServiceWorker/#service-worker-registration-updatefound-event
          var installingWorker = reg.installing;

          installingWorker.onstatechange = function() {
            switch (installingWorker.state) {
              case 'installed':
                if (navigator.serviceWorker.controller) {
                  // At this point, the old content will have been purged and the fresh content will
                  // have been added to the cache.
                  // It's the perfect time to display a "New content is available; please refresh."
                  // message in the page's interface.
                  console.log('New or updated content is available.');
                } else {
                  // At this point, everything has been precached.
                  // It's the perfect time to display a "Content is cached for offline use." message.
                  console.log('Content is now available offline!');
                }
                break;

              case 'redundant':
                console.error('The installing service worker became redundant.');
                break;
            }
          };
        };
      }).catch(function(e) {
        console.error('Error during service worker registration:', e);
      });
    });
  }
}

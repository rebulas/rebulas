var FacetRenderer = {

    // To be used as a buffer for Ctrl + facets clicks in order to produce an or query
    "orQueue" : [],

    "renderFacets" : function (args) {
        var facetContainer = args.container;;
        var catalog = args.catalog;
        var facets = args.facets;
        var clickCallback = args.clickCallback;
		var queryExecutor = args.queryExecutor;

        var self = this;

        var container = $(document.createElement("div"));

        // Render the facets, each facet entry links to a smaller result set
        for (var f in facets) {
            var facet = facets[f];

            if (facet.values.length < 2) {
                continue;
            }

            var title = $(document.createElement("li"));
            title.addClass("facet-title");
            title.addClass("facet-title-" + facet.field);
            title.append(facet["title"]);
            container.append(title);

            if (facet.values.length > 10) {

                var searchIcon = $(document.createElement("span"));
                searchIcon.addClass("glyphicon glyphicon-search facet-title-search-icon");
                searchIcon.addClass("search-icon-" + facet.id);
                title.append(searchIcon);

                var searchInput = $(document.createElement("input"));
                searchInput.attr("type", "search");
                searchInput.addClass("search-input-" + facet.id);
                searchInput.addClass("search-field form-control facet-title-search-input");
                searchInput.hide();
                title.append(searchInput);

                searchIcon.click({"input" : searchInput, "facetId" : facet.id}, function(ev) {
                    var input = ev.data.input;
                    var facetId = ev.data.facetId;

                    if (input.is(':visible')) {
                        input.fadeOut();
                        input.val("");

                        container.find(".more-link-" + facetId).show();
                        container.find(".facet-values-short-" + facetId).show();
                        container.find(".facet-values-full-" + facetId).hide();
                        container.find(".facet-values-full-" + facetId + " > li").show();
                    } else {
                        input.fadeIn().focus();
                    }
                });

                searchInput.keyup({"facetId" : facet.id}, function(ev) {
                    var facetId = ev.data.facetId;

                    var value = $(this).val();
                    value = value.toLowerCase().replace(/\b[a-z]/g, function(letter) {
                        return letter.toUpperCase();
                    });

                    container.find(".facet-values-full-" + facetId + " > li").each(function() {
                        var a = $(this).children().first();

                        if (value == "") {
                            $(this).show();
                        } else {
                            var linkText = a.text().toLowerCase().replace(/\b[a-z]/g, function(letter) {
                                return letter.toUpperCase();
                            });

                            linkText.search(value) > -1 ? $(this).show() : $(this).hide();
                        }
                    });

                    container.find(".facet-values-short-" + facetId).hide();
                    container.find(".facet-values-full-" + facetId).show();
                    container.find(".more-link-" + facetId).hide();

                    if (ev.which == 13) {
                        var shown = [];
                        container.find(".facet-values-full-" + facetId + " > li").each(function() {
                            if ($(this).is(':visible')) {
                                shown.push($(this));
                            };
                        });

                        if (shown.length == 1) {
                            var elem = shown[0].children().first();
                            elem.trigger("mouseup");
                        }
                    } else if (ev.which == 27) {
                        container.find(".search-icon-" + facetId).trigger("click");
                    }
                });
            }

            var div = $(document.createElement("div"));
            div.addClass("facet-values-full-" + facet.id);

            var total = facet.values.length;
            facet.values.forEach(function(value) {
                var facetValueContainer = self.renderFacetValue(catalog, facet, value, "facet-full-", clickCallback);
                div.append(facetValueContainer);
            });

            // Attach Ctrl+F listener on top of the facet panel to allow easy triggering of the
            // search box
            var divShortened = $(document.createElement("div"));
            divShortened.addClass("facet-values-short-" + facet.id);
            divShortened.mouseenter({"facetId" : facet.id}, function(ev) {
                $(document).keydown({"facetId" : ev.data.facetId}, function (e) {
                    if (e.keyCode === 114 || (e.ctrlKey && e.keyCode === 70)) {
                        e.preventDefault();
                        container.find(".search-icon-" + e.data.facetId).trigger("click");
                    }
                });
            });

            divShortened.mouseleave(function() {
                $(document).off("keydown");
            });


            var i = 0;
            for (var v in facet.values) {
                var value = facet.values[v];

                var facetValueContainer = self.renderFacetValue(catalog, facet, value, "facet-short-", clickCallback);
                divShortened.append(facetValueContainer);

                if (i++ == 10) {
                    break;
                }
            }

            if (total > 10) {
                div.hide();
            } else {
                divShortened.hide();
            }
            container.append(div);
            container.append(divShortened);

            var moreLink = $(document.createElement("div"));
            moreLink.addClass("pull-right");
            moreLink.css("cursor", "pointer");
            moreLink.addClass("more-link-" + facet.id);
            moreLink.click({"id" : facet.id, "total" : total}, function(ev) {
                var divShort = container.find(".facet-values-short-" + ev.data.id).first();
                var divFull = container.find(".facet-values-full-" + ev.data.id).first();

                if (divShort.is(":visible")) {
                    divShort.hide();
                    divFull.show();
                    $(this).empty();
                    $(this).append("less");
                } else {
                    divFull.hide();
                    divShort.show();
                    $(this).empty();
                    $(this).append((ev.data.total - 10 ) + " more");
                }
            });
            container.append(moreLink);

            if (total > 10) {
                container.append(document.createElement("br"));
                moreLink.append((total - 10 ) + " more");
            }

            container.append(document.createElement("br"));
        }

        container.mouseenter(function(ev) {
            self.orQueue = [];

            $(document).keyup(function (e) {
                if (e.keyCode == 17) {
                    if (self.orQueue.length > 0) {
                        var queryObject = self.buildOrQuery(self.orQueue);
                        queryExecutor.navigate("?" + Util.queryObjectToString(queryObject), clickCallback);
                    }

                    self.orQueue = [];
                }
            })
        });

        container.mouseleave(function(ev) {
            container.find(".facet-value > a").removeClass("facet-value-or-selected");
            $(document).off("keyup");
        });

        facetContainer.empty();
        facetContainer.append(container);
    },

    "renderFacetValue" : function (catalog, facet, value, prefix, clickCallback) {
        var self = this;

        var innerLi = $(document.createElement("li"));
        var valueId = String(value.id);

        innerLi.addClass(prefix + facet.field + "-value-" + valueId.toLowerCase());
        innerLi.addClass("facet-value");

        var link = $(document.createElement("a"));
        link.css("cursor", "pointer");
        link.mouseup({"link" : self.createLink(value.link, catalog)}, function(ev) {

            // Sorting a result list does not refresh the facet panel but it modifies the URL
            // To keep the facet link in sync we'll grab just the sort portion of the URL
            var q = Util.parseQueryString();
            var facetLink = Util.parseQueryString(ev.data.link);
            if (q.sort) {
                facetLink.sort = q.sort;
            } else {
                delete facetLink.sort;
            }

            if (ev.ctrlKey) {
                self.orQueue.push({"field" : facet.field, "value" : valueId});
                link.addClass("facet-value-or-selected");
            } else {
                queryExecutor.navigate("?" + Util.queryObjectToString(facetLink), clickCallback);
            }
        });
        link.attr("draggable", true);
        link.on("dragstart", {"field" : facet.field, "value" : valueId}, function(ev) {
            var dt = ev.originalEvent.dataTransfer;
            dt.setData("field", ev.data.field);
            dt.setData("value", ev.data.value);
        });

        link.append(value.title);
        innerLi.append(link);

        var em = $(document.createElement("em"));
        em.addClass("muted");
        em.append(" (" + value.count + ")");
        innerLi.append(em);

        return innerLi;
    },

    "buildOrQuery" : function(queue) {

        // Prepare the query based on whatever queue was selected
        var queryObject = Util.parseQueryString();
        var query = new Query(queryObject.q);

        var fieldMap = {};
        queue.forEach(function(pair) {
            var values = fieldMap[pair.field];
            if (!values) {
                values = [];
                fieldMap[pair.field] = values;
            }
            values.push(pair.value);
        });

        for (var field in fieldMap) {
            var values = fieldMap[field].join(";");
            query.addSelection(field, "=", values, undefined, "or");
        }
        queryObject.q = query.toString();

        return queryObject;
    },

    "createLink" : function (link, catalog) {
			var result = "?catalog=" + catalog.id + "&q=" + link;

			var queryString = Util.parseQueryString();
			delete queryString["q"];
			delete queryString["catalog"];

			var str = Util.queryObjectToString(queryString);
			if (str && str.length > 0) {
				result += "&" + str;
			}

			return result;
		}
}

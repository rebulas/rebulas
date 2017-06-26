var Util = require("extra/util");
var elasticlunr = require('elasticlunr');
var FeatureCollector = require('backend/faceting').FeatureCollector;
var DropboxOperations = require('backend/dropbox').DropboxOperations;
var localhost = require('backend/localhost');
var LocalhostOperations = localhost.LocalhostOperations;
var RejectingOperations = localhost.RejectingOperations;
var LocalWrapperOperations = localhost.LocalWrapperOperations;
var Query = require('query/query');

var performance = {
  now : () => new Date().getTime()
}

function addDocToIndex(doc, content, index, features) {
  Util.log('Indexing', doc.id);
  let analyzed = features.addDocContent(content);

  analyzed.id = doc.id;
  analyzed.rev = doc.rev;
  analyzed._content = content;

  Object.keys(analyzed).forEach((key) => {
    if(key !== 'id' && index._fields.indexOf(key) < 0) {
      Util.log('Adding new field', key);
      index.addField(key);
    }
  });

  index.addDoc(analyzed);
}

class IndexWrapper {
  constructor(indexOperations, catalog) {
    this.indexOperations = indexOperations;
    this.index = new elasticlunr.Index();
    this.features = new FeatureCollector();
    this.path = catalog.path;
  }

  saveIndex() {
    Util.log('Saving index');
    let ops = this.indexOperations;
    return ops.saveIndexContent({
      index: this.index.toJSON(),
      features: this.features.toJSON(),
      date: new Date().toUTCString()
    });
  }

  loadIndex(indexContent) {
    this.index = indexContent.index && elasticlunr.Index.load(indexContent.index);
    this.features = indexContent.features && FeatureCollector.load(indexContent.features);
  }

  adaptSearchResult(item) {
    let doc = item.doc,
        adapted = Object.assign({}, doc);
    adapted.id = item.ref.substring(1);
    adapted._md = doc._content;

    return adapted;
  }

  adaptFacets(facets) {
    let result = [];
    Object.keys(facets).forEach((key) => {
      let facet = {
        field: key,
        title: key,
        values: Object.keys(facets[key]).map((k) => adaptFacetValue(facets[key][k], key))
      };
      result.push(facet);
    });
    return result;

    function adaptFacetValue(facetValue, field) {
      return {
        count: facetValue.count,
        id: facetValue.id,
        title: facetValue.value,
        link: field + '=' + facetValue.value
      };
    }
  }

  saveItem(item) {
    // Reverse of adaptSearchResult
    let self = this,
        content = item._md,
        indexOps = this.indexOperations,
        features = this.features,
        index = this.index;

    let nameBasedId = undefined;
    let analyzed = FeatureCollector.analyzeDocument(content);
    if (analyzed.heading) {
      nameBasedId = analyzed.heading.value
                          .toLowerCase()
                          .replace("'", "")
                          .replace(/[^a-zA-Z0-9]/g, '-');
    }

    // The item that has been read from the proper path has an id that contains the path
    // Note the leading slash is not part of the item.id
    // Try do devise a file name that hints of the content
    let id = undefined;
    if (item.id) {
      id = "/" +  item.id;
    } else {
      let uniq = Util.uniqueId();
      id = '/' + this.path + "/";
      id += nameBasedId ? nameBasedId + "-" + uniq.substring(uniq.length - 2) : uniq;
    }

    Util.log('Saving item', id);
    let doc = index.documentStore.getDoc(id);
    if (doc) {
      features.removeDocContent(doc._content);
      index.removeDoc(id);
    }
    return this.indexOperations.saveDocument(id, content).then((savedItem) => {
      savedItem.id = id;
      addDocToIndex(savedItem, content, index, features);
      features.calculateFieldFeatures();
      return self.saveIndex().then(() => savedItem);
    });
  }

  processSelectionResults(selectionResults) {
    let minimalSelection = selectionResults.reduce(
                            (acc, val) => acc.length < val.length ? acc : val,
                            selectionResults[0]);
    let selectionMaps = [];
    selectionResults.forEach((result) => {
      let map = {};
      result.forEach((doc) => map[doc.ref] = true);
      selectionMaps.push(map);
    });

    return minimalSelection.filter((doc) => selectionMaps.every((map) => map[doc.ref]));
  }

  search(queryObject) {
    let startMark = performance.now();
    let self = this,
        query = new Query(queryObject.q),
        index = this.index,
        features = this.features,
        searchQuery = {};

    let result = [];
    if (query.getSelections().length < 1) {
      result = [];
      let keys = Object.keys(index.documentStore.docs).sort();
      keys.forEach((key) => result.push({
        ref: key,
        doc: index.documentStore.docs[key]
      }));
    } else {
      // Perform a search for every selection
      let searchResults = [];
      query.getSelections().forEach((selection) => {
        let selectionResults,
            searchQuery = {},
            searchConfig = {};
        if(selection.field == '$s') {
          searchQuery['any'] = selection.value;
        } else {
          searchQuery[selection.field] = selection.value;
          searchConfig.fields = {};
          searchConfig.fields[selection.field] = {
            bool: 'AND'
          };
        }
        selectionResults = index.search(searchQuery, searchConfig);
        Util.log(JSON.stringify(searchQuery), '->', selectionResults.length);
        searchResults.push(selectionResults);
      });

      // Leave only docs that matched ALL the selections
      result = this.processSelectionResults(searchResults);
    }

    let facetingResult = features.calculateResultFacets(result.map((d) => d.doc));
    let facets = self.adaptFacets(facetingResult);
    result = result.map((item) => self.adaptSearchResult(item));

    Util.log(JSON.stringify(query.getSelections()), ' -> ', result.length, '/',
             this.index.documentStore.length, 'items,',
             'took', performance.now() - startMark, 'ms');

    return {
      items: result,
      facets: facets
    };
  }
}

function verifyUpToDate(lunrIndex, files) {
  if(!lunrIndex || files.length != lunrIndex.documentStore.length) {
    return false;
  }
  let upToDate = files.every((entry) => {
    let doc = lunrIndex.documentStore.getDoc(entry.path);
    if(!doc) {
      Util.log('New document', entry.path);
    } else if(doc.rev !== entry.rev) {
      Util.log('Updated document', entry.path);
    }
    return doc && doc.rev === entry.rev;
  });
  return upToDate;
}

function emptyIndex() {
  let index = new IndexWrapper();
  index.search = () => {
    return {
      results: [],
      facets: []
    };
  };
  return index;
}

async function getIndexWithOps(indexOps, catalog) {
  let allFiles = await indexOps.listAllFiles();
  let fileIndex = allFiles.findIndex((entry) => entry.path === indexOps.getIndexFilePath());
  let existingIndexEntry = fileIndex >= 0 && allFiles.splice(fileIndex, 1)[0];

  let indexWrapper = new IndexWrapper(indexOps, catalog);
  if(existingIndexEntry) {
    Util.log('Found existing index');
    let existingIndexContent = await indexOps.getEntryContent(existingIndexEntry);
    try {
      existingIndexContent = JSON.parse(existingIndexContent);
      indexWrapper.loadIndex(existingIndexContent);
    } catch(e) { Util.error(e); }
  }

  if(!verifyUpToDate(indexWrapper.index, allFiles)) {
    Util.log('Existing index outdated');
    indexWrapper = new IndexWrapper(indexOps, catalog);
    let newIndex = await rebuildIndex(indexOps, allFiles, indexWrapper.features);
    indexWrapper.index = newIndex;
    await indexWrapper.saveIndex();
  } else {
    Util.log('Existing index up to date');
  }

  return indexWrapper;

  async function rebuildIndex(indexOps, allFiles, features) {
    Util.log('Rebuilding index');
    let index = new elasticlunr.Index();

    let promises = allFiles.map((entry) => {
      return indexOps.getEntryContent(entry).then((content) => {
        let doc = {
          id: entry.path,
          name: entry.name,
          rev: entry.rev
        };
        addDocToIndex(doc, content, index, features);
      });
    });

    await Promise.all(promises);
    features.calculateFieldFeatures();
    Util.log('Entries in index:', index.documentStore.length);
    return index;
  }
}

let loadedIndices = {};
elasticlunr.tokenizer.seperator = /([\s\-,]|(\. ))+/;

exports.RebulasBackend = {
  getIndexBackend: function(catalog) {
	  let indexOps = undefined;
	  if (catalog.uri.startsWith('dropbox.com')) {
		  indexOps = new DropboxOperations(catalog);
		  Util.log('Loading Dropbox index');
	  } else if (catalog.uri.startsWith('localhost')) {
		  indexOps = new LocalhostOperations(catalog);
		  Util.log('Loading Localhost index');
	  }
    return indexOps;
  },
  loadIndex: async function(indexOps, catalog) {
    let index = await getIndexWithOps(indexOps, catalog);
    catalog.searchIndex = index;
    return index;
  },
  getCatalogIndex: async function(catalog) {
    if(loadedIndices[catalog.id]) {
      catalog.searchIndex = loadedIndices[catalog.id];
      Util.log('Found existing search index for catalog ', catalog.id);
      return catalog.searchIndex;
    }
    let indexOps = exports.RebulasBackend.getIndexBackend(catalog);
	  if (indexOps) {
			let index = await exports.RebulasBackend.loadIndex(indexOps, catalog);
			loadedIndices[catalog.id] = index;
			return index;
	  }

	  return emptyIndex();
  },
  clearIndexCache: function () {
    loadedIndices = {};
  }
};

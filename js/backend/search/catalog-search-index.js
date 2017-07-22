var Util = require("extra/util");
var Query = require('query/query');
var FeatureCollector = require('backend/faceting').FeatureCollector;
var model = require("backend/model");
var elasticlunr = require('elasticlunr');


elasticlunr.tokenizer.seperator = /([\s\-,]|(\. ))+/;

var performance = {
  now : () => new Date().getTime()
};

class CatalogSearchIndex {

  constructor(indexOperations, catalog) {
    this.indexOperations = indexOperations;
    this.index = new elasticlunr.Index();
    this.features = new FeatureCollector();
    this.path = catalog.path;
  }

  async loadIndex() {
    let indexOps = this.indexOperations,
        allFiles = await indexOps.listItems(),
        fileIndex = allFiles.findIndex((entry) => entry.id === indexOps.indexId),
        existingIndexEntry = fileIndex >= 0 && allFiles.splice(fileIndex, 1)[0];

    if(existingIndexEntry) {
      Util.log('Found existing index');
      existingIndexEntry = await indexOps.getItem(existingIndexEntry);
      try {
        let indexContent = JSON.parse(existingIndexEntry.content);
        this.index = indexContent.index && elasticlunr.Index.load(indexContent.index);
        this.features = indexContent.features && FeatureCollector.load(indexContent.features);
      } catch(e) { Util.error(e); }
    }

    // While we'll never hit it currently, keeping this around
    // if needed to speed up loading in the future
    if(verifyUpToDate(this.index, allFiles)) {
      Util.log('Index up to date');
    } else {
      Util.log('Index outdated or none');

      let features = new FeatureCollector();
      let newIndex = await rebuildIndex(indexOps, allFiles, features);
      this.index = newIndex;
      this.features = features;
    }
  }

  saveItem(item) {
    let self = this,
        content = item.rawContent,
        indexOps = this.indexOperations,
        features = this.features,
        index = this.index;

    let nameBasedId = undefined;
    let analyzed = new model.AnalyzedItem(null, content);
    if (analyzed.fields.length > 0) {
      nameBasedId = analyzed.fields[0].textValue
        .toLowerCase()
        .replace("'", "")
        .replace(/[^a-zA-Z0-9]/g, '-');
    }

    // The item that has been read from the proper path has an id that contains the path
    // Try do devise a file name that hints of the content
    let id = item.id;
    if (!id) {
      let uniq = Util.uniqueId();
      id = '/' + this.path + '/';
      id += nameBasedId ? nameBasedId + "-" + uniq.substring(uniq.length - 2) : uniq;
    }

    Util.log('Saving item', id);

    // Note we don't pass on the revision - we've left revision stamping only to the backend storage.
    // Until we hit there (upon sync), the item would go with revision undefined
    return this.indexOperations.saveItem(new model.CatalogItem(id, content))
      .then((savedItem) => {
        self.reindexItem(savedItem);
        return savedItem;
      });
  }

  reindexItem(catalogItem) {
    let doc = this.index.documentStore.getDoc(catalogItem.id);
    if (doc) {
      this.features.removeDocContent(doc._content);
      this.index.removeDoc(doc);
    }
    addDocToIndex(catalogItem, catalogItem.content, this.index, this.features);
    this.features.calculateFieldFeatures();
  }

  sync() {
    Util.log('Synchronizing...');
    function conflictResolve(localItem, remoteItem) {
      let resolution = {
        action: 'to-remote',
        item: localItem
      };
      Util.log('Resolving conflict', resolution);
      return Promise.resolve(resolution);
    }
    return this.indexOperations.sync(conflictResolve)
      .then(() => this.loadIndex());
  }

  get state() {
    return this.indexOperations.state;
  }

  executeSearch(querySelections) {
    let startMark = performance.now(),
        index = this.index,
        result = [];

    if (querySelections.length === 0) {
      // Plain search on keyword(s)
      Object.keys(index.documentStore.docs).sort().forEach((key) => result.push({
        ref: key,
        doc: index.documentStore.docs[key]
      }));
    } else {
      // Perform a search for every selection
      let searchResults = querySelections.map((selection) => {
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
        return selectionResults;
      });

      // Leave only docs that matched ALL the selections
      result = processSelectionResults(searchResults);
    }
    Util.log(JSON.stringify(querySelections), ' -> ', result.length, '/',
             index.documentStore.length, 'items, took',
             performance.now() - startMark, 'ms');
    return result;
  }

  search(queryString) {
    let querySelections = new Query(queryString).getSelections(),
        result = this.executeSearch(querySelections);

    let facetingResult = this.features.calculateResultFacets(result.map((d) => d.doc)),
        facets = adaptFacets(facetingResult, queryString);

    let resultItems = result.map((item) => {
      let id = item.ref;
      let catalogItem = new model.CatalogItem(id, item.doc._content, item.doc.rev);
      return new model.DisplayItem(id, item.doc._content, catalogItem);
    });

    return {
      items: resultItems,
      facets: facets
    };
  }
}


function addDocToIndex(doc, content, index, features) {
  // Util.log('Indexing', doc.id, 'rev', doc.rev);
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

async function rebuildIndex(indexOps, allFiles, features) {
  Util.log('Rebuilding index');
  let index = new elasticlunr.Index();

  let promises = allFiles.map(
    entry => indexOps.getItem(entry).then(
      item => addDocToIndex({
        id: item.id,
        rev: item.rev
      }, item.content, index, features)
    )
  );

  await Promise.all(promises);
  features.calculateFieldFeatures();
  Util.log('Entries in index:', index.documentStore.length);
  return index;
}
function adaptFacets(facets, queryString="") {
  if (!queryString.endsWith('/')) {
    queryString = queryString + '/';
  }

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
      link: queryString + field + '=' + facetValue.value
    };
  }
}

function processSelectionResults(selectionResults) {
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



function verifyUpToDate(lunrIndex, files) {
  if(!lunrIndex || files.length != lunrIndex.documentStore.length) {
    return false;
  }
  let upToDate = files.every((entry) => {
    let doc = lunrIndex.documentStore.getDoc(entry.id);
    if(!doc) {
      Util.log('New document', entry.id);
    } else if(doc.rev !== entry.rev) {
      Util.log('Updated document', entry.id);
    }
    return doc && doc.rev === entry.rev;
  });
  return upToDate;
}

module.exports = CatalogSearchIndex;

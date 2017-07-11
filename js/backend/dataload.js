var Util = require("extra/util");
var elasticlunr = require('elasticlunr');
var FeatureCollector = require('backend/faceting').FeatureCollector;
var DropboxOperations = require('backend/dropbox').DropboxOperations;
var localhost = require('backend/localhost');
var LocalhostOperations = localhost.LocalhostOperations;
var LocalWrapperOperations = localhost.LocalWrapperOperations;
var Query = require('query/query');
var model = require('backend/model');

var performance = {
  now : () => new Date().getTime()
};

function addDocToIndex(doc, content, index, features) {
  //Util.log('Indexing', doc.id, 'rev', doc.rev);
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

function adaptFacets(facets) {
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

class CatalogSearchIndex {
  constructor(indexOperations, catalog) {
    this.indexOperations = indexOperations;
    this.index = new elasticlunr.Index();
    this.features = new FeatureCollector();
    this.path = catalog.path;
  }

  get state() {
    return this.indexOperations.state;
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

  dirtyItems() {
    return this.indexOperations.dirtyItems();
  }

  search(queryObject) {
    let startMark = performance.now(),
        querySelections = new Query(queryObject.q).getSelections(),
        self = this,
        index = this.index,
        features = this.features,
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

    let facetingResult = features.calculateResultFacets(result.map((d) => d.doc)),
        facets = adaptFacets(facetingResult);
    result = result.map((item) =>
                        new model.DisplayItem(item.ref.substring(1), item.doc._content));

    Util.log(JSON.stringify(querySelections), ' -> ', result.length, '/',
             index.documentStore.length, 'items, took',
             performance.now() - startMark, 'ms');

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

elasticlunr.tokenizer.seperator = /([\s\-,]|(\. ))+/;

let indexCache = new Map();
exports.indexCache = indexCache;
exports.RebulasBackend = {
  commitCatalog: function(catalog) {
    return catalog.searchIndex.sync();
  },
  getIndexBackend: function(catalog) {
    let indexOps;
    if (catalog.uri.startsWith('dropbox.com')) {
      indexOps = new DropboxOperations(catalog);
      Util.log('Loading Dropbox index');
    } else if (catalog.uri.startsWith('localhost')) {
      indexOps = new LocalhostOperations(catalog);
      Util.log('Loading Localhost index');
    } else if (catalog.uri.startsWith('empty')) {
      indexOps = new LocalWrapperOperations({
        id: 'empty',
        path: 'empty'
      });
      Util.log('Loading empty local index');
    }
    return new LocalWrapperOperations(catalog, indexOps);
  },
  loadIndex: async function(indexOps, catalog) {
    let index = new CatalogSearchIndex(indexOps, catalog);
    catalog.searchIndex = index;
    await index.sync();
    return index;
  },
  getCatalogIndex: async function(catalog) {
    if(indexCache.has(catalog.id)) {
      catalog.searchIndex = indexCache.get(catalog.id);
      Util.log('Found existing search index for catalog ', catalog.id);
    } else {
      let indexOps = exports.RebulasBackend.getIndexBackend(catalog);
      catalog.searchIndex = await exports.RebulasBackend.loadIndex(indexOps, catalog);
    }
    indexCache.set(catalog.id, catalog.searchIndex);
    return catalog.searchIndex;
  }
};

(function(window) {

  function addDocToIndex(doc, content, index, features) {
    Util.log('Indexing', doc.id);
    let analyzed = features.analyzeDocument(content);

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
    constructor(indexOperations) {
      this.indexOperations = indexOperations;
      this.index = new elasticlunr.Index();
      this.features = new FeatureCollector();
    }

    async saveIndex() {
      let ops = this.indexOperations;
      await ops.saveIndexContent({
        index: this.index.toJSON(),
        features: this.features.toJSON()
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
      Util.log('Saving', item.id);
      // Reverse of adaptSearchResult
      let self = this,
          content = item._md,
          id = '/' + item.id,
          indexOps = this.indexOperations,
          features = this.features,
          index = this.index;
      this.indexOperations.saveDocument(id, content).then((savedItem) => {
        index.removeDoc(id);
        addDocToIndex(savedItem, content, index, features);
        // TODO: Recalculate field statistics
        self.saveIndex();
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
    if(files.length != lunrIndex.documentStore.length) {
      return false;
    }
    let upToDate = files.every((entry) => {
      let doc = lunrIndex.documentStore.getDoc(entry.path);
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

    let indexWrapper = new IndexWrapper(indexOps);
    if(existingIndexEntry) {
      Util.log('Found existing index');
      let existingIndexContent = await indexOps.getEntryContent(existingIndexEntry);
      existingIndexContent = JSON.parse(existingIndexContent);
      indexWrapper.loadIndex(existingIndexContent);
    }

    if(!verifyUpToDate(indexWrapper.index, allFiles)) {
      Util.log('Existing index outdated');
      indexWrapper = new IndexWrapper(indexOps);
      let newIndex = await rebuildIndex(indexOps, allFiles, indexWrapper.features);
      indexWrapper.index = newIndex;
      await indexWrapper.saveIndex();
    }

    return indexWrapper;

    async function rebuildIndex(indexOps, allFiles, features) {
      Util.log('Rebuilding index');
      let index = new elasticlunr.Index();
      let promises = [];
      allFiles.forEach((entry) => {
        promises.push(indexOps.getEntryContent(entry).then((content) => {
          let doc = {
            id: entry.path,
            name: entry.name,
            rev: entry.rev
          };
          addDocToIndex(doc, content, index, features);
        }));
      });

      await Promise.all(promises);
      features.calculateFieldFeatures();
      Util.log('Entries in index:', index.documentStore.length);
      return index;
    }

    function serializeIndex(index) {
      return new Blob([JSON.stringify(index.toJSON())], { type: 'application/json' });
    }
  }

  let loadedIndices = {};
  window.RebulasBackend = {
    getCatalogIndex: async function(catalog) {
      elasticlunr.tokenizer.seperator = /([\s\-,]|(\. ))+/;
      if(loadedIndices[catalog.id]) {
        catalog.searchIndex = loadedIndices[catalog.id];
        Util.log('Found existing search index for catalog ', catalog.id);
        return catalog.searchIndex;
      }

      if(catalog.uri.startsWith('dropbox.com')) {
        let indexOps = new DropboxOperations(catalog);
        Util.log('Loading Dropbox index');
        return getIndexWithOps(indexOps, catalog).then((index) => {
          catalog.searchIndex = index;
          loadedIndices[catalog.id] = index;
          return index;
        });
      }
      return emptyIndex();
    }
  };
}(window));

(function(window) {
  var INDEX_FILE_NAME = '.rebulas_index',
      DBX_INDEX_FILE_PATH = '/' + INDEX_FILE_NAME;

  class AuthRequests {
    constructor(user, pass) {
      this.user = user;
      this.pass = pass;
    }
    get(url) {
      let method = 'GET', self = this;
      return new Promise(function (resolve, reject) {
          var xhr = new XMLHttpRequest();
          xhr.open(method, url);
          xhr.setRequestHeader("Authorization", "Basic " + btoa(self.user + ":" + self.pass));
          xhr.onload = resolve;
          xhr.onerror = reject;
          xhr.send();
      });
    }
  }

  function addDocToIndex(doc, content, index) {
    doc = analyzeDoc(doc, content);
    Object.keys(doc).forEach((key) => {
      if(key !== 'id' && index._fields.indexOf(key) < 0) {
        index.addField(key);
      }
    });

    doc._content = content;
    index.addDoc(doc);
  }

  function analyzeDoc(doc, content) {
    let tokens = new marked.Lexer().lex(content);

    if (tokens.length > 0) {
      // This is how we identify attributes for now, any level 1 heading followed by a paragraph of text
      // ex.
      //
      // ------------ Markdown -----------------
      // # Name
      // Constitutionalism in early modern europe
      // ------------ Markdown -----------------
      //
      // will result in item.name = "Constitutionalism in early modern europe"
      var key = undefined;
      var value = "";
      tokens.forEach((token) => {
        if (token.type == "heading" && token.depth == 1) {
          if (key) {
            doc[key] = value;
          }
          key = token.text.toLowerCase();
          value = "";
        } else if (token.type == "paragraph") {
          value += token.text;
        }
      });

      if (key) {
        doc[key] = value;
      }
    }

    return doc;
  }

  class DropboxOperations {
    constructor(token) {
      this.dbx = new Dropbox({ accessToken: token });
    }

    async listAllFiles() {
      let allFiles = [];

      let folders = [''];
      while(folders.length !== 0) {
        let folder = folders[0];
        folders.splice(0, 1);
        let files = await this.dbx.filesListFolder({ path: folder });

        files.entries.forEach((entry) => {
          if (entry['.tag'] == 'folder') {
            folders.push(entry.path_lower);
          } else {
            allFiles.push({
              path: entry.path_lower,
              name: entry.path_display,
              rev: entry.rev
            });
          }
        });
      }

      return allFiles;
    }

    saveDocument(path, content) {
      let blob = new Blob([content], { type: 'application/json' });
      return this.dbx.filesUpload({
        path: path,
        contents: blob,
        mute: true,
        mode: {
          '.tag': 'overwrite'
        }
      }).then((entry) => {
        let saved = {
          id: entry.path,
          name: entry.name,
          rev: entry.rev,
          content: content
        };
        return saved;
      });
    }

    getEntryContent(entry) {
      let self = this;
      return new Promise((resolve, reject) =>
        self.dbx.filesDownload({ path: entry.path }).then((response) => {
          let blob = response.fileBlob;
          let reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsText(blob);
        }, reject));
    }

    saveIndex(index) {
      Util.log('Saving index');
      let blob = new Blob([JSON.stringify(index.toJSON())], { type: 'application/json' });
      return this.dbx.filesUpload({
        path: DBX_INDEX_FILE_PATH,
        contents: blob,
        mute: true,
        mode: {
          '.tag': 'overwrite'
        }
      });
    }
  }

  class IndexWrapper {
    constructor(index, indexOperations) {
      this.index = index;
      this.indexOperations = indexOperations;
    }

    adaptSearchResult(item) {
      let doc = item.doc,
          adapted = Object.assign({}, doc);
      adapted.id = item.ref.substring(1);
      adapted._md = doc._content;

      return adapted;
    }

    saveItem(item) {
      Util.log('Saving', item.id);
      // Reverse of adaptSearchResult
      let content = item._md,
          id = '/' + item.id,
          indexOps = this.indexOperations,
          index = this.index;
      this.indexOperations.saveDocument(id, content).then((savedItem) => {
        index.removeDoc(id);
        addDocToIndex(savedItem, content, index);
        indexOps.saveIndex(index);
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
          let selectionResults, searchQuery = {};
          if(selection.field == '$s') {
            searchQuery['any'] = selection.value;
          } else {
            searchQuery[selection.field] = selection.value;
          }
          selectionResults = index.search(searchQuery, {});
          searchResults.push(selectionResults);
        });

        // Leave only docs that matched ALL the selections
        result = this.processSelectionResults(searchResults);
      }

      result = result.map((item) => self.adaptSearchResult(item));

      Util.log(JSON.stringify(searchQuery), ' -> ', result.length, '/',
               this.index.documentStore.length, 'items,',
               'took', performance.now() - startMark, 'ms');
      return result;
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
    index.search = () => [];
    return index;
  }

  async function getIndexWithOps(indexOps, catalog) {
    let allFiles = await indexOps.listAllFiles();
    let fileIndex = allFiles.findIndex((entry) => entry.path === DBX_INDEX_FILE_PATH);
    let existingIndexEntry = fileIndex >= 0 && allFiles.splice(fileIndex, 1)[0];
    let lunrIndex;

    if(existingIndexEntry) {
      Util.log('Found existing index');
      let existingIndexContent = await indexOps.getEntryContent(existingIndexEntry);
      existingIndexContent = JSON.parse(existingIndexContent);
      lunrIndex = elasticlunr.Index.load(existingIndexContent);
      if(!verifyUpToDate(lunrIndex, allFiles)) {
        Util.log('Existing index outdated');
        lunrIndex = null;
      }
    }

    if(!lunrIndex) {
      let newIndex = await rebuildIndex(indexOps, allFiles);
      await indexOps.saveIndex(newIndex);
      lunrIndex = newIndex;
    }
    return new IndexWrapper(lunrIndex, indexOps);

    async function rebuildIndex(indexOps, allFiles) {
      Util.log('Rebuilding index');
      let index = new elasticlunr.Index();

      index.addField('name');

      let promises = [];
      allFiles.forEach((entry) => {
        promises.push(indexOps.getEntryContent(entry).then((content) => {
          console.log('Done reading', entry.path);
          let doc = {
            id: entry.path,
            name: entry.name,
            rev: entry.rev
          };
          addDocToIndex(doc, content, index);
        }));
      });

      await Promise.all(promises);
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
      if(loadedIndices[catalog.id]) {
        catalog.searchIndex = loadedIndices[catalog.id];
        Util.log('Found existing search index for catalog ', catalog.id);
        return catalog.searchIndex;
      }

      if(catalog.uri.startsWith('dropbox.com')) {
        let indexOps = new DropboxOperations(catalog.token);
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

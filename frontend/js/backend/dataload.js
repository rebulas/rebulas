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
      let doc = this.index.documentStore.getDoc(item.ref);
      return {
        id: item.ref.substring(1),
        _md: doc.content,
        details: doc.content
      };
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
        index.addDoc(savedItem);
        indexOps.saveIndex(index);
      });
    }

    search(queryObject) {
      let query = new Query(queryObject.q),
          searchSelection = query.getSelection('$s'),
          searchPhrase = (searchSelection && searchSelection.value) || '';
      let result = this.index.search(searchPhrase).map((item) => this.adaptSearchResult(item));
      Util.log(searchPhrase, ' -> ', result.length, '/', index.documentStore.length, 'items');
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

      index.addField('path');
      index.addField('name');
      index.addField('content');

      let promises = [];
      allFiles.forEach((entry) => {
        promises.push(indexOps.getEntryContent(entry).then((content) => {
          console.log('Done reading', entry.path);
          index.addDoc({
            id: entry.path,
            name: entry.name,
            rev: entry.rev,
            content: content
          });
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

  window.RebulasBackend = {
    getCatalogIndex: async function(catalog) {
      if(catalog.searchIndex) {
        Util.log('Found existing search index for catalog ', catalog.id);
        return catalog.searchIndex;
      }

      if(catalog.uri.startsWith('dropbox.com')) {
        let indexOps = new DropboxOperations(catalog.token);
        Util.log('Loading Dropbox index');
        return getIndexWithOps(indexOps, catalog).then((index) => {
          catalog.searchIndex = index;
          return index;
        });
      }
      return emptyIndex();
    }
  };
}(window));

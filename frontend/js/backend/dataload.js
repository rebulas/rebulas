(function(window) {
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

    saveIndex(path, serializedIndex) {
      return this.dbx.filesUpload({
        path: path,
        contents: serializedIndex,
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
      return {
        id: item.ref.substring(1),
        _md: this.index.documentStore.getDoc(item.ref).content
      };
    }

    search(queryObject) {
      let query = new Query(queryObject.q),
          searchSelection = query.getSelection('$s'),
          searchPhrase = (searchSelection && searchSelection.value) || '';
      return this.index.search(searchPhrase).map((item) => this.adaptSearchResult(item));
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
    let fileIndex = allFiles.findIndex((entry) => entry.path === '/.rebulas_index');
    let existingIndexEntry = fileIndex >= 0 && allFiles.splice(fileIndex, 1)[0];
    let lunrIndex;

    if(existingIndexEntry) {
      let existingIndexContent = await indexOps.getEntryContent(existingIndexEntry);
      existingIndexContent = JSON.parse(existingIndexContent);
      lunrIndex = elasticlunr.Index.load(existingIndexContent);
      if(!verifyUpToDate(lunrIndex, allFiles)) {
        lunrIndex = null;
      }
    }

    if(!lunrIndex) {
      let newIndex = await rebuildIndex(indexOps, allFiles);
      let serializedIndex = serializeIndex(newIndex);
      await indexOps.saveIndex('/.rebulas_index', serializedIndex);
      lunrIndex = newIndex;
    }
    return new IndexWrapper(lunrIndex, indexOps);

    async function rebuildIndex(indexOps, allFiles) {
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
      return index;
    }

    function serializeIndex(index) {
      return new Blob([JSON.stringify(index.toJSON())], { type: 'application/json' });
    }
  }

  var openedCatalogs = {};
  window.RebulasBackend = {
    getCatalogIndex: async function(catalog) {
      if(openedCatalogs[catalog.id]) {
        return openedCatalogs[catalog.id];
      }

      if(catalog.uri.startsWith('dropbox.com')) {
        let indexOps = new DropboxOperations(catalog.token);
        return getIndexWithOps(indexOps, catalog).then((index) => {
          openedCatalogs[catalog.id] = index;
          return index;
        });
      }
      return emptyIndex();
    }
  };
}(window));

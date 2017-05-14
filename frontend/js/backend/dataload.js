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

  class IndexWrapper {
    constructor(index) {
      this.index = index;
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
      let doc = lunrIndex.documentStore.getDoc(entry.path_lower);
      return doc && doc.rev === entry.rev;
    });
    return upToDate;
  }

  function emptyIndex() {
    let index = new IndexWrapper();
    index.search = () => [];
    return index;
  }

  async function listAllFiles(dbx) {
    let allFiles = [];

    let folders = [''];
    while(folders.length !== 0) {
      let folder = folders[0];
      folders.splice(0, 1);
      let files = await dbx.filesListFolder({ path: folder });

      files.entries.forEach((entry) => {
        if (entry['.tag'] == 'folder') {
          folders.push(entry.path_lower);
        } else {
          allFiles.push(entry);
        }
      });
    }

    return allFiles;
  }

  async function getDropboxIndex(catalog) {
    let dbx = new Dropbox({ accessToken: catalog.token });
    let allFiles = await listAllFiles(dbx);
    let fileIndex = allFiles.findIndex((entry) => entry.path_lower === '/.rebulas_index');
    let existingIndexEntry = fileIndex >= 0 && allFiles.splice(fileIndex, 1)[0];
    let lunrIndex;

    if(existingIndexEntry) {
      let existingIndexContent = await readEntryContent(existingIndexEntry);
      existingIndexContent = JSON.parse(existingIndexContent);
      lunrIndex = elasticlunr.Index.load(existingIndexContent);
      if(!verifyUpToDate(lunrIndex, allFiles)) {
        lunrIndex = null;
      }
    }

    if(lunrIndex) {
      return new IndexWrapper(lunrIndex);
    } else {
      let newIndex = await rebuildIndex(dbx, allFiles);
      let serializedIndex = serializeIndex(newIndex);
      await dbx.filesUpload({
        path: '/.rebulas_index',
        contents: serializedIndex,
        mute: true,
        mode: {
          '.tag': 'overwrite'
        }
      });
      return new IndexWrapper(newIndex);
    }

    async function rebuildIndex(dbx, allFiles) {
      let index = new elasticlunr.Index();

      index.addField('path');
      index.addField('name');
      index.addField('content');

      let promises = [];
      allFiles.forEach((entry) => {
        promises.push(readEntryContent(entry).then((content) => {
          console.log('Done reading', entry.path_lower);
          index.addDoc({
            id: entry.path_lower,
            name: entry.path_display,
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

    function readEntryContent(entry) {
      return new Promise(async (resolve, reject) => {
        let dlResponse = await dbx.filesDownload({ path: entry.path_lower });
        let blob = dlResponse.fileBlob;
        let reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(blob);
      });
    }
  }

  var openedCatalogs = {};
  window.RebulasBackend = {
    getCatalogIndex: async function(catalog) {
      if(openedCatalogs[catalog.id]) {
        return openedCatalogs[catalog.id];
      }

      if(catalog.uri.startsWith('dropbox.com')) {
        return getDropboxIndex(catalog).then((index) => {
          openedCatalogs[catalog.id] = index;
          return index;
        });
      }
      return emptyIndex();
    }
  };
}(window));

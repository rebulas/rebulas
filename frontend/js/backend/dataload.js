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

  async function getDropboxIndex(catalog) {
    let dbx = new Dropbox({ accessToken: '' });
    let existingIndex;
    try {
      existingIndex = await dbx.filesDownload({ path: '/.rebulas_index' });
    } catch(e) {}

    if(existingIndex) {
      let existingIndexContent = await readEntryContent(existingIndex);
      existingIndexContent = JSON.parse(existingIndexContent);
      return new IndexWrapper(elasticlunr.Index.load(existingIndexContent));
    } else {
      let newIndex = await rebuildIndex(dbx);
      let serializedIndex = writeIndex(newIndex);
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

    async function rebuildIndex(dbx) {
      let index = new elasticlunr.Index();

      index.addField('path');
      index.addField('name');
      index.addField('content');

      let folders = [''];
      let promises = [];
      while(folders.length !== 0) {
        let folder = folders[0];
        folders.splice(0, 1);
        let files = await dbx.filesListFolder({ path: folder });

        for (let i = 0; i < files.entries.length; i++) {
          let entry = files.entries[i];
          if (entry['.tag'] == 'folder') {
            folders.push(entry.path_lower);
          } else {
            console.log('Reading', entry.path_lower);
            promises.push(readEntryContent(entry).then((content) => {
              console.log('Done reading', entry.path_lower);
              index.addDoc({
                id: entry.path_lower,
                name: entry.path_display,
                content: content
              });
            }));
          }
        }
      }
      await Promise.all(promises);
      return index;
    }

    function writeIndex(index) {
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

      let url = new URL(catalog.uri);
      if(url.protocol === 'dropbox:') {
        return getDropboxIndex(catalog).then((index) => {
          openedCatalogs[catalog.id] = index;
          return index;
        });
      }
      return Promise.resolve(undefined);
    }
  };
}(window));

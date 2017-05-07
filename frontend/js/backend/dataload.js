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

    search(queryObject) {
      return this.index.search(queryObject.q);
    }
  }

  async function getDropboxIndex(catalog) {
    let dbx = new Dropbox({ accessToken: '' });
    let files = await dbx.filesListFolder({path: ''});
    let index = new elasticlunr.Index();

    index.addField('path');
    index.addField('name');
    index.addField('content');

    var folders = [];
    for (let i = 0; i < files.entries.length; i++) {
      let entry = files.entries[i];
      if (entry['.tag'] == 'folder') {
        folders.push(entry);
      } else {
        console.log('Reading', entry.path_lower);
        let content = await readEntryContent(entry);
        index.addDoc({
          id: entry.path_lower,
          name: entry.path_display,
          content: content
        });
      }
    };

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

    return new IndexWrapper(index);
  }

  var openedCatalogs = {};
  window.RebulasBackend = {
    getCatalogIndex: async function(catalog) {
      if(openedCatalogs[catalog.id]) {
        return openedCatalogs[catalog.id];
      }

      let url = new URL(catalog.uri);
      if(url.protocol === 'dropbox:') {
        return getDropboxIndex(catalog);
      }
      return undefined;
    }
  };
}(window));

(function(window) {
  class DropboxOperations {
    constructor(catalog) {
      this.dbx = new Dropbox({ accessToken: catalog.token });

      var path = catalog.path ? catalog.path : "";
      if (path && path[0] != "/") {
        path = "/" + path;
      }
      this.path = path;
      this.indexFile = path + '/.rebulas_index';
    }

    getIndexFilePath() {
      return this.indexFile;
    }

    async listAllFiles() {
      let allFiles = [];

      let folders = [this.path];
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
      return new Promise((resolve, reject) => {
        this.dbx.filesUpload({
          path: path,
          contents: blob,
          mute: true,
          mode: {
            '.tag': 'overwrite'
          }
        }).then((entry) => {
          resolve({
            id: entry.path,
            name: entry.name,
            rev: entry.rev,
            content: content
          });
        });
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

    saveIndexContent(index) {
      Util.log('Saving index', this.indexFile);
      let blob = new Blob([JSON.stringify(index)], { type: 'application/json' });
      return this.dbx.filesUpload({
        path: this.indexFile,
        contents: blob,
        mute: true,
        mode: {
          '.tag': 'overwrite'
        }
      });
    }
  }

  window.DropboxOperations = DropboxOperations;
}(window));

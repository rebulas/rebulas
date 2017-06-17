(function(exports) {
  let Util = exports.Util || require('../util/util').Util,
      Dropbox = exports.Dropbox || require('dropbox');

  function createUploadPayload(content) {
    if(typeof Blob != 'undefined') {
      return new Blob([JSON.stringify(content)], { type: 'application/json' });
    } else {
      return content;
    }
  }

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

        let files = { entries: [] };
        try {
          files = await this.dbx.filesListFolder({ path: folder });
        } catch(e) {
          // Thrown if folder is missing
          Util.log(e);
        }

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
      return new Promise((resolve, reject) => {
        this.dbx.filesUpload({
          path: path,
          contents: createUploadPayload(content),
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

    async getEntryContent(entry) {
      let self = this;
      return new Promise((resolve, reject) => {
        self.dbx.filesDownload({ path: entry.path }).then((response) => {
          // Seems to behave differently in node and browser
          if(response.fileBinary) {
            // node - directly the string in fileBinary
            resolve(response.fileBinary);
            return;
          }

          // browser - Blob
          let blob = response.fileBlob;
          let reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsText(blob);
        }, reject);
      });
    }

    saveIndexContent(index) {
      Util.log('Saving index', this.indexFile);
      return this.dbx.filesUpload({
        path: this.indexFile,
        contents: createUploadPayload(JSON.stringify(index)),
        mute: true,
        mode: {
          '.tag': 'overwrite'
        }
      });
    }
  }

  exports.DropboxOperations = DropboxOperations;
}((typeof module != 'undefined' && module.exports) || window));

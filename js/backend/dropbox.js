var Util = require("extra/util");
var Dropbox = require('dropbox'),
    model = require('./model');

function createUploadPayload(content) {
  if(typeof Blob !== 'undefined') {
    return new Blob([content], { type: 'application/json' });
  } else {
    return content;
  }
}

class DropboxOperations extends model.BaseCatalogOperations {
  constructor(catalog) {
    super(catalog);
    this.dbx = new Dropbox({ accessToken: catalog.token });
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
        if(e.error.error_summary.indexOf('path/not_found/') < 0) {
          Util.log(e);
        }
      }

      files.entries.forEach((entry) => {
        if (entry['.tag'] == 'folder') {
          folders.push(entry.path_lower);
        } else {
          allFiles.push({
            path: entry.path_lower,
            name: entry.name,
            rev: entry.rev
          });
        }
      });
    }

    return allFiles;
  }

  saveDocument(path, content) {
    return this.dbx.filesUpload({
      path: path,
      contents: createUploadPayload(content),
      mute: true,
      mode: {
        '.tag': 'overwrite'
      }
    }).then((entry) => new model.CatalogItem(entry.path, content, entry.rev));
  }

  async getEntryContent(entry) {
    let self = this;
    return new Promise((resolve, reject) => {
      self.dbx.filesDownload({ path: entry.path }).then((response) => {
        // Seems to behave differently in node and browser
        if(response.fileBinary !== undefined) {
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
    return this.saveDocument(this.indexFile, JSON.stringify(index))
      .then(() => index);
  }
}

module.exports.DropboxOperations = DropboxOperations;

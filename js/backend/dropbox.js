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

function createDownloadResult(catalogItem, response) {
  // Seems to behave differently in node and browser
  if(response.fileBinary !== undefined) {
    // node - directly the string in fileBinary
    return new model.CatalogItem(catalogItem.id, response.fileBinary, response.rev);
  }

  return new Promise((resolve, reject) => {
    // browser - Blob
    let blob = response.fileBlob;
    let reader = new FileReader();
    reader.onloadend = () => {
      resolve(new model.CatalogItem(catalogItem.id, reader.result, response.rev));
    };
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}

class DropboxOperations extends model.BaseCatalogOperations {
  constructor(catalog) {
    super(catalog);
    this.dbx = new Dropbox({ accessToken: catalog.token });
  }

  async listItems() {
    let allFiles = [];

    try {
      await this.dbx.filesCreateFolder({ path: this.path });
    } catch(e) {
      if(e.status !== 409) {
        Util.error(e);
      } else {
        Util.log('Exists', this.path);
      }
    }

    let folders = [this.path];
    while(folders.length !== 0) {
      let folder = folders[0];
      folders.splice(0, 1);

      let files = { entries: [] };
      try {
        files = await this.dbx.filesListFolder({ path: folder });
      } catch(e) {
		// Part of the regular execution flow, if the folder has been deleted we don't want to return cached content
        if (e.error && e.error.error_summary && e.error.error_summary.indexOf('path/not_found/') < 0) {
          Util.log(e);
        } else {
			// Re-throw, we don't have access or there's an error we can't continue with
			throw e;
		}
      }

      files.entries.forEach((entry) => {
        if (entry['.tag'] == 'folder') {
          folders.push(entry.path_lower);
        } else {
          allFiles.push(new model.CatalogItemEntry(entry.path_lower, entry.rev));
        }
      });
    }

    return allFiles;
  }

  saveItem(catalogItem) {
    return this.dbx.filesUpload({
      path: catalogItem.id,
      contents: createUploadPayload(catalogItem.content),
      mute: true,
      mode: {
        '.tag': 'overwrite'
      }
    }).then((entry) => new model.CatalogItem(catalogItem.id, catalogItem.content, entry.rev));
  }

  async getItem(catalogItem) {
    return this.dbx.filesDownload({ path: catalogItem.id })
      .then(createDownloadResult.bind(null, catalogItem));
  }
}

module.exports.DropboxOperations = DropboxOperations;

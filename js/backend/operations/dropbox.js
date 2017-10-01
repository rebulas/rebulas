var Dropbox = require('dropbox');
var Util = require("extra/util");
var model = require("backend/model");

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

function handleGetError(err) {
  // returns 409 if not found
  if(err.status === 409) {
    return null;
  }
  throw err;
}

class DropboxOperations extends model.BaseCatalogOperations {
  constructor(catalog) {
    super(catalog);
    this.dbx = new Dropbox({ accessToken: catalog.token });
  }

  async listItems(listPath) {
    while (listPath && listPath.charAt(listPath.length - 1) === '/') {
      listPath = listPath.substring(0, listPath.length - 1);
    }

    let folder = listPath || this.path;
    try {
      await this.dbx.filesCreateFolder({ path: folder });
    } catch(e) {
      if(e.status !== 409) {
        Util.error(e);
      } else {
        Util.debug('Exists', folder);
      }
    }

    let files = { entries: [] };
    try {
      files = await this.dbx.filesListFolder({ path: folder });
    } catch(e) {
		  // Part of the regular execution flow, if the folder has been deleted
      // we don't want to return cached content
      if (e.error && e.error.error_summary &&
          e.error.error_summary.indexOf('path/not_found/') < 0) {
        Util.log(e);
      } else {
			  // Re-throw, we don't have access or there's an error we can't continue with
			  throw e;
		  }
    }

    let entries = files.entries.filter(e => e['.tag'] !== 'folder')
        .map(entry => new model.CatalogItemEntry(entry.path_lower, entry.rev));
    return entries;
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
      .then(createDownloadResult.bind(null, catalogItem))
      .catch(handleGetError);
  }

  deleteItem(catalogItem) {
    if(!catalogItem.id.startsWith(this.path)) {
      return Promise.reject(new Error('Cannot delete item with id ' + catalogItem.id));
    }

    return this.dbx.filesDeleteV2({ path: catalogItem.id });
  }
}

module.exports = DropboxOperations;

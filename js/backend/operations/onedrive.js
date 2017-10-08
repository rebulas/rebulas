let Util = require('extra/util'),
    RepositoryController = require('repository/repository-controller'),
    model = require('backend/model'),
    GraphApi = require('@microsoft/microsoft-graph-client');

function toFolderNameAndParent(path) {
  let split = path.split('/');
  if (split.length > 2) {
    return [ split[2], split[1] ];
  } else {
    return [ split[1], null ];
  }
}

class OneDriveOperations extends model.BaseCatalogOperations {
  constructor(catalog) {
    super(catalog);

    this.token = catalog.token;

    this.client = new GraphApi.Client.init({
      debugLogging: false,
      platform: 'web',
      authProvider: (callback) => {
        if(this.token != null) {
          callback(null, this.token);
          return;
        }

        RepositoryController.OneDrive.obtainNewToken((err, newToken) => {
          if(err || !newToken) {
            callback(err, null);
          } else {
            // TODO: Handle failure
            this.token = newToken;
            callback(null, this.token);
          }
        });
      }
    });
  }

  async resubmitIfTokenExpired(apiCall) {
    try {
      return await apiCall();
    } catch(e) {
      if(e.statusCode === 401) {
        Util.log('Token expired, refreshing');
        this.token = null;
        return await apiCall();
      }

      throw e;
    }
  }

  api(path) {
    path = path || '';
    return this.client.api('/drive/special/approot' + path);
  }

  async listItems(listPath) {
    let folder = listPath || this.path;
    return this.resubmitIfTokenExpired(async () => {
      let [ folderName, folderParent ] = toFolderNameAndParent(folder);

      await this.api(`${folderParent ? ':/' + folderParent + ':' : '' }/children`).post({
        name: folderName,
        folder: {}
      });

      let children = { value: [] };
      try {
        while (folder.endsWith('/')) {
          folder = folder.substring(0, folder.length - 1);
        }
        children = await this.api(`:${folder}:/children`).get();
      } catch (e) {
        if(e.statusCode !== 404) {
          throw e;
        }
      }
      let catalogItems = children.value
        .filter(child => !child.folder)
          .map(child => new model.CatalogItemEntry(
            [folder, '/', child.name].join(''), child.eTag
          ));
      return catalogItems;
    });
  }

  saveItem(catalogItem) {
    return this.resubmitIfTokenExpired(async () => {
      return this.api(`:${encodeURIComponent(catalogItem.id)}:/content`)
        .put(catalogItem.content)
        .then(response => {
          let rev = response.eTag;
          return new model.CatalogItem(catalogItem.id, catalogItem.content, rev);
        });
    });
  }

  getItem(catalogItem) {
    return this.resubmitIfTokenExpired(async () => {
      return new Promise((resolve, reject) => {
        let req = this.api(`:${encodeURIComponent(catalogItem.id)}:/content`);

        req.get((err, body, response) => {
          if(err) {
            if(err.statusCode == 404) {
              resolve(undefined);
            } else {
              Util.error(err);
              reject(err);
            }
            return;
          }

          let content = response.text,
              rev = response.headers['etag'];

          resolve(new model.CatalogItem(catalogItem.id, content, rev));
        });
      });
    });
  }

  deleteItem(catalogItem) {
    return this.resubmitIfTokenExpired(
      () => this.api(`:${encodeURIComponent(catalogItem.id)}`).delete()
    );
  }
}

module.exports = OneDriveOperations;

let Util = require('extra/util'),
    RepositoryController = require('repository/repository-controller');
    model = require('backend/model'),
    GraphApi = require('@microsoft/microsoft-graph-client');

class OneDriveOperations extends model.BaseCatalogOperations {
  constructor(catalog) {
    super(catalog);

    this.client = new GraphApi.Client.init({
      debugLogging: false,
      platform: 'web',
      authProvider: (callback) => {
        if(catalog.token != null) {
          callback(null, catalog.token);
          return;
        }

        // Right now this will hang, since it appears to not execute as a result of
        // a user action...
        throw new Error(
          `Right now this will hang, since it appears to not execute as a result of a user action`
        );

        RepositoryController.OneDrive.obtainNewToken(newToken => {
          // TODO: Handle failure
          catalog.token = newToken;
          callback(null, catalog.token);
        });
      }
    });
  }

  api(path) {
    path = path || '';
    return this.client.api('/drive/special/approot' + path);
  }

  async listItems() {
    await this.api(`/children`).post({
      name: this.path.split('/')[1],
      folder: {}
    });

    let children = [];
    try {
      children = await this.api(`:${this.path}:/children`).get();
    } catch(e) {
      Util.error(e);
    }
    let catalogItems = children.value
        .filter(child => !child.folder)
        .map(child => new model.CatalogItemEntry([this.path, '/', child.name].join('')));
    return catalogItems;
  }

  saveItem(catalogItem) {
    return this.api(`:${encodeURIComponent(catalogItem.id)}:/content`)
      .put(catalogItem.content)
      .then(response => {
        let rev = response.eTag;
        return new model.CatalogItem(catalogItem.id, catalogItem.content, rev);
      });
  }

  getItem(catalogItem) {
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
  }

  deleteItem(catalogItem) {
  }
}

module.exports = OneDriveOperations;

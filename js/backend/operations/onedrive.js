let Util = require('extra/util'),
    RepositoryController = require('repository/repository-controller');
    model = require('backend/model'),
    GraphApi = require('@microsoft/microsoft-graph-client');

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

      return Promise.reject(e);
    }
  }

  api(path) {
    path = path || '';
    return this.client.api('/drive/special/approot' + path);
  }

  async listItems() {
    return this.resubmitIfTokenExpired(async () => {
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

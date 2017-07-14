var Util = require("extra/util");
var DropboxOperations = require('backend/operations/dropbox');
var LocalStorageOperations = require("backend/operations/local");
var LocalCacheWrapper = require("backend/wrapper/local-cache-wrapper");
var LocalOnlyWrapper = require("backend/wrapper/local-only-wrapper");
var CatalogSearchIndex = require("backend/search/catalog-search-index");

let indexCache = new Map();
module.exports = {

  commitCatalog: function(catalog) {
    return catalog.searchIndex.sync();
  },

  getIndexBackend: function(catalog) {
    let indexOps;
    if (catalog.uri.startsWith('dropbox.com')) {
      indexOps = new DropboxOperations(catalog);
      Util.log('Loading Dropbox index');
    } else if (catalog.uri.startsWith('localhost')) {
      indexOps = new LocalStorageOperations(catalog);
      Util.log('Loading Localhost index');
    } else if (catalog.uri.startsWith('empty')) {
      indexOps = new LocalCacheWrapper({
        id: 'empty',
        path: 'empty'
      });
      Util.log('Loading empty local index');
    }
    return new LocalCacheWrapper(catalog, indexOps);
  },

  loadIndex: async function(indexOps, catalog) {
    let index = new CatalogSearchIndex(indexOps, catalog);
    catalog.searchIndex = index;
    await index.sync();
    return index;
  },

  getCatalogIndex: async function(catalog) {
    if(indexCache.has(catalog.id)) {
      catalog.searchIndex = indexCache.get(catalog.id);
      Util.log('Found existing search index for catalog ', catalog.id);
    } else {
      let indexOps = this.getIndexBackend(catalog);
      catalog.searchIndex = await this.loadIndex(indexOps, catalog);
    }
    indexCache.set(catalog.id, catalog.searchIndex);
    return catalog.searchIndex;
  },

  purgeCache : function() {
    indexCache.clear();
  }
};

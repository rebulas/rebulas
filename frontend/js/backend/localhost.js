(function(exports) {
	let Util = exports.Util || require('../util/util').Util,
			localforage = exports.localforage || require('./localforage.min');

	class RejectingOperations {
		constructor(catalog) {
			this.catalog = catalog;
			this.indexFile = '/.rebulas_index';
		}
		listAllFiles() {
			return Promise.reject(new Error());
		}
		saveDocument() {
			return Promise.reject(new Error());
		}
		getEntryContent() {
			return Promise.reject(new Error());
		}
	}

	class LocalWrapperOperations {
		constructor(catalog, delegate) {
			this.delegate = delegate;
			this.storageId = "rebulas_local_storage_" + catalog.id;
		}

		toDelegatePath(path) {
			return path.substring(this.storageId.length + 1);
		}

		isLocalPath(path) {
			return path.startsWith(this.storageId + '/');
		}

		toLocalPath(path) {
			return this.storageId + '/' + path;
		}

		getIndexFilePath() {
			return this.delegate.indexFile;
		}

		async listAllFiles() {
			try {
				return await this.delegate.listAllFiles();
			} catch(e) {
				Util.error(e);
			}

			let self = this,
					storagePrefix = this.storageId,
					allKeys = await localforage.keys();

			let localEntries = allKeys.filter((key) => self.isLocalPath(key)).
					map((key) => self.toDelegatePath(key)).
					map((key) => {
						return {
							path: key,
							name: key
						};
					});
			return localEntries;
		}

		saveDocument(path, content) {
			let self = this;
			function saveLocal() {
				localforage.setItem(self.toLocalPath(path), content);
			}
			// TODO: If fail, mark as locally dirty
			return this.delegate.saveDocument(path, content).then(saveLocal, saveLocal);
		}

		getEntryContent(entry) {
			let self = this;
			return new Promise((resolve, reject) => {
				self.delegate.getEntryContent(entry).then((content) => {
					localforage.setItem(self.toLocalPath(entry.path), content);
					resolve(content);
				}, (err) => {
					debugger;
					Util.error(err);
					localforage.getItem(self.toLocalPath(entry.path)).then(resolve, reject);
				});
			});
		}

		saveIndexContent(index) {
			Util.log('Saving index', this.delegate.indexFile);
			return this.saveDocument(this.delegate.indexFile, JSON.stringify(index));
		}
	}

	class LocalhostOperations {
		constructor(catalog) {
			var path = catalog.path ? catalog.path : "";
			if (path && path[0] != "/") {
				path = "/" + path;
			}
			this.path = path;
			this.indexFile = path + '/.rebulas_index';
			this.storageId = "rebulas_localhost_storage_" + catalog.id;

			var list = localStorage.getItem(this.storageId);
			if (!list) {
				list = {
					"/improved-authentication-merchanism.md" : "# Name\nImproved Authentication mechanism\n\n# Description\nIn our cloud we require multiple logins while we could centralise the auth via LDAP across all login channels\n\n# Clients\nWaitrose, Cloud Team\n\n## Releases\nFAS 8.3",

					"/publishing-ui-imporovements.md" : "# Name\nPublishing UI improvements\n\n# Description\nThe UI for the punlishing went from not-granular at all to too granular all too quickly. We need improvements that allow for less input when publishing (auto-fill publish names) and ability to publish all - relevant for smaller customers that don't have large teams to collaborate.\n\n# Clients\nScrewfix, Hema, Intergramma\n\n# Releases\nFAS 8.3\n\n# People\nVincent, Tim, Kees"
				};
				localStorage.setItem(this.storageId, JSON.stringify(list));
			}
		}

		getIndexFilePath() {
			return this.indexFile;
		}

		async listAllFiles() {
			var list = JSON.parse(localStorage.getItem(this.storageId));
			let allFiles = [];

			for (var path in list) {
				allFiles.push({
					"path" : path,
					"name" : path
				});
			}

			return allFiles;
		}

		saveDocument(path, content) {
			var list = JSON.parse(localStorage.getItem(this.storageId));
			list[path] = content;

			return new Promise((resolve, reject) => {
				localStorage.setItem(this.storageId, JSON.stringify(list));
				resolve({
					"id": path,
					"name": path,
					"content": content
				});
			});
		}

		getEntryContent(entry) {
			var list = JSON.parse(localStorage.getItem(this.storageId));
			let self = this;
			return new Promise((resolve, reject) => {
				resolve(list[entry.path]);
			});
		}

		saveIndexContent(index) {
			Util.log('Saving index', this.indexFile);
			return this.saveDocument(this.indexFile, JSON.stringify(index));
		}
	}

	exports.RejectingOperations = RejectingOperations;
	exports.LocalhostOperations = LocalhostOperations;
	exports.LocalWrapperOperations = LocalWrapperOperations;
}((typeof module != 'undefined' && module.exports) || window));

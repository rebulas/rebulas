class LocalforageMock {
  constructor() {
    this.store = new Map();
  }

  keys() {
    let arr = [];
    this.store.forEach((value, key) => {
      arr.push(key);
    });
    return Promise.resolve(arr);
  }

  setItem(key, content) {
    this.store.set(key, content);
    return Promise.resolve(content);
  }

  getItem(key) {
    return Promise.resolve(this.store.get(key));
  }

  removeItem(key) {
    return Promise.resolve(this.store.delete(key));
  }
}

let cache = new Map();
module.exports = {
  clear: () => cache = new Map(),
  createInstance: (opts) => {
    if(!cache.has(opts.name))
      cache.set(opts.name, new LocalforageMock());
    return cache.get(opts.name);
  }
};

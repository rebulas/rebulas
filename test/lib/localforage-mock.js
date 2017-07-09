class LocalforageMock {
  constructor() {
    this.store = new Map();
  }

  createInstance() {
    return this;
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

  clear() {
    this.store = new Map();
  }
}

module.exports = new LocalforageMock();

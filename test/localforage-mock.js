class LocalforageMock {
  constructor() {
    this.store = new Map();
  }

  keys() {
    let arr = [];
    for(let k in this.store.keys()) {
      arr.push(k);
    }
    return arr;
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

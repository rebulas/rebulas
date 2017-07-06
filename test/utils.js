let Util = require('extra/util');

module.exports.promiseQueue = async (test) => {
  let q = new Util.PromiseQueue();
  let results = [];

  function delayedPromise(val, delay) {
    return new Promise((resolve, reject) => {
      setTimeout(() => resolve(val), delay);
    });
  }

  await Promise.all([
    q.exec(() => Promise.resolve(1), 100).then((r) => results.push(r)),
    q.exec(() => Promise.resolve(2), 5).then((r) => results.push(r)),
    q.exec(() => Promise.resolve(3), 10).then((r) => results.push(r)),
  ]);

  test.deepEqual(results, [1, 2, 3]);

  test.done();
};

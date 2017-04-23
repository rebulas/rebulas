let ReverseIndex = require('./index').ReverseIndex;
let someTokens = [ '1', '2', '3', '4', '5', '6' ];
let someDoc = {
  fields: {
    field1: someTokens.slice(0, 3),
    field2: someTokens.slice(3, 6)
  }
};

let someDoc2 = {

};

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function compareMaps(map1, map2, test) {
  test.equal(map1.size, map2.size);
  for (let [key, val] of map1) {
    let val2 = map2.get(key);
    if (test.deepEqual(val, val2)) {
      test.ok(val2 === undefined && !map2.has(key));
    }
  }
}

exports.testAdd1 = function(test) {
  let index = new ReverseIndex(),
      document = clone(someDoc),
      docId = 1;

  index.add(document);

  test.equal(document.id, docId);

  test.ok(index.postings.has('field1'));
  test.ok(index.postings.has('field2'));

  compareMaps(index.postings.get('field1'), new Map([
    ['1', [ docId ]],
    ['2', [ docId ]],
    ['3', [ docId ]],
  ]), test);

  compareMaps(index.postings.get('field2'), new Map([
    ['4', [ docId ]],
    ['5', [ docId ]],
    ['6', [ docId ]],
  ]), test);

  test.done();
};

exports.testRemove1 = function(test) {
  let index = new ReverseIndex(),
      document = clone(someDoc);

  index.add(document);

  index.remove(document);

  test.ok(!index.postings.has('field1'));
  test.ok(!index.postings.has('field2'));

  test.done();
};

exports.testQueryOr = function(test) {
  let index = new ReverseIndex(),
      document = clone(someDoc),
      query = clone(document);

  index.add(document);

  query.type = 'or';
  let result = index.query(query);
  test.equal(result.length, 1);
  test.deepEqual(result[0], document);

  test.done();
};

exports.testQueryAnd = function(test) {
  let index = new ReverseIndex(),
      document = clone(someDoc),
      query = clone(document);

  index.add(document);

  query.type = 'and';
  let result = index.query(query);
  test.equal(result.length, 1);
  test.deepEqual(result[0], document);

  test.done();
};

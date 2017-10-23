var model = require('backend/model');

module.exports = {

  testIdGeneration : function(test) {
    let item = {
      rawContent : '# Name\nDummy Item\n\n# Content\n Some content'
    };

    var id = model.generateItemId(item, {"path" : "default"}, () => "21");
    test.equal("/default/dummy-item-21.md", id);

    item = {
      rawContent : '# Name\nПримерен запис\n\n# Content\n Some content'
    };
    id = model.generateItemId(item, {"path" : "default"}, () => "21");
    test.equal("/default/primeren-zapis-21.md", id);

    // No more than 100 chars
    item = {
      rawContent : '# Name\nThe quick brown fox jumps over the lazy dog the quick brown fox jumps over the lazy dog the quick brown fox jumps over the lazy dog the quick brown fox jumps over the lazy dog\n\n# Content\n Some content'
    };
    id = model.generateItemId(item, {"path" : "default"}, () => "21");
    test.equal("/default/the-quick-brown-fox-jumps-over-the-lazy-dog-the-quick-brown-fox-jumps-over-the-lazy-dog-the-quick-br-21.md", id);

    test.done();
  }
};

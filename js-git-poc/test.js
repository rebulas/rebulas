var async = require('async'),
  repo = {
    rootPath: '/home/ivo/js-git/.git'
  };

// Requires an existing repo with an initial commit...
var githubName = 'ivanzamanov/jsgithub-playground';

var token = '';
require('js-git/mixins/fs-db')(repo);
require('jsgithub/mixins/github-db')(repo, githubName, token);
require('js-git/mixins/create-tree')(repo);

var run = require('gen-run');
run(function* () {
  var headHash = yield repo.readRef("refs/heads/master");
  var commit = yield repo.loadAs("commit", headHash);
  var tree = yield repo.loadAs("tree", commit.tree);
  var entry = tree["README.md"];
  var readme = yield repo.loadAs("text", entry.hash);
 
  var updates = [
    {
      path: 'README.md',
      mode: entry.mode,
      content: Buffer.from('readme', 'utf8')
    }
  ];
  var treeHash = yield repo.createTree(updates);
  var date = new Date();
  var author = {
    name: "Ivan Zamanov",
    email: "ivo.zamanov@gmail.com",
    date: {
      seconds: Math.floor(date.getTime() / 1000),
      offset: date.getTimezoneOffset()
    }
  };
  var commitHash = yield repo.saveAs("commit", {
    tree: treeHash,
    author: author,
    committer: author,
    parents: [ headHash ],
    message: "js-github test"
  });
  yield repo.updateRef("refs/heads/master", commitHash);
});

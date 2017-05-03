(function() {
  // Useful link for jsgit: https://github.com/LivelyKernel/js-git-browser
  function createRepo(githubName, githubToken) {
    var repo = {};
    jsgit.mixins.memDb(repo);
    jsgit.mixins.github(repo, githubName, githubToken);
    jsgit.mixins.createTree(repo);
    jsgit.mixins.packOps(repo);
    jsgit.mixins.walkers(repo);
    jsgit.mixins.readCombiner(repo);
    jsgit.mixins.formats(repo);
    return jsgit.promisify(repo);
  }

  window.RebulasBackend = {
    createIndex: async function (githubName, githubToken) {
      let repo = new RebulasBackend.DataRepo(githubName, githubToken);
      await repo.clone();

      let objects = await repo.readObjects(),
          index = new elasticlunr.Index();

      index.addField('path');
      index.addField('content');

      objects.forEach((object, id) => {
        index.addDoc({
          path: object.path,
          content: object.content,
          id: id
        });
      });
      return index;
    },
    DataRepo: class {
      constructor(githubName, githubToken) {
        this.githubName = githubName;
        this.githubToken = githubToken;
      }

      async clone() {
        this.repo = createRepo(this.githubName, this.githubToken);
      }

      async readObjects() {
        let repo = this.repo,
            headHash = await repo.readRef('refs/heads/master'),
            reader = await repo.treeWalk(headHash),
            objects = [],
            obj;

        while (obj = await reader.read()) {
          if (obj.mode !== jsgit.modes.file) {
            continue;
          }

          let content = await repo.loadAs('text', obj.hash);
          obj.content = content;
          objects.push(obj);
        }

        return objects;
      }
    }
  };
}());

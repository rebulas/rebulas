var Git = require("nodegit");
var promisify = require("promisify-node");
var fs = require('fs-extra');
var path = require("path");
var crypto = require('crypto');

var fse = promisify(require("fs-extra"));
fse.ensureDir = promisify(fse.ensureDir);

/*
https://github.com/nodegit/nodegit/issues/341
http://stackoverflow.com/questions/23870374/nodegit-how-to-modify-a-file-and-push-the-changes
*/

exports.list = function(repositoryDescriptor) {
	var localPath = crypto.createHash('md5')
						.update(repositoryDescriptor.url)
						.update(repositoryDescriptor.username)
						.update(repositoryDescriptor.password)
						.digest('hex');

	var repository = repositoryDescriptor.url;

	return exists(localPath).then(function(exists) {
		return exists ? Git.Repository.open(localPath) : Git.Clone(repository, localPath);
	}).then(function(repo) {
		return repo.getMasterCommit();
	}).then(function(head) {
		return head.getTree();
	}).then(function(tree) {
		return new Promise(function(resolve, reject) {
			var entries = [];

			var walker = tree.walk();
			walker.on("entry", function(entry) {
				entries.push(entry.path());
			});
			walker.on("end", function() {
				resolve(entries);
			});

			walker.start();
		})
	});
}

exports.get = function(repositoryDescriptor, entry) {
	var localPath = crypto.createHash('md5')
						.update(repositoryDescriptor.url)
						.update(repositoryDescriptor.username)
						.update(repositoryDescriptor.password)
						.digest('hex');

	var repository = repositoryDescriptor.url;

	return exists(localPath).then(function(exists) {
		return exists ? Git.Repository.open(localPath) : Git.Clone(repository, localPath);
	}).then(function(repo) {
		return repo.getMasterCommit();
	}).then(function(head) {
		return head.getEntry(entry);
	}).then(function(e) {
		return e.getBlob();
	}).then(function(data) {
		return data.toString();
	});
}

exports.put = function(repositoryDescriptor, fileName, data) {
	var localPath = crypto.createHash('md5')
						.update(repositoryDescriptor.url)
						.update(repositoryDescriptor.username)
						.update(repositoryDescriptor.password)
						.digest('hex');

	var repository = repositoryDescriptor.url;

	var repo;

	return exists(localPath).then(function(exists) {
		return exists ? Git.Repository.open(localPath) : Git.Clone(repository, localPath);
	}).then(function(r) {
		repo = r;
		return fse.writeFile(path.join(repo.workdir(), fileName), data);
	}).then(function() {
		 return repo.openIndex();
	})
	.then(function(indexResult) {
		index = indexResult;
		return index.read(1);
	})
	.then(function() {
		return index.addByPath(fileName);
	})
	.then(function() {
		return index.write();
	})
	.then(function() {
		return index.writeTree();
	})
	.then(function(oidResult) {
		oid = oidResult;
		return Git.Reference.nameToId(repo, "HEAD");
	})
	.then(function(head) {
		return repo.getCommit(head);
	})
	.then(function(parent) {
		var author = Git.Signature.now("Pavel Penchev", "pavel.penchev@gmail.com");
		return repo.createCommit("HEAD", author, author, "System commit", oid, [parent]);
	});	
}

exports.remove = function(repositoryDescriptor, fileName) {
	var localPath = crypto.createHash('md5')
						.update(repositoryDescriptor.url)
						.update(repositoryDescriptor.username)
						.update(repositoryDescriptor.password)
						.digest('hex');

	var repository = repositoryDescriptor.url;

	var repo;

	return exists(localPath).then(function(exists) {
		return exists ? Git.Repository.open(localPath) : Git.Clone(repository, localPath);
	}).then(function(r) {
		repo = r;
		return fse.remove(path.join(repo.workdir(), fileName));
	}).then(function() {
		 return repo.openIndex();
	})
	.then(function(indexResult) {
		index = indexResult;
		return index.read(1);
	})
	.then(function() {
		return index.removeByPath(fileName);
	})
	.then(function() {
		return index.write();
	})
	.then(function() {
		return index.writeTree();
	})
	.then(function(oidResult) {
		oid = oidResult;
		return Git.Reference.nameToId(repo, "HEAD");
	})
	.then(function(head) {
		return repo.getCommit(head);
	})
	.then(function(parent) {
		var author = Git.Signature.now("Pavel Penchev", "pavel.penchev@gmail.com");
		return repo.createCommit("HEAD", author, author, "System commit", oid, [parent]);
	});
}

exports.push = push;
function push(rp) {
	var localPath = crypto.createHash('md5')
						.update(rp.url)
						.update(rp.username)
						.update(rp.password)
						.digest('hex');

	return Git.Repository.open(localPath).then(function(repo) {
		return repo.getRemote("origin");
	}).then(function(remote) {

		var opts = {
			"callbacks" : {
				"credentials" : function(url, userName) {
					//return Git.Cred.sshKeyFromAgent(userName);
					return Git.Cred.userpassPlaintextNew(rp.username, rp.password);
				}
			}
		};

		return remote.push(["refs/heads/master:refs/heads/master"], opts);		
	}).done(function(res) {
		console.log("Remote pushed for local path " + localPath);
	})
}


function exists(dir) {
	return new Promise(function(resolve, reject) {
		fs.exists(dir, function(exist) {
			resolve(exist);
		});
	})
}

var GitKit = require('gitkit'),
    NativeFS = require('gitkit/lib/fs/native'),
    MemoryFS = require('gitkit/lib/fs/memory');

var repoPath = '/';
var transport = new GitKit.HTTPTransport('https://github.com/ivanzamanov/jsgithub-playground.git'),
    repoFs = new NativeFS('/home/ivo/tmp'),
    repo = GitKit.Repository.createWithFS(repoFs);

async function doWork() {
    try {
        await GitKit.RepoUtils.init(repo);
        console.log(await repoFs.readDir(repoPath));
        await GitKit.TransferUtils.clone(repo, transport);
        onCloned();
    } catch(err) {
        try {
            console.log(await repoFs.readDir(repoPath));
        } catch(err2) {
            console.log(err2);
        }
        console.log('Clone failed');
        console.log(err);
    }
}

async function onCloned() {
    try {
        console.log(await repoFs.readDir(repoPath));
    } catch(err) {
        console.log(err);
    }
    console.log('Cloned');
}

doWork();

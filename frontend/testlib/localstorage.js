let LocalStorage = require('node-localstorage').LocalStorage,
    fs = require('fs');

function deleteFolderRecursive(path) {
  if(fs.existsSync(path)) {
    fs.readdirSync(path).forEach((file, index) => {
      let curPath = path + "/" + file;
      if(fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

let tempDir = fs.mkdtempSync('rebulas-test');
module.exports.LocalStorage = new LocalStorage(tempDir);
module.exports.setUp = () => {
  console.log('Set up localStorage in', tempDir);
};
module.exports.tearDown = () => {
  console.log('Tear down localStorage in', tempDir);
  fs.rmdirSync(tempDir);
};

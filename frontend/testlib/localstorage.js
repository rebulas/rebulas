let LocalStorage = require('node-localstorage').LocalStorage,
    fs = require('fs');

let tempDir = fs.mkdtempSync('testdata-');
module.exports.LocalStorage = new LocalStorage(tempDir);
module.exports.setUp = () => {
  console.log('Set up localStorage in', tempDir);
  try {
    fs.mkdirSync(tempDir);
  } catch(e) {}
};
module.exports.tearDown = () => {
  console.log('Tear down localStorage in', tempDir);
  fs.rmdirSync(tempDir);
};

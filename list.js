var client = require("client/github-client.js");

var rp = {
	"username" : "pavelpenchev",
	"password" : "",
	"url" : "https://github.com/pavelpenchev/hadoop-collector.wiki.git" 
}

client.list(rp).then(function(ideas) {
	console.log(JSON.stringify(ideas, null, 4));

	return ideas[0];
}).then(function(entry) {
	return client.get(rp, entry);
}).then(function(data) {
	console.log(data);
}).then(function() {
	return client.put(rp, "Test.md", "This is a test file");
//}).then(function() {
//	return client.remove(rp, "Test.md");
})
.catch(function(e) {
	console.log("AAA");
	console.log(JSON.stringify(e));
});

var http = require('http');
var url = require('url');
var fs = require('fs');

http.createServer(function(req, res) {
	var u = url.parse(req.url, true);

	var filePath = u.pathname != "/" ? u.pathname.substring(1) : "index.html";

	fs.exists(filePath, function(exists) {
		if (exists) {
			fs.readFile(filePath, function(error, content) {
				if (error) {
					console.log("[ERROR] Reading file %s failed, error %s", filePath, error);
					res.writeHead(500);
					res.end();
				} else {
					if (endsWith(filePath, ".html")) {
						res.writeHead(200, {'Content-Type' : 'text/html'});
					} else if (endsWith(filePath, ".css")) {
						res.writeHead(200, {'Content-Type' : 'text/css'});
					} else if (endsWith(filePath, ".js")) {
						res.writeHead(200, {'Content-Type' : 'text/javascript'});
					} else {
						res.writeHead(200, {'Content-Type' : 'text/plain'});
					}
					res.end(content, 'utf-8');
				}
			});
		} else {
			res.writeHead(404);
			res.end();
		}
	});

}).listen(8080, '0.0.0.0');
console.log("[INFO] Rebulas running at http://0.0.0.0:8080/");

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

const rebulasDropboxClientID = "f0l5xgrg354cgs0";

// Register on-going OAuth sessions for mapping to OAuth callbacks
window.OAuthSessions = [];
window.OAuthCallback = function(args) {
	var state = args.state;

	if (window.OAuthSessions[state]) {
		var callback = window.OAuthSessions[state];
		callback(args);
	}
}

var RepositoryController = {

	"initDropboxOAuth" : function(successCallback) {
		// Both URLs must be registered with the Dropbox app referenced by the rebulasDropboxClientID
		var redirectUri = window.location.hostname == "localhost"
							? "http://localhost:8080/oauth/dropbox.html"
							: "https://rebulas.com/app/oauth/dropbox.html";


		var oauthUrl = "https://www.dropbox.com/1/oauth2/authorize?client_id=" + rebulasDropboxClientID;
		var oauthHash = Util.hash(oauthUrl);
		var csrf = Util.uniqueId();

		oauthUrl += "&response_type=token&redirect_uri=" + redirectUri + "&state=" + csrf;

		window.OAuthSessions[csrf] = function(oauthArgs) {
			// Compose the id to allow linking multiple dropbox account
			var repositoryId = Util.hash(oauthHash + oauthArgs.uid);

			var repository = Repositories.add(repositoryId, oauthArgs.origin, oauthArgs.token);
			successCallback(repository);
		};

		window.open(oauthUrl, "OAuth");
	}
}

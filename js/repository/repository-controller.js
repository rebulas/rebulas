const rebulasDropboxClientID = "ot4wauixsfog5px";
const rebulasOneDriveClientID = '27e0658f-8cc1-4bf7-8e28-1850190246e5';

// Register on-going OAuth sessions for mapping to OAuth callbacks
window.OAuthSessions = [];
window.OAuthCallback = function(args) {
	var state = args.state;

	if (window.OAuthSessions[state]) {
		var callback = window.OAuthSessions[state];
		callback(args);
	}
}

var Util = require("extra/util");
var Repositories = require("repository/repository-manager").Repositories;

module.exports = {

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
	},

  "initOneDriveOAuth" : function (successCallback) {
		let redirectUri = window.location.hostname == "localhost"
				? "http://localhost:8080/oauth/oauth.html"
				: "https://rebulas.com/app/oauth/oauth.html";
    let loginId = Util.uniqueId();
    redirectUri = redirectUri + '?api_type=onedrive&state=' + loginId;

    window.OAuthSessions[loginId] = function(oauthArgs) {
			var repositoryId = Util.hash(JSON.stringify(oauthArgs));
			var repository = Repositories.add(repositoryId, 'onedrive', oauthArgs.code);
      successCallback(repository);
    };

    let oauthUrl = [
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?',
      '?client_id=', rebulasOneDriveClientID,
      '&scope=files.read',
      '&response_type=code',
      '&redirect_uri=', encodeURIComponent(redirectUri)
    ].join('');

    window.open(oauthUrl, "OAuth");
  }
}

let Elements = require("ui/elements"),
    window = require('../extra/window');

const rebulasDropboxClientID = "ot4wauixsfog5px";
const rebulasOneDriveClientID = '27e0658f-8cc1-4bf7-8e28-1850190246e5';

class LoginDialog {
  static prompt(confirm, reject) {
    let dialog = $("#oauthLoginPopup");

    let loginButton = $('#oauthLoginButton');
    let confirmed = false;

    let loginClick = () => {
      confirmed = true;
      dialog.modal('hide');
      confirm();
    };
    loginButton.on('click', loginClick);

    dialog.on('hide.bs.modal', () => {
      loginButton.unbind('click', loginClick);

      if(!confirmed && reject) {
        reject();
      }
    });

    dialog.modal('show');
  }
}

class OneDrive {
  static get client_id() {
    return rebulasOneDriveClientID;
  }

  static get redirect_uri() {
    return window.location.hostname == "localhost"
      ? "http://localhost:8080/oauth/oauth.html"
      : "https://rebulas.com/app/oauth/oauth.html";
  }

  static createRepository(callback) {
    OneDrive.obtainNewToken(access_token => {
      var repositoryId = Util.hash(OneDrive.client_id);
      var repository = Repositories.add(repositoryId, 'onedrive', access_token);
      callback(repository);
    });
  }

  static obtainNewToken(callback) {
    let loginId = Util.uniqueId();
    let redirectUri = OneDrive.redirect_uri + '?state=' + loginId;

    window.OAuthSessions[loginId] = oauthArgs => {
      delete window.OAuthSessions[loginId];
      callback(null, oauthArgs.access_token);
    };

    let oauthUrl = [
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?',
      '?client_id=', OneDrive.client_id,
      '&scope=files.readwrite',
      '&response_type=token',
      '&redirect_uri=', encodeURIComponent(redirectUri)
    ].join('');

    LoginDialog.prompt(() => {
      window.open(oauthUrl, "OAuth");
    }, () => callback(new Error('Login dismissed')));
    //window.open(oauthUrl, "OAuth");
  }
}

// Register on-going OAuth sessions for mapping to OAuth callbacks
window.OAuthSessions = [];
window.OAuthCallback = function(args) {
  var state = args.state;

  if (window.OAuthSessions[state]) {
    var callback = window.OAuthSessions[state];
    callback(args);
  }
};

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

  OneDrive: OneDrive
};

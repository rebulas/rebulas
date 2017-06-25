module.exports = {

  AuthRequests: class AuthRequests {
    constructor(user, pass) {
      this.user = user;
      this.pass = pass;
    }
    get(url) {
      let method = 'GET', self = this;
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.setRequestHeader("Authorization", "Basic " + btoa(self.user + ":" + self.pass));
        xhr.onload = resolve;
        xhr.onerror = reject;
        xhr.send();
      });
    }
  },

  parseQueryString : function(q) {
	  var string = q || window.location.search.substring(1);

	  var queryString = {};
    string.replace(
      new RegExp("([^?=&]+)(=([^&]*))?", "g"),
      function($0, $1, $2, $3) { queryString[$1] = $3; }
    );

    return queryString;
  },

  queryObjectToString : function(obj) {
	  var result = [];
	  for (var a in obj) {
		  result.push(a + "=" + obj[a]);
	  }
	  return result.join("&");
  },

  uniqueId : function() {
	  var newDate = new Date;
	  var partOne = newDate.getTime();
	  var partTwo = 1 + Math.floor((Math.random() * 32767));
	  var id = partOne + "" + partTwo;
	  return id;
  },

  isArray : function(obj) {
	  return typeof (obj) == 'object' && (obj instanceof Array);
  },

  isFunction : function(arg) {
	  return typeof(arg) == 'function';
  },

  arrayRemove : function(array, from, to) {
	  var rest = array.slice((to || from) + 1 || array.length);
	  array.length = from < 0 ? array.length + from : from;
	  return array.push.apply(array, rest);
  },

  formatNumber : function(sum) {
	  var decimals = 0;
	  var decimal_sep = ".";
	  var thousands_sep = ",";

	  var n = sum,
	      c = isNaN(decimals) ? 2 : Math.abs(decimals), //if decimal is zero we must take it, it means user does not want to show any decimal
	      d = decimal_sep || ',', //if no decimal separetor is passed we use the comma as default decimal separator (we MUST use a decimal separator)

	      /*
	        according to [http://stackoverflow.com/questions/411352/how-best-to-determine-if-an-argument-is-not-sent-to-the-javascript-function]
	        the fastest way to check for not defined parameter is to use typeof value === 'undefined'
	        rather than doing value === undefined.
	      */
	      t = (typeof thousands_sep === 'undefined') ? '.' : thousands_sep, //if you don't want ot use a thousands separator you can pass empty string as thousands_sep value

	      sign = (n < 0) ? '-' : '',

	      //extracting the absolute value of the integer part of the number and converting to string
	      i = parseInt(n = Math.abs(n).toFixed(c)) + '',

	      j = ((j = i.length) > 3) ? j % 3 : 0;
	  return sign + (j ? i.substr(0, j) + t : '') + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) : '');
  },

  endsWith : function(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
  },

  escapeHtml : function (str) {
	  var div = document.createElement('div');
	  div.appendChild(document.createTextNode(str));
	  return div.innerHTML;
  },

  unescapeHtml : function (escapedStr) {
	  var div = document.createElement('div');
	  div.innerHTML = escapedStr;
	  var child = div.childNodes[0];
	  return child ? child.nodeValue : '';
  },

  unescapeHtmlText : function (escapedStr) {
	  var html = this.unescapeHtml(escapedStr);
	  return html.replace(/<(?:.|\n)*?>/gm, '');
  },

  promptDownload : function(data, type, name) {
	  var url = "data:" + type + "," + encodeURIComponent(data);
	  var anchor = document.createElement("a");
	  anchor.setAttribute("href", url);
	  anchor.setAttribute("download", name);

	  var event = new MouseEvent('click', {
		  "view" : window,
		  "bubbles" : true,
		  "cancelable" : true
	  });

	  anchor.dispatchEvent(event);
  },

  hash : function(str) {
    var hash = 0, i, chr;
    if (str.length === 0) return hash;
    for (i = 0; i < str.length; i++) {
      chr   = str.charCodeAt(i);
      hash  = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  },

  log: console.log,
  error: console.error
};

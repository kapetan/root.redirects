var crypto = require('crypto');
var querystring = require('querystring');

var noop = function() {};
var REDIRECT_CODES = {
	movedpermanently: 301,
	found: 302,
	seeother: 303,
	temporaryredirect: 307,
	permanentredirect: 308
};

module.exports = function(app) {
	app.use('response.redirect', function(url, options) {
		if(!options && typeof url === 'object') {
			var opt = url;

			url = opt.path || opt.url;
			options = opt;
		}

		options = options || {};

		options.status = options.status || REDIRECT_CODES.found;

		if(typeof options.status === 'string') {
			options.status = REDIRECT_CODES[options.status.toLowerCase()];
		}

		if(options.query) {
			url += '?' + querystring.stringify(options.query);
		}
		if(!/^http(s)?:/.test(url)) {
			var https = !!this.request.connection.encrypted;
			var protocol = https ? 'https' : 'http';

			url = /^\//.test(url) ? url : '/' + url;
			url = protocol + '://' + this.request.headers.host + url;
		}

		this.statusCode = options.status;
		this.setHeader('Location', url);
		this.end();
	});

	app.use('request.stale', function(options, fn) {
		if(typeof options !== 'object') {
			var etag = options;
			options = { etag: etag }
		}

		var etag = options.etag;
		var lastModified = options.lastModified;

		var request = this;
		var response = this.response;

		if(etag) {
			var sha1 = crypto.createHash('sha1');
			etag = sha1.update(etag.toString()).digest('hex');
		}
		if(lastModified) {
			lastModified = lastModified instanceof Date ? lastModified.toUTCString() : lastModified.toString();
		}

		var isStale = (etag && (etag !== (request.headers['if-none-match'] || '').replace(/(^")|("$)/g, ''))) ||
			(lastModified && (lastModified !== request.headers['if-modified-since']));

		if(etag) response.setHeader('ETag', '"' + etag + '"');
		if(lastModified) {
			response.setHeader('Last-Modified', lastModified);
			if(!response.getHeader('Date')) response.setHeader('Date', (new Date()).toUTCString());
		}

		if(!isStale) {
			response.statusCode = 304;
			response.end();
		} else {
			(fn || noop)();
		}

		return isStale;
	});
};

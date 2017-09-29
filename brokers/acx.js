const got    = require('got');
const crypto = require('crypto');
const qs     = require('qs');

// Public/Private method names
const methods = {
	public  : [ 'tickers' ],
	private : [ ],
};

const pairs = {
	BTCUSD: "btcusd",
	BTCAUD: "btcaud",
};

// https://acx.io/api/v2/tickers/btcusd.json
// Default options
const defaults = {
	url     : 'https://acx.io/api',
	version : 2,
	timeout : 5000,
};

const name = "ACS";

// Create a signature for a request
const getMessageSignature = (path, request, secret, nonce) => {
	const message       = qs.stringify(request);
	const secret_buffer = new Buffer(secret, 'base64');
	const hash          = new crypto.createHash('sha256');
	const hmac          = new crypto.createHmac('sha512', secret_buffer);
	const hash_digest   = hash.update(nonce + message).digest('binary');
	const hmac_digest   = hmac.update(path + hash_digest, 'binary').digest('base64');

	return hmac_digest;
};

// Send an API request
const rawRequest = async (url, method, headers, data, timeout) => {
	// Set custom User-Agent string
	headers['User-Agent'] = 'ACX Javascript API Client';

	const options = { headers, timeout };

	Object.assign(options, {
		method : method || 'POST',
		body   : qs.stringify(data),
	});

	const { body } = await got(url, options);
	const response = JSON.parse(body);

	if(response.error && response.error.length) {
		const error = response.error
			.filter((e) => e.startsWith('E'))
			.map((e) => e.substr(1));

		if(!error.length) {
			throw new Error("ACX API returned an unknown error");
		}

		throw new Error(error.join(', '));
	}

	return response;
};

class ACX {
	constructor(key, secret, options) {
		// Allow passing the OTP as the third argument for backwards compatibility
		if(typeof options === 'string') {
			options = { otp : options };
		}

		this.config = Object.assign({ key, secret }, defaults, options);
	}

	getTickerValue(pair, callback) {

		var promise = this.api('tickers', { pair : pair }, callback);
		var promise2 = promise
			.then((result) => {
				var r = {value: result.ticker.last, volume: result.ticker.vol, time: new Date(result.at*1000)};
				return r;
			})
			.catch((error) => {return error});

		return promise2;
	}

	api(method, params, callback) {
		// Default params to empty object
		if(typeof params === 'function') {
			callback = params;
			params   = {};
		}

		if(methods.public.includes(method)) {
			return this.publicMethod(method, params, callback);
		}
		else if(methods.private.includes(method)) {
			return this.privateMethod(method, params, callback);
		}
		else {
			throw new Error(method + ' is not a valid API method.');
		}
	}

	publicMethod(method, params, callback) {
		params = params || {};

		// Default params to empty object
		if(typeof params === 'function') {
			callback = params;
			params   = {};
		}

		var path     = '/v' + this.config.version + '/' + method;
		path += (params.pair != undefined ? "/"+pairs[params.pair]+".json" : "")
		const url      = this.config.url + path;
		const response = rawRequest(url, 'GET', {}, params, this.config.timeout);

		if(typeof callback === 'function') {
			response
				.then((result) => callback(null, result))
				.catch((error) => callback(error, null));
		}
		return response;
	}

	privateMethod(method, params, callback) {
		params = params || {};

		// Default params to empty object
		if(typeof params === 'function') {
			callback = params;
			params   = {};
		}

		const path = '/' + this.config.version + '/private/' + method;
		const url  = this.config.url + path;

		if(!params.nonce) {
			params.nonce = new Date() * 1000; // spoof microsecond
		}

		if(this.config.otp !== undefined) {
			params.otp = this.config.otp;
		}

		const signature = getMessageSignature(
			path,
			params,
			this.config.secret,
			params.nonce
		);

		const headers = {
			'API-Key'  : this.config.key,
			'API-Sign' : signature,
		};

		const response = rawRequest(url, 'POST', headers, params, this.config.timeout);

		if(typeof callback === 'function') {
			response
				.then((result) => callback(null, result))
				.catch((error) => callback(error, null));
		}

		return response;
	}
}

module.exports = ACX;

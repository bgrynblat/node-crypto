const got    = require('got');
const crypto = require('crypto');
const qs     = require('qs');

// Public/Private method names
const methods = {
	public  : [ 'pubticker' ],
	private : [ ],
};

const pairs = {
	ETHBTC: "BTC-ETH",
	LTCBTC: "BTC-LTC",
	XMRBTC: "BTC-XMR",
	ZECBTC: "BTC-ZEC",
	NEOBTC: "BTC-NEO",
	DASHBTC: "BTC-DASH",
	ETCBTC: "BTC-ETC",
	BCHBTC: "BTC-BCC",
	OMGBTC: "BTC-OMG",
};

const withdraw_fees = {
	LTC: 0.001,
	BTC: 0.0005,
	ETH: 0.01
};

// Default options
const defaults = {
	url     : 'https://bittrex.com/api',
	version : 1.1,
	timeout : 5000,
};

const name = "BITREX";

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
	headers['User-Agent'] = 'Bitrex Javascript API Client';

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
			throw new Error("Bitrex API returned an unknown error");
		}

		throw new Error(error.join(', '));
	}

	return response;
};

var requests = [];
var values = {};

class Bitrex {

	constructor(key, secret, options) {
		// Allow passing the OTP as the third argument for backwards compatibility
		if(typeof options === 'string') {
			options = { otp : options };
		}

		this.config = Object.assign({ key, secret }, defaults, options);

		this.updateTickers();
		setInterval(this.updateTickers, 5000);
		setInterval(this.processRequest, 1000, this);
	}

	updateTickers() {
		for(var i in pairs) {
			var pair = pairs[i];
			var exists = false;
			for(var j in requests) {
				if(requests[j].method == "fetch" && requests[j].pair == pair) {
					exists = true;
					break;
				}
			}
			if(!exists)	requests.push({method: "fetch", pair: pair});
		}
	}

	getTickerValue(pair) {
		var promise = (async() => {
			// console.log(values);
			return values[pairs[pair]];
		})();
		promise.then((result) => {
				// console.log("RESULT", pair, result);
				return result;
			})
			.catch((error) => {return error});

		return promise;
		// console.log("PROMISE", promise);
	}

	fetchTickerValue(pair, callback) {
		var url = defaults.url+"/v"+defaults.version+"/public/getticker?market="+pair;

		var promise = rawRequest(url, 'GET', {}, {}, defaults.timeout);
		var promise2 = promise
			.then((result) => {
				var time = Date.now();
				// console.log(result);
				var obj = {value: result.result.Last, volume: 0, time: new Date(time)};
				values[pair] = obj;
				// console.log(pair, obj);
			})
			.catch((error) => {
				console.log(error);
				return error;
			});

		return promise2;
	}

	processRequest(scope) {
		if(requests.length > 0) {
			var req = requests[0];
			// console.log("Processing request 1 on "+requests.length+" : "+JSON.stringify(req));
			if(req.method == "fetch")	scope.fetchTickerValue(req.pair);
			requests.splice(0,1);
		}
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
		path += (params.pair != undefined ? "/"+params.pair : "")
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

module.exports = Bitrex;

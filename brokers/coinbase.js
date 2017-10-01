const got    = require('got');
const crypto = require('crypto');
const qs     = require('qs');

// Public/Private method names
const methods = {
	public  : [ 'exchange-rates' ],
	private : [ ],
};

const pairs = {
	BTCUSD: "BTCUSD",
	BTCEUR: "BTCEUR",
	LTCUSD: "LTCUSD",
	ETHBTC: "ETHBTC",
	LTCBTC: "LTCBTC"
};

const currencies = ["BTC", "ETH", "LTC"];

// hhttps://api.coinbase.com/v2/exchange-rates?currency=BTC
// Default options
const defaults = {
	url     : 'https://api.coinbase.com',
	version : 2,
	timeout : 5000,
};

const name = "Coinbase";

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
	headers['User-Agent'] = 'Coinbase Javascript API Client';

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
			throw new Error("Coinbase API returned an unknown error");
		}

		throw new Error(error.join(', '));
	}

	return response;
};

var requests = [];
var values = {};

class Coinbase {
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
		for(var i in currencies) {
			var cur = currencies[i];
			var exists = false;
			for(var j in requests) {
				if(requests[j].method == "exchange-rates" && requests[j].currency == cur) {
					exists = true;
					break;
				}
			}

			if(!exists)	requests.push({method: "exchange-rates", currency: cur});
		}
	}

	getTickerValue(pair) {
		var promise = (async() => {
			// console.log(values);

			var c1 = pair.substr(0,3);
			var c2 = pair.substr(3);

			var val, time;
			try {
				time = values[c1].time;
				val = values[c1].rates[c2];
			} catch(error) {
				val = undefined;
				time = undefined;
			}

			var obj = {value: val, volume: 0, time: (time == undefined ? undefined : new Date(time))};
			// console.log(obj);
			return obj;
		})();
		promise.then((result) => {
				// console.log("RESULT", result);
				return result;
			})
			.catch((error) => {return error});

		return promise;
		console.log("PROMISE", promise);
	}

	fetchTickerValue(currency, callback) {
		var promise = this.api('exchange-rates', { currency : currency }, callback);
		var promise2 = promise
			.then((result) => {
				// var time = (parseFloat(result.timestamp)*1000);
				// var obj = {value: result.last_price, volume: result.volume, time: new Date(time)};
				values[currency] = {time: Date.now(), rates: result.data.rates};
			})
			.catch((error) => {return error});

		return promise2;
	}

	processRequest(scope) {
		if(requests.length > 0) {
			var req = JSON.parse(JSON.stringify(requests[0]));
			// console.log("Processing request 1 on "+requests.length+" : "+JSON.stringify(req));
			scope.fetchTickerValue(req.currency);
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
		path += (params.currency != undefined ? "?currency="+params.currency : "")

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

module.exports = Coinbase;

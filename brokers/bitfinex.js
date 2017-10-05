const got    = require('got');
const crypto = require('crypto');
const qs     = require('qs');

// Public/Private method names
const methods = {
	public  : [ 'pubticker' ],
	private : [ ],
};

const currencies = {
	btc: "BTC",
	eos: "EOS",
	bch: "BCH",
	eth: "ETH",
	ltc: "LTC",
	xmr: "XMR",
	zec: "ZEC",
	neo: "NEO",
	dash: "DASH",
	etc: "ETC",
	omg: "OMG",
	usd: "USD",
	xrp: "XRP"
}

const pairs = {
	BTCUSD: "BTCUSD",
	ETHUSD: "ETHUSD",
	LTCUSD: "LTCUSD",
	ETHBTC: "ETHBTC",
	LTCBTC: "LTCBTC",
	XMRBTC: "XMRBTC",
	ZECBTC: "ZECBTC",
	NEOBTC: "NEOBTC",
	ETCBTC: "ETCBTC",
	BCHBTC: "BCHBTC",
	OMGBTC: "OMGBTC"
};

const withdraw_fees = {
	LTC: 0.001,
	BTC: 0.0005,
	ETH: 0.01
};

// Default options
const defaults = {
	url     : 'https://api.bitfinex.com',
	version : 1,
	timeout : 5000,
};

const name = "BITFINEX";

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
	headers['User-Agent'] = 'Bitfinex Javascript API Client';

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
			throw new Error("Bitfinex API returned an unknown error");
		}

		throw new Error(error.join(', '));
	}

	return response;
};

var requests = [];
var values = {};

class Bitfinex {

	constructor(key, secret, options) {
		// Allow passing the OTP as the third argument for backwards compatibility
		if(typeof options === 'string') {
			options = { otp : options };
		}

		this.config = Object.assign({ key, secret }, defaults, options);

		this.updateTickers();
		setInterval(this.updateTickers, 5000);
		setInterval(this.processRequest, 2000, this);
	}

	updateTickers() {
		for(var i in pairs) {
			var pair = pairs[i];
			var exists = false;
			for(var j in requests) {
				if(requests[j].method == "pubticker" && requests[j].pair == pair) {
					exists = true;
					break;
				}
			}

			if(!exists)	requests.push({method: "pubticker", pair: pair});
		}
	}

	getTickerValue(pair) {
		var promise = (async() => {
			// console.log(values);
			return values[pair];
		})();
		promise.then((result) => {
				// console.log("RESULT", result);
				return result;
			})
			.catch((error) => {return error});

		return promise;
		// console.log("PROMISE", promise);
	}

	fetchTickerValue(pair, callback) {
		var promise = this.api('pubticker', { pair : pair }, callback);
		var promise2 = promise
			.then((result) => {
				var time = (parseFloat(result.timestamp)*1000);
				var obj = {value: result.last_price, volume: result.volume, time: new Date(time)};
				values[pair] = obj;
				// console.log("VALUES", values);
			})
			.catch((error) => {return error});

		return promise2;
	}

	processRequest(scope) {
		if(requests.length > 0) {
			var req = JSON.parse(JSON.stringify(requests[0]));
			// console.log("Processing request 1 on "+requests.length+" : "+JSON.stringify(req));
			scope.fetchTickerValue(req.pair);
			requests.splice(0,1);
		}
	}

	getBalance(apikey, secretkey) {

		const url = "/v"+defaults.version+'/balances'
		const nonce = Date.now().toString()
		const body = {request: url, nonce}
		const payload = new Buffer(JSON.stringify(body)).toString('base64')

		const signature = crypto.createHmac('sha384', secretkey).update(payload) .digest('hex')

		const headers = {
			'X-BFX-APIKEY': apikey,
			'X-BFX-PAYLOAD': payload,
			'X-BFX-SIGNATURE': signature
		};

		const options = { headers };

		Object.assign(options, {
			method : 'POST',
			body   : qs.stringify(body),
		});

		var promise = (async() => {
			try {
				const result = await got(defaults.url+"/"+url, options);

				var json = JSON.parse(result.body);
				var obj = {};
				for(var i in json) {
					var c = json[i];
					var cur = currencies[c.currency];
					var val = parseFloat(c.amount);

					if(cur != undefined && val > 0)
						obj[cur] = val;
				}

				return obj;
			} catch(error) {
				console.log(error);
				return error;
			}
		})();

		return promise;
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

module.exports = Bitfinex;

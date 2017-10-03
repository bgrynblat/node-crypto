const got    = require('got');
const crypto = require('crypto');
const qs     = require('qs');

const pairs = {
	ETHBTC: "BTC_ETH",
	LTCBTC: "BTC_LTC",
	DASHBTC: "BTC_DASH",
	XMRBTC: "BTC_XMR",
	ZECBTC: "BTC_ZEC",
	ETCBTC: "BTC_ETC",
	BCHBTC: "BTC_BCH",
	OMGBTC: "BTC_OMG",
};

// const currencies = ["BTC", "ETH", "LTC"];

// https://poloniex.com/public?command=returnTicker
// Default options
const defaults = {
	url     : 'https://poloniex.com',
	timeout : 5000,
};

const name = "Poloniex";

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
	headers['User-Agent'] = 'Poloniex Javascript API Client';

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
			throw new Error("Poloniex API returned an unknown error");
		}

		throw new Error(error.join(', '));
	}

	return response;
};

var requests = [];
var values = {};

class Poloniex {
	constructor(key, secret, options) {
		this.config = Object.assign({ key, secret }, defaults, options);

		this.fetchTickerValue();
		setInterval(this.fetchTickerValue, 5000);
		setInterval(this.processRequest, 1000, this);
	}

	getTickerValue(pair) {
		var promise = (async() => {
			var time = values.time;

			if(values.rates == undefined)	return;

			var pp = values.rates[pairs[pair]] || undefined;
			
			// if(pair == "USDTBTC")	console.log(pair, values.rates);


			if(pp == undefined)	return;

			var obj = {value: parseFloat(pp.last), volume: parseFloat(pp.baseVolume), time: new Date(time)};
			// console.log(pair, obj);
			return obj;
		})();
		promise.then((result) => {
				// console.log("RESULT", result);
				return result;
			})
			.catch((error) => {return error});

		return promise;
	}

	fetchTickerValue() {		

		var promise = rawRequest(defaults.url+"/public?command=returnTicker", 'GET', {}, {});
		// var promise = this.api('exchange-rates', { currency : currency }, callback);
		var promise2 = promise
			.then((result) => {
				// var time = (parseFloat(result.timestamp)*1000);
				// var obj = {value: result.last_price, volume: result.volume, time: new Date(time)};
				// console.log(result);
				values = {time: Date.now(), rates: result};
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
}

module.exports = Poloniex;
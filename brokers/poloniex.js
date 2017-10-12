const got    = require('got');
const crypto = require('crypto');
const qs     = require('qs');

const currencies = {
	BTC: "BTC",
	ADX: "ADX",
	BCH: "BCH",
	ETH: "ETH",
	LTC: "LTC",
	XMR: "XMR",
	ZEC: "ZEC",
	DASH: "DASH",
	ETC: "ETC",
	OMG: "OMG",
	FUN: "FUN",
	ADX: "ADX",
	DGB: "DGB",
	DOGE: "DOGE",
	NXT: "NXT",
};

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

		this.withdraw_fees = {
			LTC: 0.001,
			BTC: 0.0001,
			ETH: 0.005,
			BCH: 0.0001,
			OMG: 0.1,
			ZEC: 0.001,
			XRP: 0.15,
			DASH: 0,
			ETC: 0.01,
			XMR: 0.05,
		};

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

	getBalance(apikey, secretkey) {

		const url = defaults.url+'/tradingApi'
		const nonce = Date.now().toString()
		
		var parameters = {};
        parameters.command = 'returnBalances';
        parameters.nonce = nonce;

        var paramString, signature;

        if (!apikey || !secretkey) {
            throw 'Poloniex: Error. API key and secret required';
        }

        // Convert to `arg1=foo&arg2=bar`
        var paramString = Object.keys(parameters).map(function(param) {
            return encodeURIComponent(param) + '=' + encodeURIComponent(parameters[param]);
        }).join('&');

        var signature = crypto.createHmac('sha512', secretkey).update(paramString).digest('hex');

        var headers = {
            Key: apikey,
            Sign: signature
        };

        var options = {
            method: 'POST',
            url: url,
            form: parameters,
            body: parameters,
            headers: headers,
            json: true,
            // options.headers['User-Agent'] = Poloniex.USER_AGENT;
        	strictSSL: true
        };

		var promise = (async() => {
			try {
				const result = await got(url, options);
				var obj = {};

				for(var i in result.body) {
					var cur = currencies[i];
					var val = parseFloat(result.body[i]);
					if(val > 0)	obj[cur] = val;
				}

				return obj;
			} catch(error) {
				console.log(error);
				return error;
			}
		})();

		return promise;
	}
}

module.exports = Poloniex;
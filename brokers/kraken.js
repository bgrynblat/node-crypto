const got    = require('got');
const crypto = require('crypto');
const qs     = require('qs');

// Public/Private method names
const methods = {
	public  : [ 'Time', 'Assets', 'AssetPairs', 'Ticker', 'Depth', 'Trades', 'Spread', 'OHLC' ],
	private : [ 'Balance', 'TradeBalance', 'OpenOrders', 'ClosedOrders', 'QueryOrders', 'TradesHistory', 'QueryTrades', 'OpenPositions', 'Ledgers', 'QueryLedgers', 'TradeVolume', 'AddOrder', 'CancelOrder', 'DepositMethods', 'DepositAddresses', 'DepositStatus', 'WithdrawInfo', 'Withdraw', 'WithdrawStatus', 'WithdrawCancel' ],
};

const currencies = {
	ZEUR: "EUR",
	XXBT: "BTC",
	XLTC: "LTC",
	XETH: "ETH",
	XUSD: "USD",
	DASH: "DASH",
	USDT: "USDT",
	XETC: "ETC",
	XXMR: "XMR",
	XBCH: "BCH",
	XZEC: "ZEC"
};

const pairs = {
	BTCEUR: "XBTEUR",
	BTCUSD: "XBTUSD",
	ETHEUR: "ETHEUR",
	ETHUSD: "ETHUSD",
	LTCEUR: "LTCEUR",
	LTCUSD: "LTCUSD",
	ETHBTC: "ETHXBT",
	LTCBTC: "LTCXBT",
	DASHBTC: "DASHXBT",
	ZECBTC: "ZECXBT",
	XMRBTC: "XMRXBT",
	ETCBTC: "ETCXBT"
};

// Default options
const defaults = {
	url     : 'https://api.kraken.com',
	version : 0,
	timeout : 5000,
};

const name = "KRAKEN";

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
const rawRequest = async (url, headers, data, timeout) => {
	// Set custom User-Agent string
	headers['User-Agent'] = 'Kraken Javascript API Client';

	const options = { headers, timeout };

	Object.assign(options, {
		method : 'POST',
		body   : qs.stringify(data),
	});

	const { body } = await got(url, options);
	const response = JSON.parse(body);

	if(response.error && response.error.length) {
		const error = response.error
			.filter((e) => e.startsWith('E'))
			.map((e) => e.substr(1));

		if(!error.length) {
			throw new Error("Kraken API returned an unknown error");
		}

		throw new Error(error.join(', '));
	}

	return response;
};

/**
 * KrakenClient connects to the Kraken.com API
 * @param {String}        key               API Key
 * @param {String}        secret            API Secret
 * @param {String|Object} [options={}]      Additional options. If a string is passed, will default to just setting `options.otp`.
 * @param {String}        [options.otp]     Two-factor password (optional) (also, doesn't work)
 * @param {Number}        [options.timeout] Maximum timeout (in milliseconds) for all API-calls (passed to `request`)
 */
class KrakenClient {
	constructor(key, secret, options) {
		this.config = Object.assign({ key, secret }, defaults, options);

		this.withdraw_fees = {
			LTC: 0.001,
			BTC: 0.001,
			ETH: 0.005,
			EUR: 0.09,
			USDT: 5,
			XRP: 0.02,
			DASH: 0.005,
			XMR: 0.05,
			ETC: 0.005,
			ZEC: 0.0001,
			BCH: 0.001,
		};
	}

	getTickerValue(pair) {

		var promise = this.api('Ticker', { pair : pairs[pair] });
		var promise2 = promise
			.then((result) => {

				// console.log("KRAKEN", result);
				if(result.name == "HTTPError") {
					// console.log("HERE");
					return undefined;
				}
				var value = result.result[Object.keys(result.result)[0]]["c"][0];
				var volume = result.result[Object.keys(result.result)[0]]["v"][1];

				return {value: value, volume: volume, time: new Date()}
			})
			.catch((error) => {return error});

		return promise2;
	}

	/**
	 * This method makes a public or private API request.
	 * @param  {String}   method   The API method (public or private)
	 * @param  {Object}   params   Arguments to pass to the api call
	 * @param  {Function} callback A callback function to be executed when the request is complete
	 * @return {Object}            The request object
	 */
	api(method, params, apikey, secretkey, callback) {
		// Default params to empty object
		if(typeof params === 'function') {
			callback = params;
			params   = {};
		}

		if(methods.public.includes(method)) {
			return this.publicMethod(method, params, callback);
		}
		else if(methods.private.includes(method)) {
			return this.privateMethod(method, params, apikey, secretkey, callback);
		}
		else {
			throw new Error(method + ' is not a valid API method.');
		}
	}

	/**
	 * This method makes a public API request.
	 * @param  {String}   method   The API method (public or private)
	 * @param  {Object}   params   Arguments to pass to the api call
	 * @param  {Function} callback A callback function to be executed when the request is complete
	 * @return {Object}            The request object
	 */
	publicMethod(method, params, callback) {
		params = params || {};

		// Default params to empty object
		if(typeof params === 'function') {
			callback = params;
			params   = {};
		}

		const path     = '/' + this.config.version + '/public/' + method;
		const url      = this.config.url + path;
		const response = rawRequest(url, {}, params, this.config.timeout);

		if(typeof callback === 'function') {
			response
				.then((result) => callback(null, result))
				.catch((error) => callback(error, null));
		}

		return response;
	}

	/**
	 * This method makes a private API request.
	 * @param  {String}   method   The API method (public or private)
	 * @param  {Object}   params   Arguments to pass to the api call
	 * @param  {Function} callback A callback function to be executed when the request is complete
	 * @return {Object}            The request object
	 */
	privateMethod(method, params, apikey, secretkey, callback) {

		if(apikey == undefined || secretkey == undefined) {
			console.log("ERROR KRAKEN APIKEY/SECRETKEY is empty");
			return;
		}

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
			secretkey,
			params.nonce
		);

		const headers = {
			'API-Key'  : apikey,
			'API-Sign' : signature,
		};

		const response = rawRequest(url, headers, params, this.config.timeout);

		if(typeof callback === 'function') {
			response
				.then((result) => callback(null, result))
				.catch((error) => callback(error, null));
		}

		return response;
	}

	getBalance(apikey, secretkey) {
		var promise = (async() => {
			try {
				const result = await this.api('Balance', {}, apikey, secretkey);
				
				if(result.error.length > 0)	throw new Error(result.error);

				var obj = {};
				for(var i in result.result) {
					var val = parseFloat(result.result[i]);
					if(val > 0) {
						var cc = currencies[i];
						if(cc != undefined)
							obj[cc] = val;
					}
				}

				return obj;
			} catch(error) {
				console.log(error);
				return error;
			}
		})();

		return promise;
	}

	// sendBuyOrder(pairname) {
	// 	var vof = pairname.substr(0,3);
	// 	var vin = pairname.substr(pairname.length-3);

	// 	var pair = global.pairs[pairname];

	// 	var volume = pair.default_buy_price/pair.current_value;
	// 	volume = volume.toFixed(3);

	// 	pair.order_in_progress = true;

	// 	(async() => {

	// 		var price = pair.current_value*1;
	// 		price = price.toFixed(2);

	// 		try {
	// 			var ref = Date.now()+"";
	// 			ref = parseInt("1"+ref.substr(ref.length-7));

	// 			console.log(Date()+" - +++ BUY ORDER "+volume+" "+vof+" FOR "+pair.current_value*volume+" "+vin+" (AT:"+pair.current_value+" "+vin+" - REF: "+ref+")");
	// 			var params = {
	// 				pair: pairname,
	// 				type: "buy",
	// 				ordertype: "limit",
	// 				volume: volume,
	// 				price: price,
	// 				userref: ref
	// 			};

	// 			var res = await kraken.api('AddOrder', params);

	// 			if(res.error[0] != null)	console.err("THERE", res.error);
	// 			else {
	// 				console.log("BUY ORDER SUCCESSFULLY SENT : ",res.result["descr"])
	// 				pair.order_in_progress = false;
	// 				pair.last_order_value = price;
	// 				pair.code = 1;
	// 			}
	// 		} catch(error) {
	// 			var msg = "ERROR SENDING ORDER : "+error.code;
	// 			pair.order_in_progress = false;

	// 			if(error.code == "ETIMEDOUT") {
	// 				// msg += " - RETRYING...";
	// 				// sendBuyOrder(vof, vin, volume);
	// 			} else msg = "ERROR SENDING ORDER REF: "+ref+" - "+error;

	// 			// console.log(msg);
	// 		}
	// 	})();
	// }

	// sendSellOrder(pairname, volume) {
	// 	var vof = pairname.substr(0,3);
	// 	var vin = pairname.substr(pairname.length-3);

	// 	var pair = global.pairs[pairname];
	// 	volume = volume || pair.last_order_volume;
		
	// 	var price = pair.last_order_value*(1+(pair.threshold/100));
	// 	price = price.toFixed(1);

	// 	if(price < pair.current_value)	price = pair.current_value;

	// 	pair.order_in_progress = true;

	// 	(async() => {

	// 		try {
	// 			var ref = Date.now()+"";
	// 			ref = parseInt("2"+ref.substr(ref.length-7));

	// 			console.log(Date()+" - --- SELL ORDER "+volume+" "+vof+" FOR "+price*volume+" "+vin+" (AT:"+price+" "+vin+" - REF: "+ref+")");
	// 			var params = {
	// 				pair: pairname,
	// 				type: "sell",
	// 				ordertype: "limit",
	// 				volume: volume,
	// 				price: price,
	// 				userref: ref
	// 			};

	// 			var res = await kraken.api('AddOrder', params);
				
	// 			// console.log("HERE", res);

	// 			if(res.error[0] != null)	console.err("THERE", res.error);
	// 			else {
	// 				console.log("SELL ORDER SUCCESSFULLY SENT : ",res.result["descr"])
	// 				pair.order_in_progress = false;
	// 				pair.code = 0;
	// 			}
	// 		} catch(error) {
	// 			// console.log("ERROR SENDING ORDER REF: "+ref, error);
	// 			pair.order_in_progress = false;
	// 		}
	// 	})();
	// }

	// async getOpenOrders(verbose) {
	// 	try {
	// 		var res = await kraken.api('OpenOrders', { trades : true });

	// 	    if(res.error[0] != null)        console.err(res.error);
	// 	    else {
	// 	    	var nb = Object.keys(res.result["open"]).length;

	// 	    	for(var i = 0; i<nb; i++) {
	// 	    		var key = Object.keys(res.result["open"])[i];
	// 	    		var order = res.result["open"][key];

	// 	    		if(verbose)	console.log(key+" (REF:"+order["userref"]+" STATUS:"+order["status"]+"): "+order["descr"]["order"]);
	// 	    		// console.log(order["descr"]["pair"]);

	// 	    		for(var j in global.pairs) {
	// 	    			var oo = global.pairs[j];
	// 	    			if(oo.kraken_pair == order["descr"]["pair"]) {

	// 	    				if(oo.orders[key] == undefined)
	// 	    					console.log("NEW ORDER FOR PAIR "+order["descr"]["pair"]+" : "+key);

	// 	    				oo.orders[key] = order;
	// 	    				oo.last_order_value = order["descr"]["price"];
	// 	    			}
	// 	       		}

	// 	    		// console.log("ORDER : "+key+" => ",);
	// 	    	}
	// 		}
	// 	} catch(error) {
	// 		// console.log("ERROR", error);
	// 	}
	// }

	// async getClosedOrders(verbose) {
	// 	try {
	// 		var res = await kraken.api('ClosedOrders', { trades : true });
	// 	    if(res.error[0] != null)        console.err(res.error);
	// 	    else {
	// 	    	var nb = Object.keys(res.result["closed"]).length;
	// 	    	for(var i = nb-1; i>=0; i--) {
	// 	    		var key = Object.keys(res.result["closed"])[i];
	// 	    		var order = res.result["closed"][key];

	// 	    		if(verbose)	console.log(key+" (REF:"+order["userref"]+" STATUS:"+order["status"]+"): "+order["descr"]["order"]);

	// 	    		for(var j in global.pairs) {
	// 	    			var oo = global.pairs[j];
	// 	    			if(oo.kraken_pair == order["descr"]["pair"]) {

	// 	    				if(order.status == "closed") {
	// 			    			// console.log("LAST ORDER :", order);
	// 			    			oo.last_order_value = parseFloat(order.descr.price);
	// 			    			oo.last_order_volume = parseFloat(order.vol_exec);
	// 			    			oo.last_order_type = order.descr.type;
	// 			    		}

	// 	    				if(oo.orders[key] != undefined) {
	// 	    					console.log("ORDER "+key+" closed");
	// 	    					delete oo.orders[key];
	// 	    				}
	// 	    			}
	// 	       		}

	// 	    		// console.log("ORDER : "+key+" => ",);
	// 	    	}
	// 		}
	// 	} catch(error) {
	// 		console.log("ERROR FETCHING CLOSED ORDERS", error.code || error);
	// 	}
	// }

	// showValueOf(pairname) {
	// 	var vals = global.pairs[pairname].value;
	// 	var thresh = global.pairs[pairname].threshold;

	// 	var vof = pairname.substr(0,3);
	// 	var vin = pairname.substr(pairname.length-3);

	// 	if(val != null)	{
	// 		// console.log(Date()+" - 1 "+vof+" = "+val+" "+vin+" ===> +"+thresh+"% / -"+thresh+"% = "+val*(1+(thresh/100))+" / "+val*(1-(thresh/100)));
	// 	}
	// }
}

module.exports = KrakenClient;

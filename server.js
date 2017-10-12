const fs = require('fs');
const express = require('express');
const https = require('https');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const stdin = process.openStdin();

const onesignal_apikey = process.env.ONESIGNAL_APIKEY;
const onesignal_appid = process.env.ONESIGNAL_APPID;

//==========================================================
// BROKERS
//==========================================================

const kraken = new (require('./brokers/kraken.js'))();
const bitfinex = new (require('./brokers/bitfinex.js'))();
const acx = new (require('./brokers/acx.js'))();
const coinbase = new (require('./brokers/coinbase.js'))();
const poloniex = new (require('./brokers/poloniex.js'))();
const bittrex = new (require('./brokers/bittrex.js'))();

const brokers = {
	"KRAKEN": kraken,
	"BITFINEX": bitfinex,
	"ACX": acx,
	"COINBASE": coinbase,
	"POLONIEX": poloniex,
	"BITREX": bittrex
}

//==========================================================
// ALGORITHMS
//==========================================================

const Algos = {
	Rotation: require('./algorithms/rotation.js')
};

//==========================================================
// VARIABLES
//==========================================================

global.users = {
	accounts: {},
	apikeys: {}
};

global.currencies = {
	BTC: {name: "Bitcoin", logo: "http://logok.org/wp-content/uploads/2016/10/Bitcoin-Logo-640x480.png"},
	USD: {name: "US Dollar", logo: "http://logonoid.com/images/dollar-logo.png"},
	ETH: {name: "Ethereum", logo: "http://files.coinmarketcap.com.s3-website-us-east-1.amazonaws.com/static/img/coins/200x200/ethereum.png"},
	LTC: {name: "Litecoin", logo: "https://bittrexblobstorage.blob.core.windows.net/public/6defbc41-582d-47a6-bb2e-d0fa88663524.png"},
	EUR: {name: "Euro", logo: "https://image.freepik.com/free-icon/euro-symbol_318-33107.jpg"},
	AUD: {name: "Australian Dollar", logo: "https://png.icons8.com/australian-dollar/win8/1600"},
	XMR: {name: "Monero", logo: "https://bittrexblobstorage.blob.core.windows.net/public/efcda24e-c6c3-4029-982c-15af2915fb08.png"},
	DASH: {name: "Dash", logo: "https://bittrexblobstorage.blob.core.windows.net/public/49993d38-d344-4197-b449-c50c3cc13d47.png"},
	ZEC: {name: "ZCash", logo: "https://bittrexblobstorage.blob.core.windows.net/public/db51f5f5-3728-4e12-b32f-ea3f4825038b.png"},
	NEO: {name: "NEO", logo: "https://bittrexblobstorage.blob.core.windows.net/public/ed823972-8cfd-4f1f-a91d-f638ba20bf02.png"},
	ETC: {name: "Ethereum Classic", logo: "https://bittrexblobstorage.blob.core.windows.net/public/efc96992-1993-4a91-84cf-c04fea919788.png"},
	BCH: {name: "Bitcoin Cash", logo: "https://coincheck.com/images/icons/icon_bch.svg"},
	OMG: {name: "OmiseGO", logo: "http://neocashradio.com/wp-content/uploads/2017/08/omisego.jpg"},
	ADX: {name: "AdEx", logo: "https://bittrexblobstorage.blob.core.windows.net/public/75fe532b-ba7f-483a-a377-4c2b56517224.png"},
	FUN: {name: "FunFair", logo: "https://bittrexblobstorage.blob.core.windows.net/public/15870ba6-ec5a-4261-8ee2-15e005536a71.png"},
	DGB: {name: "Digibyte", logo: "https://bittrexblobstorage.blob.core.windows.net/public/f71e4e1a-9249-47a0-b4d0-53afa08ccbc3.png"},
	DOGE: {name: "Dogecoin", logo: "https://bittrexblobstorage.blob.core.windows.net/public/a2b8eaee-2905-4478-a7a0-246f212c64c6.png"},
	KMD: {name: "Komodo", logo: "https://bittrexblobstorage.blob.core.windows.net/public/ec8df0e5-f320-44c5-abc4-116bacc31336.png"},
	MCO: {name: "Monaco", logo: "https://bittrexblobstorage.blob.core.windows.net/public/582b0dc7-5c04-4a2a-b450-c8488799cbd6.png"},
	NXT: {name: "NXT", logo: "https://bittrexblobstorage.blob.core.windows.net/public/443d492d-4f8b-4a2d-a613-1b37e4ab80cd.png"},
	PAY: {name: "TenX Pay Token", logo: "https://bittrexblobstorage.blob.core.windows.net/public/c39a72fc-848e-4302-80c8-836a35c6ef99.png"},
	QTUM: {name: "Qtum", logo: "https://bittrexblobstorage.blob.core.windows.net/public/d2722d80-adb4-4a3d-adac-a75e7d2edd51.png"},
	XEL: {name: "Elastic", logo: "https://bittrexblobstorage.blob.core.windows.net/public/13ffc393-5f0d-491f-9942-cd664c1f0459.png"},
	XRP: {name: "Ripple", logo: "http://files.coinmarketcap.com.s3-website-us-east-1.amazonaws.com/static/img/coins/200x200/ripple.png"},
	USDT: {name: "USD Tether", logo: "http://files.coinmarketcap.com.s3-website-us-east-1.amazonaws.com/static/img/coins/200x200/tether.png"},
}

global.pairs = {
	BTCUSD : {brokers: ["KRAKEN", "BITFINEX", "COINBASE", "POLONIEX"], trade: false, threshold: 20, default_buy_price: 6, last_notification: 0},
	ETHUSD : {brokers: ["KRAKEN", "BITFINEX", "POLONIEX"], trade: false, threshold: 20, default_buy_price: 6, last_notification: 0},
	LTCUSD : {brokers: ["KRAKEN", "BITFINEX"], trade: false, threshold: 20, default_buy_price: 6, last_notification: 0},
	BTCEUR : {brokers: ["KRAKEN"], trade: false, threshold: 1, default_buy_price: 6, last_notification: 0},
	ETHEUR : {brokers: ["KRAKEN"], trade: false, threshold: 1, default_buy_price: 6, last_notification: 0},
	LTCEUR : {brokers: ["KRAKEN"], trade: false, threshold: 1, default_buy_price: 6, last_notification: 0},
	BTCAUD : {brokers: ["ACX"], trade: false, threshold: 1, default_buy_price: 6, last_notification: 0},
	ETHBTC : {brokers: ["KRAKEN", "BITFINEX", "COINBASE", "POLONIEX", "BITREX"], trade: true, threshold: 0.0003, default_buy_price: 6, last_notification: 0},
	LTCBTC : {brokers: ["KRAKEN", "BITFINEX", "COINBASE", "POLONIEX", "BITREX"], trade: true, threshold: 0.0003, default_buy_price: 6, last_notification: 0},
	XMRBTC : {brokers: ["POLONIEX", "BITFINEX", "KRAKEN", "BITREX"], trade: true, threshold: 0.0003, default_buy_price: 6, last_notification: 0},
	DASHBTC: {brokers: ["POLONIEX", "KRAKEN", "BITREX"], trade: true, threshold: 0.0003, default_buy_price: 6, last_notification: 0},
	ZECBTC: {brokers: ["POLONIEX", "BITFINEX", "KRAKEN", "BITREX"], trade: true, threshold: 0.0003, default_buy_price: 6, last_notification: 0},
	NEOBTC: {brokers: ["BITFINEX", "BITREX"], trade: true, threshold: 0.0003, default_buy_price: 6, last_notification: 0},
	ETCBTC: {brokers: ["KRAKEN", "BITFINEX", "BITREX", "POLONIEX"], trade: true, threshold: 0.0003, default_buy_price: 6, last_notification: 0},
	BCHBTC: {brokers: ["BITFINEX", "BITREX", "POLONIEX"], trade: true, threshold: 0.0003, default_buy_price: 6, last_notification: 0},
	OMGBTC: {brokers: ["BITFINEX", "BITREX", "POLONIEX"], trade: true, threshold: 0.0003, default_buy_price: 6, last_notification: 0},
};

global.archiving = true;
global.history = [];
global.tmp = {};
global.min_gain = 0.001;
global.last_rotation = {};
// global.send_orders = false;

for(var i in global.pairs) {
	global.pairs[i].values = {};

	global.pairs[i].lowest = null;
	global.pairs[i].lowest_at = null;
	global.pairs[i].lowest_from = null;

	global.pairs[i].highest = null;
	global.pairs[i].highest_at = null;
	global.pairs[i].highest_from = null;

	// global.pairs[i].last_order_value = null;
	// global.pairs[i].last_order_volume = null;
	// global.pairs[i].last_order_type = "buy";
	// global.pairs[i].orders = {};
	// global.pairs[i].order_in_progress = false;
	// global.pairs[i].trend = null;
	// global.pairs[i].trending_for = 1;
	// global.pairs[i].trend_start_value = 0;
	// global.pairs[i].trend_starts_at = Date.now();
	// global.pairs[i].history = [];
}

global.interval = 5000;
global.prefix = "#?#";

//==========================================================
// ENCRYPTION
//==========================================================


function generateHmac(string) {
	const hmac = crypto.createHmac('sha256', "bcrypt0");
	hmac.update(string);
	return hmac.digest('hex');
}

function encrypt(text, password) {
	var algorithm = 'aes-256-ctr';
	var cipher = crypto.createCipher(algorithm,password)
	var crypted = cipher.update(text,'utf8','hex')
	crypted += cipher.final('hex');
	return crypted;
}

function decrypt(text, password){
	var algorithm = 'aes-256-ctr';
	var decipher = crypto.createDecipher(algorithm,password)
	var dec = decipher.update(text,'hex','utf8')
	dec += decipher.final('utf8');
	return dec;
}

function encryptKey(key, apikey, broker) {

	// console.log("dec => ", key);
	var usersecret = global.users.apikeys[apikey];
	var pass = "_b4th_"+usersecret+"_s4lt_"+broker;

	var enc1 = encrypt(key, pass);
	// console.log("e1 => ", enc1);
	var enc2 = encrypt(broker, broker+"_br0k3r");
	var enc3 = encrypt(enc2+"-#-"+enc1, enc2+"_3ncrypt");
	// console.log("e2 => ", enc3);
	
	return prefix+enc3+prefix;
}

function decryptKey(key, apikey, broker) {

	try {
		// console.log("enc => ", key);
		var usersecret = global.users.apikeys[apikey];
		var pass = "_b4th_"+usersecret+"_s4lt_"+broker;

		var enc3 = key.substr(global.prefix.length, key.length-(global.prefix.length*2));
		// console.log("d2 => ", enc3);

		var enc2 = encrypt(broker, broker+"_br0k3r");

		var dec3 = decrypt(enc3, enc2+"_3ncrypt");

		var array = dec3.split("-#-");
		var enc1 = array[1];
		// console.log("d1 => ", enc1);

		var dec1 = decrypt(enc1, pass);
		// console.log("dec => ", dec1);
		return dec1;
	} catch(error) {
		console.log("error", error);
		return undefined;
	}
}

//==========================================================
// FUNCTIONS
//==========================================================

// function algo(a, fee_high, fee_low, rate_high, rate_low) {
// 	// 1 - Withdraw BTC broker high -> broker low
// 	// 2 - Wait for transfer
// 	// 3 - Buy XXX from BTC in broker low
// 	// 4 - Wait for order to be completed
// 	// 5 - Withdraw XXX broker low -> broker high
// 	// 6 - Wait for transfer
// 	// 7 - Sell XXX to BTC in broker high
// 	// 8 - Wait for order to be completed
// 	var e = (((a-fee_high)/rate_low)-fee_low)*rate_high;
// 	return e;
// }

// function checkMinimumTradeValue(min_gain, fee_high, fee_low, rate_high, rate_low) {
// 	var dd = -1;
// 	var i = rate_high-rate_low;
// 	var f = 0;
// 	for(i = i; dd<min_gain; i+=0.005) {
// 		f = algo(i, fee_high, fee_low, rate_high, rate_low);
// 		dd = f-i;
// 	}
// 	i -= 0.005;

// 	// console.log(i, "=>", f, "("+dd+")");
// 	return {min: i, gain: dd};
// }

function rotation(user, pair, broker_high, broker_low, rate_high, rate_low, amount, diff) {
	var bhigh = brokers[broker_high];
	var blow = brokers[broker_low];

	var cur_from = pair.reverse().substring(0, 3).reverse();
	var cur_to = pair.replace(cur_from, "");

	var fee1 = bhigh.withdraw_fees[cur_from];
	var fee2 = blow.withdraw_fees[cur_to];

	var request = {
		id: generateHmac(Date.now()+""),
		started_at: Date.now(),
		type: "rotation",
		broker1: broker_high,
		broker2: broker_low,
		status: "in progress",
		pair: pair,
		amount: amount,
		details: {
			step: 1,
			diff: diff,
			expected_gain: algo(amount, fee1, fee2, rate_high, rate_low)
		}
	};

	if(user.requests == undefined)	user.requests = [];

	user.requests.push(request);
}

async function updateTickerValue(pair) {
	for(var i in global.pairs[pair].brokers) {
		try {

			var brokername = global.pairs[pair].brokers[i];
			var broker = brokers[brokername];

			var res = await broker.getTickerValue(pair);
			// if(broker == poloniex)	console.log(brokername, pair, res);

			if(res == undefined)	break;

			var pp = global.pairs[pair];
			pp.values[brokername] = res;

			if(pp.lowest == null || pp.lowest > res.value) {
				pp.lowest = res.value;
				pp.lowest_at = res.time;
				pp.lowest_from = brokername;
			}

			if(pp.highest == null || pp.highest < res.value) {
				pp.highest = res.value;
				pp.highest_at = res.time;
				pp.highest_from = brokername;
			}

			// if(broker == poloniex)	console.log(pair, pp);

			var low, high;
			for(var j in pp.values) {
				// if(pair == "BTCUSD")	console.log(j+" -> "+pp.values[j].value);
				if(low == undefined || pp.values[j].value < low.value)		low = {value: pp.values[j].value, from: j};
				if(high == undefined || pp.values[j].value > high.value)	high = {value: pp.values[j].value, from: j};
			}

			pp.low = low;
			pp.high = high;
			pp.diff = high.value-low.value;
			// if(pp.diff < 0)	break;

			// if(pair == "BTCUSD") {
				// console.log("HIGH "+high.value+"/"+high.from, "LOW "+low.value+"/"+low.from);
				// console.log("DIFF "+pair+" ("+high.from+" > "+low.from+"): "+pp.diff+" "+pair.substr(3));
			// }

			// if(pair == "DASHBTC")	console.log(pair, pp.high.from, ">", pp.low.from, pp.diff, " => ", global.pairs[pair].threshold);
			// if(pp.trade && pp.low.from != pp.high.from)	console.log(pair, pp.high.from, ">", pp.low.from, pp.diff);

//======================================
			// if(pp.trade && (pp.diff >= global.pairs[pair].threshold)) {
			// 	var cur_from = pair.reverse().substring(0, 3).reverse();
			// 	var cur_to = pair.replace(cur_from, "");

			// 	if(brokers[low.from].withdraw_fees != undefined && brokers[high.from].withdraw_fees != undefined) {
			// 		// console.log("====================="+pair+"======================")
			// 		// var msg = "DIFF ("+high.from+" > "+low.from+"): "+pp.diff+" "+cur_from;
			// 		// console.log(msg);

			// 		var fee_high = brokers[high.from].withdraw_fees[cur_from];
			// 		var fee_low = brokers[low.from].withdraw_fees[cur_to];
			// 		// var ret = checkMinimumTradeValue(global.min_gain, fee_high, fee_low, high.value, low.value);
			// 		// if(ret.min < 0.4) {
			// 			// console.log(pair, "=> Invest", ret.min, cur_from, "get", ret.gain, cur_from, high.from, "=>", low.from);
			// 			// console.log(low.from, "=>", brokers[low.from].withdraw_fees);

			// 			for(var id in global.users.accounts) {
			// 				var user = global.users.accounts[id];
							
			// 				if(user.apikey == "bb9ee66fd5d967acd7148d34516fe829ad463ab01b18aeb03fa0e3b2024c0f6f") {
			// 					// var exists = false;
			// 					// for(var j in user.requests) {
			// 					// 	if(user.requests[j].pair == pair)	exists = true;
			// 					// }
			// 					// if(!exists)		rotation(user, pair, high.from, low.from, high.value, low.value, ret.min, pp.diff);
			// 					var ret = new Algos.Rotation(pair, fee_high, fee_low, high.value, low.value, 0.001).checkMinimumTradeValue();
			// 					if(ret.pair != global.last_rotation.pair) {
			// 						global.last_rotation = ret;
			// 						console.log(ret.pair, "=> Invest", ret.min, cur_from, "get", ret.gain, cur_from, high.from, "=>", low.from)
			// 					}
			// 				}
			// 			}
			// 		// }
			// 	}
//======================================


				// if(pair.last_notification+300000 < Date.now()) {
				// 	pair.last_notification = Date.now();
				// 	// sendNotification("", msg);
				// }
			// }


		} catch(error) {
			console.log("ERROR FOR BROKER "+brokername+", PAIR : "+pair, error);
		}
	}
}

function archive() {

	var now = Date.now();
	var hh = {time: now, pairs: {}}
	for(var i in global.pairs) {
		hh.pairs[i] = JSON.parse(JSON.stringify(global.pairs[i].values));
	}

	if(global.history.length > 18000)	global.history.splice(0, 10);
	if(global.archiving)				global.history.push(hh);
}

function dumpMemory(filename) {
	var fs = require('fs');
	var file = __dirname+"/"+(filename || Date.now()+"-dump.json");
	fs.writeFileSync(file, JSON.stringify({pairs: global.pairs, history: global.history}));	
}

function readMemoryBackup(filename) {
	try {
		var fs = require('fs');
		var file = __dirname+"/"+(filename || "memdata.json");
		var data = fs.readFileSync(file, "utf-8");

		var json = JSON.parse(data);
		global.history = json.history;

		for(var i in json.pairs) {
			global.pairs[i].values = json.pairs[i].values;

			global.pairs[i].lowest = json.pairs[i].lowest;
			global.pairs[i].lowest_at = json.pairs[i].lowest_at;
			global.pairs[i].lowest_from = json.pairs[i].lowest_from;

			global.pairs[i].highest = json.pairs[i].highest;
			global.pairs[i].highest_at = json.pairs[i].highest_at;
			global.pairs[i].highest_from = json.pairs[i].highest_from;
		}
	} catch(error) {}
}

function createAccount(email, password) {
	console.log(email, password);

	var hmac = generateHmac(email+password);
	var apikey = generateHmac(email+"_"+Date.now());

	// console.log(hmac, apikey);

	if(global.users.accounts[hmac] != undefined)	return undefined;

	global.users.accounts[hmac] = {
		notifications: false,
		email: email,
		apikey: apikey,
		created_at: Date.now()
	};

	global.users.apikeys[apikey] = hmac;

	saveAccounts();

	return apikey;
}

function saveAccounts(filename) {
	var fs = require('fs');
	var file = __dirname+"/"+(filename || "accounts.json");
	fs.writeFileSync(file, JSON.stringify(global.users));	
}

function readAccounts(filename) {
	try {
		var fs = require('fs');
		var file = __dirname+"/"+(filename || "accounts.json");
		var data = fs.readFileSync(file, "utf-8");

		var json = JSON.parse(data);
		global.users = json;

	} catch(error) {
		// global.accounts = {};
		console.log("Error loading user accounts !")
	}

	console.log(Object.keys(global.users.apikeys).length+" accounts loaded");
}

function clearMemory() {
	global.history = (global.history.length > 0 ? [global.history[global.history.length-1]] : []);
}

function autoClear() {
	for(var i in global.pairs) {
		var pair = global.pairs[i];
		for(var j in pair.values) {
			var t = new Date(pair.values[j].time).getTime();
			if(Date.now()-t > 3600000) {
				console.log("TOO OLD : Delete", j, pair.values[j])
				delete pair.values[j];
			}
		}

	}

	var nb = global.history.length;
	
	if(nb >= 200000) {
		dumpMemory();
		clearMemory();
	}
}

function generateHeader(user) {
	var html = "<div class='header'>";

	html += "<div class='pages'>";
	html += "<a href='/' class='page'>Dashboard</a>";
	html += "<a href='/charts/BTCUSD' class='page'>Charts</a>";
	html += "<a href='/balance' class='page'>Balance</a>";
	html += "<a href='/account' class='page'>Account</a>";
	html += "</div>";

	html += "<div class='logout' onclick='logout()'>Log Out</div>"

	html += "</div>";

	html += "<script>function logout() {document.cookie = 'apikey=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';window.location.reload();}</script>";

	return html;
}

function generateChartHTML(pairs, min) {
	var html = fs.readFileSync(__dirname+"/html/chart.html", {encoding: "utf-8"});
	var data = {};

	var minutes = min || 60;	//Default 1 hour
	minutes = (minutes > 240 ? 240 : minutes);	//Max 4 hours

	var max = (minutes*60000)/global.interval;

	var start = (global.history.length-max < 0 ? 0 : global.history.length-max);

	for(var i = start; i < global.history.length; i++) {
		var h = JSON.parse(JSON.stringify(global.history[i]));

		for(var j in pairs) {
			var pair = pairs[j];
	
			if(global.pairs[pair] != undefined) {
				if(data[pair] == undefined)		data[pair] = {data: [], brokers: global.pairs[pair].brokers};
				if(h.pairs[pair] != undefined)	data[pair].data.push({time: h.time, values: h.pairs[pair]});
			}
		}
	}
	// console.log(data);

	html = html.replace(/%data%/g, JSON.stringify(data));
	html = html.replace(/%pairs%/g, JSON.stringify(global.pairs));
	var header = generateHeader();
	html = html.replace(/%header%/g, header);


	var pp = global.pairs[pairs[0]];

	if(pp == undefined) {
		html = html.replace(/%data2%/g, "");
		return html;
	}

	var cur_from = pairs[0].reverse().substring(0, 3).reverse();
	var cur_to = pairs[0].replace(cur_from, "");

	// console.log(pp);
	try {
		var fee_high = brokers[pp.high.from].withdraw_fees[cur_from];
		var fee_low = brokers[pp.low.from].withdraw_fees[cur_to];

		if(fee_high == undefined || fee_low == undefined || pp.low.value >= pp.high.value) {
			html = html.replace(/%data2%/g, "");
		} else {
			var ret = new Algos.Rotation(pairs[0], fee_high, fee_low, pp.high.value, pp.low.value, 0.003).getChartData(0.003);
			html = html.replace(/%data2%/g, "var data2="+JSON.stringify(ret)+";");
		}
	} catch(error) {
		html = html.replace(/%data2%/g, "");
	}

	return html;
}

function generateAccountHTML(account) {
	var html = fs.readFileSync(__dirname+"/html/account.html", {encoding: "utf-8"});
	html = html.replace(/%data%/g, JSON.stringify(account));

	var obj = [];
	for(var i in brokers)	obj.push(i);
	html = html.replace(/%brokers%/g, JSON.stringify(obj));

	var header = generateHeader();
	html = html.replace(/%header%/g, header);

	html = html.replace(/%display_form%/g, (account.apikey == "bb9ee66fd5d967acd7148d34516fe829ad463ab01b18aeb03fa0e3b2024c0f6f" ? "block" : "none"));

	return html;
}

function generateBalanceHTML(balance) {
	var html = fs.readFileSync(__dirname+"/html/balance.html", {encoding: "utf-8"});
	html = html.replace(/%currencies%/g, JSON.stringify(global.currencies));
	html = html.replace(/%pairs%/g, JSON.stringify(global.pairs));

	var header = generateHeader();
	html = html.replace(/%header%/g, header);

	return html;
}

function generateDashboardHTML() {
	var html = fs.readFileSync(__dirname+"/html/dashboard.html", {encoding: "utf-8"});
	html = html.replace(/%data%/g, JSON.stringify(global.pairs));
	html = html.replace(/%currencies%/g, JSON.stringify(global.currencies));

	var header = generateHeader();
	html = html.replace(/%header%/g, header);

	return html;
}

var sendNotification = function(title, message, app_id) {
	var headers = {
		"Content-Type": "application/json; charset=utf-8",
		"Authorization": "Basic "+onesignal_apikey
	};

	var msg = { 
		app_id: app_id || onesignal_appid,
		contents: {"en": message},
		included_segments: ["All"]
	};

	// console.log("SENDING NOTIFICATION");

	var options = {
		host: "onesignal.com",
		port: 443,
		path: "/api/v1/notifications",
		method: "POST",
		headers: headers
	};

	var https = require('https');
	var req = https.request(options, function(res) {  
		res.on('data', function(data) {
		  // console.log("Response:");
		  // console.log(JSON.parse(data));
		});
	});

	req.on('error', function(e) {
		console.log("ERROR:");
		console.log(e);
	});

	req.write(JSON.stringify(msg));
	req.end();
};

function printMenu() {
	console.log("======= MENU =======");
	console.log("t - Toggle adding orders (current:"+global.send_orders+")");
	console.log("a - Toggle archiving (current:"+global.archiving+")");
	console.log("m - Display memory");
	console.log("c - Check closed orders");
	console.log("o - Check open orders");
	console.log("b - Show account balance");
	console.log("d - Dump memory into JSON file");
	console.log("r - Clear memory");
	console.log("h - Show this menu");
	console.log("====================");
	console.log("Type value then press enter");
}

function exitHandler() {
    console.log("Exiting... Saving data first !");
    dumpMemory("memdata.json");
    saveAccounts();
    process.exit();
}

function awaitResult(req, res, now) {
	if(global.tmp[now] == undefined) return;
	if(req.user.brokers == undefined)	req.user.brokers = {};

	if(global.tmp[now].received == Object.keys(req.user.brokers).length) {
		res.status(200).send(global.tmp[now].result);
		delete global.tmp[now];
	} else if(Date.now() > global.tmp[now].expires) {
		res.status(500).send("TIMEOUT ERROR");
		delete global.tmp[now];
	} else {
		setInterval(awaitResult, 1000, req, res, now);
	}
}

String.prototype.reverse = function() {
    var splitString = this.split(""); // var splitString = "hello".split("");
    var reverseArray = splitString.reverse(); // var reverseArray = ["h", "e", "l", "l", "o"].reverse();
    var joinArray = reverseArray.join(""); // var joinArray = ["o", "l", "l", "e", "h"].join("");
    return joinArray; // "olleh"
}

//===============================================================
// INIT
//===============================================================
process.stdin.resume();//so the program will not close instantly

// process.on('exit', exitHandler);	//do something when app is closing
process.on('SIGINT', exitHandler);	//catches ctrl+c event

process.on('uncaughtException', function(err) {	//catches uncaught exceptions
        console.log("Exception caught : "+err);
});

stdin.on('data', function(chunk) {
	// console.log("Got chunk: " + chunk); 

	if(chunk == "m\n")		console.log(global.pairs);
	else if(chunk == "h\n")	printMenu();
	else if(chunk == "c\n")	getClosedOrders(true);
	else if(chunk == "o\n")	getOpenOrders(true);
	else if(chunk == "t\n")	global.send_orders = !global.send_orders;
	else if(chunk == "b\n")	showBalance();
	else if(chunk == "d\n")	dumpMemory();
	else if(chunk == "a\n")	global.archiving = !global.archiving;
	else if(chunk == "r\n") {
		dumpMemory();
		clearMemory();
	}
});

readMemoryBackup();
readAccounts();

// getOpenOrders();
// getClosedOrders();
// setInterval(getOpenOrders, 10000)
// setInterval(getClosedOrders, 10000)
setInterval(archive, 10000);


for(var i in global.pairs) {
	updateTickerValue(i);
	setInterval(updateTickerValue, global.interval, i);
	// setInterval(algorithm, 20000, i);
}

setInterval(autoClear, 60000)
printMenu();

//===============================================================
// EXPRESS SERVER
//===============================================================
var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json())

var auth = function (req, res, next) {
	function unauthorized(res) {
		// res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
		return res.status(401).send(fs.readFileSync(__dirname+"/html/login.html", "utf-8"));
	};

	if(req.headers.cookie == undefined)	return unauthorized(res);

	var valid = false;

	var cook = req.headers.cookie.replace(/ /g, "");
	var cookies = cook.split(';');
	for(var i in cookies) {
		if(cookies[i].startsWith("apikey=")) {
			var s = cookies[i].substr(7);
			// console.log(s);
			if(global.users.apikeys[s] != undefined) {
				req.user = global.users.accounts[global.users.apikeys[s]];
				valid = true;
				break;
			}
		}
	}

	if(!valid)	return unauthorized(res);
	next();
};

app.use("/public", express.static('public'));

app.get("/charts/:pairs", auth, function(req, res) {
	try {
		var pairs = req.params.pairs;
		if(pairs.indexOf(".") > 0)	pairs = pairs.split(".");
		else						pairs = [pairs];

		res.status(200).send(generateChartHTML(pairs, req.query.minutes));
	} catch(err) {
		console.log(err)
	}
});

app.get("/", auth, function(req, res) {
	res.status(200).send(generateDashboardHTML());
});

app.get("/balance", auth, function(req, res) {
	res.status(200).send(generateBalanceHTML());
});

app.get("/api/balance", auth, function(req, res) {
	var data = {};

	var now = Date.now()+"";
	global.tmp[now] = {received: 0, expires: parseInt(now)+10000, result: {}};

	for(var i in req.user.brokers) {
			(async() => {
				try {
					var brokername = i;
					var userinfo = req.user.brokers[brokername];
					var broker = brokers[brokername];

					var apikey = decryptKey(userinfo.apikey, req.user.apikey, brokername);
					var secret = decryptKey(userinfo.secret, req.user.apikey, brokername);

					var v = await broker.getBalance(apikey, secret);

					// console.log(v);

					global.tmp[now].received++;
					global.tmp[now].result[brokername] = v;
					// console.log("SUCCESS", global.tmp[now].received);
				} catch(error) {
					global.tmp[now].received++;
					console.log("Error fetching balance for broker "+i+" user: "+req.user.email);
				}
			})();
	}
	setInterval(awaitResult, 1000, req, res, now);
});

app.get("/account", auth, function(req, res) {
	res.status(200).send(generateAccountHTML(req.user));
});

app.post("/account", auth, function(req, res) {
	req.user.notifications = req.body.notifications;

	for(var broker in req.body.brokers) {
		var b = req.body.brokers[broker];

		var enc_apikey, enc_secret;
		if(b.apikey.startsWith(global.prefix) && b.apikey.endsWith(global.prefix)) { //ENCRYPTED
			enc_apikey = b.apikey;
			enc_secret = b.secret;
		} else {
			enc_apikey = encryptKey(b.apikey, req.user.apikey, broker);
			enc_secret = encryptKey(b.secret, req.user.apikey, broker);
			// var dec = decryptKey(enc, req.user.apikey, broker);
		}
		b.apikey = enc_apikey;
		b.secret = enc_secret;
	}

	req.user.brokers = req.body.brokers;

	res.status(200).send();
	saveAccounts();
});

app.post("/account/new", auth, function(req, res) {
	createAccount(req.body.email, req.body.password);
	res.status(200).send();
});

app.post("/login", function(req, res) {
	try {
		var hmac = generateHmac(req.body.email+req.body.password);

		if(global.users.accounts[hmac] != null)	res.status(200).send(global.users.accounts[hmac].apikey);
		else							res.status(401).send("Unknown email/password");
	} catch(err) {
		console.log(err)
	}
});

app.get("/api/pairs", auth, function(req, res) {
	res.status(200).send(global.pairs);
});

app.use("/.well-known", express.static('.well-known'));


global.verbose = false;
var port = process.env.PORT || 5999;

for(var i=0; i<process.argv.length; i++) {
	if(process.argv[i] == "-v")	verbose = true;
	else if(process.argv[i] == "-p") {
		if(process.argv.length > i+1)	port = process.argv[i+1];
	}
}

// var server = app.listen(port);
// console.log('Listening on port '+port+""+(global.verbose ? " VERBOSE" : "")+'...');

//=======================================================
// HTTPS
//=======================================================

var options = {
    key: fs.readFileSync('certificates/privkey.pem'),
    cert: fs.readFileSync('certificates/fullchain.pem')
};

var port_https = 443;
var server_https = https.createServer(options, app).listen(port_https, function(){
	console.log("Express HTTPS server listening on port " + port_https);
});

var http = express();
//http.get('/', function(req,res) {
//    var redirect = 'https://'+req.get('host')+req.url;
//        // console.log(redirect)
//    res.redirect(redirect);
//});

http.use("/.well-known", express.static('.well-known'));

var server_http = http.listen(port);
console.log('HTTP:'+port+' HTTPS:'+port_https);


// var r = bittrex.getBalance("25a5446226cb4a408af3b17394caca90", "f1372732c3a14c1c8c8fd529c5c11610");
// console.log(r);

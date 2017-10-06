const fs = require('fs');
const express = require('express');
const https = require('https');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const stdin = process.openStdin();

const KrakenClient = require('./brokers/kraken.js');
const BitfinexClient = require('./brokers/bitfinex.js');
const ACXClient = require('./brokers/acx.js');
const CoinbaseClient = require('./brokers/coinbase.js');
const PoloniexClient = require('./brokers/poloniex.js');
const BittrexClient = require('./brokers/bittrex.js');

const key1 = process.env.KRAKEN_KEY;
const secret1 = process.env.KRAKEN_SECRET;
const onesignal_apikey = process.env.ONESIGNAL_APIKEY;
const onesignal_appid = process.env.ONESIGNAL_APPID;

const kraken = new KrakenClient(key1, secret1);
const bitfinex = new BitfinexClient(key1, secret1);
const acx = new ACXClient(key1, secret1);
const coinbase = new CoinbaseClient(key1, secret1);
const poloniex = new PoloniexClient(key1, secret1);
const bittrex = new BittrexClient(key1, secret1);

const brokers = {
	"KRAKEN": kraken,
	"BITFINEX": bitfinex,
	"ACX": acx,
	"COINBASE": coinbase,
	"POLONIEX": poloniex,
	"BITREX": bittrex
}

//==========================================================
// VARIABLES
//==========================================================

global.users = {
	accounts: {},
	apikeys: {}
};
// global.accounts = {
// 	notifications: true
// };

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
	OMG: {name: "Omisego", logo: "http://neocashradio.com/wp-content/uploads/2017/08/omisego.jpg"},
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
	BTCUSD : {brokers: ["KRAKEN", "BITFINEX", "COINBASE", "POLONIEX"], threshold: 20, default_buy_price: 6, last_notification: 0},
	ETHUSD : {brokers: ["KRAKEN", "BITFINEX", "POLONIEX"], threshold: 20, default_buy_price: 6, last_notification: 0},
	LTCUSD : {brokers: ["KRAKEN", "BITFINEX"], threshold: 20, default_buy_price: 6, last_notification: 0},
	BTCEUR : {brokers: ["KRAKEN"], threshold: 1, default_buy_price: 6, last_notification: 0},
	ETHEUR : {brokers: ["KRAKEN"], threshold: 1, default_buy_price: 6, last_notification: 0},
	LTCEUR : {brokers: ["KRAKEN"], threshold: 1, default_buy_price: 6, last_notification: 0},
	BTCAUD : {brokers: ["ACX"], threshold: 1, default_buy_price: 6, last_notification: 0},
	ETHBTC : {brokers: ["KRAKEN", "BITFINEX", "COINBASE", "POLONIEX", "BITREX"], threshold: 0.002, default_buy_price: 6, last_notification: 0},
	LTCBTC : {brokers: ["KRAKEN", "BITFINEX", "COINBASE", "POLONIEX", "BITREX"], threshold: 0.002, default_buy_price: 6, last_notification: 0},
	XMRBTC : {brokers: ["POLONIEX", "BITFINEX", "KRAKEN", "BITREX"], threshold: 1, default_buy_price: 6, last_notification: 0},
	DASHBTC: {brokers: ["POLONIEX", "KRAKEN", "BITREX"], threshold: 1, default_buy_price: 6, last_notification: 0},
	ZECBTC: {brokers: ["POLONIEX", "BITFINEX", "KRAKEN", "BITREX"], threshold: 1, default_buy_price: 6, last_notification: 0},
	NEOBTC: {brokers: ["BITFINEX", "BITREX"], threshold: 1, default_buy_price: 6, last_notification: 0},

	ETCBTC: {brokers: ["BITFINEX", "BITREX", "POLONIEX"], threshold: 1, default_buy_price: 6, last_notification: 0},
	BCHBTC: {brokers: ["BITFINEX", "BITREX", "POLONIEX"], threshold: 1, default_buy_price: 6, last_notification: 0},
	OMGBTC: {brokers: ["BITFINEX", "BITREX", "POLONIEX"], threshold: 1, default_buy_price: 6, last_notification: 0},

};

global.archiving = true;
global.history = [];
global.tmp = {};
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

			pp.diff = high.value-low.value;
			// if(pp.diff < 0)	break;

			// if(pair == "BTCUSD") {
				// console.log("HIGH "+high.value+"/"+high.from, "LOW "+low.value+"/"+low.from);
				// console.log("DIFF "+pair+" ("+high.from+" > "+low.from+"): "+pp.diff+" "+pair.substr(3));
			// }

			if(pp.diff >= global.pairs[pair].threshold) {
				var msg = "DIFF "+pair+" ("+high.from+" > "+low.from+"): "+pp.diff+" "+pair.substr(3);
				if(pair.last_notification+300000 < Date.now()) {
					pair.last_notification = Date.now();
					// sendNotification("", msg);
				}
			}


		} catch(error) {
			console.log("ERROR FOR BROKER "+brokername+", PAIR : "+pair, error);
		}
	}

	// var newval = parseFloat(res.result[Object.keys(res.result)[0]]["c"][0]);
	// var curval = global.pairs[pair].current_value;

	// var prevtrend = global.pairs[pair].trend+"";
	// var newtrend;
	// var v = newval/curval;
	// if(v < 1) {
	// 	newtrend = "down";		//DOWN

	// }
	// else if(v > 1) {
	// 	newtrend = "up";		//UP
	// }
	// else {
	// 	newtrend = "stable";	//STABLE
	// }
	
	// if(prevtrend == newtrend)	global.pairs[pair].trending_for++;	//TREND HAS NOT CHANGED
	// else {	// NEW TREND

	// 	var tfor = global.pairs[pair].trending_for+0;
	// 	var trend = (((newval-global.pairs[pair].trend_start_value)/global.pairs[pair].trend_start_value)*100)+prevtrend;
	// 	var now = Date.now();

	// 	if(trend < 100 && trend > -100) {
	// 		var obj = {trend: trend, "for": tfor, starts_at: global.pairs[pair].trend_starts_at+0, ends_at: now, ends: newval};
	// 		global.pairs[pair].history.push(obj);

	// 		if(obj.trend > global.pairs[pair].threshold || obj.trend < -global.pairs[pair].threshold) {
	// 			var msg = pair+" has "+(obj.trend < 0 ? "dropped -" : "raised +")+obj.trend.toFixed(3)+"%";
	// 			sendNotification("", msg);
	// 		}
	// 	}

	// 	global.pairs[pair].trending_for = 1;
	// 	global.pairs[pair].trend_starts_at = now;
	// 	global.pairs[pair].trend = newtrend;
	// 	global.pairs[pair].trend_start_value = newval;
	// }
	// global.pairs[pair].current_value = newval;

	// var obj = {trend: trend, "for": tfor, starts_at: global.pairs[pair].trend_starts_at+0, ends_at: now, ends: newval};
}

// function algorithm(pairname) {
// 	// showValueOf(pairname);

// 	if(!global.send_orders)	return;

// 	var pair = global.pairs[pairname];
// 	var nb_orders = Object.keys(pair.orders).length;
// 	// if(pair.order_in_progress)	console.log("ORDER IN PROGRESS FOR PAIR "+pairname+"...");
// 	if(nb_orders == 0) {
// 		if(!pair.order_in_progress) {
// 			// console.log("NO ORDER FOR PAIR "+pp);
// 			// sendSellOrder(vof, vin);

// 			// if(pair.last_order_type == "sell")		sendBuyOrder(pairname);
// 			// else if(pair.last_order_type == "buy")	sendSellOrder(pairname);
// 		}
// 	} else {
// 		// console.log("PAIR "+pp+" HAS "+nb_orders+" ORDER");
// 	}
// }

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

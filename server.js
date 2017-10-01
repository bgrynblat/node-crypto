const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const stdin = process.openStdin();

const KrakenClient = require('./brokers/kraken.js');
const BitfinexClient = require('./brokers/bitfinex.js');
const ACXClient = require('./brokers/acx.js');
const CoinbaseClient = require('./brokers/coinbase.js');
const PoloniexClient = require('./brokers/poloniex.js');

const key1 = process.env.KRAKEN_KEY;
const secret1 = process.env.KRAKEN_SECRET;
const onesignal_apikey = process.env.ONESIGNAL_APIKEY;
const onesignal_appid = process.env.ONESIGNAL_APPID;

const kraken = new KrakenClient(key1, secret1);
const bitfinex = new BitfinexClient(key1, secret1);
const acx = new ACXClient(key1, secret1);
const coinbase = new CoinbaseClient(key1, secret1);
const poloniex = new PoloniexClient(key1, secret1);

const brokers = {
	"KRAKEN": kraken,
	"BITFINEX": bitfinex,
	"ACX": acx,
	"COINBASE": coinbase,
	"POLONIEX": poloniex
}

//==========================================================
// INIT
//==========================================================

if(key1 == undefined || secret1 == undefined) {
	console.log("No KRAKEN keys, exiting.");
	process.exit();
}

//==========================================================
// FETCH FROM BROKERS
//==========================================================

global.users = {
	accounts: {},
	apikeys: {}
};
// global.accounts = {
// 	notifications: true
// };

global.pairs = {
	BTCUSD : {brokers: ["KRAKEN", "BITFINEX", "COINBASE", "POLONIEX"], threshold: 20, default_buy_price: 6, last_notification: 0},
	ETHUSD : {brokers: ["KRAKEN", "BITFINEX", "POLONIEX"], threshold: 20, default_buy_price: 6, last_notification: 0},
	LTCUSD : {brokers: ["KRAKEN", "BITFINEX", "POLONIEX"], threshold: 20, default_buy_price: 6, last_notification: 0},
	BTCAUD : {brokers: ["ACX"], threshold: 1, default_buy_price: 6},
	ETHBTC : {brokers: ["KRAKEN", "BITFINEX", "COINBASE", "POLONIEX"], threshold: 0.002, default_buy_price: 6, last_notification: 0},
	LTCBTC : {brokers: ["KRAKEN", "BITFINEX", "COINBASE", "POLONIEX"], threshold: 0.002, default_buy_price: 6, last_notification: 0},
	BTCEUR : {brokers: ["KRAKEN"], threshold: 1, default_buy_price: 6},
	ETHEUR : {brokers: ["KRAKEN"], threshold: 1, default_buy_price: 6},
	LTCEUR : {brokers: ["KRAKEN"], threshold: 1, default_buy_price: 6},
};

global.archiving = true;
global.history = [];
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

async function showBalance() {
	var res = await kraken.api('Balance');
	if(res.error[0] != null)	console.err(res.error);
	else {
		console.log(res.result);
	}
}

async function updateTickerValue(pair) {
	for(var i in global.pairs[pair].brokers) {
		try {
			var brokername = global.pairs[pair].brokers[i];
			// console.log(pair, brokername);
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
					sendNotification("", msg);
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
	var nb = global.history;
	// for(var i in global.pairs)
	// 	nb += global.pairs[i].history.length;

	if(nb >= 200000) {
		dumpMemory();
		clearMemory();
	}
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
	
			if(data[pair] == undefined)		data[pair] = {data: [], brokers: global.pairs[pair].brokers};
			if(h.pairs[pair] != undefined)	data[pair].data.push({time: h.time, values: h.pairs[pair]});
		}
	}
	// console.log(data);

	html = html.replace(/%data%/g, JSON.stringify(data));
	return html;
}

function generateAccountHTML(account) {
	var html = fs.readFileSync(__dirname+"/html/account.html", {encoding: "utf-8"});
	html = html.replace(/%data%/g, JSON.stringify(account));

	html = html.replace(/%display_form%/g, (account.apikey == "bb9ee66fd5d967acd7148d34516fe829ad463ab01b18aeb03fa0e3b2024c0f6f" ? "block" : "none"));

	return html;
}

function generateDashboardHTML() {
	var html = fs.readFileSync(__dirname+"/html/dashboard.html", {encoding: "utf-8"});
	html = html.replace(/%data%/g, JSON.stringify(global.pairs));
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

function generateHmac(string) {
	const hmac = crypto.createHmac('sha256', "bcrypt0");
	hmac.update(string);
	return hmac.digest('hex');
}

//===============================================================
// INIT
//===============================================================
process.stdin.resume();//so the program will not close instantly

function exitHandler() {
    console.log("Exiting... Saving data first !");
    dumpMemory("memdata.json");
    saveAccounts();
    process.exit();
}

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

app.get("/account", auth, function(req, res) {
	res.status(200).send(generateAccountHTML(req.user));
});

app.post("/account", auth, function(req, res) {
	if(req.body.notifications)	req.user.notifications = (req.body.notifications == 'true' ? true : false);
	// if(req.body.notifications)	req.user.notifications = (req.body.notifications == 'true' ? true : false);

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


global.verbose = false;
var port = process.env.PORT || 5999;

for(var i=0; i<process.argv.length; i++) {
	if(process.argv[i] == "-v")	verbose = true;
	else if(process.argv[i] == "-p") {
		if(process.argv.length > i+1)	port = process.argv[i+1];
	}
}

var server = app.listen(port);
console.log('Listening on port '+port+""+(global.verbose ? " VERBOSE" : "")+'...');
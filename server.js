const fs = require('fs');
const express = require('express');
const KrakenClient = require('./kraken.js');
const BitfinexClient = require('./bitfinex.js');
const stdin = process.openStdin();

const key1 = process.env.KRAKEN_KEY;
const secret1 = process.env.KRAKEN_SECRET;
const onesignal_apikey = process.env.ONESIGNAL_APIKEY;
const onesignal_appid = process.env.ONESIGNAL_APPID;

const kraken = new KrakenClient(key1, secret1);
const bitfinex = new BitfinexClient(key1, secret1);

const brokers = {
	"KRAKEN": kraken,
	"BITFINEX": bitfinex
}

//==========================================================
// INIT
//==========================================================

if(key1 == undefined || secret1 == undefined) {
	console.log("No KRAKEN keys, exiting.");
	process.exit();
}

//==========================================================
// KRAKEN
//==========================================================

global.account = {
	notifications: true
};

global.pairs = {
	BTCEUR : {brokers: ["KRAKEN"], threshold: 1, default_buy_price: 6},
	ETHEUR : {brokers: ["KRAKEN"], threshold: 1, default_buy_price: 6},
	LTCEUR : {brokers: ["KRAKEN"], threshold: 1, default_buy_price: 6},
	BTCUSD : {brokers: ["KRAKEN", "BITFINEX"], threshold: 1, default_buy_price: 6},
	ETHUSD : {brokers: ["KRAKEN", "BITFINEX"], threshold: 1, default_buy_price: 6},
	LTCUSD : {brokers: ["KRAKEN", "BITFINEX"], threshold: 1, default_buy_price: 6},
}
global.archiving = true;
global.history = [];
global.send_orders = false;

for(var i in global.pairs) {
	global.pairs[i].values = {};
	global.pairs[i].last_order_value = null;
	global.pairs[i].last_order_volume = null;
	global.pairs[i].last_order_type = "buy";
	global.pairs[i].orders = {};
	global.pairs[i].order_in_progress = false;
	global.pairs[i].trend = null;
	global.pairs[i].trending_for = 1;
	global.pairs[i].trend_start_value = 0;
	global.pairs[i].trend_starts_at = Date.now();
	global.pairs[i].history = [];
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
	try {
		for(var i in global.pairs[pair].brokers) {
			var brokername = global.pairs[pair].brokers[i];
			var broker = brokers[brokername];
			var res = await broker.getTickerValue(pair);

			global.pairs[pair].values[brokername] = res;
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
	} catch(error) {
		console.log("ERROR FOR PAIR : "+pair, error);
	}
}

async function getOpenOrders(verbose) {
	try {
		var res = await kraken.api('OpenOrders', { trades : true });

	    if(res.error[0] != null)        console.err(res.error);
	    else {
	    	var nb = Object.keys(res.result["open"]).length;

	    	for(var i = 0; i<nb; i++) {
	    		var key = Object.keys(res.result["open"])[i];
	    		var order = res.result["open"][key];

	    		if(verbose)	console.log(key+" (REF:"+order["userref"]+" STATUS:"+order["status"]+"): "+order["descr"]["order"]);
	    		// console.log(order["descr"]["pair"]);

	    		for(var j in global.pairs) {
	    			var oo = global.pairs[j];
	    			if(oo.kraken_pair == order["descr"]["pair"]) {

	    				if(oo.orders[key] == undefined)
	    					console.log("NEW ORDER FOR PAIR "+order["descr"]["pair"]+" : "+key);

	    				oo.orders[key] = order;
	    				oo.last_order_value = order["descr"]["price"];
	    			}
	       		}

	    		// console.log("ORDER : "+key+" => ",);
	    	}
		}
	} catch(error) {
		// console.log("ERROR", error);
	}
}

async function getClosedOrders(verbose) {
	try {
		var res = await kraken.api('ClosedOrders', { trades : true });
	    if(res.error[0] != null)        console.err(res.error);
	    else {
	    	var nb = Object.keys(res.result["closed"]).length;
	    	for(var i = nb-1; i>=0; i--) {
	    		var key = Object.keys(res.result["closed"])[i];
	    		var order = res.result["closed"][key];

	    		if(verbose)	console.log(key+" (REF:"+order["userref"]+" STATUS:"+order["status"]+"): "+order["descr"]["order"]);

	    		for(var j in global.pairs) {
	    			var oo = global.pairs[j];
	    			if(oo.kraken_pair == order["descr"]["pair"]) {

	    				if(order.status == "closed") {
			    			// console.log("LAST ORDER :", order);
			    			oo.last_order_value = parseFloat(order.descr.price);
			    			oo.last_order_volume = parseFloat(order.vol_exec);
			    			oo.last_order_type = order.descr.type;
			    		}

	    				if(oo.orders[key] != undefined) {
	    					console.log("ORDER "+key+" closed");
	    					delete oo.orders[key];
	    				}
	    			}
	       		}

	    		// console.log("ORDER : "+key+" => ",);
	    	}
		}
	} catch(error) {
		console.log("ERROR FETCHING CLOSED ORDERS", error.code);
	}
}

function showValueOf(pairname) {
	var vals = global.pairs[pairname].value;
	var thresh = global.pairs[pairname].threshold;

	var vof = pairname.substr(0,3);
	var vin = pairname.substr(pairname.length-3);

	if(val != null)	{
		// console.log(Date()+" - 1 "+vof+" = "+val+" "+vin+" ===> +"+thresh+"% / -"+thresh+"% = "+val*(1+(thresh/100))+" / "+val*(1-(thresh/100)));
	}
}

function sendBuyOrder(pairname) {
	var vof = pairname.substr(0,3);
	var vin = pairname.substr(pairname.length-3);

	var pair = global.pairs[pairname];

	var volume = pair.default_buy_price/pair.current_value;
	volume = volume.toFixed(3);

	pair.order_in_progress = true;

	(async() => {

		var price = pair.current_value*1;
		price = price.toFixed(2);

		try {
			var ref = Date.now()+"";
			ref = parseInt("1"+ref.substr(ref.length-7));

			console.log(Date()+" - +++ BUY ORDER "+volume+" "+vof+" FOR "+pair.current_value*volume+" "+vin+" (AT:"+pair.current_value+" "+vin+" - REF: "+ref+")");
			var params = {
				pair: pairname,
				type: "buy",
				ordertype: "limit",
				volume: volume,
				price: price,
				userref: ref
			};

			var res = await kraken.api('AddOrder', params);

			if(res.error[0] != null)	console.err("THERE", res.error);
			else {
				console.log("BUY ORDER SUCCESSFULLY SENT : ",res.result["descr"])
				pair.order_in_progress = false;
				pair.last_order_value = price;
				pair.code = 1;
			}
		} catch(error) {
			var msg = "ERROR SENDING ORDER : "+error.code;
			pair.order_in_progress = false;

			if(error.code == "ETIMEDOUT") {
				// msg += " - RETRYING...";
				// sendBuyOrder(vof, vin, volume);
			} else msg = "ERROR SENDING ORDER REF: "+ref+" - "+error;

			// console.log(msg);
		}
	})();
}

function sendSellOrder(pairname, volume) {
	var vof = pairname.substr(0,3);
	var vin = pairname.substr(pairname.length-3);

	var pair = global.pairs[pairname];
	volume = volume || pair.last_order_volume;
	
	var price = pair.last_order_value*(1+(pair.threshold/100));
	price = price.toFixed(1);

	if(price < pair.current_value)	price = pair.current_value;

	pair.order_in_progress = true;

	(async() => {

		try {
			var ref = Date.now()+"";
			ref = parseInt("2"+ref.substr(ref.length-7));

			console.log(Date()+" - --- SELL ORDER "+volume+" "+vof+" FOR "+price*volume+" "+vin+" (AT:"+price+" "+vin+" - REF: "+ref+")");
			var params = {
				pair: pairname,
				type: "sell",
				ordertype: "limit",
				volume: volume,
				price: price,
				userref: ref
			};

			var res = await kraken.api('AddOrder', params);
			
			// console.log("HERE", res);

			if(res.error[0] != null)	console.err("THERE", res.error);
			else {
				console.log("SELL ORDER SUCCESSFULLY SENT : ",res.result["descr"])
				pair.order_in_progress = false;
				pair.code = 0;
			}
		} catch(error) {
			// console.log("ERROR SENDING ORDER REF: "+ref, error);
			pair.order_in_progress = false;
		}
	})();
}

function algorithm(pairname) {
	// showValueOf(pairname);

	if(!global.send_orders)	return;

	var pair = global.pairs[pairname];
	var nb_orders = Object.keys(pair.orders).length;
	if(pair.order_in_progress)	console.log("ORDER IN PROGRESS FOR PAIR "+pairname+"...");
	if(nb_orders == 0) {
		if(!pair.order_in_progress) {
			// console.log("NO ORDER FOR PAIR "+pp);
			// sendSellOrder(vof, vin);

			if(pair.last_order_type == "sell")		sendBuyOrder(pairname);
			else if(pair.last_order_type == "buy")	sendSellOrder(pairname);
		}
	} else {
		// console.log("PAIR "+pp+" HAS "+nb_orders+" ORDER");
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

function dumpMemory() {
	var fs = require('fs');
	fs.writeFile(Date.now()+"-dump.json", JSON.stringify(global.history), function(err) {
		if(err)	return console.log(err);
		console.log("The file was saved!");
	});
}

function clearMemory() {
	global.history = (global.history.length > 0 ? [global.history[global.history.length-1]] : []);
}

function autoClear() {
	var nb = 0;
	for(var i in global.pairs)
		nb += global.pairs[i].history.length;

	if(nb >= 200000) {
		dumpMemory();
		clearMemory();
	}
}

function generateHTML(pairs) {
	var html = fs.readFileSync(__dirname+"/chart.html", {encoding: "utf-8"});

	var data = {};

	for(var i in global.history) {
		var h = JSON.parse(JSON.stringify(global.history[i]));

		for(var j in pairs) {
			var pair = pairs[j];
	
			if(data[pair] == undefined)		data[pair] = [];
			if(h.pairs[pair] != undefined)	data[pair].push({time: h.time, values: h.pairs[pair]});
		}
	}

	console.log(data);

	html = html.replace(/%data%/g, JSON.stringify(data));

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

stdin.on('data', function(chunk) {
	// console.log("Got chunk: " + chunk); 

	if(chunk == "m\n")		console.log(global.history);
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

getOpenOrders();
getClosedOrders();
setInterval(getOpenOrders, 10000)
setInterval(getClosedOrders, 10000)
setInterval(archive, 10000);


for(var i in global.pairs) {
	updateTickerValue(i);
	setInterval(updateTickerValue, global.interval, i);
	setInterval(algorithm, 20000, i);
}

setInterval(autoClear, 60000)
printMenu();

//===============================================================
// EXPRESS SERVER
//===============================================================
var app = express();

var auth = function (req, res, next) {
	function unauthorized(res) {
		// res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
		return res.status(401).send(fs.readFileSync("login.html", "utf-8"));
	};

	next();
};

app.get("/charts/:pairs", auth, function(req, res) {
	try {
		var pairs = req.params.pairs;
		if(pairs.indexOf(".") > 0)	pairs = pairs.split(".");
		else						pairs = [pairs];

		res.status(200).send(generateHTML(pairs));
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
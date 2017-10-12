// var cur_from = "BTC";
// var cur_to = "DASH";

// var fee_low = 0.05;		//DASH
// var fee_high = 0.001; 	//BTC

// var rate_low = 0.0207;	//1 DASH = 0.06BTC
// var rate_high = 0.0209;	//1 DASH = 0.07BTC
// var diff = rate_high-rate_low;		//BTC

// var a = 1;	//VALUE
// var min_gain = 0.002;

var increment = 0.005;

class Rotation {
	constructor(pair, fee_high, fee_low, rate_high, rate_low, min_gain) {
		this.fee_high = fee_high;
		this.fee_low = fee_low;
		this.rate_high = rate_high;
		this.rate_low = rate_low;
		this.min_gain = min_gain;
		this.pair = pair;
	}

	algoA(a, fee_high, fee_low, rate_high, rate_low) {
		var e = (((a-fee_high)/rate_low)-fee_low)*rate_high;
		return e;
	}

	algoB(a, fee_high, fee_low, rate_high, rate_low) {
		var b=a/rate_low;
		var c=b-fee_low;
		var d=c*rate_high;
		var e=d-fee_high;
		return e;
	}

	algoC(a, fee_high, fee_low, rate_high, rate_low) {
		var b=a-fee_low;
		var c=b*rate_high;
		var d=c-fee_high;
		var e=d/rate_low;
		return e;
	}

	algoD(a, fee_high, fee_low, rate_high, rate_low) {
		var b=a*rate_high;
		var c=b-fee_high;
		var d=c/rate_low;
		var e=d-fee_low;

		return e;
	}

	checkMinimumTradeValue(min_gain, algo) {

		min_gain = (min_gain == undefined ? 0.001 : min_gain);
		algo = (algo == undefined ? this.algoB : algo);

		var diff = this.rate_high - this.rate_low;

		var dd = -1;
		var i =0
		for(i = diff; dd<min_gain; i+=increment) {
			var f = algo(i, this.fee_high, this.fee_low, this.rate_high, this.rate_low);
			dd = f-i;
			// console.log("A", i);
		}
		i -= increment;
		// console.log(i, "=>", f, "("+dd+")");
		return {pair: this.pair, min: i, gain: dd};
	}

	getChartData(min_gain, algo) {

		console.log(this.pair, this.fee_high, this.fee_low, this.rate_high, this.rate_low);

		min_gain = (min_gain == undefined ? 0.001 : min_gain);
		algo = (algo == undefined ? this.algoB : algo);

		var diff = this.rate_high - this.rate_low;

		var increment = 0.01;

		var invest = [], gain = [];
		var dd = -1;
		var i =0
		for(i = 0; dd<min_gain; i+=increment) {
			var f = algo(i, this.fee_high, this.fee_low, this.rate_high, this.rate_low);
			dd = f-i;
			
			invest.push(i);
			gain.push(dd);
			// console.log("A", i);
		}
		i -= increment;

		// console.log(i, "=>", f, "("+dd+")");
		var ret = {x: invest, y: gain};
		return ret;
	}

}

module.exports = Rotation;

// var retA = checkMinimumTradeValue(min_gain,algoA);
// var retB = checkMinimumTradeValue(min_gain,algoB);
// // var retC = checkMinimumTradeValue(min_gain,algoC);
// // var retD = checkMinimumTradeValue(min_gain,algoD);
// console.log("ALGO A Minimum value :", retA.min, cur_from, "(+"+retA.gain+")");
// console.log("ALGO B Minimum value :", retB.min, cur_from, "(+"+retB.gain+")");

// var e = algoB(retA.min, fee_high, fee_low, rate_high, rate_low);
// console.log("ALGO B Invest:", retA.min, cur_from, "=>", e, "(+"+(e-retA.min)+")");

// console.log("ALGO C Minimum value :", retC.min, cur_to, "(+"+retC.gain+")");
// console.log("ALGO D Minimum value :", retD.min, cur_to, "(+"+retD.gain+")");
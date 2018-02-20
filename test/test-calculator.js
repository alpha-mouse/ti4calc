// todo This tests suite is not paranoid enough. There are many more edge cases then those that are tested here.

var calc = require("../calculator").calculator;
var im = require("../imitator").imitator;
var _ = require("underscore");

var distributionsEqual = function (distr1, distr2, epsilon) {
	var min = Math.min(distr1.min(), distr2.min());
	var max = Math.max(distr1.max(), distr2.max());
	if (isNaN(min) || isNaN(max)) return false;
	var cumulative1 = 0, cumulative2 = 0;
	for (var i = min; i <= max; i++) {
		if (epsilon < Math.abs(distr1.at(i) - distr2.at(i)))
			return false;

		cumulative1 += distr1.at(i);
		cumulative2 += distr2.at(i);
		if (epsilon < Math.abs(cumulative1 - cumulative2))
			return false;
	}
	if (epsilon < Math.abs((distr1.deadlock || 0) - (distr2.deadlock)))
		return false;
	return true;
};

var invertDistribution = function (distr) {
	return {
		min: function () {
			return -distr.max();
		},
		max: function () {
			return -distr.min();
		},
		at: function (i) {
			return distr.at(-i);
		}
	};
};

var accuracy = 0.02;

//test unit counts expansion into ship units
exports.expansion = function (test) {
	var fleet = {};
	fleet[calc.UnitType.Dreadnought] = 4;
	fleet[calc.UnitType.Cruiser] = 3;
	fleet[calc.UnitType.PDS] = 2;

	var expansion = calc.expandFleet(fleet);

	var u = calc.UnitType;
	var expected = [calc.units[u.Dreadnought],
					calc.units[u.Dreadnought],
					calc.units[u.Dreadnought],
					calc.units[u.Dreadnought],
					calc.units[u.Cruiser],
					calc.units[u.Cruiser],
					calc.units[u.Cruiser],
					calc.units[u.PDS],
					calc.units[u.PDS],
					calc.units[u.Dreadnought],
					calc.units[u.Dreadnought],
					calc.units[u.Dreadnought],
					calc.units[u.Dreadnought]];

	test.ok(expansion, "no expansion");
	test.equal(expansion.length, expected.length, "wrong length");
	for (var i = 0; i < expansion.length; i++)
		test.equal(expansion[i].type, expected[i].type, "wrong ship at " + i);

	test.done();
};

exports.expansionWithOptions = function (test) {
	var fleet = {};
	fleet[calc.UnitType.Dreadnought] = 4;
	fleet[calc.UnitType.Cruiser] = 3;
	fleet[calc.UnitType.Carrier] = 3;
	fleet[calc.UnitType.PDS] = 2;
	var damaged = {};
	damaged[calc.UnitType.Dreadnought] = 1;
	damaged[calc.UnitType.Cruiser] = 1;
	damaged[calc.UnitType.Carrier] = 2;

	var expansion = calc.expandFleet(fleet, damaged, {}, {}, {allowDamage: true, enhancedArmor: true, advancedCarriers: true});

	var u = calc.UnitType;
	var expected = [calc.units[u.Dreadnought],
		calc.units[u.Dreadnought],
		calc.units[u.Dreadnought],
		calc.units[u.Dreadnought],
		calc.units[u.Cruiser],
		calc.units[u.Cruiser],
		calc.units[u.Cruiser],
		calc.units[u.Carrier],
		calc.units[u.Carrier],
		calc.units[u.Carrier],
		calc.units[u.PDS],
		calc.units[u.PDS],
		calc.units[u.Dreadnought].toDamageGhost(),
		calc.units[u.Dreadnought].toDamageGhost(),
		calc.units[u.Dreadnought].toDamageGhost(),
		calc.units[u.Cruiser].toDamageGhost(),
		calc.units[u.Cruiser].toDamageGhost(),
		calc.units[u.Carrier].toDamageGhost(),
	];

	test.ok(expansion, "no expansion");
	test.equal(expansion.length, expected.length, "wrong length");
	for (var i = 0; i < expansion.length; i++) {
		test.equal(expansion[i].type, expected[i].type, "wrong ship at " + i);
		test.equal(expansion[i].isDamageGhost, expected[i].isDamageGhost, "isDamageGhost wrong at " + i);
	}

	test.done();
};

//test default ship sort
exports.defaultSort = function (test) {
	var unit = calc.UnitType;
	var fleet = {};
	fleet[unit.WarSun] = 1;
	fleet[unit.Dreadnought] = 1;
	fleet[unit.Cruiser] = 1;
	fleet[unit.Destroyer] = 1;
	fleet[unit.Carrier] = 1;
	fleet[unit.Mech] = 1
	fleet[unit.Ground] = 1;
	fleet[unit.Fighter] = 1;
	fleet[unit.PDS] = 1;
	var expansion = calc.expandFleet(fleet);
	var shuffled = _.shuffle(expansion);
	var got = calc.defaultSort(shuffled);
	
	var expected = [calc.units[unit.WarSun],
					calc.units[unit.Dreadnought],
					calc.units[unit.Cruiser],
					calc.units[unit.Destroyer],
					calc.units[unit.Carrier],
					calc.units[unit.Mech],
					calc.units[unit.Ground],
					calc.units[unit.Fighter],
					calc.units[unit.PDS],
					calc.units[unit.WarSun].toDamageGhost(),
					calc.units[unit.Dreadnought].toDamageGhost(),
					calc.units[unit.Mech].toDamageGhost()];
	test.equal(expected.length, got.length, "wrong length");
	var fleetTypesToString = function(fleet){
		return fleet.map(function(u){return u.shortType();}).reduce(function(prev, current){return prev + current;}, "");
	};
	for (var i = 0; i < expansion.length; i++)
		if (!(expected[i].type === got[i].type && expected[i].isDamageGhost === got[i].isDamageGhost)){
			test.ok(false, "Wrong sort. From " + fleetTypesToString(shuffled) + " got " + fleetTypesToString(got));
			break;
		}

	test.done();
};

var defaultSortGravitonNegator = function(test, boosted, expected){
	var unit = calc.UnitType;
	var fleet = {};
	fleet[unit.Destroyer] = 1;
	fleet[unit.Ground] = 3;
	fleet[unit.Fighter] = 3;
	fleet[unit.PDS] = 1;
	var modifiers = {};
	modifiers[boosted] = 3;
	var expansion = calc.expandFleet(fleet, {}, modifiers);
	var shuffled = _.shuffle(expansion);
	var got = calc.defaultSort(shuffled, true);
	
	test.equal(expected.length, got.length, "wrong length");
	var fleetTypesToString = function(fleet){
		return fleet.map(function(u){return u.shortType();}).reduce(function(prev, current){return prev + current;}, "");
	};
	for (var i = 0; i < expansion.length; i++)
		if (!(expected[i].type === got[i].type)){
			test.ok(false, "Wrong sort. From " + fleetTypesToString(shuffled) + " got " + fleetTypesToString(got));
			break;
		}

	test.done();
}

exports.defaultSortGravitonNegatorGoodFighters = function (test) {
	var unit = calc.UnitType;
	var expected = [calc.units[unit.Destroyer],
				calc.units[unit.Ground],
				calc.units[unit.Fighter],
				calc.units[unit.Fighter],
				calc.units[unit.Fighter],
				calc.units[unit.Ground],
				calc.units[unit.Ground],
				calc.units[unit.PDS]];
	defaultSortGravitonNegator(test, unit.Fighter, expected);
};

exports.defaultSortGravitonNegatorGoodGroundForces = function (test) {
	var unit = calc.UnitType;
	var expected = [calc.units[unit.Destroyer],
				calc.units[unit.Ground],
				calc.units[unit.Ground],
				calc.units[unit.Ground],
				calc.units[unit.Fighter],
				calc.units[unit.Fighter],
				calc.units[unit.Fighter],
				calc.units[unit.PDS]];
	defaultSortGravitonNegator(test, unit.Ground, expected);
};

//test symmetric battle by imitator
exports.symmetricImitator = function (test) {
	var fleet = {};
	fleet[calc.UnitType.Dreadnought] = 2;
	fleet[calc.UnitType.Destroyer] = 4;
	fleet[calc.UnitType.Cruiser] = 2;
	fleet[calc.UnitType.PDS] = 1;
	fleet[calc.UnitType.Fighter] = 3;
	var fleet1 = calc.defaultSort(calc.expandFleet(fleet));
	var fleet2 = calc.defaultSort(calc.expandFleet(fleet));
	var distr = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	var inverse = invertDistribution(distr);
	test.ok(distributionsEqual(distr, inverse, accuracy), "got asymmetric distribution");
	test.done();
};


//test symmetric battle by simulator
exports.symmetricSimulator = function (test) {
	var fleet = {};
	fleet[calc.UnitType.WarSun] = 1;
	fleet[calc.UnitType.Dreadnought] = 2;
	fleet[calc.UnitType.Destroyer] = 4;
	fleet[calc.UnitType.Cruiser] = 2;
	fleet[calc.UnitType.PDS] = 1;
	fleet[calc.UnitType.Carrier] = 2;
	fleet[calc.UnitType.Fighter] = 3;
	var fleet1 = calc.defaultSort(calc.expandFleet(fleet));
	var fleet2 = calc.defaultSort(calc.expandFleet(fleet));
	var distr = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	var inverse = invertDistribution(distr);
	test.ok(distributionsEqual(distr, inverse, accuracy), "got asymmetric distribution");
	test.done();
};



//test compare space battle
exports.space = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Cruiser] = 4;
	fleet1[calc.UnitType.Destroyer] = 6;
	fleet1[calc.UnitType.Dreadnought] = 2;

	fleet2[calc.UnitType.WarSun] = 2;
	fleet2[calc.UnitType.Cruiser] = 7;
	fleet2[calc.UnitType.Destroyer] = 4;
	fleet2[calc.UnitType.Ground] = 4;
	fleet2[calc.UnitType.Carrier] = 3;
	fleet2[calc.UnitType.PDS] = 3;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

//test another space battle
exports.space2 = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.WarSun] = 4;
	fleet1[calc.UnitType.Dreadnought] = 2;
	fleet1[calc.UnitType.Destroyer] = 6;
	fleet1[calc.UnitType.Cruiser] = 2;
	fleet1[calc.UnitType.Carrier] = 6;

	fleet2[calc.UnitType.WarSun] = 2;
	fleet2[calc.UnitType.Cruiser] = 7;
	fleet2[calc.UnitType.Destroyer] = 4;
	fleet2[calc.UnitType.Ground] = 4;
	fleet2[calc.UnitType.Carrier] = 3;
	fleet2[calc.UnitType.PDS] = 3;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

//test space battle with unit modifiers
exports.spaceModifiers = function (test) {

	var fleet1 = {};

	fleet1[calc.UnitType.WarSun] = 2;
	fleet1[calc.UnitType.Dreadnought] = 4;
	fleet1[calc.UnitType.Cruiser] = 2;
	fleet1[calc.UnitType.Destroyer] = 3;

	var fleet2 = {};
	fleet2[calc.UnitType.WarSun] = 1;
	fleet2[calc.UnitType.Dreadnought] = 1;
	fleet2[calc.UnitType.Cruiser] = 4;
	fleet2[calc.UnitType.Destroyer] = 2;
	fleet2[calc.UnitType.Carrier] = 5;
	fleet2[calc.UnitType.PDS] = 4;

	var fleet2Mods = {};
	fleet2Mods[calc.UnitType.WarSun] = 3;
	fleet2Mods[calc.UnitType.Dreadnought] = 3;
	fleet2Mods[calc.UnitType.Cruiser] = 3;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2, {}, fleet2Mods));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

//test long space battle
exports.spaceLong = function (test) {

	var fleet1 = {};

	fleet1[calc.UnitType.Cruiser] = 1;
	fleet1[calc.UnitType.Carrier] = 5;
	fleet1[calc.UnitType.Fighter] = 22;

	var fleet2 = {};
	fleet2[calc.UnitType.Cruiser] = 1;
	fleet2[calc.UnitType.Carrier] = 5;
	fleet2[calc.UnitType.Fighter] = 20;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

//test performance
exports.spacePerformance = function (test) {

	var fleet1 = {};

	fleet1[calc.UnitType.Cruiser] = 1;
	fleet1[calc.UnitType.Carrier] = 5;
	fleet1[calc.UnitType.Fighter] = 22;

	var fleet2 = {};
	fleet2[calc.UnitType.Cruiser] = 1;
	fleet2[calc.UnitType.Carrier] = 5;
	fleet2[calc.UnitType.Fighter] = 20;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

 	var s = new Date();
 	for (var i = 0; i < 100; ++i)
		calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	var elapsed = new Date() - s;

	s = new Date();
	var dummy = 1;
	for (var i = 0; i < 700000000; ++i)
			dummy *= 1.000000001;
	var elapsedComparison = new Date() - s;

	test.ok(elapsed < elapsedComparison, "such performance is suspicious: " + elapsed / elapsedComparison);

	test.done();
};

exports.spaceBarrageNoGhosts = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Destroyer] = 5;
	fleet1[calc.UnitType.Fighter] = 4;

	fleet2[calc.UnitType.Destroyer] = 1;
	fleet2[calc.UnitType.Fighter] = 3;
	fleet2[calc.UnitType.PDS] = 1;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.spaceBarrageSplitDefender = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Cruiser] = 2;
	fleet1[calc.UnitType.Destroyer] = 4;
	fleet1[calc.UnitType.Fighter] = 7;

	fleet2[calc.UnitType.Dreadnought] = 3;
	fleet2[calc.UnitType.Destroyer] = 3;
	fleet2[calc.UnitType.Fighter] = 4;
	fleet2[calc.UnitType.PDS] = 1;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.spaceBarrageSplitAttacker = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Dreadnought] = 3;
	fleet1[calc.UnitType.Destroyer] = 3;
	fleet1[calc.UnitType.Fighter] = 4;
	fleet1[calc.UnitType.PDS] = 1;

	fleet2[calc.UnitType.Cruiser] = 2;
	fleet2[calc.UnitType.Destroyer] = 4;
	fleet2[calc.UnitType.Fighter] = 7;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.spaceBarrageQuadraticSplit = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.WarSun] = 2;
	fleet1[calc.UnitType.Destroyer] = 2;
	fleet1[calc.UnitType.Fighter] = 4;

	fleet2[calc.UnitType.Dreadnought] = 3;
	fleet2[calc.UnitType.Destroyer] = 4;
	fleet2[calc.UnitType.Fighter] = 2;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.spaceBarragePDSvsDestroyers = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Dreadnought] = 1;
	fleet1[calc.UnitType.Fighter] = 2;
	fleet1[calc.UnitType.PDS] = 2;

	fleet2[calc.UnitType.Destroyer] = 3;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.spaceBarragePDSandDestroyers = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Cruiser] = 3;
	fleet1[calc.UnitType.Fighter] = 4;

	fleet2[calc.UnitType.Destroyer] = 3;
	fleet2[calc.UnitType.PDS] = 4;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.spaceBarrageHyperPDS = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Dreadnought] = 1;
	fleet1[calc.UnitType.Fighter] = 1;
	fleet1[calc.UnitType.PDS] = 8;

	fleet2[calc.UnitType.Destroyer] = 1;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.spaceBarrageMess = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Dreadnought] = 1;
	fleet1[calc.UnitType.Destroyer] = 2;
	fleet1[calc.UnitType.Fighter] = 4;
	fleet1[calc.UnitType.PDS] = 4;

	fleet2[calc.UnitType.Dreadnought] = 2;
	fleet2[calc.UnitType.Destroyer] = 4;
	fleet2[calc.UnitType.Fighter] = 2;
	fleet2[calc.UnitType.PDS] = 1;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};


//test compare ground battle
exports.ground = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Ground] = 4;
	fleet1[calc.UnitType.Dreadnought] = 2;
	fleet1[calc.UnitType.WarSun] = 1;

	fleet2[calc.UnitType.Ground] = 6;
	fleet2[calc.UnitType.Cruiser] = 7; //should have no impact
	fleet2[calc.UnitType.PDS] = 2;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.groundLonelyPDS = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Ground] = 2;

	fleet2[calc.UnitType.PDS] = 2;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.mentakRacial = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Cruiser] = 3;
	fleet1[calc.UnitType.Destroyer] = 1;

	fleet2[calc.UnitType.Cruiser] = 1;
	fleet2[calc.UnitType.Carrier] = 1;
	var options = {attacker:{mentak:true},defender:{mentak:true}};

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.mentakRacialWithBarrageAndPds = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Dreadnought] = 1;
	fleet1[calc.UnitType.Destroyer] = 2;
	fleet1[calc.UnitType.Fighter] = 2;
	fleet1[calc.UnitType.PDS] = 1;

	fleet2[calc.UnitType.Dreadnought] = 1;
	fleet2[calc.UnitType.Destroyer] = 1;
	fleet2[calc.UnitType.Fighter] = 1;
	fleet2[calc.UnitType.PDS] = 2;
	var options = {attacker:{mentak:true},defender:{mentak:false}};

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.moraleBoost1stRound = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Dreadnought] = 2;

	fleet2[calc.UnitType.Fighter] = 5;

	var options = {attacker:{moraleBoost1:true},defender:{moraleBoost1:true}};

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.assaultCannon = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Dreadnought] = 1;
	fleet1[calc.UnitType.Cruiser] = 3;

	fleet2[calc.UnitType.Dreadnought] = 3;

	var options = {attacker:{allowDamage:false, assaultCannon:true},defender:{allowDamage:false, assaultCannon:true}};

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1, {}, {}, {}, options.attacker));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2, {}, {}, {}, options.defender));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.gravitonLaserSystem = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Cruiser] = 3;
	fleet1[calc.UnitType.PDS] = 2;

	fleet2[calc.UnitType.Dreadnought] = 1;
	fleet2[calc.UnitType.PDS] = 3;

	var options = {attacker:{gravitonLaser:true},defender:{gravitonLaser:true}};

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.gravitonNegatorBombardment = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Dreadnought] = 3;
	fleet1[calc.UnitType.Ground] = 2;

	fleet2[calc.UnitType.Ground] = 2;
	fleet2[calc.UnitType.PDS] = 3;

	var options = {attacker:{gravitonNegator:true},defender:{gravitonNegator:true}};

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.gravitonNegatorFighters = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Dreadnought] = 3;
	fleet1[calc.UnitType.Ground] = 2;
	fleet1[calc.UnitType.Fighter] = 3;

	fleet2[calc.UnitType.Ground] = 2;
	fleet2[calc.UnitType.PDS] = 3;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1), true);
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.automatedDefenceTurretPositiveMod = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Fighter] = 1;
	fleet1[calc.UnitType.Destroyer] = 1;

	fleet2[calc.UnitType.Fighter] = 1;
	fleet2[calc.UnitType.Destroyer] = 1;
	var fleet2Mods = {};
	fleet2Mods[calc.UnitType.Destroyer] = +10;

	var options = {attacker:{defenceTurret:true},defender:{defenceTurret:true}};

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2, {}, fleet2Mods));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.automatedDefenceTurretNegativeMod = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Fighter] = 1;
	fleet1[calc.UnitType.Destroyer] = 1;

	fleet2[calc.UnitType.Fighter] = 1;
	fleet2[calc.UnitType.Destroyer] = 1;
	var fleet2Mods = {};
	fleet2Mods[calc.UnitType.Destroyer] = -10;

	var options = {attacker:{defenceTurret:true},defender:{defenceTurret:true}};

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2, {}, fleet2Mods));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.mechAndGroundBattle = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Ground] = 2;
	fleet1[calc.UnitType.Mech] = 2;

	fleet1[calc.UnitType.Ground] = 2;
	fleet1[calc.UnitType.Mech] = 2;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.mechAndGroundVsPDS = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Ground] = 2;
	fleet1[calc.UnitType.Mech] = 1;

	fleet2[calc.UnitType.PDS] = 2;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.bombardAgainstMechsSimple = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Ground] = 1;
	fleet1[calc.UnitType.Dreadnought] = 2;

	fleet2[calc.UnitType.Mech] = 1;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.bombardAgainstMechs = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Ground] = 1;
	fleet1[calc.UnitType.Dreadnought] = 2;
	fleet1[calc.UnitType.WarSun] = 1;

	fleet2[calc.UnitType.Ground] = 4;
	fleet2[calc.UnitType.Mech] = 1;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.bombardAgainstMechsMoreBombardersThanTargets = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Ground] = 1;
	fleet1[calc.UnitType.Mech] = 1;
	fleet1[calc.UnitType.Dreadnought] = 5;
	fleet1[calc.UnitType.WarSun] = 3;

	fleet2[calc.UnitType.Ground] = 2;
	fleet2[calc.UnitType.Mech] = 3;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.bombardAgainstMechsMoreBombardersThanAttackingUnits = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Ground] = 1;
	fleet1[calc.UnitType.Mech] = 1;
	fleet1[calc.UnitType.Dreadnought] = 5;
	fleet1[calc.UnitType.WarSun] = 3;

	fleet2[calc.UnitType.Ground] = 1;
	fleet2[calc.UnitType.Mech] = 1;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.bombardAgainstMechsLessBombardersThanTargets = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Ground] = 1;
	fleet1[calc.UnitType.Mech] = 1;
	fleet1[calc.UnitType.Dreadnought] = 1;
	fleet1[calc.UnitType.WarSun] = 1;

	fleet2[calc.UnitType.Ground] = 5;
	fleet2[calc.UnitType.Mech] = 5;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.bombardAgainstMechsLessBombardersThanAttackingUnits = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Ground] = 5;
	fleet1[calc.UnitType.Mech] = 3;
	fleet1[calc.UnitType.Dreadnought] = 1;
	fleet1[calc.UnitType.WarSun] = 1;

	fleet2[calc.UnitType.Ground] = 5;
	fleet2[calc.UnitType.Mech] = 5;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.bombardAgainstMechsDreadBombardWithoutInvasion = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Dreadnought] = 1;

	fleet2[calc.UnitType.Ground] = 1;
	fleet2[calc.UnitType.Mech] = 1;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.bombardAgainstMechsDreadBombardAgaintPDS = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Ground] = 1;
	fleet1[calc.UnitType.Dreadnought] = 1;

	fleet2[calc.UnitType.Ground] = 1;
	fleet2[calc.UnitType.Mech] = 1;
	fleet2[calc.UnitType.PDS] = 1;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.bombardAgainstMechsDreadBombardWithWarSunAgaintPDS = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Ground] = 1;
	fleet1[calc.UnitType.Dreadnought] = 1;
	fleet1[calc.UnitType.WarSun] = 1;

	fleet2[calc.UnitType.Ground] = 3;
	fleet2[calc.UnitType.Mech] = 1;
	fleet2[calc.UnitType.PDS] = 1;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.bombardAgainstMechsDreadBombardWithWarSunGravNegatorAgaintPDS = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Ground] = 1;
	fleet1[calc.UnitType.Dreadnought] = 1;
	fleet1[calc.UnitType.WarSun] = 1;

	fleet2[calc.UnitType.Ground] = 3;
	fleet2[calc.UnitType.Mech] = 1;
	fleet2[calc.UnitType.PDS] = 1;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var options = {attacker:{gravitonNegator:true},defender:{defenceTurret:true}};

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.bombardAgainstMechsWarSunWithoutInvasionCombat = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Dreadnought] = 5;
	fleet1[calc.UnitType.WarSun] = 3;

	fleet2[calc.UnitType.Ground] = 5;
	fleet2[calc.UnitType.Mech] = 3;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};


exports.bombardAgainstMechsTwoDiceDreadLessThanTarget = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Ground] = 1;
	fleet1[calc.UnitType.Dreadnought] = 1;

	fleet2[calc.UnitType.Ground] = 3;
	fleet2[calc.UnitType.Mech] = 1;

	var fleetMods = {};
	var diceMods = {};
	diceMods[calc.UnitType.Dreadnought] = 2;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1, {}, fleetMods, diceMods));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.bombardAgainstMechsTwoDiceDreadMoreThanTarget = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Ground] = 1;
	fleet1[calc.UnitType.Dreadnought] = 3;

	fleet2[calc.UnitType.Ground] = 3;
	fleet2[calc.UnitType.Mech] = 1;

	var fleetMods = {};
	var diceMods = {};
	diceMods[calc.UnitType.Dreadnought] = 2;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1, {}, fleetMods, diceMods));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.bombardAgainstMechsMassiveComplexBattle = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Ground] = 3;
	fleet1[calc.UnitType.Dreadnought] = 2;
	fleet1[calc.UnitType.WarSun] = 1;
	fleet1[calc.UnitType.Mech] = 3;

	fleet2[calc.UnitType.Ground] = 3;
	fleet2[calc.UnitType.Mech] = 1;
	fleet2[calc.UnitType.PDS] = 3;

	var fleetMods = {};
	var diceMods = {};
	diceMods[calc.UnitType.Dreadnought] = 2;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1, {}, fleetMods, diceMods));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var options = {attacker:{gravitonNegator:true},defender:{defenceTurret:true}};

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.xxchaRacial = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Ground] = 3;

	fleet2[calc.UnitType.Ground] = 3;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var options = {attacker:{xxcha:true},defender:{}};

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.xxchaRacialAgainstMoraleBoost = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Dreadnought] = 2;

	fleet2[calc.UnitType.Cruiser] = 3;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var options = {attacker:{xxcha:true},defender:{moraleBoost1:true}};

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.damageOptions = function (test) {
	// actually nothing should break here if calc.expandFleet is working properly

	var fleet1 = {};
	fleet1[calc.UnitType.Dreadnought] = 1;
	fleet1[calc.UnitType.Cruiser] = 2;
	fleet1[calc.UnitType.Carrier] = 2;
	var damaged1 = {};
	damaged1[calc.UnitType.Dreadnought] = 1;
	damaged1[calc.UnitType.Cruiser] = 1;
	damaged1[calc.UnitType.Carrier] = 0;

	var fleet2 = {};
	fleet2[calc.UnitType.Cruiser] = 6;

	var options1 = {allowDamage: true, enhancedArmor: true, advancedCarriers: true};
	fleet1 = calc.defaultSort(calc.expandFleet(fleet1, damaged1, {}, {}, options1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space, {attacker: options1, defender: {}}).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space, {attacker: options1, defender: {}}).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.admirals = function (test) {
	// actually nothing should break here if calc.expandFleet is working properly

	var fleet1 = {};
	fleet1[calc.UnitType.Dreadnought] = 1;
	fleet1[calc.UnitType.Cruiser] = 1;

	var fleet2 = {};
	fleet2[calc.UnitType.Dreadnought] = 1;
	fleet2[calc.UnitType.Cruiser] = 2;

	var options1 = {allowDamage: true, admiral: calc.UnitType.Dreadnought};
	var options2 = {allowDamage: true, admiral: calc.UnitType.Cruiser, moraleBoost1: true};
	var options = {attacker: options1, defender: options2};
	fleet1 = calc.defaultSort(calc.expandFleet(fleet1, {}, {}, {}, options.attacker));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2, {}, {}, {}, options.defender));


	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

/*
Enabling these tests doesn't make sense as calculator cannot deal with duranium armor and application uses imitator for that.
But if you find a way to calculate probabilities with duranium analytically - enable these tests to check correctness.
exports.dreadnoughtFighterAgainstDreadnaughtFighterWithoutDuraniumArmorSingle = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Dreadnought] = 1;
	fleet1[calc.UnitType.Fighter] = 1;

	fleet2[calc.UnitType.Dreadnought] = 1;
	fleet2[calc.UnitType.Fighter] = 1;

	var fleetMods = {};
	var diceMods = {};
	diceMods[calc.UnitType.Dreadnought] = 1;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1, fleetMods, false, diceMods));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2, fleetMods, false, diceMods));

	var options = {attacker:{duraniumArmor:false},defender:{}};

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.dreadnoughtFighterAgainstDreadnaughtFighterWithDuraniumArmorSingle = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Dreadnought] = 1;
	fleet1[calc.UnitType.Fighter] = 1;

	fleet2[calc.UnitType.Dreadnought] = 1;
	fleet2[calc.UnitType.Fighter] = 1;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var options = {attacker:{duraniumArmor:true},defender:{}};

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};


exports.duraniumArmorSpaceBattle = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Dreadnought] = 2;
	fleet1[calc.UnitType.Cruiser] = 2;

	fleet2[calc.UnitType.Cruiser] = 5;
	fleet2[calc.UnitType.Fighter] = 1;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var options = {attacker: {duraniumArmor: true}, defender: {}};

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.duraniumArmorInvasion = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Ground] = 4;

	fleet2[calc.UnitType.Ground] = 1;
	fleet2[calc.UnitType.Mech] = 2;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var options = {attacker: {}, defender: {duraniumArmor: true}};

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Ground, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Ground, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.duraniumArmorDeadlock = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Dreadnought] = 1;

	fleet2[calc.UnitType.Dreadnought] = 1;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var options = {attacker: {duraniumArmor: true}, defender: {duraniumArmor: true}};

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.duraniumArmorInapplicable = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Cruiser] = 3;

	fleet2[calc.UnitType.Cruiser] = 1;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var options = {attacker: {duraniumArmor: true}, defender: {duraniumArmor: true}};

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};

exports.duraniumArmorMoraleBoost = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[calc.UnitType.Dreadnought] = 2;
	fleet1[calc.UnitType.Cruiser] = 6;

	fleet2[calc.UnitType.Dreadnought] = 2;
	fleet2[calc.UnitType.Cruiser] = 5;
	fleet2[calc.UnitType.Fighter] = 1;

	fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
	fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

	var options = {attacker: {duraniumArmor: true, moraleBoost1: true}, defender: {duraniumArmor: true, moraleBoost1: true}};

	var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), "empirical differs from analytical");

	test.done();
};
*/

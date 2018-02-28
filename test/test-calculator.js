// todo This tests suite is not paranoid enough. There are many more edge cases then those that are tested here.

var game = require('../game-elements');
var calc = require('../calculator').calculator;
var im = require('../imitator').imitator;
var defaultRace = 'Sardakk';

function distributionsEqual(distr1, distr2, epsilon) {
	var min = Math.min(distr1.min, distr2.min);
	var max = Math.max(distr1.max, distr2.max);
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
	return true;
}

function invertDistribution(distr) {
	return {
		min: -distr.max,
		max: -distr.min,
		at: function (i) {
			return distr.at(-i);
		},
	};
}

var accuracy = 0.02;

/** test unit counts expansion into ship units */
exports.expansion = function (test) {
	var fleet = {};
	fleet[game.UnitType.Dreadnought] = { count: 4 };
	fleet[game.UnitType.Cruiser] = { count: 3 };
	fleet[game.UnitType.PDS] = { count: 2 };

	var expansion = game.expandFleet(defaultRace, fleet);

	var u = game.UnitType;
	var expected = [game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Cruiser],
		game.StandardUnits[u.Cruiser],
		game.StandardUnits[u.Cruiser],
		game.StandardUnits[u.PDS],
		game.StandardUnits[u.PDS],
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.StandardUnits[u.Dreadnought].toDamageGhost()];

	test.ok(expansion, 'no expansion');
	test.equal(expansion.length, expected.length, 'wrong length');
	for (var i = 0; i < expansion.length; i++) {
		test.equal(expansion[i].type, expected[i].type, 'wrong ship at ' + i);
		test.equal(expansion[i].isDamageGhost, expected[i].isDamageGhost, 'isDamageGhost wrong at ' + i);
	}

	test.done();
};

exports.expansionWithUpgrades = function (test) {
	var fleet = {};
	fleet[game.UnitType.Dreadnought] = { count: 1 };
	fleet[game.UnitType.Carrier] = { count: 1, upgraded: true };
	fleet[game.UnitType.Cruiser] = { count: 3, upgraded: true };
	fleet[game.UnitType.PDS] = { count: 2, upgraded: true };

	var expansion = game.expandFleet('Sol', fleet);

	var u = game.UnitType;
	var expected = [
		game.StandardUnits[u.Dreadnought],
		game.StandardUpgrades[u.Cruiser],
		game.StandardUpgrades[u.Cruiser],
		game.StandardUpgrades[u.Cruiser],
		game.RaceSpecificUpgrades.Sol[u.Carrier],
		game.StandardUpgrades[u.PDS],
		game.StandardUpgrades[u.PDS],
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.RaceSpecificUpgrades.Sol[u.Carrier].toDamageGhost(),
	];

	test.ok(expansion, 'no expansion');
	test.equal(expansion.length, expected.length, 'wrong length');
	for (var i = 0; i < expansion.length; i++) {
		test.equal(expansion[i].type, expected[i].type, 'wrong ship at ' + i);

		test.equal(expansion[i].isDamageGhost, expected[i].isDamageGhost, 'isDamageGhost wrong at ' + i);
		if (expected[i].type === u.PDS) {
			test.equal(expansion[i].spaceCannonValue, expected[i].spaceCannonValue, 'wrong space cannon at ' + i);
		} else if (expected[i].isDamageGhost) {
			test.ok(isNaN(expansion[i].battleValue), 'battleValue not NaN for damage ghost at ' + i);
		} else {
			test.equal(expansion[i].battleValue, expected[i].battleValue, 'wrong battleValue at ' + i);
		}
	}

	test.done();
};

/** test default ship sort */
exports.defaultSort = function (test) {
	var unit = game.UnitType;
	var fleet = {};
	fleet[unit.Flagship] = { count: 1 };
	fleet[unit.WarSun] = { count: 1 };
	fleet[unit.Dreadnought] = { count: 1 };
	fleet[unit.Cruiser] = { count: 1 };
	fleet[unit.Destroyer] = { count: 1 };
	fleet[unit.Carrier] = { count: 1 };
	fleet[unit.Ground] = { count: 1 };
	fleet[unit.Fighter] = { count: 1 };
	fleet[unit.PDS] = { count: 1 };
	var expansion = game.expandFleet(defaultRace, fleet);

	var units = Object.assign({}, game.RaceSpecificUnits[defaultRace], game.StandardUnits);

	var expected = [
		units[unit.Flagship],
		units[unit.WarSun],
		units[unit.Dreadnought],
		units[unit.Cruiser],
		units[unit.Destroyer],
		units[unit.Carrier],
		units[unit.Fighter],
		units[unit.Ground],
		units[unit.PDS],
		units[unit.Flagship].toDamageGhost(),
		units[unit.WarSun].toDamageGhost(),
		units[unit.Dreadnought].toDamageGhost(),
	];
	test.equal(expected.length, expansion.length, 'wrong length');
	var fleetTypesToString = function (fleet) {
		return fleet.map(function (u) {
			return u.shortType;
		}).reduce(function (prev, current) {
			return prev + current;
		}, '');
	};
	for (var i = 0; i < expansion.length; i++) {
		if (!(expected[i].type === expansion[i].type && expected[i].isDamageGhost === expansion[i].isDamageGhost)) {
			test.ok(false, 'Wrong sort. Got ' + fleetTypesToString(expansion));
			break;
		}
	}

	test.done();
};

/** test symmetric battle by imitator */
exports.symmetricImitator = function (test) {
	var fleet = {};
	fleet[game.UnitType.Dreadnought] = 2;
	fleet[game.UnitType.Destroyer] = 4;
	fleet[game.UnitType.Cruiser] = 2;
	fleet[game.UnitType.PDS] = 1;
	fleet[game.UnitType.Fighter] = 3;
	var fleet1 = game.expandFleet(defaultRace, fleet);
	var fleet2 = game.expandFleet(defaultRace, fleet);
	var distr = im.estimateProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
	var inverse = invertDistribution(distr);
	test.ok(distributionsEqual(distr, inverse, accuracy), 'got asymmetric distribution');
	test.done();
};

/** test symmetric battle by calculator */
exports.symmetricCalculator = function (test) {
	var fleet = {};
	fleet[game.UnitType.WarSun] = 1;
	fleet[game.UnitType.Dreadnought] = 2;
	fleet[game.UnitType.Destroyer] = 4;
	fleet[game.UnitType.Cruiser] = 2;
	fleet[game.UnitType.PDS] = 1;
	fleet[game.UnitType.Carrier] = 2;
	fleet[game.UnitType.Fighter] = 3;
	var fleet1 = game.expandFleet(defaultRace, fleet);
	var fleet2 = game.expandFleet(defaultRace, fleet);
	var distr = calc.computeProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
	var inverse = invertDistribution(distr);
	test.ok(distributionsEqual(distr, inverse, accuracy), 'got asymmetric distribution');
	test.done();
};

/** test space battle */
exports.space = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Cruiser] = { count: 4 };
	fleet1[game.UnitType.Destroyer] = { count: 6 };
	fleet1[game.UnitType.Dreadnought] = { count: 2 };

	fleet2[game.UnitType.WarSun] = { count: 2 };
	fleet2[game.UnitType.Cruiser] = { count: 7 };
	fleet2[game.UnitType.Destroyer] = { count: 4 };
	fleet2[game.UnitType.Ground] = { count: 4 };
	fleet2[game.UnitType.Carrier] = { count: 3 };
	fleet2[game.UnitType.PDS] = { count: 3 };

	fleet1 = game.expandFleet(defaultRace, fleet1);
	fleet2 = game.expandFleet(defaultRace, fleet2);

	var expected = im.estimateProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), 'empirical differs from analytical');

	test.done();
};

/** test another space battle */
exports.space2 = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.WarSun] = { count: 4 };
	fleet1[game.UnitType.Dreadnought] = { count: 2 };
	fleet1[game.UnitType.Destroyer] = { count: 6 };
	fleet1[game.UnitType.Cruiser] = { count: 2 };
	fleet1[game.UnitType.Carrier] = { count: 6 };

	fleet2[game.UnitType.WarSun] = { count: 2 };
	fleet2[game.UnitType.Cruiser] = { count: 7 };
	fleet2[game.UnitType.Destroyer] = { count: 4 };
	fleet2[game.UnitType.Ground] = { count: 4 };
	fleet2[game.UnitType.Carrier] = { count: 3 };
	fleet2[game.UnitType.PDS] = { count: 3 };

	fleet1 = game.expandFleet(defaultRace, fleet1);
	fleet2 = game.expandFleet(defaultRace, fleet2);

	var expected = im.estimateProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), 'empirical differs from analytical');

	test.done();
};

/** test space battle with unit upgrades */
exports.spaceUpgrades = function (test) {

	var fleet1 = {};

	fleet1[game.UnitType.WarSun] = { count: 2 };
	fleet1[game.UnitType.Dreadnought] = { count: 4 };
	fleet1[game.UnitType.Cruiser] = { count: 2, upgraded: true };
	fleet1[game.UnitType.Destroyer] = { count: 3 };

	var fleet2 = {};
	fleet2[game.UnitType.WarSun] = { count: 1 };
	fleet2[game.UnitType.Dreadnought] = { count: 1 };
	fleet2[game.UnitType.Cruiser] = { count: 4 };
	fleet2[game.UnitType.Destroyer] = { count: 2, upgraded: true };
	fleet2[game.UnitType.Carrier] = { count: 5 };
	fleet2[game.UnitType.PDS] = { count: 4, upgraded: true };

	fleet1 = game.expandFleet(defaultRace, fleet1);
	fleet2 = game.expandFleet(defaultRace, fleet2);

	var expected = im.estimateProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), 'empirical differs from analytical');

	test.done();
};

/** test long space battle */
exports.spaceLong = function (test) {

	var fleet1 = {};

	fleet1[game.UnitType.Cruiser] = { count: 1 };
	fleet1[game.UnitType.Carrier] = { count: 5 };
	fleet1[game.UnitType.Fighter] = { count: 22 };

	var fleet2 = {};
	fleet2[game.UnitType.Cruiser] = { count: 1 };
	fleet2[game.UnitType.Carrier] = { count: 5 };
	fleet2[game.UnitType.Fighter] = { count: 20 };

	fleet1 = game.expandFleet(defaultRace, fleet1);
	fleet2 = game.expandFleet(defaultRace, fleet2);

	var expected = im.estimateProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), 'empirical differs from analytical');

	test.done();
};

/** test performance */
exports.spacePerformance = function (test) {

	var fleet1 = {};

	fleet1[game.UnitType.Cruiser] = { count: 1 };
	fleet1[game.UnitType.Carrier] = { count: 5 };
	fleet1[game.UnitType.Fighter] = { count: 22 };

	var fleet2 = {};
	fleet2[game.UnitType.Cruiser] = { count: 1 };
	fleet2[game.UnitType.Carrier] = { count: 5 };
	fleet2[game.UnitType.Fighter] = { count: 20 };

	fleet1 = game.expandFleet(defaultRace, fleet1);
	fleet2 = game.expandFleet(defaultRace, fleet2);

	var s = new Date();
	for (var i = 0; i < 100; ++i)
		calc.computeProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
	var elapsed = new Date() - s;

	s = new Date();
	var dummy = 1;
	for (var i = 0; i < 300000000; ++i)
		dummy *= 1.000000001;
	var elapsedComparison = new Date() - s;

	test.ok(elapsed < elapsedComparison, 'such performance is suspicious: ' + elapsed / elapsedComparison);

	test.done();
};

exports.spaceBarrage = {
	spaceBarrageNoGhosts: function (test) {

		var fleet1 = {};
		var fleet2 = {};
		fleet1[game.UnitType.Destroyer] = { count: 5 };
		fleet1[game.UnitType.Fighter] = { count: 4 };

		fleet2[game.UnitType.Destroyer] = { count: 1 };
		fleet2[game.UnitType.Fighter] = { count: 3 };
		fleet2[game.UnitType.PDS] = { count: 1 };

		fleet1 = game.expandFleet(defaultRace, fleet1);
		fleet2 = game.expandFleet(defaultRace, fleet2);

		var expected = im.estimateProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
		//console.log(expected.toString());
		var got = calc.computeProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
		//console.log(got.toString());
		test.ok(distributionsEqual(expected, got, accuracy), 'empirical differs from analytical');

		test.done();
	},

	spaceBarrageSplitDefender: function (test) {

		var fleet1 = {};
		var fleet2 = {};
		fleet1[game.UnitType.Cruiser] = { count: 2 };
		fleet1[game.UnitType.Destroyer] = { count: 4 };
		fleet1[game.UnitType.Fighter] = { count: 7 };

		fleet2[game.UnitType.Dreadnought] = { count: 3 };
		fleet2[game.UnitType.Destroyer] = { count: 3 };
		fleet2[game.UnitType.Fighter] = { count: 4 };
		fleet2[game.UnitType.PDS] = { count: 1 };

		fleet1 = game.expandFleet(defaultRace, fleet1);
		fleet2 = game.expandFleet(defaultRace, fleet2);

		var expected = im.estimateProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
		//console.log(expected.toString());
		var got = calc.computeProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
		//console.log(got.toString());
		test.ok(distributionsEqual(expected, got, accuracy), 'empirical differs from analytical');

		test.done();
	},

	spaceBarrageSplitAttacker: function (test) {

		var fleet1 = {};
		var fleet2 = {};
		fleet1[game.UnitType.Dreadnought] = { count: 3 };
		fleet1[game.UnitType.Destroyer] = { count: 3 };
		fleet1[game.UnitType.Fighter] = { count: 4 };
		fleet1[game.UnitType.PDS] = { count: 1 };

		fleet2[game.UnitType.Cruiser] = { count: 2 };
		fleet2[game.UnitType.Destroyer] = { count: 4 };
		fleet2[game.UnitType.Fighter] = { count: 7 };

		fleet1 = game.expandFleet(defaultRace, fleet1);
		fleet2 = game.expandFleet(defaultRace, fleet2);

		var expected = im.estimateProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
		//console.log(expected.toString());
		var got = calc.computeProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
		//console.log(got.toString());
		test.ok(distributionsEqual(expected, got, accuracy), 'empirical differs from analytical');

		test.done();
	},

	spaceBarrageQuadraticSplit: function (test) {

		var fleet1 = {};
		var fleet2 = {};
		fleet1[game.UnitType.WarSun] = { count: 2 };
		fleet1[game.UnitType.Destroyer] = { count: 2 };
		fleet1[game.UnitType.Fighter] = { count: 4 };

		fleet2[game.UnitType.Dreadnought] = { count: 3 };
		fleet2[game.UnitType.Destroyer] = { count: 4 };
		fleet2[game.UnitType.Fighter] = { count: 2 };

		fleet1 = game.expandFleet(defaultRace, fleet1);
		fleet2 = game.expandFleet(defaultRace, fleet2);

		var expected = im.estimateProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
		//console.log(expected.toString());
		var got = calc.computeProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
		//console.log(got.toString());
		test.ok(distributionsEqual(expected, got, accuracy), 'empirical differs from analytical');

		test.done();
	},

	spaceBarragePDSvsDestroyers: function (test) {

		var fleet1 = {};
		var fleet2 = {};
		fleet1[game.UnitType.Dreadnought] = { count: 1 };
		fleet1[game.UnitType.Fighter] = { count: 2 };
		fleet1[game.UnitType.PDS] = { count: 2 };

		fleet2[game.UnitType.Destroyer] = { count: 3 };

		fleet1 = game.expandFleet(defaultRace, fleet1);
		fleet2 = game.expandFleet(defaultRace, fleet2);

		var expected = im.estimateProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
		//console.log(expected.toString());
		var got = calc.computeProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
		//console.log(got.toString());
		test.ok(distributionsEqual(expected, got, accuracy), 'empirical differs from analytical');

		test.done();
	},

	spaceBarragePDSandDestroyers: function (test) {

		var fleet1 = {};
		var fleet2 = {};
		fleet1[game.UnitType.Cruiser] = { count: 3 };
		fleet1[game.UnitType.Fighter] = { count: 4 };

		fleet2[game.UnitType.Destroyer] = { count: 3 };
		fleet2[game.UnitType.PDS] = { count: 4 };

		fleet1 = game.expandFleet(defaultRace, fleet1);
		fleet2 = game.expandFleet(defaultRace, fleet2);

		var expected = im.estimateProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
		//console.log(expected.toString());
		var got = calc.computeProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
		//console.log(got.toString());
		test.ok(distributionsEqual(expected, got, accuracy), 'empirical differs from analytical');

		test.done();
	},

	spaceBarrageHyperPDS: function (test) {

		var fleet1 = {};
		var fleet2 = {};
		fleet1[game.UnitType.Dreadnought] = { count: 1 };
		fleet1[game.UnitType.Fighter] = { count: 1 };
		fleet1[game.UnitType.PDS] = { count: 8 };

		fleet2[game.UnitType.Destroyer] = { count: 1 };

		fleet1 = game.expandFleet(defaultRace, fleet1);
		fleet2 = game.expandFleet(defaultRace, fleet2);

		var expected = im.estimateProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
		//console.log(expected.toString());
		var got = calc.computeProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
		//console.log(got.toString());
		test.ok(distributionsEqual(expected, got, accuracy), 'empirical differs from analytical');

		test.done();
	},

	spaceBarrageMess: function (test) {

		var fleet1 = {};
		var fleet2 = {};
		fleet1[game.UnitType.Dreadnought] = { count: 1 };
		fleet1[game.UnitType.Destroyer] = { count: 2 };
		fleet1[game.UnitType.Fighter] = { count: 4 };
		fleet1[game.UnitType.PDS] = { count: 4 };

		fleet2[game.UnitType.Dreadnought] = { count: 2 };
		fleet2[game.UnitType.Destroyer] = { count: 4 };
		fleet2[game.UnitType.Fighter] = { count: 2 };
		fleet2[game.UnitType.PDS] = { count: 1 };

		fleet1 = game.expandFleet(defaultRace, fleet1);
		fleet2 = game.expandFleet(defaultRace, fleet2);

		var expected = im.estimateProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
		//console.log(expected.toString());
		var got = calc.computeProbabilities(fleet1, fleet2, game.BattleType.Space).distribution;
		//console.log(got.toString());
		test.ok(distributionsEqual(expected, got, accuracy), 'empirical differs from analytical');

		test.done();
	},
};

/** test compare ground battle */
exports.ground = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Ground] = { count: 4 };
	fleet1[game.UnitType.Dreadnought] = { count: 2 };
	fleet1[game.UnitType.WarSun] = { count: 1 };

	fleet2[game.UnitType.Ground] = { count: 6 };
	fleet2[game.UnitType.Cruiser] = { count: 7 }; //should have no impact
	fleet2[game.UnitType.PDS] = { count: 2 };

	fleet1 = game.expandFleet(defaultRace, fleet1);
	fleet2 = game.expandFleet(defaultRace, fleet2);

	var expected = im.estimateProbabilities(fleet1, fleet2, game.BattleType.Ground).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, game.BattleType.Ground).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), 'empirical differs from analytical');

	test.done();
};

exports.groundLonelyPDS = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Ground] = { count: 2 };

	fleet2[game.UnitType.PDS] = { count: 2 };

	fleet1 = game.expandFleet(defaultRace, fleet1);
	fleet2 = game.expandFleet(defaultRace, fleet2);

	var expected = im.estimateProbabilities(fleet1, fleet2, game.BattleType.Ground).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, game.BattleType.Ground).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), 'empirical differs from analytical');

	test.done();
};

exports.mentakRacial = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Cruiser] = { count: 1 };
	fleet1[game.UnitType.Destroyer] = { count: 1 };

	fleet2[game.UnitType.Cruiser] = { count: 1 };
	fleet2[game.UnitType.Destroyer] = { count: 1 };

	var mentak = 'Mentak';
	var options = { attacker: { race: mentak }, defender: { race: defaultRace } };

	fleet1 = game.expandFleet(mentak, fleet1);
	fleet2 = game.expandFleet(mentak, fleet2);

	var expected = im.estimateProbabilities(fleet1, fleet2, game.BattleType.Space, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, game.BattleType.Space, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), 'empirical differs from analytical');

	test.done();
};

exports.mentakRacialWithBarrageAndPds = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Dreadnought] = { count: 1 };
	fleet1[game.UnitType.Destroyer] = { count: 2 };
	fleet1[game.UnitType.Fighter] = { count: 2 };
	fleet1[game.UnitType.PDS] = { count: 1 };

	fleet2[game.UnitType.Dreadnought] = { count: 1 };
	fleet2[game.UnitType.Destroyer] = { count: 1 };
	fleet2[game.UnitType.Fighter] = { count: 1 };
	fleet2[game.UnitType.PDS] = { count: 2 };
	var mentak = 'Mentak';
	var options = { attacker: { race: mentak }, defender: { race: defaultRace } };

	fleet1 = game.expandFleet(defaultRace, fleet1);
	fleet2 = game.expandFleet(defaultRace, fleet2);

	var expected = im.estimateProbabilities(fleet1, fleet2, game.BattleType.Space, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, game.BattleType.Space, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), 'empirical differs from analytical');

	test.done();
};

exports.moraleBoost1stRound = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Dreadnought] = { count: 2 };

	fleet2[game.UnitType.Fighter] = { count: 5 };

	var options = { attacker: { moraleBoost1: true }, defender: { moraleBoost1: true } };

	fleet1 = game.expandFleet(defaultRace, fleet1);
	fleet2 = game.expandFleet(defaultRace, fleet2);

	var expected = im.estimateProbabilities(fleet1, fleet2, game.BattleType.Space, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, game.BattleType.Space, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), 'empirical differs from analytical');

	test.done();
};

exports.assaultCannon = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Dreadnought] = { count: 1 };
	fleet1[game.UnitType.Cruiser] = { count: 3 };

	fleet2[game.UnitType.Dreadnought] = { count: 3 };

	var options = {
		attacker: { assaultCannon: true },
		defender: { assaultCannon: true },
	};

	fleet1 = game.expandFleet(defaultRace, fleet1);
	fleet2 = game.expandFleet(defaultRace, fleet2);

	var expected = im.estimateProbabilities(fleet1, fleet2, game.BattleType.Space, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(fleet1, fleet2, game.BattleType.Space, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), 'empirical differs from analytical');

	test.done();
};

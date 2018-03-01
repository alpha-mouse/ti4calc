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

function testBattle(test, fleet1, fleet2, battleType, options) {
	options = options || { attacker: {}, defender: {} };

	var expanded1 = game.expandFleet(options.attacker.race || defaultRace, fleet1);
	var expanded2 = game.expandFleet(options.defender.race || defaultRace, fleet2);

	var expected = im.estimateProbabilities(expanded1, expanded2, battleType, options).distribution;
	//console.log(expected.toString());
	var got = calc.computeProbabilities(expanded1, expanded2, battleType, options).distribution;
	//console.log(got.toString());
	test.ok(distributionsEqual(expected, got, accuracy), 'empirical differs from analytical');

	test.done();
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

exports.space1 = function (test) {

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

	testBattle(test, fleet1, fleet2, game.BattleType.Space);

};

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

	testBattle(test, fleet1, fleet2, game.BattleType.Space);

};

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

	testBattle(test, fleet1, fleet2, game.BattleType.Space);
};

exports.spaceLong = function (test) {

	var fleet1 = {};

	fleet1[game.UnitType.Cruiser] = { count: 1 };
	fleet1[game.UnitType.Carrier] = { count: 5 };
	fleet1[game.UnitType.Fighter] = { count: 22 };

	var fleet2 = {};
	fleet2[game.UnitType.Cruiser] = { count: 1 };
	fleet2[game.UnitType.Carrier] = { count: 5 };
	fleet2[game.UnitType.Fighter] = { count: 20 };

	testBattle(test, fleet1, fleet2, game.BattleType.Space);
};

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

exports.barrage = {
	spaceBarrageNoGhosts: function (test) {

		var fleet1 = {};
		var fleet2 = {};
		fleet1[game.UnitType.Destroyer] = { count: 5 };
		fleet1[game.UnitType.Fighter] = { count: 4 };

		fleet2[game.UnitType.Destroyer] = { count: 1 };
		fleet2[game.UnitType.Fighter] = { count: 3 };
		fleet2[game.UnitType.PDS] = { count: 1 };

		testBattle(test, fleet1, fleet2, game.BattleType.Space);

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

		testBattle(test, fleet1, fleet2, game.BattleType.Space);

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

		testBattle(test, fleet1, fleet2, game.BattleType.Space);

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

		testBattle(test, fleet1, fleet2, game.BattleType.Space);

	},

	spaceBarragePDSvsDestroyers: function (test) {

		var fleet1 = {};
		var fleet2 = {};
		fleet1[game.UnitType.Dreadnought] = { count: 1 };
		fleet1[game.UnitType.Fighter] = { count: 2 };
		fleet1[game.UnitType.PDS] = { count: 2 };

		fleet2[game.UnitType.Destroyer] = { count: 3 };

		testBattle(test, fleet1, fleet2, game.BattleType.Space);

	},

	spaceBarragePDSandDestroyers: function (test) {

		var fleet1 = {};
		var fleet2 = {};
		fleet1[game.UnitType.Cruiser] = { count: 3 };
		fleet1[game.UnitType.Fighter] = { count: 4 };

		fleet2[game.UnitType.Destroyer] = { count: 3 };
		fleet2[game.UnitType.PDS] = { count: 4 };

		testBattle(test, fleet1, fleet2, game.BattleType.Space);

	},

	spaceBarrageHyperPDS: function (test) {

		var fleet1 = {};
		var fleet2 = {};
		fleet1[game.UnitType.Dreadnought] = { count: 1 };
		fleet1[game.UnitType.Fighter] = { count: 1 };
		fleet1[game.UnitType.PDS] = { count: 8 };

		fleet2[game.UnitType.Destroyer] = { count: 1 };

		testBattle(test, fleet1, fleet2, game.BattleType.Space);

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

		testBattle(test, fleet1, fleet2, game.BattleType.Space);

	},
};

exports.groundSimple = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Ground] = { count: 4 };
	fleet1[game.UnitType.Dreadnought] = { count: 2 };
	fleet1[game.UnitType.WarSun] = { count: 1 };

	fleet2[game.UnitType.Ground] = { count: 6 };
	fleet2[game.UnitType.Cruiser] = { count: 7 }; //should have no impact
	fleet2[game.UnitType.PDS] = { count: 2 };

	testBattle(test, fleet1, fleet2, game.BattleType.Ground);

};

exports.groundPds = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Ground] = { count: 2 };

	fleet2[game.UnitType.PDS] = { count: 2 };

	testBattle(test, fleet1, fleet2, game.BattleType.Ground);

};

exports.groundPlanetaryShield = function (test) {
	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Ground] = { count: 4 };
	fleet1[game.UnitType.Dreadnought] = { count: 0 };

	fleet2[game.UnitType.Ground] = { count: 6 };
	fleet2[game.UnitType.PDS] = { count: 2 };

	var expanded1 = game.expandFleet(defaultRace, fleet1);
	var expanded2 = game.expandFleet(defaultRace, fleet2);

	var noDreadnoughts = calc.computeProbabilities(expanded1, expanded2, game.BattleType.Ground).distribution;
	//console.log(noDreadnoughts.toString());

	fleet1[game.UnitType.Dreadnought] = { count: 6 };
	expanded1 = game.expandFleet(defaultRace, fleet1);
	var withDreadnoughts = calc.computeProbabilities(expanded1, expanded2, game.BattleType.Ground).distribution;
	//console.log(withDreadnoughts.toString());
	test.ok(distributionsEqual(noDreadnoughts, withDreadnoughts, accuracy), 'Dreadnoughts bombarded over Planetary Shield');

	test.done();

};

exports.groundPlanetaryShieldWarSun = function (test) {
	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Ground] = { count: 4 };
	fleet1[game.UnitType.Dreadnought] = { count: 5 };

	fleet2[game.UnitType.Ground] = { count: 6 };
	fleet2[game.UnitType.PDS] = { count: 2 };

	var expanded1 = game.expandFleet(defaultRace, fleet1);
	var expanded2 = game.expandFleet(defaultRace, fleet2);

	var noWarSun = calc.computeProbabilities(expanded1, expanded2, game.BattleType.Ground).distribution;
	//console.log(noWarSun.toString());

	fleet1[game.UnitType.WarSun] = { count: 1 };
	expanded1 = game.expandFleet(defaultRace, fleet1);
	var withWarSun = calc.computeProbabilities(expanded1, expanded2, game.BattleType.Ground).distribution;
	//console.log(withWarSun.toString());
	test.ok(!distributionsEqual(noWarSun, withWarSun, accuracy), 'War Sun didn\'t negate Planetary Shield');

	test.done();

};

exports.mentakRacial = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Cruiser] = { count: 1 };
	fleet1[game.UnitType.Destroyer] = { count: 1 };

	fleet2[game.UnitType.Cruiser] = { count: 1 };
	fleet2[game.UnitType.Destroyer] = { count: 1 };

	var options = { attacker: { race: 'Mentak' }, defender: { race: defaultRace } };

	testBattle(test, fleet1, fleet2, game.BattleType.Space, options);

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
	var options = { attacker: { race: 'Mentak' }, defender: { race: defaultRace } };

	testBattle(test, fleet1, fleet2, game.BattleType.Space, options);

};

exports.moraleBoost1stRoundSpace = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Dreadnought] = { count: 2 };

	fleet2[game.UnitType.Fighter] = { count: 5 };

	var options = { attacker: { moraleBoost1: true }, defender: { moraleBoost1: true } };

	testBattle(test, fleet1, fleet2, game.BattleType.Space, options);

};

exports.moraleBoost1stRoundGround = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Ground] = { count: 2 };
	fleet1[game.UnitType.PDS] = { count: 2 };

	fleet2[game.UnitType.Ground] = { count: 5 };

	var options = { attacker: { moraleBoost1: true }, defender: { } };

	testBattle(test, fleet1, fleet2, game.BattleType.Ground, options);

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

	testBattle(test, fleet1, fleet2, game.BattleType.Space, options);

};

exports.antimassDeflectorsSpace = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Cruiser] = { count: 3 };

	fleet2[game.UnitType.Cruiser] = { count: 3 };
	fleet2[game.UnitType.PDS] = { count: 3 };

	var options = {
		attacker: { antimassDeflectors: true },
		defender: {},
	};

	testBattle(test, fleet1, fleet2, game.BattleType.Space, options);

};

exports.antimassDeflectorsGround = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Ground] = { count: 3 };

	fleet2[game.UnitType.Ground] = { count: 3 };
	fleet2[game.UnitType.PDS] = { count: 3 };

	var options = {
		attacker: { antimassDeflectors: true },
		defender: {},
	};

	testBattle(test, fleet1, fleet2, game.BattleType.Ground, options);

};

exports.gravitonLaserSpace = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Cruiser] = { count: 3 };
	fleet1[game.UnitType.Fighter] = { count: 3 };

	fleet2[game.UnitType.Cruiser] = { count: 3 };
	fleet2[game.UnitType.PDS] = { count: 3 };

	var options = {
		attacker: {},
		defender: { gravitonLaser: true },
	};

	testBattle(test, fleet1, fleet2, game.BattleType.Space, options);

};

exports.plasmaScoringBombardmentGround = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.WarSun] = { count: 1 };
	fleet1[game.UnitType.Dreadnought] = { count: 2 };
	fleet1[game.UnitType.Ground] = { count: 2 };

	fleet2[game.UnitType.Ground] = { count: 5 };

	var options = {
		attacker: { plasmaScoring: true },
		defender: {},
	};

	testBattle(test, fleet1, fleet2, game.BattleType.Ground, options);

};

exports.plasmaScoringSpaceCannonSpace = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Cruiser] = { count: 3 };

	fleet2[game.UnitType.Cruiser] = { count: 2 };
	fleet2[game.UnitType.PDS] = { count: 2 };

	var options = {
		attacker: {},
		defender: { plasmaScoring: true },
	};

	testBattle(test, fleet1, fleet2, game.BattleType.Space, options);

};

exports.plasmaScoringSpaceCannonXxcha = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Flagship] = { count: 1 };
	fleet1[game.UnitType.PDS] = { count: 1 };

	fleet2[game.UnitType.Cruiser] = { count: 4 };


	var options = {
		attacker: { race: 'Xxcha', plasmaScoring: true },
		defender: {},
	};

	testBattle(test, fleet1, fleet2, game.BattleType.Space, options);

};

exports.plasmaScoringSpaceCannonGround = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Ground] = { count: 3 };

	fleet2[game.UnitType.Ground] = { count: 2 };
	fleet2[game.UnitType.PDS] = { count: 2 };

	var options = {
		attacker: {},
		defender: { plasmaScoring: true },
	};

	testBattle(test, fleet1, fleet2, game.BattleType.Ground, options);

};

exports.magenDefenseGround = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Ground] = { count: 5 };

	fleet2[game.UnitType.Ground] = { count: 5 };
	fleet2[game.UnitType.PDS] = { count: 1 };

	var options = {
		attacker: { },
		defender: { magenDefense: 1 },
	};

	testBattle(test, fleet1, fleet2, game.BattleType.Ground, options);
};

exports.magenDefenseGroundWithoutPds = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.Ground] = { count: 5 };

	fleet2[game.UnitType.Ground] = { count: 5 };

	var expanded1 = game.expandFleet(defaultRace, fleet1);
	var expanded2 = game.expandFleet(defaultRace, fleet2);

	var options = {
		attacker: { },
		defender: { },
	};

	var noMagenDefense = calc.computeProbabilities(expanded1, expanded2, game.BattleType.Ground, options).distribution;
	//console.log(noMagenDefense.toString());

	options.defender.magenDefense = true;
	var withMagenDefense = calc.computeProbabilities(expanded1, expanded2, game.BattleType.Ground, options).distribution;
	//console.log(withMagenDefense.toString());
	test.ok(distributionsEqual(noMagenDefense, withMagenDefense, accuracy), 'Magen Defense activated without PDS');

	test.done();
};

exports.magenDefenseWarSunGround = function (test) {

	var fleet1 = {};
	var fleet2 = {};
	fleet1[game.UnitType.WarSun] = { count: 1 };
	fleet1[game.UnitType.Ground] = { count: 5 };

	fleet2[game.UnitType.Ground] = { count: 5 };
	fleet2[game.UnitType.PDS] = { count: 1 };

	var options = {
		attacker: { },
		defender: { magenDefense: 1 },
	};

	testBattle(test, fleet1, fleet2, game.BattleType.Ground, options);
};


/** used to group tests for easier selective running */
function group(exports, testGroup) {
	var result = {};
	var rx = new RegExp(testGroup, 'i');
	for (var test in exports){
		if (exports.hasOwnProperty(test) && rx.test(test)){
			var name = test.replace(rx, '');
			result[name] = exports[test];
		}
	}
	return result;
}

//exports.plasmaScoring = group(exports, 'plasmaScoring');
exports.magenDefense = group(exports, 'magenDefense');
//exports.ground = group(exports, 'ground');
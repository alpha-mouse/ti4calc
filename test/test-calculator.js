// todo This tests suite is not paranoid enough. There are many more edge cases then those that are tested here.

var game = require('../game-elements');
var calc = require('../calculator').calculator;
var imitatorModule = require('../imitator');
var im = imitatorModule.imitator;
imitatorModule.imitationIterations = 30000;
var defaultRace = game.Race.Muaat;
var accuracy = 0.01;

function distributionsEqual(distr1, distr2) {
	var min = Math.min(distr1.min, distr2.min);
	var max = Math.max(distr1.max, distr2.max);
	if (isNaN(min) || isNaN(max)) return false;
	var cumulative1 = 0, cumulative2 = 0;
	for (var i = min; i <= max; i++) {
		if (accuracy < Math.abs(distr1.at(i) - distr2.at(i)))
			return false;

		cumulative1 += distr1.at(i);
		cumulative2 += distr2.at(i);
		if (accuracy < Math.abs(cumulative1 - cumulative2))
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

function testBattle(test, attacker, defender, battleType, options) {
	var input = new Input(attacker, defender, battleType, options);

	var got = calc.computeProbabilities(input).distribution;
	var expected = im.estimateProbabilities(input).distribution;

	//console.log('i', expected.toString());
	//console.log('c', got.toString());

	test.ok(distributionsEqual(expected, got), 'empirical differs from analytical');

	test.done();
}

function testExpansion(test, actual, expected) {
	test.ok(actual, 'no expansion');
	test.equal(actual.length, expected.length, 'wrong length');
	for (var i = 0; i < actual.length; i++) {
		var unit = actual[i];
		var expectedUnit = expected[i];
		test.equal(unit.type, expectedUnit.type, 'wrong ship at ' + i);

		test.equal(unit.isDamageGhost, expectedUnit.isDamageGhost, 'isDamageGhost wrong at ' + i);
		if (expectedUnit.type === game.UnitType.PDS || expectedUnit.type === 'Bloodthirsty Space Dock') {
			test.equal(unit.spaceCannonValue, expectedUnit.spaceCannonValue, 'wrong space cannon at ' + i);
		} else if (expectedUnit.isDamageGhost) {
			test.ok(isNaN(unit.battleValue), 'battleValue not NaN for damage ghost at ' + i);
		} else {
			test.equal(unit.battleValue, expectedUnit.battleValue, 'wrong battleValue at ' + i);
		}
	}

	test.done();
}

exports.expansionDefault = function (test) {
	var unit = game.UnitType;
	var fleet = {};
	fleet[unit.Flagship] = { count: 1 };
	fleet[unit.WarSun] = { count: 1 };
	fleet[unit.Dreadnought] = { count: 1 };
	fleet[unit.Cruiser] = { count: 1 };
	fleet[unit.Carrier] = { count: 1 };
	fleet[unit.Destroyer] = { count: 1 };
	fleet[unit.Ground] = { count: 1 };
	fleet[unit.Fighter] = { count: 1 };
	fleet[unit.PDS] = { count: 1 };
	var expansion = game.expandFleet(new Input(fleet, null, game.BattleType.Space, {
		attacker: { race: defaultRace, riskDirectHit: true, experimentalBattlestation: true },
	}), game.BattleSide.attacker);

	var units = Object.assign({}, game.RaceSpecificUnits[defaultRace], game.StandardUnits);

	var expected = [
		units[unit.Flagship],
		units[unit.WarSun],
		units[unit.Dreadnought],
		units[unit.Cruiser],
		units[unit.Carrier],
		units[unit.Destroyer],
		units[unit.Fighter],
		units[unit.Ground],
		units[unit.PDS],
		units[unit.Flagship].toDamageGhost(),
		units[unit.WarSun].toDamageGhost(),
		units[unit.Dreadnought].toDamageGhost(),
		game.StandardUnits.ExperimentalBattlestation,
	];

	testExpansion(test, expansion, expected);
};

exports.expansionRiskDirectHit = function (test) {
	var fleet = {};
	fleet[game.UnitType.Dreadnought] = { count: 4 };
	fleet[game.UnitType.Cruiser] = { count: 3 };
	fleet[game.UnitType.PDS] = { count: 2 };

	var expansion = game.expandFleet(new Input(fleet, null, game.BattleType.Space, {
		attacker: { race: defaultRace, riskDirectHit: true },
	}), game.BattleSide.attacker);

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

	testExpansion(test, expansion, expected);
};

exports.expansionNoRiskDirectHit = function (test) {
	var fleet = {};
	fleet[game.UnitType.WarSun] = { count: 1 };
	fleet[game.UnitType.Dreadnought] = { count: 4 };
	fleet[game.UnitType.Cruiser] = { count: 3 };
	fleet[game.UnitType.PDS] = { count: 2 };

	var expansion = game.expandFleet(new Input(fleet, null, game.BattleType.Space, {
		attacker: { race: defaultRace, riskDirectHit: false },
	}), game.BattleSide.attacker);

	var u = game.UnitType;
	var expected = [
		game.StandardUnits[u.WarSun],
		game.StandardUnits[u.WarSun].toDamageGhost(),
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.StandardUnits[u.Cruiser],
		game.StandardUnits[u.Cruiser],
		game.StandardUnits[u.Cruiser],
		game.StandardUnits[u.PDS],
		game.StandardUnits[u.PDS]
	];

	testExpansion(test, expansion, expected);
};

exports.expansionWithUpgrades = function (test) {
	var fleet = {};
	fleet[game.UnitType.Dreadnought] = { count: 1 };
	fleet[game.UnitType.Carrier] = { count: 1, upgraded: true };
	fleet[game.UnitType.Cruiser] = { count: 3, upgraded: true };
	fleet[game.UnitType.PDS] = { count: 2, upgraded: true };

	var expansion = game.expandFleet(new Input(fleet, null, game.BattleType.Space, {
		attacker: { race: game.Race.Sol, riskDirectHit: true, },
	}), game.BattleSide.attacker);

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

	testExpansion(test, expansion, expected);
};

exports.expansionMentakFlagship = function (test) {
	var attacker = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.WarSun] = { count: 2 };
	attacker[game.UnitType.Dreadnought] = { count: 2 };

	var defender = {};
	defender[game.UnitType.Flagship] = { count: 1 };

	var expansion = game.expandFleet(new Input(attacker, defender, game.BattleType.Space, {
		attacker: { race: defaultRace },
		defender: { race: game.Race.Mentak },
	}), game.BattleSide.attacker);

	var u = game.UnitType;
	var expected = [
		game.RaceSpecificUnits[defaultRace][u.Flagship],
		game.StandardUnits[u.WarSun],
		game.StandardUnits[u.WarSun],
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought],
	];

	testExpansion(test, expansion, expected);
};

exports.expansionAndFilterVirusFlagship = function (test) {
	var attacker = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.Fighter] = { count: 2 };
	attacker[game.UnitType.Ground] = { count: 2 };

	var options = { attacker: { race: game.Race.Virus }, };
	var expandedFleet = game.expandFleet(new Input(attacker, null, game.BattleType.Space, options), game.BattleSide.attacker);
	var filteredFleet = game.filterFleet(expandedFleet, game.BattleType.Space, options.attacker);

	var u = game.UnitType;
	var expected = [
		game.RaceSpecificUnits[game.Race.Virus][u.Flagship],
		game.StandardUnits[u.Ground],
		game.StandardUnits[u.Ground],
		game.StandardUnits[u.Fighter],
		game.StandardUnits[u.Fighter],
		game.RaceSpecificUnits[game.Race.Virus][u.Flagship].toDamageGhost(),
	];

	testExpansion(test, filteredFleet, expected);
};

exports.symmetricImitator = function (test) {
	var fleet = {};
	fleet[game.UnitType.Dreadnought] = 2;
	fleet[game.UnitType.Destroyer] = 4;
	fleet[game.UnitType.Cruiser] = 2;
	fleet[game.UnitType.PDS] = 1;
	fleet[game.UnitType.Fighter] = 3;
	var input = new Input(fleet, fleet, game.BattleType.Space);
	var distr = im.estimateProbabilities(input).distribution;
	var inverse = invertDistribution(distr);
	test.ok(distributionsEqual(distr, inverse), 'got asymmetric distribution');
	test.done();
};

exports.symmetricCalculator = function (test) {
	var fleet = {};
	fleet[game.UnitType.WarSun] = 1;
	fleet[game.UnitType.Dreadnought] = 2;
	fleet[game.UnitType.Destroyer] = 4;
	fleet[game.UnitType.Cruiser] = 2;
	fleet[game.UnitType.PDS] = 1;
	fleet[game.UnitType.Carrier] = 2;
	fleet[game.UnitType.Fighter] = 3;
	var input = new Input(fleet, fleet, game.BattleType.Space);
	var distr = calc.computeProbabilities(input).distribution;
	var inverse = invertDistribution(distr);
	test.ok(distributionsEqual(distr, inverse), 'got asymmetric distribution');
	test.done();
};

exports.space1 = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 2 };

	defender[game.UnitType.Destroyer] = { count: 3 };

	testBattle(test, attacker, defender, game.BattleType.Space);
};

exports.space2 = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 4 };
	attacker[game.UnitType.Destroyer] = { count: 6 };
	attacker[game.UnitType.Dreadnought] = { count: 2 };

	defender[game.UnitType.WarSun] = { count: 2 };
	defender[game.UnitType.Cruiser] = { count: 7 };
	defender[game.UnitType.Destroyer] = { count: 4 };
	defender[game.UnitType.Ground] = { count: 4 };
	defender[game.UnitType.Carrier] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 3 };

	testBattle(test, attacker, defender, game.BattleType.Space);
};

exports.space3 = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.WarSun] = { count: 4 };
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Destroyer] = { count: 6 };
	attacker[game.UnitType.Cruiser] = { count: 2 };
	attacker[game.UnitType.Carrier] = { count: 6 };

	defender[game.UnitType.WarSun] = { count: 2 };
	defender[game.UnitType.Cruiser] = { count: 7 };
	defender[game.UnitType.Destroyer] = { count: 4 };
	defender[game.UnitType.Ground] = { count: 4 };
	defender[game.UnitType.Carrier] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 3 };

	testBattle(test, attacker, defender, game.BattleType.Space);

};

exports.spaceUpgrades = function (test) {

	var attacker = {};

	attacker[game.UnitType.WarSun] = { count: 2 };
	attacker[game.UnitType.Dreadnought] = { count: 4 };
	attacker[game.UnitType.Cruiser] = { count: 2, upgraded: true };
	attacker[game.UnitType.Destroyer] = { count: 3 };

	var defender = {};
	defender[game.UnitType.WarSun] = { count: 1 };
	defender[game.UnitType.Dreadnought] = { count: 1 };
	defender[game.UnitType.Cruiser] = { count: 4 };
	defender[game.UnitType.Destroyer] = { count: 2, upgraded: true };
	defender[game.UnitType.Carrier] = { count: 5 };
	defender[game.UnitType.PDS] = { count: 4, upgraded: true };

	testBattle(test, attacker, defender, game.BattleType.Space);
};

exports.spaceLong = function (test) {

	var attacker = {};

	attacker[game.UnitType.Cruiser] = { count: 1 };
	attacker[game.UnitType.Carrier] = { count: 5 };
	attacker[game.UnitType.Fighter] = { count: 22 };

	var defender = {};
	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.Carrier] = { count: 5 };
	defender[game.UnitType.Fighter] = { count: 20 };

	testBattle(test, attacker, defender, game.BattleType.Space);
};

exports.spacePerformance = function (test) {

	var attacker = {};

	attacker[game.UnitType.Cruiser] = { count: 1 };
	attacker[game.UnitType.Carrier] = { count: 5 };
	attacker[game.UnitType.Fighter] = { count: 22 };

	var defender = {};
	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.Carrier] = { count: 5 };
	defender[game.UnitType.Fighter] = { count: 20 };

	var input = new Input(attacker, defender, game.BattleType.Space);
	var s = new Date();
	for (var i = 0; i < 100; ++i)
		calc.computeProbabilities(input);
	var elapsed = new Date() - s;

	s = new Date();
	var dummy = 1;
	for (var i = 0; i < 500000000; ++i)
		dummy *= 1.000000001;
	var elapsedComparison = new Date() - s;

	test.ok(elapsed < elapsedComparison, 'such performance is suspicious: ' + elapsed / elapsedComparison);

	test.done();
};

exports.barrage = {
	noGhosts: function (test) {

		var attacker = {};
		var defender = {};
		attacker[game.UnitType.Destroyer] = { count: 5 };
		attacker[game.UnitType.Fighter] = { count: 4 };

		defender[game.UnitType.Destroyer] = { count: 1 };
		defender[game.UnitType.Fighter] = { count: 3 };
		defender[game.UnitType.PDS] = { count: 1 };

		testBattle(test, attacker, defender, game.BattleType.Space);

	},

	splitDefender: function (test) {

		var attacker = {};
		var defender = {};
		attacker[game.UnitType.Cruiser] = { count: 2 };
		attacker[game.UnitType.Destroyer] = { count: 4 };
		attacker[game.UnitType.Fighter] = { count: 7 };

		defender[game.UnitType.Dreadnought] = { count: 3 };
		defender[game.UnitType.Destroyer] = { count: 3 };
		defender[game.UnitType.Fighter] = { count: 4 };
		defender[game.UnitType.PDS] = { count: 1 };

		testBattle(test, attacker, defender, game.BattleType.Space);

	},

	splitAttacker: function (test) {

		var attacker = {};
		var defender = {};
		attacker[game.UnitType.Dreadnought] = { count: 3 };
		attacker[game.UnitType.Destroyer] = { count: 3 };
		attacker[game.UnitType.Fighter] = { count: 4 };
		attacker[game.UnitType.PDS] = { count: 1 };

		defender[game.UnitType.Cruiser] = { count: 2 };
		defender[game.UnitType.Destroyer] = { count: 4 };
		defender[game.UnitType.Fighter] = { count: 7 };

		testBattle(test, attacker, defender, game.BattleType.Space);

	},

	quadraticSplit: function (test) {

		var attacker = {};
		var defender = {};
		attacker[game.UnitType.WarSun] = { count: 2 };
		attacker[game.UnitType.Destroyer] = { count: 2 };
		attacker[game.UnitType.Fighter] = { count: 4 };

		defender[game.UnitType.Dreadnought] = { count: 3 };
		defender[game.UnitType.Destroyer] = { count: 4 };
		defender[game.UnitType.Fighter] = { count: 2 };

		testBattle(test, attacker, defender, game.BattleType.Space);

	},

	PDSvsDestroyers: function (test) {

		var attacker = {};
		var defender = {};
		attacker[game.UnitType.Dreadnought] = { count: 1 };
		attacker[game.UnitType.Fighter] = { count: 2 };
		attacker[game.UnitType.PDS] = { count: 2 };

		defender[game.UnitType.Destroyer] = { count: 3 };

		testBattle(test, attacker, defender, game.BattleType.Space);

	},

	PDSandDestroyers: function (test) {

		var attacker = {};
		var defender = {};
		attacker[game.UnitType.Cruiser] = { count: 3 };
		attacker[game.UnitType.Fighter] = { count: 4 };

		defender[game.UnitType.Destroyer] = { count: 3 };
		defender[game.UnitType.PDS] = { count: 4 };

		testBattle(test, attacker, defender, game.BattleType.Space);

	},

	hyperPDS: function (test) {

		var attacker = {};
		var defender = {};
		attacker[game.UnitType.Dreadnought] = { count: 1 };
		attacker[game.UnitType.Fighter] = { count: 1 };
		attacker[game.UnitType.PDS] = { count: 8 };

		defender[game.UnitType.Destroyer] = { count: 1 };

		testBattle(test, attacker, defender, game.BattleType.Space);

	},

	mess: function (test) {

		var attacker = {};
		var defender = {};
		attacker[game.UnitType.Dreadnought] = { count: 1 };
		attacker[game.UnitType.Destroyer] = { count: 2 };
		attacker[game.UnitType.Fighter] = { count: 4 };
		attacker[game.UnitType.PDS] = { count: 4 };

		defender[game.UnitType.Dreadnought] = { count: 2 };
		defender[game.UnitType.Destroyer] = { count: 4 };
		defender[game.UnitType.Fighter] = { count: 2 };
		defender[game.UnitType.PDS] = { count: 1 };

		testBattle(test, attacker, defender, game.BattleType.Space);

	},
};

exports.groundSimple = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 4 };
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.WarSun] = { count: 1 };

	defender[game.UnitType.Ground] = { count: 6 };
	defender[game.UnitType.Cruiser] = { count: 7 }; //should have no impact
	defender[game.UnitType.PDS] = { count: 2 };

	testBattle(test, attacker, defender, game.BattleType.Ground);

};

exports.groundPds = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 2 };

	defender[game.UnitType.PDS] = { count: 2 };

	testBattle(test, attacker, defender, game.BattleType.Ground);
};

exports.groundPlanetaryShield = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 4 };
	attacker[game.UnitType.Dreadnought] = { count: 0 };

	defender[game.UnitType.Ground] = { count: 6 };
	defender[game.UnitType.PDS] = { count: 2 };

	var input = new Input(attacker, defender, game.BattleType.Ground);
	var noDreadnoughts = calc.computeProbabilities(input).distribution;
	//console.log(noDreadnoughts.toString());

	attacker[game.UnitType.Dreadnought] = { count: 6 };
	var withDreadnoughts = calc.computeProbabilities(input).distribution;
	//console.log(withDreadnoughts.toString());
	test.ok(distributionsEqual(noDreadnoughts, withDreadnoughts), 'Dreadnoughts bombarded over Planetary Shield');

	test.done();
};

exports.groundPlanetaryShieldWarSun = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 4 };
	attacker[game.UnitType.Dreadnought] = { count: 5 };

	defender[game.UnitType.Ground] = { count: 6 };
	defender[game.UnitType.PDS] = { count: 2 };

	var input = new Input(attacker, defender, game.BattleType.Ground);
	var noWarSun = calc.computeProbabilities(input).distribution;
	//console.log(noWarSun.toString());

	attacker[game.UnitType.WarSun] = { count: 1 };
	var withWarSun = calc.computeProbabilities(input).distribution;
	//console.log(withWarSun.toString());
	test.ok(!distributionsEqual(noWarSun, withWarSun), 'War Sun didn\'t negate Planetary Shield');

	test.done();

};

exports.mentakRacial = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 1 };
	attacker[game.UnitType.Destroyer] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.Destroyer] = { count: 1 };

	var options = { attacker: { race: game.Race.Mentak }, defender: { race: defaultRace } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);

};

exports.mentakRacialWithBarrageAndPds = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 1 };
	attacker[game.UnitType.Destroyer] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 2 };
	attacker[game.UnitType.PDS] = { count: 1 };

	defender[game.UnitType.Dreadnought] = { count: 1 };
	defender[game.UnitType.Destroyer] = { count: 1 };
	defender[game.UnitType.Fighter] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 2 };
	var options = { attacker: { race: game.Race.Mentak }, defender: { race: defaultRace } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);

};

exports.moraleBoostSpace = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };

	defender[game.UnitType.Fighter] = { count: 5 };

	var options = { attacker: { moraleBoost: true }, defender: { moraleBoost: true } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.moraleBoostBarrage = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Destroyer] = { count: 1 };

	defender[game.UnitType.Fighter] = { count: 1 };

	var options = { attacker: { moraleBoost: true }, defender: { moraleBoost: true } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.moraleBoostGround = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 2 };
	attacker[game.UnitType.PDS] = { count: 2 };

	defender[game.UnitType.Ground] = { count: 5 };

	var options = { attacker: { moraleBoost: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.moraleBoostMagenDefenseGround = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 4 };

	defender[game.UnitType.Ground] = { count: 4 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = {
		attacker: {
			moraleBoost: true,
		}, defender: {
			moraleBoost: true,
			magenDefense: true,
		},
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.fireTeamGround = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 2 };
	attacker[game.UnitType.PDS] = { count: 2 };

	defender[game.UnitType.Ground] = { count: 5 };

	var options = { attacker: { fireTeam: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.fireTeamMagenDefenseGround = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 4 };

	defender[game.UnitType.Ground] = { count: 4 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = {
		attacker: {
			fireTeam: true,
		}, defender: {
			fireTeam: true,
			magenDefense: true,
		},
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.assaultCannonSimple = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 3 };

	defender[game.UnitType.Cruiser] = { count: 3 };

	var options = {
		attacker: { assaultCannon: true },
		defender: { assaultCannon: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.assaultCannonNonDamageable = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 3 };
	attacker[game.UnitType.Fighter] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 3 };

	var options = {
		attacker: { assaultCannon: true },
		defender: { assaultCannon: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.assaultCannonDamageable = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 1 };
	attacker[game.UnitType.Cruiser] = { count: 3 };
	attacker[game.UnitType.Fighter] = { count: 1 };

	defender[game.UnitType.Dreadnought] = { count: 3 };

	var options = {
		attacker: { assaultCannon: true },
		defender: { assaultCannon: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.assaultCannonFighters = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 1 };
	attacker[game.UnitType.Cruiser] = { count: 3 };
	attacker[game.UnitType.Fighter] = { count: 3 };

	defender[game.UnitType.Dreadnought] = { count: 3 };
	defender[game.UnitType.Fighter] = { count: 3 };

	var options = {
		attacker: { assaultCannon: true },
		defender: { assaultCannon: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.assaultCannonNotEnoughShips = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 3 };

	var options = {
		attacker: { assaultCannon: true },
		defender: { assaultCannon: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.assaultCannonPds = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 3 };

	defender[game.UnitType.Dreadnought] = { count: 3 };
	defender[game.UnitType.Fighter] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 2 };

	var options = {
		attacker: { assaultCannon: true },
		defender: { assaultCannon: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.assaultCannonMorePdsNoDirectHit = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.WarSun] = { count: 1 };
	attacker[game.UnitType.Dreadnought] = { count: 1 };
	attacker[game.UnitType.PDS] = { count: 6 };

	defender[game.UnitType.Flagship] = { count: 1 };
	defender[game.UnitType.WarSun] = { count: 1 };
	defender[game.UnitType.Dreadnought] = { count: 1 };
	defender[game.UnitType.Fighter] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 6 };

	var options = {
		attacker: { assaultCannon: true, riskDirectHit: false },
		defender: { assaultCannon: true, riskDirectHit: false },
	};
	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.assaultCannonPdsBarrage = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Destroyer] = { count: 1 };
	attacker[game.UnitType.Fighter] = { count: 1 };
	attacker[game.UnitType.PDS] = { count: 4 };

	defender[game.UnitType.Dreadnought] = { count: 2 };
	defender[game.UnitType.Destroyer] = { count: 1 };
	defender[game.UnitType.Fighter] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 4 };

	var options = {
		attacker: { assaultCannon: true, },
		defender: { assaultCannon: true, },
	};
	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.assaultCannonPdsBarrageGravitonLaser = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Destroyer] = { count: 1 };
	attacker[game.UnitType.Fighter] = { count: 1 };
	attacker[game.UnitType.PDS] = { count: 4 };

	defender[game.UnitType.Dreadnought] = { count: 2 };
	defender[game.UnitType.Destroyer] = { count: 1 };
	defender[game.UnitType.Fighter] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 4 };

	var options = {
		attacker: { assaultCannon: true, gravitonLaser: true },
		defender: { assaultCannon: true, gravitonLaser: true },
	};
	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.assaultCannonNoRiskDirectHit = function (test) {
	var attacker = {};
	var defender = {};

	attacker[game.UnitType.WarSun] = { count: 1 };
	attacker[game.UnitType.Dreadnought] = { count: 1 };

	defender[game.UnitType.Destroyer] = { count: 3 };

	var options = { attacker: { riskDirectHit: false, }, defender: { assaultCannon: true, } };
	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.assaultCannonNoSplit = function (test) {
	var attacker = {};
	var defender = {};

	attacker[game.UnitType.WarSun] = { count: 1 };
	attacker[game.UnitType.Dreadnought] = { count: 1 };

	defender[game.UnitType.Destroyer] = { count: 3 };

	var options = { attacker: {}, defender: { assaultCannon: true, } };
	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.antimassDeflectorsSpace = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 3 };

	defender[game.UnitType.Cruiser] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = {
		attacker: { antimassDeflectors: true },
		defender: {},
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);

};

exports.antimassDeflectorsGround = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 3 };

	defender[game.UnitType.Ground] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = {
		attacker: { antimassDeflectors: true },
		defender: {},
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.gravitonLaserSpace = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 3 };

	defender[game.UnitType.Cruiser] = { count: 2 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = {
		attacker: {},
		defender: { gravitonLaser: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.gravitonLaserPureFighters = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Fighter] = { count: 3 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 4 };

	var options = {
		attacker: {},
		defender: { gravitonLaser: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.gravitonLaserNonEuclidean = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 2 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = {
		attacker: { race: game.Race.Letnev, nonEuclidean: true },
		defender: { gravitonLaser: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.gravitonLaserManyPds = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 1 };
	attacker[game.UnitType.Fighter] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 4 };

	var options = {
		attacker: {},
		defender: { gravitonLaser: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.gravitonLaserManeuveringJets = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.PDS] = { count: 1 };

	defender[game.UnitType.Carrier] = { count: 1 };

	var options = {
		attacker: {},
		defender: { gravitonLaser: true, maneuveringJets: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.plasmaScoringBombardmentGround = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.WarSun] = { count: 1 };
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Ground] = { count: 2 };

	defender[game.UnitType.Ground] = { count: 5 };

	var options = {
		attacker: { plasmaScoring: true },
		defender: {},
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.plasmaScoringSpaceCannonSpace = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 3 };

	defender[game.UnitType.Cruiser] = { count: 2 };
	defender[game.UnitType.PDS] = { count: 2 };

	var options = {
		attacker: {},
		defender: { plasmaScoring: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.plasmaScoringSpaceCannonXxcha = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.PDS] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 4 };


	var options = {
		attacker: { race: game.Race.Xxcha, plasmaScoring: true },
		defender: {},
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.plasmaScoringSpaceCannonGround = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 3 };

	defender[game.UnitType.Ground] = { count: 2 };
	defender[game.UnitType.PDS] = { count: 2 };

	var options = {
		attacker: {},
		defender: { plasmaScoring: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.plasmaScoringAntimassDeflectorsGround = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 1 };

	defender[game.UnitType.PDS] = { count: 1 };

	var options = {
		attacker: { antimassDeflectors: true },
		defender: { plasmaScoring: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.magenDefenseGround = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 5 };

	defender[game.UnitType.Ground] = { count: 5 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = {
		attacker: {},
		defender: { magenDefense: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.magenDefenseGroundWithoutPds = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 5 };

	defender[game.UnitType.Ground] = { count: 5 };

	var options = {
		attacker: {},
		defender: {},
	};

	var input = new Input(attacker, defender, game.BattleType.Ground, options);

	var noMagenDefense = calc.computeProbabilities(input).distribution;
	//console.log(noMagenDefense.toString());

	options.defender.magenDefense = true;
	var withMagenDefense = calc.computeProbabilities(input).distribution;
	//console.log(withMagenDefense.toString());
	test.ok(distributionsEqual(noMagenDefense, withMagenDefense), 'Magen Defense activated without PDS');

	test.done();
};

exports.magenDefenseWarSunGround = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.WarSun] = { count: 1 };
	attacker[game.UnitType.Ground] = { count: 5 };

	defender[game.UnitType.Ground] = { count: 5 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = {
		attacker: {},
		defender: { magenDefense: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.duraniumArmor = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.WarSun] = { count: 1 };
	attacker[game.UnitType.Dreadnought] = { count: 1 };

	defender[game.UnitType.Flagship] = { count: 1 };
	defender[game.UnitType.WarSun] = { count: 1 };
	defender[game.UnitType.Dreadnought] = { count: 1 };

	var options = {
		attacker: {},
		defender: { duraniumArmor: true },
	};

	var distribution = im.estimateProbabilities(new Input(attacker, defender, game.BattleType.Space, options)).distribution;
	//console.log(distribution.toString());
	var inverse = invertDistribution(distribution);
	test.ok(!distributionsEqual(distribution, inverse), 'Duranium Armor not applied');

	test.done();
};

exports.fighterPrototypeSimple = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 2 };

	defender[game.UnitType.Fighter] = { count: 5 };

	var options = { attacker: { fighterPrototype: true }, defender: { fighterPrototype: true } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.fighterPrototypeMoraleBoost = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 2 };

	defender[game.UnitType.Fighter] = { count: 4 };

	var options = { attacker: { fighterPrototype: true }, defender: { fighterPrototype: true, moraleBoost: true } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.bunkerSimple = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 3 };
	attacker[game.UnitType.Ground] = { count: 7 };

	defender[game.UnitType.Ground] = { count: 5 };

	var options = {
		attacker: {},
		defender: { bunker: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.bunkerPlasmaScoring = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 3 };
	attacker[game.UnitType.Ground] = { count: 7 };

	defender[game.UnitType.Ground] = { count: 5 };

	var options = {
		attacker: { plasmaScoring: true },
		defender: { bunker: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.noRiskingDirectHit1 = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Cruiser] = { count: 4 };
	attacker[game.UnitType.Destroyer] = { count: 6 };

	defender[game.UnitType.WarSun] = { count: 2 };
	defender[game.UnitType.Cruiser] = { count: 7 };
	defender[game.UnitType.Destroyer] = { count: 4 };
	defender[game.UnitType.Carrier] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = { attacker: { riskDirectHit: false }, defender: { riskDirectHit: false } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.noRiskingDirectHit2 = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.WarSun] = { count: 4 };
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Destroyer] = { count: 6 };
	attacker[game.UnitType.Cruiser] = { count: 2 };
	attacker[game.UnitType.Carrier] = { count: 6 };

	defender[game.UnitType.WarSun] = { count: 2 };
	defender[game.UnitType.Cruiser] = { count: 7 };
	defender[game.UnitType.Destroyer] = { count: 4 };
	defender[game.UnitType.Ground] = { count: 4 };
	defender[game.UnitType.Carrier] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = { attacker: { riskDirectHit: false }, defender: { riskDirectHit: false } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.maneuveringJetsSpace = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 2 };
	attacker[game.UnitType.PDS] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = { attacker: { maneuveringJets: true }, defender: { maneuveringJets: true } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.maneuveringJetsNoPds = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 2 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = { attacker: {}, defender: { maneuveringJets: true } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.maneuveringJetsGround = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 3 };

	defender[game.UnitType.Ground] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = { attacker: { maneuveringJets: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.sardakkRacial = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 2 };
	attacker[game.UnitType.PDS] = { count: 2 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.Fighter] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = { attacker: { race: game.Race.Sardakk }, defender: { race: game.Race.Sardakk } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.sardakkFighterPrototypeMoraleBoost = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 2 };
	attacker[game.UnitType.PDS] = { count: 2 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.Fighter] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = {
		attacker: { race: game.Race.Sardakk, moraleBoost: true },
		defender: { race: game.Race.Sardakk, fighterPrototype: true }
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.jolNarRacial = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 2 };
	attacker[game.UnitType.PDS] = { count: 2 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.Fighter] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = { attacker: { race: game.Race.JolNar }, defender: { race: game.Race.JolNar } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.jolNarRacialMoraleBoost = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 1 };

	var options = { attacker: { race: game.Race.JolNar, moraleBoost: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.l1z1xRacialHarrow = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Ground] = { count: 2 };

	defender[game.UnitType.Ground] = { count: 2 };

	var options = { attacker: { race: game.Race.L1Z1X }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.l1z1xRacialHarrowMoraleBoost = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Ground] = { count: 2 };

	defender[game.UnitType.Ground] = { count: 2 };

	var options = { attacker: { race: game.Race.L1Z1X }, defender: { moraleBoost: true } };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.l1z1xRacialHarrowBunker = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Ground] = { count: 3 };

	defender[game.UnitType.Ground] = { count: 4 };

	var options = { attacker: { race: game.Race.L1Z1X }, defender: { bunker: true } };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.l1z1xRacialHarrowMagenDefense = function (test) {
	// In principle, either L1Z1X can bombard, or Magen Defense can be activated, but not both.
	// But just in case..

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.WarSun] = { count: 1 };
	attacker[game.UnitType.Ground] = { count: 3 };

	defender[game.UnitType.Ground] = { count: 4 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = { attacker: { race: game.Race.L1Z1X }, defender: { magenDefense: true } };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.l1z1xRacialHarrowPlasmaScoring = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Ground] = { count: 3 };

	defender[game.UnitType.Ground] = { count: 4 };

	var options = { attacker: { race: game.Race.L1Z1X, plasmaScoring: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.l4Disruptors = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 2 };

	defender[game.UnitType.Ground] = { count: 2 };
	defender[game.UnitType.PDS] = { count: 2 };

	var options = { attacker: { race: game.Race.Letnev, l4Disruptors: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.letnevRacialNonEuclideanSimple = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };

	defender[game.UnitType.Dreadnought] = { count: 3 };

	var options = { attacker: { race: game.Race.Letnev, nonEuclidean: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.letnevRacialNonEuclideanDontRiskDirectHit = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 3 };
	attacker[game.UnitType.Fighter] = { count: 2 };

	defender[game.UnitType.Dreadnought] = { count: 3 };

	var options = { attacker: { race: game.Race.Letnev, nonEuclidean: true, riskDirectHit: false }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.letnevRacialNonEuclideanMoraleBoost = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 3 };
	attacker[game.UnitType.Fighter] = { count: 2 };

	defender[game.UnitType.Dreadnought] = { count: 3 };

	var options = {
		attacker: { race: game.Race.Letnev, nonEuclidean: true, riskDirectHit: false },
		defender: { moraleBoost: true }
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.sardakkRacialValkyrieParticleWeave = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 1 };

	defender[game.UnitType.Ground] = { count: 1 };

	var options = { attacker: { race: game.Race.Sardakk, valkyrieParticleWeave: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.sardakkRacialValkyrieParticleWeaveBoth = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 2 };

	defender[game.UnitType.Ground] = { count: 2 };

	// yes, this cannot happen in the actual game, but anyway
	var options = {
		attacker: { race: game.Race.Sardakk, valkyrieParticleWeave: true },
		defender: { race: game.Race.Sardakk, valkyrieParticleWeave: true }
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.sardakkRacialValkyrieParticleWeaveHarrow = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 2 };
	attacker[game.UnitType.Dreadnought] = { count: 1 };

	defender[game.UnitType.Ground] = { count: 3 };

	var options = {
		attacker: { race: game.Race.L1Z1X, },
		defender: { race: game.Race.Sardakk, valkyrieParticleWeave: true }
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.sardakkRacialValkyrieParticleWeaveMagenDefense = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 1 };

	defender[game.UnitType.Ground] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = {
		attacker: { race: game.Race.Sardakk, valkyrieParticleWeave: true },
		defender: { magenDefense: true }
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.sardakkRacialValkyrieParticleWeaveSpace = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 1 };

	var options = { attacker: { race: game.Race.Sardakk, valkyrieParticleWeave: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.winnuFlagship = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };

	defender[game.UnitType.Destroyer] = { count: 1 };

	var options = { attacker: { race: game.Race.Winnu, }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.winnuFlagshipMany = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 2 };
	attacker[game.UnitType.Cruiser] = { count: 2 };

	defender[game.UnitType.Dreadnought] = { count: 1 };
	defender[game.UnitType.Destroyer] = { count: 3 };
	defender[game.UnitType.Fighter] = { count: 2 };

	var options = { attacker: { race: game.Race.Winnu, }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.winnuFlagshipMoraleBoost = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 2 };
	attacker[game.UnitType.Cruiser] = { count: 2 };

	defender[game.UnitType.Dreadnought] = { count: 1 };
	defender[game.UnitType.Destroyer] = { count: 3 };
	defender[game.UnitType.Fighter] = { count: 2 };

	var options = { attacker: { race: game.Race.Winnu, moraleBoost: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.yinFlagship = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };

	defender[game.UnitType.Destroyer] = { count: 3 };

	var options = { attacker: { race: game.Race.Yin, }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.yinFlagshipPds = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };

	defender[game.UnitType.Destroyer] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = { attacker: { race: game.Race.Yin, }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.yinFlagshipAssaultCannon = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };

	defender[game.UnitType.Destroyer] = { count: 3 };

	var options = { attacker: { race: game.Race.Yin, }, defender: { assaultCannon: true } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.yinFlagshipMoraleBoost = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 2 };

	var options = { attacker: { race: game.Race.Yin, }, defender: { moraleBoost: true } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.yinFlagshipMentakRacial = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 3 };

	var options = { attacker: { race: game.Race.Yin, }, defender: { race: game.Race.Mentak } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.jolNarFlagship = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };

	defender[game.UnitType.Destroyer] = { count: 3 };

	var options = { attacker: { race: game.Race.JolNar, }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.jolNarFlagshipMoraleBoost = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };

	defender[game.UnitType.Destroyer] = { count: 3 };

	var options = { attacker: { race: game.Race.JolNar, moraleBoost: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.sardakkFlagship = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.Cruiser] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 3 };

	var options = { attacker: { race: game.Race.Sardakk, }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.sardakkFlagshipMoraleBoost = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.Cruiser] = { count: 1 };

	defender[game.UnitType.Destroyer] = { count: 3 };

	var options = { attacker: { race: game.Race.Sardakk, moraleBoost: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

/** Test some random battle. Because I couldn't have imagined all edge cases.
 * When this test fails - take input fleets and options from the console and reproduce the problem */
function chaoticTest(test) {
	var attacker = {};
	var defender = {};

	for (var unitType in game.UnitType) {
		var count = Math.max(0, Math.floor(Math.random() * 8) - 3);
		attacker[unitType] = { count: count };
	}

	for (var unitType in game.UnitType) {
		var count = Math.max(0, Math.floor(Math.random() * 8) - 3);
		defender[unitType] = { count: count };
	}

	var options = {
		attacker: {
			race: pickRandom(Object.keys(game.Race)),
		},
		defender: {
			race: pickRandom(Object.keys(game.Race)),
		},
	};

	for (var technology in game.Technologies) {
		options.attacker[technology] = Math.random() < .2;
		options.defender[technology] = Math.random() < .2;
	}

	// Duranium Armor is not supported by the calculator, so don't try to test it
	options.attacker.duraniumArmor = false;
	options.defender.duraniumArmor = false;

	for (var actionCard in game.ActionCards) {
		options.attacker[actionCard] = Math.random() < .2;
		options.defender[actionCard] = Math.random() < .2;
	}

	var input = {
		attackerUnits: attacker,
		defenderUnits: defender,
		battleType: Math.random() < .8 ? game.BattleType.Space : game.BattleType.Ground,
		options: options
	};

	var showInput = false;
	try {
		var expected = im.estimateProbabilities(input).distribution;
		var got = calc.computeProbabilities(input).distribution;
		var testPassed = distributionsEqual(expected, got);
		if (!testPassed) {
			//try two more times in case of false positives
			expected = im.estimateProbabilities(input).distribution;
			if (distributionsEqual(expected, got)) {
				// third round to break the tie
				expected = im.estimateProbabilities(input).distribution;
				testPassed = distributionsEqual(expected, got);
			}
		}
		if (!testPassed) {
			showInput = true;
		}
		test.ok(testPassed, 'empirical differs from analytical');
	} catch (e) {
		console.log(e);
		showInput = true;
		test.ok(false, 'exception thrown');
	}

	if (showInput) {
		console.log('Battle type =', battleType);
		console.log(JSON.stringify(attacker));
		console.log(JSON.stringify(defender));
		console.log(JSON.stringify(options));
	}

	test.done();

	function pickRandom(obj) {
		if (Array.isArray(obj))
			return obj[Math.floor(Math.random() * obj.length)];
		else
			return obj[pickRandom(Object.keys(obj))];
	}
}

/** If chaotic test fails, this test is convenient to reproduce the problem */
exports.chaoticReproduce = function (test) {
	var battleType = game.BattleType.Space;
	var attacker = {
		WarSun: { count: 1 },
		Dreadnought: { count: 1 },
	};
	var defender = {
		Destroyer: { count: 3 },
	};
	var options = {
		attacker: {
			riskDirectHit: false,
		},
		defender: {
			assaultCannon: true,
		}
	};
	testBattle(test, attacker, defender, battleType, options);
};

//exports.chaoticMonkey = new Array(20).fill(chaoticTest);

function Input(attacker, defender, battleType, options) {
	this.attackerUnits = attacker;
	this.defenderUnits = defender;
	this.battleType = battleType;
	this.options = {
		attacker: Object.assign({ race: defaultRace, riskDirectHit: true }, options && options.attacker),
		defender: Object.assign({ race: defaultRace, riskDirectHit: true }, options && options.defender),
	};
}

/** used to group tests for easier selective running */
function group(exports, testGroup) {
	var result = {};
	var rx = new RegExp(testGroup, 'i');
	for (var test in exports) {
		if (exports.hasOwnProperty(test) && rx.test(test)) {
			var name = test.replace(rx, '');
			result[name] = exports[test];
		}
	}
	return result;
}

//var barrageGroup = group(exports, 'barrage');
//delete barrageGroup[''];
//Object.assign(exports.barrage, barrageGroup);

//exports.expansion = group(exports, 'expansion');
//exports.plasmaScoring = group(exports, 'plasmaScoring');
//exports.magenDefense = group(exports, 'magenDefense');
//exports.ground = group(exports, 'ground');
//exports.assaultCannon = group(exports, 'assaultCannon');
//exports.moraleBoost = group(exports, 'moraleBoost');
//exports.fireTeam = group(exports, 'fireTeam');
//exports.fighterPrototype = group(exports, 'fighterPrototype');
//exports.bunker = group(exports, 'bunker');
//exports.directHit = group(exports, 'directHit');
//exports.maneuveringJets = group(exports, 'maneuveringJets');
//exports.sardakk = group(exports, 'sardakk');
//exports.harrow = group(exports, 'harrow');
//exports.nonEuclidean = group(exports, 'nonEuclidean');
//exports.valkyrieParticleWeave = group(exports, 'valkyrieParticleWeave');
//exports.gravitonLaser = group(exports, 'gravitonLaser');
//exports.winnu = group(exports, 'winnuFlagship');
//exports.yin = group(exports, 'yinFlagship');
//exports.jolNar = group(exports, 'jolNar');

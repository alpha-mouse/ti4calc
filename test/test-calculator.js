// todo This tests suite is not paranoid enough. There are many more edge cases then those that are tested here.

var game = require('../game-elements');
var calc = require('../calculator').calculator;
var imitatorModule = require('../imitator');
var im = imitatorModule.imitator;
imitatorModule.imitationIterations = 30000;
var defaultRace = 'Muaat';


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
	options = options || { attacker: {}, defender: {} };

	var attackerRiskDirectHit = typeof options.attacker.riskDirectHit === 'boolean' ? options.attacker.riskDirectHit : true;
	var defenderRiskDirectHit = typeof options.defender.riskDirectHit === 'boolean' ? options.defender.riskDirectHit : true;
	var attackerBattlestation = options.attacker.experimentalBattlestation && battleType === BattleType.Space;
	var defenderBattlestation = options.defender.experimentalBattlestation && battleType === BattleType.Space;
	var attackerExpanded = game.expandFleet(options.attacker.race || defaultRace, attacker, attackerRiskDirectHit, attackerBattlestation);
	var defenderExpanded = game.expandFleet(options.defender.race || defaultRace, defender, defenderRiskDirectHit, defenderBattlestation);

	var got = calc.computeProbabilities(attackerExpanded, defenderExpanded, battleType, options).distribution;
	var expected = im.estimateProbabilities(attackerExpanded, defenderExpanded, battleType, options).distribution;

	//console.log('i', expected.toString());
	//console.log('c', got.toString());

	test.ok(distributionsEqual(expected, got), 'empirical differs from analytical');

	test.done();
}

var accuracy = 0.01;

/** test unit counts expansion into ship units */
exports.expansionRiskDirectHit = function (test) {
	var fleet = {};
	fleet[game.UnitType.Dreadnought] = { count: 4 };
	fleet[game.UnitType.Cruiser] = { count: 3 };
	fleet[game.UnitType.PDS] = { count: 2 };

	var expansion = game.expandFleet(defaultRace, fleet, true);

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

/** test unit counts expansion into ship units */
exports.expansionNoRiskDirectHit = function (test) {
	var fleet = {};
	fleet[game.UnitType.WarSun] = { count: 1 };
	fleet[game.UnitType.Dreadnought] = { count: 4 };
	fleet[game.UnitType.Cruiser] = { count: 3 };
	fleet[game.UnitType.PDS] = { count: 2 };

	var expansion = game.expandFleet(defaultRace, fleet, false);

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

	var expansion = game.expandFleet('Sol', fleet, true);

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
	var expansion = game.expandFleet(defaultRace, fleet, true, true);

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
		game.StandardUnits.ExperimentalBattlestation,
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
	var attacker = game.expandFleet(defaultRace, fleet, true);
	var defender = game.expandFleet(defaultRace, fleet, true);
	var distr = im.estimateProbabilities(attacker, defender, game.BattleType.Space).distribution;
	var inverse = invertDistribution(distr);
	test.ok(distributionsEqual(distr, inverse), 'got asymmetric distribution');
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
	var attacker = game.expandFleet(defaultRace, fleet, true);
	var defender = game.expandFleet(defaultRace, fleet, true);
	var distr = calc.computeProbabilities(attacker, defender, game.BattleType.Space).distribution;
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

	var attackerExpanded = game.expandFleet(defaultRace, attacker, true);
	var defenderExpanded = game.expandFleet(defaultRace, defender, true);

	var s = new Date();
	for (var i = 0; i < 100; ++i)
		calc.computeProbabilities(attackerExpanded, defenderExpanded, game.BattleType.Space);
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

	var attackerExpanded = game.expandFleet(defaultRace, attacker);
	var defenderExpanded = game.expandFleet(defaultRace, defender);

	var noDreadnoughts = calc.computeProbabilities(attackerExpanded, defenderExpanded, game.BattleType.Ground).distribution;
	//console.log(noDreadnoughts.toString());

	attacker[game.UnitType.Dreadnought] = { count: 6 };
	attackerExpanded = game.expandFleet(defaultRace, attacker);
	var withDreadnoughts = calc.computeProbabilities(attackerExpanded, defenderExpanded, game.BattleType.Ground).distribution;
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

	var attackerExpanded = game.expandFleet(defaultRace, attacker);
	var defenderExpanded = game.expandFleet(defaultRace, defender);

	var noWarSun = calc.computeProbabilities(attackerExpanded, defenderExpanded, game.BattleType.Ground).distribution;
	//console.log(noWarSun.toString());

	attacker[game.UnitType.WarSun] = { count: 1 };
	attackerExpanded = game.expandFleet(defaultRace, attacker);
	var withWarSun = calc.computeProbabilities(attackerExpanded, defenderExpanded, game.BattleType.Ground).distribution;
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

	var options = { attacker: { race: 'Mentak' }, defender: { race: defaultRace } };

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
	var options = { attacker: { race: 'Mentak' }, defender: { race: defaultRace } };

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

exports.assaultCannonNonDagameable = function (test) {

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
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 3 };

	defender[game.UnitType.Dreadnought] = { count: 3 };
	defender[game.UnitType.Fighter] = { count: 3 };

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

exports.assaultCannonMorePds = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 1 };
	attacker[game.UnitType.PDS] = { count: 4 };

	defender[game.UnitType.Destroyer] = { count: 3 };
	defender[game.UnitType.Fighter] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = { attacker: {}, defender: { assaultCannon: true, }, };
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
	attacker[game.UnitType.Cruiser] = { count: 3 };
	attacker[game.UnitType.Fighter] = { count: 3 };

	defender[game.UnitType.Cruiser] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = {
		attacker: {},
		defender: { gravitonLaser: true },
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
		attacker: { race: 'Xxcha', plasmaScoring: true },
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

	var attackerExpanded = game.expandFleet(defaultRace, attacker);
	var defenderExpanded = game.expandFleet(defaultRace, defender);

	var options = {
		attacker: {},
		defender: {},
	};

	var noMagenDefense = calc.computeProbabilities(attackerExpanded, defenderExpanded, game.BattleType.Ground, options).distribution;
	//console.log(noMagenDefense.toString());

	options.defender.magenDefense = true;
	var withMagenDefense = calc.computeProbabilities(attackerExpanded, defenderExpanded, game.BattleType.Ground, options).distribution;
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

	var attackerExpanded = game.expandFleet(defaultRace, attacker, true);
	var defenderExpanded = game.expandFleet(defaultRace, defender, true);

	var distribution = im.estimateProbabilities(attackerExpanded, defenderExpanded, game.BattleType.Space, options).distribution;
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

	var options = { attacker: { race: 'Sardakk' }, defender: { race: 'Sardakk' } };

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

	var options = { attacker: { race: 'Sardakk', moraleBoost: true }, defender: { race: 'Sardakk', fighterPrototype: true } };

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
			race: pickRandom(Object.keys(game.Races)),
		},
		defender: {
			race: pickRandom(Object.keys(game.Races)),
		},
	};

	for (var technology in game.Technologies) {
		options.attacker[technology] = Math.random() < .2;
		options.defender[technology] = Math.random() < .2;
	}

	// Duranium Armor is not supported by the calculator, so don't try to test it
	options.attacker.duraniumArmor = false;
	options.defender.duraniumArmor = false;

	options.attacker.gravitonLaser = false;
	options.defender.gravitonLaser = false;

	for (var actionCard in game.ActionCards) {
		options.attacker[actionCard] = Math.random() < .2;
		options.defender[actionCard] = Math.random() < .2;
	}

	var battleType = Math.random() < .8 ? game.BattleType.Space : game.BattleType.Ground;

	var showInput = false;
	try {
		var attackerExpanded = game.expandFleet(options.attacker.race, attacker, options.attacker.riskDirectHit);
		var defenderExpanded = game.expandFleet(options.defender.race, defender, options.defender.riskDirectHit);

		var expected = im.estimateProbabilities(attackerExpanded, defenderExpanded, battleType, options).distribution;
		var got = calc.computeProbabilities(attackerExpanded, defenderExpanded, battleType, options).distribution;
		var testPassed = distributionsEqual(expected, got);
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
		'Flagship': { 'count': 1 },
		'PDS': { 'count': 1 },
	};
	var defender = {
		'Cruiser': { 'count': 1 },
	};
	var options = {
		'attacker': {},
		'defender': {},
	};
	testBattle(test, attacker, defender, battleType, options);
};

//exports.chaoticMonkey = new Array(20).fill(chaoticTest);

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

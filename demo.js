var calc = require('./calculator').calculator;
var im = require('./imitator').imitator;
var structs = require('./structs');
var game = require('./game-elements');


var fleet1 = {};
var fleet2 = {};

fleet1[game.UnitType.Dreadnought] = { count: 3 };
fleet1[game.UnitType.Cruiser] = { count: 3 };
fleet1[game.UnitType.Fighter] = { count: 3 };

fleet2[game.UnitType.Dreadnought] = { count: 2 };
fleet2[game.UnitType.Cruiser] = { count: 3 };
fleet2[game.UnitType.Fighter] = { count: 5 };

var input = {
		attackerUnits: fleet1,
		defenderUnits: fleet2,
		battleType: game.BattleType.Space,
		options: {
			attacker: { race: game.Race.Arborec },
			defender: { race: game.Race.Arborec, duraniumArmor: true },
		},
	}
;

im.imitationIterations = 100000;
var start = new Date();
var expected = im.estimateProbabilities(input).distribution;
console.log('passed', new Date() - start);
console.log(expected.toString());

//var got = calc.computeProbabilities(input).distribution;
//console.log(got.toString());


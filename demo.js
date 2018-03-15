var calc = require('./calculator').calculator;
var im = require('./imitator').imitator;
var structs = require('./structs');
var game = require('./game-elements');


var fleet1 = {};
var fleet2 = {};

fleet1[game.UnitType.Dreadnought] = { count: 1 };

fleet2[game.UnitType.Fighter] = { count: 1 };

var input = { attackerUnits: fleet1, defenderUnits: fleet2, battleType: game.BattleType.Space };

var expected = im.estimateProbabilities(input).distribution;
console.log(expected.toString());
var got = calc.computeProbabilities(input).distribution;
console.log(got.toString());


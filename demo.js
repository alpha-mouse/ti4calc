var calc = require('./calculator').calculator;
var im = require('./imitator').imitator;
var structs = require('./structs');
var game = require('./game-elements');


var fleet1 = {};
var fleet2 = {};

fleet1[game.UnitType.Dreadnought] = { count: 1 };

fleet2[game.UnitType.Fighter] = { count: 1 };

var options = null;

fleet1 = game.expandFleet('Sardakk', fleet1);
fleet2 = game.expandFleet('Sardakk', fleet2);

var expected = im.estimateProbabilities(fleet1, fleet2, game.BattleType.Space, options).distribution;
console.log(expected.toString());
var got = calc.computeProbabilities(fleet1, fleet2, game.BattleType.Space, options).distribution;
console.log(got.toString());


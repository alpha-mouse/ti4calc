var calc = require('./calculator').calculator;
var im = require('./imitator').imitator;
var structs = require('./structs');
var game = require('./game-elements');


var battleType = game.BattleType.Ground;
var attacker = {
	Dreadnought: {
		count: 1,
	},
	Ground: {
		count: 1,
	},
};
var defender = {
	Ground: {
		count: 1,
	},
};
var options = {
  attacker: { race: game.Race.Arborec },
	defender: {
    race: game.Race.Arborec,
		tekklarLegion: true,
		valkyrieParticleWeave: true
	}
};

var input = {
		attackerUnits: attacker,
		defenderUnits: defender,
		battleType: battleType,
		options: options,
	}
;

//im.imitationIterations = 100000;
//var start = new Date();
//var expected = im.estimateProbabilities(input).distribution;
//console.log('passed', new Date() - start);
//console.log(expected.toString());

var got = calc.computeProbabilities(input).distribution;
//console.log(got.toString());


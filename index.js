var input = {
	battleType: globals.BattleType.Space,
	attackerUnits: {},
	defenderUnits: {},
	options: {
		attacker: {
			race: 'Sardakk',
			moraleBoost: false,
			fireTeam: false,
			fighterPrototype: false,
			bunker: false,
			emergencyRepairs: false,
			riskDirectHit: true,

			shieldsHolding: false,
			experimentalBattlestation: false,
			courageous: false,
		}, defender: null,
	},
};
input.options.defender = _.clone(input.options.attacker);

for (var unitType in globals.UnitType) {
	input.attackerUnits[unitType] = { count: 0, upgraded: false };
	input.defenderUnits[unitType] = { count: 0, upgraded: false };
}

var recomputeHandler = {
	handler: 'recompute',
	deep: true,
};

app = new Vue({
	el: '#root',
	data: Object.assign({}, globals, input),
	methods: {
		increment: function (unitInput) {
			unitInput.count++;
		},
		decrement: function (unitInput) {
			unitInput.count = unitInput.count === 0 ? 0 : unitInput.count - 1;
		},
		updateable: function (race, unitType) {
			return !!(globals.StandardUpgrades.hasOwnProperty(unitType) ||
			globals.RaceSpecificUpgrades[race] &&
			globals.RaceSpecificUpgrades[race].hasOwnProperty(unitType));
		},
		recompute: function () {
			var attacker = globals.expandFleet(input.options.attacker.race, input.attackerUnits);
			var defender = globals.expandFleet(input.options.defender.race, input.defenderUnits);
			var computed = globals.calculator.computeProbabilities(attacker, defender, input.battleType, input.options);
			console.log(computed.distribution.toString());
		},
	},
	watch: {
		battleType: recomputeHandler,
		attackerUnits: recomputeHandler,
		defenderUnits: recomputeHandler,
		options: recomputeHandler,
	},
});
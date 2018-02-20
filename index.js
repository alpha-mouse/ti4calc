var input = {
	battleType: globals.BattleType.Space,
	attackerRace: 'Sardakk',
	defenderRace: 'Sardakk',
	attackerUnits: {},
	defenderUnits: {},
};
/*var computed = {
	attackerHints: {},
	defenderHints: {},
	something: function () {
		return '=)';
	},
};*/
for (var unitType in globals.UnitType) {
	input.attackerUnits[unitType] = { count: 0, upgraded: false };
	input.defenderUnits[unitType] = { count: 0, upgraded: false };
}
/*for (var unitType in globals.UnitType) {
	computed.attackerHints[unitType] = {
		updateable: function () {
			return globals.StandardUpgrades.hasOwnProperty(unitType) ||
				globals.RaceSpecificUpgrades[input.attackerRace] &&
				globals.RaceSpecificUpgrades[input.attackerRace].hasOwnProperty(unitType);
		},
	};
	computed.defenderHints[unitType] = {
		updateable: function () {
			return globals.StandardUpgrades.hasOwnProperty(unitType) ||
				globals.RaceSpecificUpgrades[input.defenderRace] &&
				globals.RaceSpecificUpgrades[input.defenderRace].hasOwnProperty(unitType);
		},
	};
}*/
app = new Vue({
	el: '#root',
	data: Object.assign({}, globals, input),
//	computed: computed,
	methods: {
		increment: function (unitInput) {
			unitInput.count++;
		},
		decrement: function (unitInput) {
			unitInput.count = unitInput.count === 0 ? 0 : unitInput.count -1;
		},
		updateable: function(race, unitType) {
			return !!(globals.StandardUpgrades.hasOwnProperty(unitType) ||
				globals.RaceSpecificUpgrades[race] &&
				globals.RaceSpecificUpgrades[race].hasOwnProperty(unitType));
		},
	}
});
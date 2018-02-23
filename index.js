var input = {
	battleType: globals.BattleType.Space,
	attackerUnits: {},
	defenderUnits: {},
	options: {
		attacker: {
			race: 'Sardakk',

			antimassDeflectors: false,
			gravitonLaser: false,
			plasmeScoring: false,
			magenDefense: false,
			duraniumArmor: false,
			assaultCannon: false,

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
			this.displayDistribution(computed);
			//console.log(computed.distribution.toString());
		},
		displayDistribution: function (solution) {

			drawChart(solution);
			drawTotalWinProbabilities(solution);

			return;

			function drawChart(solution) {
				var labels = [];
				var data = [];
				var dataLabels = [];
				var from = Math.min(-8, solution.distribution.min);
				var to = Math.max(8, solution.distribution.max);

				for (var i = from; i <= to; ++i) {
					labels.push(getLabel(i, solution.attacker, solution.defender));
					if (i === 0) {
						data.push(solution.distribution.at(0) * 100);
						dataLabels.push(Math.round(solution.distribution.at(0) * 100).toString() + '%');
					} else {
						data.push(solution.distribution.at(i) * 100);
						dataLabels.push(Math.round(solution.distribution.downTo(i) * 100).toString() + '%');
					}
				}

				RGraph.clear(document.getElementById('chart-area'));
				RGraph.ObjectRegistry.Clear();

				var line = new RGraph.Line('chart-area', data)
					.Set('labels', labels)
					.Set('chart.background.grid.vlines', true)
					.Set('chart.background.grid.autofit.numvlines', 1)
					.Set('chart.filled', true)
					.Set('chart.tickmarks', 'circle')
					.Set('chart.numxticks', 0)
					.Set('chart.ymax', _.max(data) * 1.08)
					.Set('chart.colors', ['rgba(200,200,256,0.7)']);
				if (to - from < 20)
					line.Set('chart.labels.ingraph', dataLabels);
				else
					line.Set('chart.tooltips', dataLabels);
				line.Draw();

				function getLabel(i, attacker, defender) {
					if (i === 0)
						return "=";
					if (i < 0) {
						i = -i;
						if (i <= attacker.length)
							return attacker[i - 1];
						else
							return "";
					}
					else {
						if (i <= defender.length)
							return defender[i - 1];
						else
							return "";
					}
				}
			}

			function drawTotalWinProbabilities(solution) {
				var attackerWinProbability = 0;
				var defenderWinProbability = 0;
				for (var i = solution.distribution.min; i < 0; i++) {
					attackerWinProbability += solution.distribution.at(i);
				}
				for (var i = 1; i <= solution.distribution.max; i++) {
					defenderWinProbability += solution.distribution.at(i);
				}

				var canvas = document.getElementById('chart-area-overlay');
				RGraph.clear(canvas);
				var context = canvas.getContext('2d');
				var canvasWidth = canvas.width;
				var canvasHeight = canvas.height;
				context.font = 'bold 100px Arial';
				context.fillStyle = 'rgba(256, 100, 100, 0.5)';
				context.fillText(Math.round(attackerWinProbability * 100) + '%', canvasWidth / 12, 3 * canvasHeight / 4);
				context.fillStyle = 'rgba(100, 100, 256, 0.5)';
				context.fillText(Math.round(defenderWinProbability * 100) + '%', 7 * canvasWidth / 12, 3 * canvasHeight / 4);
			}
		},
	},
	watch: {
		battleType: recomputeHandler,
		attackerUnits: recomputeHandler,
		defenderUnits: recomputeHandler,
		options: recomputeHandler,
	},
});
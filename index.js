(function () {

	var input = getInput();

	var recomputeHandler = {
		handler: 'recompute',
		deep: true,
	};

	var viewOnlyProperties = {
		showOptions: false,
		showHelp: false,
	};

	app = new Vue({
		el: '#root',
		data: Object.assign(input, viewOnlyProperties),
		methods: {
			increment: function (unitInput) {
				unitInput.count++;
			},
			decrement: function (unitInput) {
				unitInput.count = unitInput.count === 0 ? 0 : unitInput.count - 1;
			},
			displayName: function (unitType) {
				if (unitType === UnitType.WarSun) return 'War Sun';
				else if (unitType === UnitType.Ground) return 'Ground Force';
				else return unitType;
			},
			clear: function (side) {
				for (var unitType in UnitType) {
					this[side + 'Units'][unitType].count = 0;
					this[side + 'Units'][unitType].upgraded = false;
				}
			},
			recompute: function () {
				persistInput();

				var attackerBattlestation = this.options.attacker.experimentalBattlestation && this.battleType === BattleType.Space;
				var defenderBattlestation = this.options.defender.experimentalBattlestation && this.battleType === BattleType.Space;
				var attacker = expandFleet(this.options.attacker.race, this.attackerUnits, this.options.attacker.riskDirectHit, attackerBattlestation);
				var defender = expandFleet(this.options.defender.race, this.defenderUnits, this.options.defender.riskDirectHit, defenderBattlestation);
				var computed;

				// unfortunately Duranium Armor cannot be handled by the calculator
				var duraniumArmor = this.options.attacker.duraniumArmor || this.options.defender.duraniumArmor;
				if (duraniumArmor && this.battleType === BattleType.Space)
					computed = imitator.estimateProbabilities(attacker, defender, this.battleType, this.options);
				else
					computed = calculator.computeProbabilities(attacker, defender, this.battleType, this.options);

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
						.Set('chart.ymax', Math.max.apply(null, data) * 1.08)
						.Set('chart.colors', ['rgba(200,200,256,0.7)']);
					if (to - from < 20)
						line.Set('chart.labels.ingraph', dataLabels);
					else
						line.Set('chart.tooltips', dataLabels);
					line.Draw();

					function getLabel(i, attacker, defender) {
						if (i === 0)
							return '=';
						if (i < 0) {
							i = -i;
							if (i <= attacker.length)
								return attacker[i - 1];
							else
								return '';
						}
						else {
							if (i <= defender.length)
								return defender[i - 1];
							else
								return '';
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
			'options.attacker.race': resetUpdatesAndTechnologies('attacker'),
			'options.defender.race': resetUpdatesAndTechnologies('defender'),
			battleType: recomputeHandler,
			attackerUnits: recomputeHandler,
			defenderUnits: recomputeHandler,
			options: recomputeHandler,
		},
		computed: {
			raceTechnologies: function () {
				var attackerTech = RaceSpecificTechnologies[this.options.attacker.race] || {};
				var defenderTech = RaceSpecificTechnologies[this.options.defender.race] || {};
				var attackerTechKeys = Object.keys(attackerTech);
				var defenderTechKeys = Object.keys(defenderTech);
				var result = [];
				for (var i = 0; i < attackerTechKeys.length || i < defenderTechKeys.length; ++i) {
					var pair = {};
					pair.attacker = i < attackerTechKeys.length ? {
						key: attackerTechKeys[i],
						option: attackerTech[attackerTechKeys[i]],
					} : stub(defenderTech[defenderTechKeys[i]].title);
					pair.defender = i < defenderTechKeys.length ? {
						key: defenderTechKeys[i],
						option: defenderTech[defenderTechKeys[i]],
					} : stub(attackerTech[attackerTechKeys[i]].title);
					result.push(pair);
				}
				return result;

				function stub(name) {
					return {
						key: '',
						option:
							{
								title: name,
								availableFor: function () {
									return false;
								}
							}
					};
				}
			}
		}
	});
	Vue.component('left-option', {
		props: ['optionName', 'option', 'options', 'side'],
		template:
		'<div class="o-grid__cell" :class="{ hidden: !option.availableFor(side) }">' +
		'	<label class="" v-bind:for="side + \'.\' + optionName"' +
		'		   v-bind:title="option.description">{{option.title}}</label>' +
		'	<input type="checkbox" class="" v-bind:id="side + \'.\' + optionName"' +
		'		   v-model="options[side][optionName]">' +
		'</div>',
	});
	Vue.component('right-option', {
		props: ['optionName', 'option', 'options', 'side'],
		template:
		'<div class="o-grid__cell" :class="{ hidden: !option.availableFor(side) }">' +
		'	<input type="checkbox" class="" v-bind:id="side + \'.\' + optionName"' +
		'		   v-model="options[side][optionName]">' +
		'	<label class="" v-bind:for="side + \'.\' + optionName"' +
		'		   v-bind:title="option.description">{{option.title}}</label>' +
		'</div>',
	});
	Vue.component('option-pair', {
		props: ['optionName', 'option', 'options',],
		template:
		'<div class="o-grid center-grid">' +
		'	<left-option :option-name="optionName" :option="option" :options="options" side="attacker"></left-option>' +
		'	<help-mark :text="option.description"></help-mark>' +
		'	<right-option :option-name="optionName" :option="option" :options="options" side="defender"></right-option>' +
		'</div>',
	});
	Vue.component('help-mark', {
		props: ['text'],
		template:
		'<div class="o-grid__cell">' +
		'	<button type="button" class="help" v-bind:title="text"></button>' +
		'</div>',
	});

	app.recompute();

	/** When the race changed from the race having an upgrade for the unit (eg Sol Carrier)
	 * to the race not having such upgrade, input flag for the unit upgrade should be set to false */
	function resetUpdatesAndTechnologies(battleSide) {
		return function (newRace, oldRace) {
			for (var unitType in UnitType) {
				if (upgradeable(oldRace, unitType) &&
					!upgradeable(newRace, unitType)) {
					this[battleSide + 'Units'][unitType].upgraded = false;
				}
			}
			if (RaceSpecificTechnologies[oldRace])
				for (var tech in RaceSpecificTechnologies[oldRace])
					this.options[battleSide][tech] = false;
		};
	}

	function getInput() {
		return Object.assign(getDefaultInput(), getPersistedInput());
	}

	function getDefaultInput() {
		var result = {
			battleType: BattleType.Space,
			attackerUnits: {},
			defenderUnits: {},
			options: {
				attacker: {
					race: 'Sardakk',
				}, defender: null,
			},
		};

		for (var technology in Technologies) {
			result.options.attacker[technology] = false;
		}
		for (var actionCard in ActionCards) {
			result.options.attacker[actionCard] = false;
		}
		result.options.attacker.riskDirectHit = true;

		result.options.defender = Object.assign({}, result.options.attacker);

		for (var unitType in UnitType) {
			result.attackerUnits[unitType] = { count: 0, upgraded: false };
			result.defenderUnits[unitType] = { count: 0, upgraded: false };
		}
		return result;
	}

	function persistInput() {
		if (localStorage) {
			var inputToSave = JSON.parse(JSON.stringify(input));
			for (var viewOnlyProperty in viewOnlyProperties) {
				delete inputToSave[viewOnlyProperty];
			}
			localStorage.setItem('input', JSON.stringify(inputToSave));
			return true;
		}
		return false;
	}

	function getPersistedInput() {
		if (!localStorage) return null;
		var result = localStorage.getItem('input');
		if (!result) return null;
		return JSON.parse(result);
	}
})();
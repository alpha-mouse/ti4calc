(function () {

	window.CanvasSizes = [
		{ width: 600, height: 400 },
		{ width: 900, height: 600 },
		{ width: 1200, height: 800 },
		{ width: 1800, height: 1200 },
	];

	var lastComputed;

	var input = getInput();

	var recomputeHandler = {
		handler: 'recompute',
		deep: true,
	};

	var transientProperties = {
		costs: { attacker: { count: 0, cost: 0, }, defender: { count: 0, cost: 0, } },
		showOptions: false,
		showHelp: false,
		computing: false,
		forceSlow: false, // do `app.forceSlow = true;` in developers console to force slow but robust calculation
		windowWidth: window.innerWidth,
		windowHeight: window.innerHeight,
	};

	app = new Vue({
		el: '#root',
		data: Object.assign(input, transientProperties),
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
					this[SideUnits[side]][unitType].count = 0;
					this[SideUnits[side]][unitType].upgraded = false;
				}
			},
			recompute: function () {
				this.tallyCosts();
				this.computing = true;
				var self = this;

				persistInput();

				// veeery poor man's background processing
				setTimeout(function () {
					// unfortunately some game aspects are hard to handle in the calculator
					var duraniumArmor = self.options.attacker.duraniumArmor || self.options.defender.duraniumArmor;
					var l1z1xFlagship = self.options.attacker.race === Race.L1Z1X && self.attackerUnits.Flagship.count !== 0 ||
						self.options.defender.race === Race.L1Z1X && self.defenderUnits.Flagship.count !== 0;
					var letnevFlagship = self.options.attacker.race === Race.Letnev && self.attackerUnits.Flagship.count !== 0 ||
						self.options.defender.race === Race.Letnev && self.defenderUnits.Flagship.count !== 0;
					if ((duraniumArmor || l1z1xFlagship || letnevFlagship) && self.battleType === BattleType.Space || self.forceSlow)
						lastComputed = imitator.estimateProbabilities(self);
					else
						lastComputed = calculator.computeProbabilities(self);

					self.displayDistribution(lastComputed);

					self.computing = false;
				}, 15); // number is magic. but at least the spinner has time to show up before calculation begins
			},
			displayDistribution: function (solution) {

				drawChart(solution);
				drawTotalWinProbabilities(solution.distribution);

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

				function drawTotalWinProbabilities(distribution) {
					var attackerWinProbability = 0;
					var defenderWinProbability = 0;
					var drawProbability = distribution.at(0);
					for (var i = distribution.min; i < 0; i++) {
						attackerWinProbability += distribution.at(i);
					}
					for (var i = 1; i <= distribution.max; i++) {
						defenderWinProbability += distribution.at(i);
					}

					var canvas = document.getElementById('chart-area-overlay');
					RGraph.clear(canvas);
					var context = canvas.getContext('2d');
					var canvasWidth = canvas.width;
					var canvasHeight = canvas.height;
					context.font = 'bold 100px Arial';

					context.fillStyle = 'rgba(256, 100, 100, 0.5)';
					var roundedAttackerProbability = Math.round(attackerWinProbability * 100);
					context.fillText(roundedAttackerProbability + '%', canvasWidth / 12, 3 * canvasHeight / 4);

					context.fillStyle = 'rgba(100, 100, 256, 0.5)';
					var roundedDefenderProbability = Math.round(defenderWinProbability * 100);
					context.fillText(roundedDefenderProbability + '%', 7 * canvasWidth / 12, 3 * canvasHeight / 4);

					if (drawProbability > .005 && (roundedAttackerProbability + roundedDefenderProbability) < 100) {
						context.font = 'bold 80px Arial';
						context.fillStyle = 'rgba(160, 160, 160, 0.5)';
						context.fillText(Math.round(drawProbability * 100) + '%', 5 * canvasWidth / 12, 3 * canvasHeight / 8);
					}
				}
			},
			tallyCosts: function () {
				tally(this.costs.attacker, this.attackerUnits, this.options.attacker);
				tally(this.costs.defender, this.defenderUnits, this.options.defender);

				function tally(costs, units, sideOptions) {
					costs.count = 0;
					costs.cost = 0;
					for (var unitType in UnitType) {
						if (unitType === UnitType.PDS) continue;

						var counter = units[unitType];
						costs.count += counter.count;
						costs.cost += (counter.upgraded && MergedUpgrades[sideOptions.race][unitType].cost || MergedUnits[sideOptions.race][unitType].cost) * counter.count;
					}
				}
			},
			participates: function (battleSide, unitType) {
				var bombardmentPossible = this.defenderUnits.PDS.count === 0 // either there are no defending PDS
					|| this.attackerUnits.WarSun.count !== 0 // or there are but attacking WarSuns negate their Planetary Shield
					|| this.options.attacker.race === Race.Letnev && this.attackerUnits.Flagship.count !== 0; // Letnev Flagship negates Planetary Shield as well
				switch (unitType) {
					case UnitType.Flagship:
						return this.battleType === BattleType.Space ||
							battleSide === BattleSide.attacker && (this.options.attacker.race === Race.Naalu || this.options.attacker.race === Race.Letnev && !this.options.defender.conventionsOfWar);
					case UnitType.WarSun:
						return this.battleType === BattleType.Space ||
							battleSide === BattleSide.attacker && !this.options.defender.conventionsOfWar;
					case UnitType.Dreadnought:
						return this.battleType === BattleType.Space ||
							battleSide === BattleSide.attacker && bombardmentPossible && !this.options.defender.conventionsOfWar;
					case UnitType.Cruiser:
						return this.battleType === BattleType.Space;
					case UnitType.Carrier:
						return this.battleType === BattleType.Space;
					case UnitType.Destroyer:
						return this.battleType === BattleType.Space;
					case UnitType.Fighter:
						return this.battleType === BattleType.Space ||
							battleSide === BattleSide.attacker && this.options.attacker.race === Race.Naalu && this.attackerUnits.Flagship.count !== 0;
					case UnitType.Ground:
						return this.battleType === BattleType.Ground ||
							this.options[battleSide].race === Race.Virus && this[SideUnits[battleSide]].Flagship.count !== 0;
					case UnitType.PDS:
						return this.battleType === BattleType.Space || battleSide === BattleSide.defender;
				}
			},
			damageableCount: function (count) {
				var result = [];
				for (var i = 0; i <= count; i++)
					result.push(i);
				return result;
			},
			// will compute canvas width to match the width of the
			// 'container' bootstrap class (minus 30px padding)
			computeCanvasWidth: function () {
				if (this.windowWidth < 576) {
					return this.windowWidth - 48;
				} else if (this.windowWidth < 768) {
					return 510;
				} else if (this.windowWidth < 992) {
					return 690;
				} else if (this.windowWidth < 1200) {
					return 930;
				} else {
					return 1110;
				}
			},
		},
		watch: {
			'options.attacker.race': resetUpdatesAndTechnologies('attacker'),
			'options.defender.race': resetUpdatesAndTechnologies('defender'),
			'options.attacker.publicizeSchematics': function (value) {
				this.options.defender.publicizeSchematics = value;
			},
			'options.defender.publicizeSchematics': function (value) {
				this.options.attacker.publicizeSchematics = value;
			},
			battleType: recomputeHandler,
			attackerUnits: updateDamageableCountAndRecomputeHandler('attacker'),
			defenderUnits: updateDamageableCountAndRecomputeHandler('defender'),
			options: recomputeHandler,
			canvasSize: function () {
				persistInput();
				var self = this;
				if (lastComputed)
					this.$nextTick(function () {
						this.displayDistribution(lastComputed);
					});
			},
			canvasWidth: function () {
				persistInput();
				var self = this;
				if (lastComputed)
					this.$nextTick(function () {
						this.displayDistribution(lastComputed);
					});
			},
			canvasHeight: function () {
				persistInput();
				var self = this;
				if (lastComputed)
					this.$nextTick(function () {
						this.displayDistribution(lastComputed);
					});
			},
			forceSlow: recomputeHandler,
		},
		mounted: function () {
			var self = this;
			window.addEventListener('resize', function () {
				self.windowWidth = window.innerWidth;
				self.windowHeight = window.innerHeight;
			});
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
			},
			canvasWidth: function () {
				// if not set to responsive, choose width from array
				if (this.canvasSize >= 1) {
					return window.CanvasSizes[this.canvasSize - 1].width + 'px';
				}
				return this.computeCanvasWidth() + 'px';
			},
			canvasHeight: function () {
				if (this.canvasSize >= 1) {
					return window.CanvasSizes[this.canvasSize - 1].height + 'px';
				}
				// make height a ratio of the width
				let locCanvasWidth = parseInt(this.canvasWidth);
				if (locCanvasWidth > 600) {
					return this.computeCanvasWidth() * (4 / 6) + 'px';
				} else if (locCanvasWidth > 460) {
					return this.computeCanvasWidth() * (5 / 6) + 'px';
				} else {
					return '380px'; // 380 is the lowest height that won't cut off the labels at the top
				}
			},
		},
	});
	Vue.component('side-option', {
		props: ['optionName', 'option', 'options', 'side'],
		template:
		'<div class="col-5" :class="{ hidden: !option.availableFor(side) }">' +
		'	<button type="button" class="btn rounded-0 w-100"' +
		'			:class="{ \'btn-secondary-outline\': !options[side][optionName],' +
		'					  \'btn-secondary\': !options[side][optionName] }"' +
		'			@click="options[side][optionName] = !options[side][optionName]">' +
		'			{{option.title}}<span :class="{ hidden: !options[side][optionName]}"> ✓</span>' +
		'	</button>' +
		'</div>',
	});
	Vue.component('option-pair', {
		props: ['optionName', 'option', 'options',],
		template:
		'<div class="row no-gutters">' +
		'	<side-option :option-name="optionName" :option="option" :options="options" side="attacker"></side-option>' +
		'	<help-mark :option="option" col="2"></help-mark>' +
		'	<side-option :option-name="optionName" :option="option" :options="options" side="defender"></side-option>' +
		'</div>',
	});
	Vue.component('help-mark', {
		props: ['option', 'col'],
		template:
		'<div :class="\'col-\'+col">' +
		'	<button type="button" class="btn btn-primary rounded-0 w-100 h-100"' +
		'		v-bind:title="option.description" @click="showHelp">?' +
		'	</button>' +
		'</div>',
		methods: {
			showHelp: function () {
				alert(this.option.title + ':\n' + this.option.description);
			}
		}
	});

	app.recompute();

	/** When the race changed from the race having an upgrade for the unit (eg Sol Carrier)
	 * to the race not having such upgrade, input flag for the unit upgrade should be set to false */
	function resetUpdatesAndTechnologies(battleSide) {
		return function (newRace, oldRace) {
			for (var unitType in UnitType) {
				var counter = this[SideUnits[battleSide]][unitType];
				if (!upgradeable(newRace, unitType)) {
					counter.upgraded = false;
				}
				if (!damageable(newRace, unitType, counter.upgraded)) {
					counter.damaged = 0;
				}
			}
			if (RaceSpecificTechnologies[oldRace])
				for (var tech in RaceSpecificTechnologies[oldRace])
					this.options[battleSide][tech] = false;
		};
	}

	function updateDamageableCountAndRecomputeHandler(battleSide) {
		return {
			handler: function () {
				for (var unitType in UnitType) {
					var counter = this[SideUnits[battleSide]][unitType];
					counter.damaged = Math.min(counter.damaged, counter.count);
				}
				this.recompute();
			},
			deep: true
		}
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
					race: Race.Arborec,
				}, defender: null,
			},
			canvasSize: 0,
		};

		for (var technology in Technologies) {
			result.options.attacker[technology] = false;
		}
		for (var race in RaceSpecificTechnologies) {
			for (var technology in RaceSpecificTechnologies[race]) {
				result.options.attacker[technology] = false;
			}
		}
		for (var actionCard in ActionCards) {
			result.options.attacker[actionCard] = false;
		}
		for (var agenda in Agendas) {
			result.options.attacker[agenda] = false;
		}
		for (var promissory in Promissory) {
			result.options.attacker[promissory] = false;
		}
		result.options.attacker.riskDirectHit = true;

		result.options.defender = Object.assign({}, result.options.attacker);

		for (var unitType in UnitType) {
			result.attackerUnits[unitType] = { count: 0, upgraded: false, damaged: 0 };
			result.defenderUnits[unitType] = { count: 0, upgraded: false, damaged: 0 };
		}
		return result;
	}

	function persistInput() {
		if (localStorage) {
			var inputToSave = JSON.parse(JSON.stringify(input));
			for (var viewOnlyProperty in transientProperties) {
				delete inputToSave[viewOnlyProperty];
			}
			localStorage.setItem('ti4calc/input', JSON.stringify(inputToSave));
			return true;
		}
		return false;
	}

	function getPersistedInput() {
		if (!localStorage) return null;
		var resultString = localStorage.getItem('ti4calc/input');
		if (!resultString) return null;
		var result = JSON.parse(resultString);
		for (var unitType in UnitType) {
			// because previous published version didn't have already damaged units, persisted input might miss these fields
			result.attackerUnits[unitType].damaged = result.attackerUnits[unitType].damaged || 0;
			result.defenderUnits[unitType].damaged = result.defenderUnits[unitType].damaged || 0;
		}
		return result;
	}
})();

if (typeof require === "function" && typeof _ === "undefined")
	var _ = require("underscore");
if (typeof require === "function")
	var createMatrix = require("./matrix").createMatrix;
else
	var createMatrix = globals.createMatrix;

if (typeof assert === "undefined")
	var assert = function (condition, message) {
		if (!condition) {
			console.log("assertion failed. " + message);
			throw message || "Assertion failed";
		}
	};

var Calculator = function () {
	var calc = this;
	var useAssertions = true;

	//fleet counts -> unit list
	this.expandFleet = function (fleet, damaged, modifiers, modifiersDice, options) {
		var result = [];
		var damageGhosts = [];
		damaged = damaged || {};
		modifiers = modifiers || {};
		modifiersDice = modifiersDice || {};
		options = options || { allowDamage: true };
		for (var typeName in calc.UnitType) {
			if (calc.UnitType.hasOwnProperty(typeName)) {
				var unitType = calc.UnitType[typeName];
				for (var i = 0; i < fleet[unitType]; i++) {
					result.push(calc.units[unitType].applyModifier(modifiers[unitType] || 0, modifiersDice[unitType]));
					if (options.allowDamage && i < (fleet[unitType] || 0) - (damaged[unitType] || 0)) {
						if (calc.units[unitType].isDamageable ||
							(unitType === calc.UnitType.Cruiser && options.enhancedArmor) ||
							(unitType === calc.UnitType.Carrier && options.advancedCarriers)) {
							var ghost = calc.units[unitType].toDamageGhost();
							damageGhosts.push(ghost);
						}
					}
				}
			}
		}
		return result.concat(damageGhosts);
	};

	//apply default sort to fleet. decreasing importance
	this.defaultSort = function (fleet, gravitonNegator) {
		//mostly units are sorted in order of their types
		//except for when doing invasion combat and the attacker has Graviton Negator technology I do minor tweak that I see reasonable
		//Graviton Negator allows Fighters to participate in invasion combat. In which order should the units die?
		//I propose that the last dies single Ground Force unit, because Fighters cannot take control over the planet
		//right before it should die either Fighters of Ground Forces depending on which unit is stronger
		//and the first should die the weakest.
		//So, all in all, Fighters and Grounds may be sorted as G, F, F, G, G, G (die from right to left) when Fighters are stronger.
		var type = calc.UnitType;
		var unitOrder = {};
		unitOrder[type.WarSun] = 1;
		unitOrder[type.Dreadnought] = 2;
		unitOrder[type.Cruiser] = 3;
		unitOrder[type.Destroyer] = 4;
		unitOrder[type.Carrier] = 5;
		unitOrder[type.Mech] = 6;
		unitOrder[type.Ground] = 7;
		unitOrder[type.Fighter] = 8;
		unitOrder[type.PDS] = 9;
		var sorter = function (unit1, unit2) {
			var typeOrder = unitOrder[unit1.type] - unitOrder[unit2.type];
			if (unit1.isDamageGhost === unit2.isDamageGhost)
				return typeOrder;
			if (unit1.isDamageGhost)
				return 1;
			else
				return -1;
		};
		if (gravitonNegator) {
			//designate one Ground Force to die before all fighters and
			var vipGroundForce = _.find(fleet, function (unit) {
				return unit.type === type.Ground;
			});
			var typeSorter = sorter;
			sorter = function (unit1, unit2) {
				var typeOrder = typeSorter(unit1, unit2);
				if (typeOrder > 0) {
					//swap
					var tmp = unit1;
					unit1 = unit2;
					unit2 = tmp;
				}
				if (unit1.type === type.Ground) {
					if (unit2.type === type.Ground) {
						//vip ground force goes before other ground forces
						if (unit1 === vipGroundForce)
							return -1;
						if (unit2 === vipGroundForce)
							return 1;
					} else if (unit2.type === type.Fighter) {
						//vip ground force goes before fighters
						if (unit1 === vipGroundForce)
							return (typeOrder > 0) ? 1 : -1;
						else {
							//other ground forces go after fighters if fighters are stronger
							if (unit2.dmgDice < unit1.dmgDice)
								return (typeOrder > 0) ? -1 : 1;
						}
					}
				}

				//when no overrides - return standard type ordering
				return typeOrder;
			};
		}
		var result = fleet.slice();
		result.sort(sorter);
		return result;
	};

	//enumeration of available units
	this.units = (function () {
		var units = {};
		units[calc.UnitType.WarSun] = new UnitInfo(3, true, calc.UnitType.WarSun, 2, 3);
		units[calc.UnitType.Dreadnought] = new UnitInfo(5, true, calc.UnitType.Dreadnought, 5);
		units[calc.UnitType.Cruiser] = new UnitInfo(7, false, calc.UnitType.Cruiser, 8);
		units[calc.UnitType.Destroyer] = new UnitInfo(9, false, calc.UnitType.Destroyer, 8);
		units[calc.UnitType.Carrier] = new UnitInfo(9, false, calc.UnitType.Carrier, 4);
		units[calc.UnitType.Fighter] = new UnitInfo(9, false, calc.UnitType.Fighter, Infinity);
		units[calc.UnitType.PDS] = new UnitInfo(6, false, calc.UnitType.PDS, 6);
		units[calc.UnitType.Ground] = new UnitInfo(8, false, calc.UnitType.Ground, Infinity);
		units[calc.UnitType.Mech] = new UnitInfo(6, true, calc.UnitType.Mech, 4, 2);
		return units;
	})();

	this.belongsToBattle = function (unit, battleType, gravitonNegator) {
		//Graviton Negator allows Fighters to participate in Invasion Combats
		if (battleType === calc.BattleType.Space)
			return ships.indexOf(unit.type) >= 0;
		else //battleType === calc.BattleType.Ground
			return unit.type === calc.UnitType.Ground || unit.type === calc.UnitType.Mech || gravitonNegator && unit.type === calc.UnitType.Fighter;
	};

	//units that participate in space battles
	var ships = [calc.UnitType.WarSun,
		calc.UnitType.Dreadnought,
		calc.UnitType.Cruiser,
		calc.UnitType.Destroyer,
		calc.UnitType.Carrier,
		calc.UnitType.Fighter];

	//expanded fleets
	//fleets -> probabilities of survival for each ordered fleet subset
	this.computeProbabilities = function (attackerFull, defenderFull, battleType, options) {
		options = options || { attacker: {}, defender: {} };

		var attacker = _.filter(attackerFull, function (unit) {
			return calc.belongsToBattle(unit, battleType, options.attacker.gravitonNegator);
		});
		var defender = _.filter(defenderFull, function (unit) {
			return calc.belongsToBattle(unit, battleType);
		});

		//use upper left as an origin
		//initially all the probability mass is concentrated at both fleets being unharmed
		var distr = matrix.create(attacker.length + 1, defender.length + 1, 0);
		distr[attacker.length][defender.length] = 1;
		var problemArray = [{ distribution: distr, attacker: attacker, defender: defender, options: options }];

		//apply all pre-battle actions
		for (var i = 0; i < prebattle.actions.length; i++) {
			var action = prebattle.actions[i];
			if (action.appliesTo === battleType)
				problemArray = action.execute(problemArray, attackerFull, defenderFull);
		}

		for (var i = 0; i < problemArray.length; ++i)
			propagateProbability(problemArray[i]);

		var finalDistribution = Object.create(distributionBase);
		finalDistribution.min = function () {
			return -attacker.length
		};
		finalDistribution.max = function () {
			return defender.length
		};
		var finalAttacker = attacker.map(function (unit) {
			return [unit.shortType()];
		});
		var finalDefender = defender.map(function (unit) {
			return [unit.shortType()];
		});
		problemArray.forEach(function (problem) {
			finalDistribution[0] = finalDistribution.at(0) + problem.distribution[0][0];
			if (problem.distribution.deadlock) {
				finalDistribution.deadlock = (finalDistribution.deadlock || 0) + problem.distribution.deadlock;
			}

			for (var a = 1; a < problem.distribution.rows; a++) {
				finalDistribution[-a] = finalDistribution.at(-a) + problem.distribution[a][0];
				if (finalAttacker[a - 1].indexOf(problem.attacker[a - 1].shortType()) < 0)
					finalAttacker[a - 1].push(problem.attacker[a - 1].shortType());
			}

			for (var d = 1; d < problem.distribution.columns; d++) {
				finalDistribution[d] = finalDistribution.at(d) + problem.distribution[0][d];
				if (finalDefender[d - 1].indexOf(problem.defender[d - 1].shortType()) < 0)
					finalDefender[d - 1].push(problem.defender[d - 1].shortType());
			}
		});

		return {
			distribution: finalDistribution,
			attacker: finalAttacker.map(function (set) {
				return set.reduce(function (prev, item) {
					return prev + item;
				});
			}),
			defender: finalDefender.map(function (set) {
				return set.reduce(function (prev, item) {
					return prev + item;
				});
			})
		};
	};

	//apply transition vectors to the distribution matrix just once
	var applyTransitions = function (distr, attackerTransitions, defenderTransitions, attackerVulnerable, defenderVulnerable) {
		attackerVulnerable = attackerVulnerable || { from: 0 };
		defenderVulnerable = defenderVulnerable || { from: 0 };

		var result = matrix.create(distr.rows, distr.columns, 0);

		for (var a = 0; a < distr.rows; a++) {
			for (var d = 0; d < distr.columns; d++) {

				if (distr[a][d] === 0) continue;

				var maxAttackerDamage = Math.max(0, a - attackerVulnerable.from);
				var maxDefenderDamage = Math.max(0, d - defenderVulnerable.from);
				var transitionMatrix = createTransitionMatrix(attackerTransitions[a], defenderTransitions[d], maxDefenderDamage, maxAttackerDamage);

				for (var attackerInflicted = 0; attackerInflicted < attackerTransitions[a].length && attackerInflicted <= maxDefenderDamage; attackerInflicted++)
					for (var defenderInflicted = 0; defenderInflicted < defenderTransitions[d].length && defenderInflicted <= maxAttackerDamage; defenderInflicted++) {
						result[a - defenderInflicted][d - attackerInflicted] += transitionMatrix.at(attackerInflicted, defenderInflicted) * distr[a][d];
					}
			}
		}

		return result;
	};

	// do full probability mass redistribution according to transition vectors.
	var propagateProbability = function (problem) {
		var attackerBoost = 0;
		var defenderBoost = 0;

		attackerBoost += problem.options.attacker.moraleBoost1 ? 1 : 0;
		defenderBoost += problem.options.defender.moraleBoost1 ? 1 : 0;
		attackerBoost -= problem.options.defender.xxcha ? 1 : 0;
		defenderBoost -= problem.options.attacker.xxcha ? 1 : 0;

		if (attackerBoost !== 0 || defenderBoost !== 0) {
			//need to make one round of propagation with altered probabilities
			var attackerTransitions = computeFleetTransitions(problem.attacker, attackerBoost, false, problem.options.attacker.admiral);
			var defenderTransitions = computeFleetTransitions(problem.defender, defenderBoost, false, problem.options.defender.admiral);
			problem.distribution = applyTransitions(problem.distribution, attackerTransitions, defenderTransitions);
		}

		propagateProbabilityUpLeft(problem);

	};

	var propagateProbabilityUpLeft = function (problem) {
		var distr = problem.distribution;
		// evaluate probabilities of transitions for each fleet
		var attackerTransitions = computeFleetTransitions(problem.attacker, null, null, problem.options.attacker.admiral);
		var defenderTransitions = computeFleetTransitions(problem.defender, null, null, problem.options.defender.admiral);
		//do propagation
		for (var a = distr.rows - 1; 0 < a; a--) {
			for (var d = distr.columns - 1; 0 < d; d--) {

				var transitionsMatrix = createTransitionMatrix(attackerTransitions[a], defenderTransitions[d], d, a);

				var k;
				if (distr[a][d] === 0)
					continue;
				else {
					assert(transitionsMatrix.at(0, 0) !== 1, "Cannot move from specific point");
					k = distr[a][d] / (1 - transitionsMatrix.at(0, 0));
				}

				// transitions for everything except for attackerInflicted===0&&defenderInflicted===0
				var attackerInflicted = 0;
				for (var defenderInflicted = 1; defenderInflicted < defenderTransitions[d].length && defenderInflicted <= a; defenderInflicted++) {
					distr[a - defenderInflicted][d - attackerInflicted] += transitionsMatrix.at(attackerInflicted, defenderInflicted) * k;
				}
				for (var attackerInflicted = 1; attackerInflicted < attackerTransitions[a].length && attackerInflicted <= d; attackerInflicted++)
					for (var defenderInflicted = 0; defenderInflicted < defenderTransitions[d].length && defenderInflicted <= a; defenderInflicted++) {
						distr[a - defenderInflicted][d - attackerInflicted] += transitionsMatrix.at(attackerInflicted, defenderInflicted) * k;
					}
				// all probability mass was moved from distr[a][d]
				distr[a][d] = 0;
			}
		}
	};

	//compute transition arrays for all left-subsets of the fleet
	//result[4] == [X,Y,Z,..] means that probabilities of the first 4 units in the fleet inflicting 0, 1, 2 etc damage points are X, Y, Z, etc respectively
	var computeFleetTransitions = function (fleet, boost, reroll, admiral) {
		var processedAdmiral = false;
		boost = boost || 0;
		var result = [[1]];
		for (var a = 1; a <= fleet.length; ++a) {
			var unit = fleet[a - 1];
			var isAdmiral = !processedAdmiral && admiral === unit.type;
			processedAdmiral |= isAdmiral;
			if (isAdmiral)
				unit = unit.applyModifier(0, unit.diceRolled + 1);
			var thisUnitTransitions = computeUnitTransitions(unit, boost, reroll);
			result[a] = slideMultiply(thisUnitTransitions, result[a - 1]);
		}
		return result;
	};

	//compute probabilities of this unit inflicting 0, 1, etc. damage points. `reroll` is used for PDS which can reroll misses given Graviton Laser technology
	var computeUnitTransitions = function (unit, boost, reroll) {
		boost = boost || 0;
		var singleRoll = [];
		singleRoll[0] = Math.max(Math.min((unit.dmgDice - 1 - boost) / calc.dieSides(), 1), 0);
		if (reroll)
			singleRoll[0] = singleRoll[0] * singleRoll[0];
		singleRoll[1] = 1 - singleRoll[0];
		var result = singleRoll;
		for (var i = 1; i < unit.diceRolled; i++)
			result = slideMultiply(result, singleRoll);

		return result;
	};

	//check for whether probability mass is mainly concentrated at either fleet being annihilated
	//distr is the fleet probability distribution matrix
	var distrConverged = function (distr) {
		var annihilatedProb = 0;

		for (var a = 0; a < distr.rows; a++)
			annihilatedProb += distr[a][0];
		for (var d = 1; d < distr.columns; d++)
			annihilatedProb += distr[0][d];

		if (useAssertions) {
			var bothSurvivalProb = 0;
			for (var a = 1; a < distr.rows; a++) {
				for (var d = 1; d < distr.columns; d++) {
					bothSurvivalProb += distr[a][d];
				}
			}

			assert(annihilatedProb + bothSurvivalProb > 0.95, "Where did the probability mass vanish?");
		}

		return annihilatedProb > 0.98;
	};

	//create matrix-like object providing probabilities of inflicted damage
	// result.at(1,2) == X means that probability of the first fleet inflicting 1 dmg while the second inflicts 2 is X
	// matrix will conflate probabilities of damages exceeding maxI1 and maxI2
	var createTransitionMatrix = function (transitions1, transitions2, maxI1, maxI2) {
		return orthogonalMultiply(transitions1, transitions2, maxI1, maxI2);
	};

	var orthogonalMultiply = function (transitions1, transitions2, maxI1, maxI2) {
		return {
			rows: maxI1,
			columns: maxI2,
			at: function (i1, i2) {
				assert(!useAssertions || i1 <= maxI1 && i2 <= maxI2, "index outside of range");
				var inflicted1 = transitions1[i1];
				if (i1 === maxI1)
					while (++i1 < transitions1.length)
						inflicted1 += transitions1[i1];
				var inflicted2 = transitions2[i2];
				if (i2 === maxI2)
					while (++i2 < transitions2.length)
						inflicted2 += transitions2[i2];
				return inflicted1 * inflicted2;
			}
		};
	};

	//multiply two transition arrays to produce probabilities of total damage point being 0, 1, 2 etc.
	var slideMultiply = function (transitions1, transitions2) {
		var result = [];
		for (var i = 0; i < transitions1.length + transitions2.length - 1; ++i)
			result[i] = 0;
		for (var i1 = 0; i1 < transitions1.length; ++i1)
			for (var i2 = 0; i2 < transitions2.length; ++i2)
				result[i1 + i2] += transitions1[i1] * transitions2[i2];

		return result;
	};

	//array of all available pre-battle actions
	// each action modifies distribution of fleet state probabilities
	// anti-fighter barrage may split distribution into several distributions
	// it's a shame that the order of pre-battle actions is not specified from UI, but I think it's an unneeded complication to add such feature
	var prebattle = (function () {

		return {
			actions: [
				{
					name: "pds -> ships",
					appliesTo: calc.BattleType.Space,
					execute: function (problemArray, attackerFull, defenderFull) {
						return _.map(problemArray, function (problem) {
							var attackerTransitions = scaleTransitions(_.filter(attackerFull, unitIs(calc.UnitType.PDS)), problem.attacker.length + 1, problem.options.attacker.gravitonLaser);
							var defenderTransitions = scaleTransitions(_.filter(defenderFull, unitIs(calc.UnitType.PDS)), problem.defender.length + 1, problem.options.defender.gravitonLaser);
							return {
								distribution: applyTransitions(problem.distribution, attackerTransitions, defenderTransitions),
								attacker: problem.attacker,
								defender: problem.defender,
								options: problem.options
							};
						});
					}
				},
				{
					name: "mentak racial",
					appliesTo: calc.BattleType.Space,
					execute: function (problemArray) {
						return _.map(problemArray, function (problem) {
							if (!(problem.options.attacker.mentak || problem.options.defender.mentak))
								return problem;

							var createMentakTransitions = function (fleet) {
								var firedShips = 0;
								return computeSelectedUnitsTransitions(fleet, function (ship) {
									if (2 <= firedShips) {
										return false;
									} else if (ship.type === calc.UnitType.Cruiser || ship.type === calc.UnitType.Destroyer) {
										firedShips++;
										return true;
									}
									return false;
								});
							};
							var attackerTransitions;
							var defenderTransitions;
							if (problem.options.attacker.mentak)
								attackerTransitions = createMentakTransitions(problem.attacker);
							else
								attackerTransitions = scaleTransitions([], problem.attacker.length + 1);
							if (problem.options.defender.mentak)
								defenderTransitions = createMentakTransitions(problem.defender);
							else
								defenderTransitions = scaleTransitions([], problem.defender.length + 1);
							return {
								distribution: applyTransitions(problem.distribution, attackerTransitions, defenderTransitions),
								attacker: problem.attacker,
								defender: problem.defender,
								options: problem.options
							};
						});
					}
				},
				{
					name: "assault cannon",
					appliesTo: calc.BattleType.Space,
					execute: function (problemArray) {
						return _.map(problemArray, function (problem) {
							if (!(problem.options.attacker.assaultCannon || problem.options.defender.assaultCannon))
								return problem;

							var attackerTransitions;
							var defenderTransitions;
							if (problem.options.attacker.assaultCannon)
								attackerTransitions = computeSelectedUnitsTransitions(problem.attacker, unitIs(calc.UnitType.Dreadnought));
							else
								attackerTransitions = scaleTransitions([], problem.attacker.length + 1);
							if (problem.options.defender.assaultCannon)
								defenderTransitions = computeSelectedUnitsTransitions(problem.defender, unitIs(calc.UnitType.Dreadnought));
							else
								defenderTransitions = scaleTransitions([], problem.defender.length + 1);
							return {
								distribution: applyTransitions(problem.distribution, attackerTransitions, defenderTransitions),
								attacker: problem.attacker,
								defender: problem.defender,
								options: problem.options
							};
						});
					}
				},
				{
					name: "anti-fighter barrage",
					appliesTo: calc.BattleType.Space,
					execute: function (problemArray) {
						//Barrage prevents main optimisation trick from being used, namely strict ordering of units deaths.
						//With barrage Fighters die earlier than Warsun and Dreadnoughts are damaged.
						//So what we get is a huge collection of separate problems to solve.

						var result = [];
						problemArray.forEach(function (problem) {

							var attackerTransitions = computeBarrageDestroyersTransitions(problem.attacker, problem.options.attacker.defenceTurret);
							var defenderTransitions = computeBarrageDestroyersTransitions(problem.defender, problem.options.defender.defenceTurret);

							var attackerVulnerable = getVulnerableUnitsRange(problem.attacker, unitIs(calc.UnitType.Fighter));
							var defenderVulnerable = getVulnerableUnitsRange(problem.defender, unitIs(calc.UnitType.Fighter));

							var subproblems = interSplit(problem, attackerVulnerable, defenderVulnerable, attackerTransitions, defenderTransitions);

							result.push.apply(result, subproblems);
						});

						return result;

						function computeBarrageDestroyersTransitions(fleet, defenceTurret) {
							var barrageFleet = fleet.map(function (unit) {
								if (unit.type === calc.UnitType.Destroyer) {
									return unit.toBarrageDestroyer(defenceTurret);
								} else {
									return unit;
								}
							});
							return computeSelectedUnitsTransitions(barrageFleet, unitIs(calc.UnitType.Destroyer));
						}
					}
				},
				{
					name: "pds -> ground forces",
					appliesTo: calc.BattleType.Ground,
					execute: function (problemArray, attackerFull, defenderFull) {

						var result = [];
						problemArray.forEach(function (problem) {

							var attackerTransitions = scaleTransitions([], problem.attacker.length + 1); // attacker does not fire
							var defenderTransitions = scaleTransitions(_.filter(defenderFull, unitIs(calc.UnitType.PDS)), problem.defender.length + 1, problem.options.defender.gravitonLaser);

							var attackerVulnerable = getVulnerableUnitsRange(problem.attacker, unitIs(calc.UnitType.Ground));
							var defenderVulnerable = { from: problem.defender.length, to: problem.defender.length };

							var subproblems = interSplit(problem, attackerVulnerable, defenderVulnerable, attackerTransitions, defenderTransitions);

							result.push.apply(result, subproblems);
						});

						return result;
					}
				},
				{
					name: "WarSun bombardment",
					appliesTo: calc.BattleType.Ground,
					execute: function (problemArray, attackerFull, defenderFull) {

						var result = [];
						problemArray.forEach(function (problem) {

							var attackerTransitions = scaleTransitions(_.filter(attackerFull, unitIs(calc.UnitType.WarSun)), problem.attacker.length + 1);
							var defenderTransitions = scaleTransitions([], problem.defender.length + 1);

							var attackerVulnerable = { from: problem.attacker.length, to: problem.attacker.length };
							var defenderVulnerable = getVulnerableUnitsRange(problem.defender, unitIs(calc.UnitType.Ground));

							var subproblems = interSplit(problem, attackerVulnerable, defenderVulnerable, attackerTransitions, defenderTransitions);

							result.push.apply(result, subproblems);
						});

						return result;
					}
				},
				{
					name: "Dreadnought bombardment",
					appliesTo: calc.BattleType.Ground,
					execute: function (problemArray, attackerFull, defenderFull) {

						var result = [];
						problemArray.forEach(function (problem) {

							var attackerTransitions;
							var defenderTransitions = scaleTransitions([], problem.defender.length + 1);

							var attackerVulnerable = { from: problem.attacker.length, to: problem.attacker.length };
							var defenderVulnerable;

							if (_.any(defenderFull, unitIs(calc.UnitType.PDS)) && !problem.options.attacker.gravitonNegator //dreadnoughts do not bombard over PDS. unless Graviton Negator
								|| !(_.any(attackerFull, unitIs(calc.UnitType.Ground)) || _.any(attackerFull, unitIs(calc.UnitType.Mech))) // and alse they don't bombard without invasion
							) {
								attackerTransitions = scaleTransitions([], problem.attacker.length + 1);
								defenderVulnerable = { from: problem.defender.length, to: problem.defender.length };
							} else {
								attackerTransitions = scaleTransitions(_.filter(attackerFull, unitIs(calc.UnitType.Dreadnought)), problem.attacker.length + 1);
								defenderVulnerable = getVulnerableUnitsRange(problem.defender, unitIs(calc.UnitType.Ground));
							}

							var subproblems = interSplit(problem, attackerVulnerable, defenderVulnerable, attackerTransitions, defenderTransitions);

							result.push.apply(result, subproblems);
						});

						return result;
					}
				}
			]
		};

		function unitIs(unitType) {
			return function (unit) {
				return unit.type === unitType;
			};
		};

		function scaleTransitions(fleet, repeat, reroll) {
			var fleetInflicted = computeFleetTransitions(fleet, 0, reroll).pop();
			var result = [];
			for (var a = 0; a < repeat; ++a)
				result.push(fleetInflicted);
			return result;
		};

		// Split problem into several subproblems in cases where main optimisation trick (strict ordering of units deaths) cannot be used.
		// For example with barrage Fighters die earlier than Warsun and Dreadnoughts are damaged.
		// Or during bombardment Ground Forces die before Mechanised Units are damaged.
		// So what we get is a huge collection of separate problems to solve.
		// Potentially up to F_a+F_d+F_a*F_d, where F_a and F_d are numbers of attacking and defending Fighters, Ground Forces or
		// whichever units that could die before the last one in order.
		// This method is conceptually similar to applyTransitions in that it applies transitions once. And different
		// in that this application could lead to problem splitting into several subproblems.
		// parameter: *Vulnerable {from, to}: range of units that are vulnerable to computed pre-battle action. In case of barrage
		//   from - index of first Fighter, to - index of first non-Fighter after Fighters. These indices are relative to problem.(attacker|defender)
		//   which means that for problem.distribution they are shifted by 1 to the left, as zeroth row and column correspond to no units, not zeroth unit
		// parameter: *Transitions: transitions inflicted by pre-battle-action-specific subset of units within whole range of units. In case of barrage - by destroyers.
		// returns: array of problems.
		function interSplit(problem, attackerVulnerable, defenderVulnerable, attackerTransitions, defenderTransitions) {
			var result = [];

			var dieableAttackers = attackerVulnerable.to - attackerVulnerable.from;
			var dieableDefenders = defenderVulnerable.to - defenderVulnerable.from;

			// maaaybe no intersplitting is needed at all?..
			if ((attackerTransitions[attackerTransitions.length - 1].length === 1 &&
				defenderTransitions[defenderTransitions.length - 1].length === 1) ||
				(dieableAttackers === 0 && dieableDefenders === 0)) {
				// so lucky
				result.push(problem);
				return result;
			}

			// ..fat chance
			// do simple round of transitions for the part of distribution matrix that doesn't require splitting
			var nonSplittableSubmatrix = extractMinor(problem.distribution, attackerVulnerable.to + 1, defenderVulnerable.to + 1);
			nonSplittableSubmatrix = applyTransitions(nonSplittableSubmatrix, attackerTransitions, defenderTransitions, attackerVulnerable, defenderVulnerable);
			result.push({
				distribution: nonSplittableSubmatrix,
				attacker: problem.attacker.slice(0, attackerVulnerable.to),
				defender: problem.defender.slice(0, defenderVulnerable.to),
				options: problem.options
			});

			var memoize = { attacker: {}, defender: {} }; // forget about this variable

			// Check if splitting makes sense for attacker. If all units at the end of the list are vulnerable then
			// no splitting is needed
			if (attackerVulnerable.to + 1 < problem.distribution.rows) {
				// try out all possible counts of vulnerable attacker units deaths
				for (var vulA = attackerVulnerable.from; vulA <= attackerVulnerable.to; vulA++) { // "vul" stands for "vulnerable"
					var attackersDied = attackerVulnerable.to - vulA;
					var splitDistribution = matrix.create(problem.distribution.rows - attackersDied, defenderVulnerable.to + 1, 0);
					var subproblemProbabilityMass = 0;
					for (var d = 0; d <= defenderVulnerable.to; d++) {
						if (attackersDied < defenderTransitions[d].length) {
							for (var a = attackerVulnerable.to + 1; a < problem.distribution.rows; a++) {
								var maxDefenderDamage = Math.max(0, d - defenderVulnerable.from);
								var transitionMatrix = createTransitionMatrix(attackerTransitions[a], defenderTransitions[d], maxDefenderDamage, dieableAttackers);
								for (var attackerInflicted = 0; attackerInflicted < attackerTransitions[a].length && attackerInflicted <= maxDefenderDamage; attackerInflicted++) {
									subproblemProbabilityMass += (
										splitDistribution[a - attackersDied][d - attackerInflicted] += problem.distribution[a][d] * transitionMatrix.at(attackerInflicted, attackersDied)
									);
								}
							}
						}
					}
					if (subproblemProbabilityMass !== 0) {
						result.push({
							distribution: splitDistribution,
							attacker: splitAttacker(attackersDied),
							defender: problem.defender,
							options: problem.options,
						});
					}
				}
			}
			// Check if splitting makes sense for defender.
			if (defenderVulnerable.to + 1 < problem.distribution.columns) {
				// try out all possible counts of vulnerable defender units deaths
				for (var vulD = defenderVulnerable.from; vulD <= defenderVulnerable.to; vulD++) { // "vul" stands for "vulnerable"
					var defendersDied = defenderVulnerable.to - vulD;
					var splitDistribution = matrix.create(attackerVulnerable.to + 1, problem.distribution.columns - defendersDied, 0);
					var subproblemProbabilityMass = 0;
					for (var a = 0; a <= attackerVulnerable.to; a++) {
						if (defendersDied < attackerTransitions[a].length) {
							for (var d = defenderVulnerable.to + 1; d < problem.distribution.columns; d++) {
								var maxAttackerDamage = Math.max(0, a - attackerVulnerable.from);
								var transitionMatrix = createTransitionMatrix(attackerTransitions[a], defenderTransitions[d], dieableDefenders, maxAttackerDamage);
								for (var defenderInflicted = 0; defenderInflicted < defenderTransitions[d].length && defenderInflicted <= maxAttackerDamage; defenderInflicted++) {
									subproblemProbabilityMass += (
										splitDistribution[a - defenderInflicted][d - defendersDied] += problem.distribution[a][d] * transitionMatrix.at(defendersDied, defenderInflicted)
									);
								}
							}
						}
					}
					if (subproblemProbabilityMass !== 0) {
						result.push({
							distribution: splitDistribution,
							attacker: problem.attacker,
							defender: splitDefender(defendersDied),
							options: problem.options,
						});
					}
				}
			}

			// And now shit just gets squared. Problem splitting along both attacker and defender dimensions
			// .. but first, maybe all of this might be avoided?
			if (attackerVulnerable.to + 1 === problem.distribution.rows || defenderVulnerable.to + 1 === problem.distribution.columns)
				return result;

			// ..no, seems like we are doomed
			for (var vulA = attackerVulnerable.from; vulA <= attackerVulnerable.to; vulA++) {
				for (var vulD = defenderVulnerable.from; vulD <= defenderVulnerable.to; vulD++) {

					var attackersDied = attackerVulnerable.to - vulA;
					var defendersDied = defenderVulnerable.to - vulD;
					var splitDistribution = matrix.create(problem.distribution.rows - attackersDied, problem.distribution.columns - defendersDied, 0);
					var subproblemProbabilityMass = 0;
					for (var a = attackerVulnerable.to + 1; a < problem.distribution.rows; a++) {
						for (var d = defenderVulnerable.to + 1; d < problem.distribution.columns; d++) {
							if (attackersDied < defenderTransitions[d].length && defendersDied < attackerTransitions[a].length) {
								var transitionMatrix = createTransitionMatrix(attackerTransitions[a], defenderTransitions[d], dieableDefenders, dieableAttackers);
								subproblemProbabilityMass += (
									splitDistribution[a - attackersDied][d - defendersDied] += problem.distribution[a][d] * transitionMatrix.at(defendersDied, attackersDied)
								);
							}
						}
					}
					if (subproblemProbabilityMass !== 0) {
						result.push({
							distribution: splitDistribution,
							attacker: splitAttacker(attackersDied),
							defender: splitDefender(defendersDied),
							options: problem.options,
						});
					}
				}
			}

			return result;

			function splitAttacker(attackersDied) {
				if (!memoize.attacker[attackersDied]) {
					var a = attackerVulnerable.to - attackersDied;
					var newAttacker = problem.attacker.slice();
					newAttacker.splice(a, attackersDied);
					memoize.attacker[attackersDied] = newAttacker;
				}
				return memoize.attacker[attackersDied];
			}

			function splitDefender(defendersDied) {
				if (!memoize.defender[defendersDied]) {
					var d = defenderVulnerable.to - defendersDied;
					var newDefender = problem.defender.slice();
					newDefender.splice(d, defendersDied);
					memoize.defender[defendersDied] = newDefender;
				}
				return memoize.defender[defendersDied];
			}

			function extractMinor(distr, rows, columns) {
				var result = matrix.create(rows, columns, 0);
				for (var i = 0; i < rows; i++) {
					for (var j = 0; j < columns; j++) {
						result[i][j] = distr[i][j];
					}
				}
				return result;
			}
		}

		function getVulnerableUnitsRange(fleet, predicate) {
			var from = undefined;
			for (var i = 0; i < fleet.length; i++) {
				if (from === undefined) {
					if (predicate(fleet[i])) {
						from = i;
					}
				} else {
					if (!predicate(fleet[i])) {
						break;
					}
				}
			}
			if (from === undefined) {
				from = i;
			}
			return { from: from, to: i };
		}

		function computeSelectedUnitsTransitions(fleet, predicate) {
			var result = [[1]];
			var currentTransitions = [[1]];
			for (var i = 0; i < fleet.length; i++) {
				var ship = fleet[i];
				if (predicate(ship)) {
					var transitions = computeUnitTransitions(ship);
					currentTransitions = slideMultiply(currentTransitions, transitions);
				}
				result.push(currentTransitions);
			}
			return result;
		};

	})();
};


//----- EXPORTS ----
if (typeof exports === "undefined")
	exports = {};

exports.calculator = new Calculator();
exports.distributionBase = distributionBase;
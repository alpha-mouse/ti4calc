if (typeof require === 'function' && typeof _ === 'undefined')
	var _ = require('lodash');
if (typeof globals === 'undefined')
	globals = {};
if (typeof require === 'function')
	var createMatrix = require('./structs').createMatrix;
else
	var createMatrix = globals.createMatrix;

globals.calculator = (function () {

	var prebattleActions = initPrebattleActions();

	return {
		computeProbabilities: computeProbabilities,
	};

	/** Compute survival probabilities of each subset of attacker and defender */
	function computeProbabilities(attackerFull, defenderFull, battleType, options) {

		options = options || { attacker: {}, defender: {} };

		var attacker = _.filter(attackerFull, globals.unitBattleFilter(battleType));
		var defender = _.filter(defenderFull, globals.unitBattleFilter(battleType));

		//use upper left as an origin
		//initially all the probability mass is concentrated at both fleets being unharmed
		var distribution = globals.createMatrix(attacker.length + 1, defender.length + 1, 0);
		distribution[attacker.length][defender.length] = 1;
		var problemArray = [{ distribution: distribution, attacker: attacker, defender: defender, options: options }];

		//apply all pre-battle actions, like PDS fire and Barrage
		prebattleActions.forEach(function (action) {
			if (action.appliesTo === battleType)
				problemArray = action.execute(problemArray, attackerFull, defenderFull, options);
		});

		// the most interesting part - actually compute outcome probabilities
		for (var i = 0; i < problemArray.length; ++i)
			solveProblem(problemArray[i]);

		// format output
		var finalDistribution = new globals.DistributionBase(-attacker.length, defender.length);
		var finalAttacker = attacker.map(function (unit) {
			return [unit.shortType];
		});
		var finalDefender = defender.map(function (unit) {
			return [unit.shortType];
		});
		problemArray.forEach(function (problem) {
			finalDistribution[0] = finalDistribution.at(0) + problem.distribution[0][0];

			for (var a = 1; a < problem.distribution.rows; a++) {
				finalDistribution[-a] = finalDistribution.at(-a) + problem.distribution[a][0];
				if (finalAttacker[a - 1].indexOf(problem.attacker[a - 1].shortType) < 0)
					finalAttacker[a - 1].push(problem.attacker[a - 1].shortType);
			}

			for (var d = 1; d < problem.distribution.columns; d++) {
				finalDistribution[d] = finalDistribution.at(d) + problem.distribution[0][d];
				if (finalDefender[d - 1].indexOf(problem.defender[d - 1].shortType) < 0)
					finalDefender[d - 1].push(problem.defender[d - 1].shortType);
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
			}),
		};
	}

	/** Do full probability mass redistribution according to transition vectors */
	function solveProblem(problem) {
		/*var attackerBoost = 0;
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
		 }*/

		propagateProbabilityUpLeft(problem);
	}

	function propagateProbabilityUpLeft(problem) {
		var distr = problem.distribution;
		// evaluate probabilities of transitions for each fleet
		var attackerTransitions = computeFleetTransitions(problem.attacker, globals.ThrowTypes.Battle);
		var defenderTransitions = computeFleetTransitions(problem.defender, globals.ThrowTypes.Battle);
		//do propagation
		for (var a = distr.rows - 1; 0 < a; a--) {
			for (var d = distr.columns - 1; 0 < d; d--) {

				var transitionsMatrix = orthogonalMultiply(attackerTransitions[a], defenderTransitions[d], d, a);

				var k;
				if (distr[a][d] === 0)
					continue;
				else {
					k = distr[a][d] / (1 - transitionsMatrix.at(0, 0));
				}

				// transitions for everything except for attackerInflicted===0&&defenderInflicted===0
				var attackerInflicted = 0;
				for (var defenderInflicted = 1; defenderInflicted < defenderTransitions[d].length && defenderInflicted <= a; defenderInflicted++) {
					distr[a - defenderInflicted][d - attackerInflicted] += transitionsMatrix.at(attackerInflicted, defenderInflicted) * k;
				}
				for (var attackerInflicted = 1; attackerInflicted < attackerTransitions[a].length && attackerInflicted <= d; attackerInflicted++) {
					for (var defenderInflicted = 0; defenderInflicted < defenderTransitions[d].length && defenderInflicted <= a; defenderInflicted++) {
						distr[a - defenderInflicted][d - attackerInflicted] += transitionsMatrix.at(attackerInflicted, defenderInflicted) * k;
					}
				}
				// all probability mass was moved from distr[a][d]
				distr[a][d] = 0;
			}
		}
	}

	/** Compute transition arrays for all left-subsets of the fleet
	 * result[4] === [X,Y,Z,..] means that probabilities of the first 4 units in the fleet
	 * inflicting 0, 1, 2 etc damage points are X, Y, Z, etc respectively
	 * @param throwType globals.ThrowTypes */
	function computeFleetTransitions(fleet, throwType, modifier, reroll) {
		modifier = modifier || 0;
		var result = [[1]];
		for (var a = 1; a <= fleet.length; ++a) {
			var unit = fleet[a - 1];
			var thisUnitTransitions = computeUnitTransitions(unit[throwType + 'Value'], unit[throwType + 'Dice'], modifier, reroll);
			result[a] = slideMultiply(thisUnitTransitions, result[a - 1]);
		}
		return result;
	}

	/** Compute probabilities of the unit inflicting 0, 1, etc. hits.
	 * @param reroll is used for units that can reroll failed throws */
	function computeUnitTransitions(battleValue, diceCount, modifier, reroll) {
		if (diceCount === 0) return [1];
		modifier = modifier || 0;
		var singleRoll = [];
		singleRoll[0] = Math.max(Math.min((battleValue - 1 - modifier) / globals.dieSides, 1), 0);
		if (reroll)
			singleRoll[0] = singleRoll[0] * singleRoll[0];
		singleRoll[1] = 1 - singleRoll[0];
		var result = singleRoll;
		for (var i = 1; i < diceCount; i++)
			result = slideMultiply(result, singleRoll);

		return result;
	}

	/** Multiply two transition arrays to produce probabilities of total hits being 0, 1, 2 etc. */
	function slideMultiply(transitions1, transitions2) {
		var result = [];
		for (var i = 0; i < transitions1.length + transitions2.length - 1; ++i)
			result[i] = 0;
		for (var i1 = 0; i1 < transitions1.length; ++i1) {
			for (var i2 = 0; i2 < transitions2.length; ++i2)
				result[i1 + i2] += transitions1[i1] * transitions2[i2];
		}
		return result;
	}

	/** Create matrix-like object providing probabilities of inflicted damage
	 * result.at(1,2) == X means that probability of the first fleet inflicting 1 dmg while the second inflicts 2 is X
	 * matrix will conflate probabilities of damages exceeding maxI1 and maxI2 */
	function orthogonalMultiply(transitions1, transitions2, maxI1, maxI2) {
		return {
			rows: maxI1,
			columns: maxI2,
			at: function (i1, i2) {
				var inflicted1 = transitions1[i1];
				if (i1 === maxI1)
					while (++i1 < transitions1.length)
						inflicted1 += transitions1[i1];
				var inflicted2 = transitions2[i2];
				if (i2 === maxI2)
					while (++i2 < transitions2.length)
						inflicted2 += transitions2[i2];
				return inflicted1 * inflicted2;
			},
		};
	}

	function initPrebattleActions() {
		return [
			{
				name: 'Space Cannon -> ships',
				appliesTo: globals.BattleType.Space,
				execute: function (problemArray, attackerFull, defenderFull) {
					return problemArray;
					return _.map(problemArray, function (problem) {
						var attackerTransitions = scaleTransitions(_.filter(attackerFull, unitIs(calc.UnitType.PDS)), problem.attacker.length + 1, problem.options.attacker.gravitonLaser);
						var defenderTransitions = scaleTransitions(_.filter(defenderFull, unitIs(calc.UnitType.PDS)), problem.defender.length + 1, problem.options.defender.gravitonLaser);
						return {
							distribution: applyTransitions(problem.distribution, attackerTransitions, defenderTransitions),
							attacker: problem.attacker,
							defender: problem.defender,
							options: problem.options,
						};
					});
				},
			},
			{
				name: 'Mentak racial',
				appliesTo: globals.BattleType.Space,
				execute: function (problemArray) {
					return problemArray;
					//todo Mentak racial
				},
			},
			{
				name: 'Assault Cannon',
				appliesTo: globals.BattleType.Space,
				execute: function (problemArray) {
					return problemArray;
					//todo assault cannon
				},
			},
			{
				name: 'Anti-Fighter Barrage',
				appliesTo: globals.BattleType.Space,
				execute: function (problemArray) {
					return problemArray;
					//todo barrage

					//Barrage prevents main optimisation trick from being used, namely strict ordering of units deaths.
					//With barrage Fighters die earlier than Warsun and Dreadnoughts are damaged.
					//So what we get is a huge collection of separate problems to solve.
				},
			},
			{
				name: 'Space Cannon -> Infantry',
				appliesTo: globals.BattleType.Ground,
				execute: function (problemArray, attackerFull, defenderFull) {

					return problemArray;

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
				},
			},
			{
				name: 'Bombardment',
				appliesTo: globals.BattleType.Ground,
				execute: function (problemArray, attackerFull, defenderFull) {
					return problemArray;
					//todo bombardment
				},
			},
		];
	}

})();

function xxx() {
	var calc = this;

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

				for (var attackerInflicted = 0; attackerInflicted < attackerTransitions[a].length && attackerInflicted <= maxDefenderDamage; attackerInflicted++) {
					for (var defenderInflicted = 0; defenderInflicted < defenderTransitions[d].length && defenderInflicted <= maxAttackerDamage; defenderInflicted++) {
						result[a - defenderInflicted][d - attackerInflicted] += transitionMatrix.at(attackerInflicted, defenderInflicted) * distr[a][d];
					}
				}
			}
		}

		return result;
	};

};

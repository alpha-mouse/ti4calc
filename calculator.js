(function (root) {

	var structs, game;
	if (typeof require === 'function') {
		structs = require('./structs');
		game = require('./game-elements');
	} else {
		structs = window;
		game = window;
	}

	root.calculator = (function () {

		var prebattleActions = initPrebattleActions();

		return {
			computeProbabilities: computeProbabilities,
		};

		/** Compute survival probabilities of each subset of attacker and defender */
		function computeProbabilities(attackerFull, defenderFull, battleType, options) {

			options = options || { attacker: {}, defender: {} };

			var attacker = attackerFull.filter(game.unitBattleFilter(battleType));
			var defender = defenderFull.filter(game.unitBattleFilter(battleType));

			//use upper left as an origin
			//initially all the probability mass is concentrated at both fleets being unharmed
			var distribution = structs.createMatrix(attacker.length + 1, defender.length + 1, 0);
			distribution[attacker.length][defender.length] = 1;
			var problemArray = [new structs.Problem(distribution, attacker, defender, options)];

			//apply all pre-battle actions, like PDS fire and Barrage
			prebattleActions.forEach(function (action) {
				if (action.appliesTo === battleType)
					problemArray = action.execute(problemArray, attackerFull, defenderFull, options);
			});

			// the most interesting part - actually compute outcome probabilities
			for (var i = 0; i < problemArray.length; ++i)
				solveProblem(problemArray[i]);

			// format output
			var finalDistribution = new structs.DistributionBase(-attacker.length, defender.length);
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
			var attackerTransitions = computeFleetTransitions(problem.attacker, game.ThrowTypes.Battle);
			var defenderTransitions = computeFleetTransitions(problem.defender, game.ThrowTypes.Battle);
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
		 * @param throwType game.ThrowTypes */
		function computeFleetTransitions(fleet, throwType, modifier, reroll) {
			modifier = modifier || 0;
			var result = [[1]];
			for (var a = 1; a <= fleet.length; ++a) {
				var unit = fleet[a - 1];
				var thisUnitTransitions = computeUnitTransitions(unit, throwType, modifier, reroll);
				result[a] = slideMultiply(thisUnitTransitions, result[a - 1]);
			}
			return result;
		}

		/** like computeFleetTransitions, but not all units are allowed to throw dice */
		function computeSelectedUnitsTransitions(fleet, throwType, predicate) {
			var result = [[1]];
			var currentTransitions = [[1]];
			for (var i = 0; i < fleet.length; i++) {
				var unit = fleet[i];
				if (predicate(unit)) {
					var transitions = computeUnitTransitions(unit, throwType);
					currentTransitions = slideMultiply(currentTransitions, transitions);
				}
				result.push(currentTransitions);
			}
			return result;
		}

		/** Compute probabilities of the unit inflicting 0, 1, etc. hits.
		 * @param reroll is used for units that can reroll failed throws */
		function computeUnitTransitions(unit, throwType, modifier, reroll) {
			var battleValue = unit[throwType + 'Value'];
			var diceCount = unit[throwType + 'Dice'];
			if (diceCount === 0) return [1];
			modifier = modifier || 0;
			var singleRoll = [];
			singleRoll[0] = Math.max(Math.min((battleValue - 1 - modifier) / game.dieSides, 1), 0);
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

		/** Apply transition vectors to the distribution matrix just once
		 * attackerVulnerableFrom and defenderVulnerableFrom could be used*/
		function applyTransitions(distribution, attackerTransitions, defenderTransitions, attackerVulnerableFrom, defenderVulnerableFrom) {
			attackerVulnerableFrom = attackerVulnerableFrom || 0;
			defenderVulnerableFrom = defenderVulnerableFrom || 0;

			for (var a = 0; a < distribution.rows; a++) {
				for (var d = 0; d < distribution.columns; d++) {

					if (distribution[a][d] === 0) continue;

					var maxAttackerDamage = Math.max(0, a - attackerVulnerableFrom);
					var maxDefenderDamage = Math.max(0, d - defenderVulnerableFrom);
					var transitionMatrix = orthogonalMultiply(attackerTransitions[a], defenderTransitions[d], maxDefenderDamage, maxAttackerDamage);

					for (var attackerInflicted = 0; attackerInflicted < attackerTransitions[a].length && attackerInflicted <= maxDefenderDamage; attackerInflicted++) {
						for (var defenderInflicted = 0; defenderInflicted < defenderTransitions[d].length && defenderInflicted <= maxAttackerDamage; defenderInflicted++) {
							if (attackerInflicted === 0 && defenderInflicted === 0) continue;
							distribution[a - defenderInflicted][d - attackerInflicted] += transitionMatrix.at(attackerInflicted, defenderInflicted) * distribution[a][d];
						}
					}
					distribution[a][d] *= transitionMatrix.at(0, 0);
				}
			}
		}

		function initPrebattleActions() {
			return [
				{
					name: 'Space Cannon -> Ships',
					appliesTo: game.BattleType.Space,
					execute: function (problemArray, attackerFull, defenderFull, options) {
						problemArray.forEach(function (problem) {
							var attackerModifier = options.defender.antimassDeflectors ? -1 : 0;
							var attackerTransitions = scaleTransitions(attackerFull.filter(hasSpaceCannon), game.ThrowTypes.SpaceCannon, problem.attacker.length + 1, attackerModifier);
							var defenderModifier = options.attacker.antimassDeflectors ? -1 : 0;
							var defenderTransitions = scaleTransitions(defenderFull.filter(hasSpaceCannon), game.ThrowTypes.SpaceCannon, problem.defender.length + 1, defenderModifier);
							applyTransitions(problem.distribution, attackerTransitions, defenderTransitions);
						});
						return problemArray;

						function hasSpaceCannon(unit) {
							return unit.spaceCannonDice !== 0;
						}
					},
				},
				{
					name: 'Mentak racial',
					appliesTo: game.BattleType.Space,
					execute: function (problemArray) {
						problemArray.forEach(function (problem) {
							if (problem.options.attacker.race !== 'Mentak' && problem.options.defender.race !== 'Mentak')
								return;

							function createMentakTransitions(fleet) {
								var firedShips = 0;
								return computeSelectedUnitsTransitions(fleet, game.ThrowTypes.Battle, function (ship) {
									if (2 <= firedShips) {
										return false;
									} else if (ship.type === game.UnitType.Cruiser || ship.type === game.UnitType.Destroyer) {
										firedShips++;
										return true;
									}
									return false;
								});
							}

							var attackerTransitions;
							var defenderTransitions;
							if (problem.options.attacker.race === 'Mentak')
								attackerTransitions = createMentakTransitions(problem.attacker);
							else
								attackerTransitions = scaleTransitions([], null, problem.attacker.length + 1);
							if (problem.options.defender.race === 'Mentak')
								defenderTransitions = createMentakTransitions(problem.defender);
							else
								defenderTransitions = scaleTransitions([], null, problem.defender.length + 1);
							applyTransitions(problem.distribution, attackerTransitions, defenderTransitions);
						});
						return problemArray;
					},
				},
				{
					name: 'Assault Cannon',
					appliesTo: game.BattleType.Space,
					execute: function (problemArray) {
						return problemArray;
						//todo assault cannon

						return problemArray.map(function (problem) {
							if (!problem.options.attacker.assaultCannon && !problem.options.defender.assaultCannon)
								return problem;

							function createSpaceCannonTransitions(fleet) {
								var result = [];
								var nonFightersFound = 0;
								for (var i = 0; i < fleet.length; i++) {
									if (fleet[i].type !== game.UnitType.Fighter)
										nonFightersFound++;
									if (nonFightersFound < 3)
										result.push([1]);
									else
										result.push([0, 1]);
								}
								return result;
							}


							var attackerTransitions;
							var defenderTransitions;
							if (problem.options.attacker.assaultCannon)
								attackerTransitions = createSpaceCannonTransitions(problem.attacker);
							else
								attackerTransitions = scaleTransitions([], null, problem.attacker.length + 1);
							if (problem.options.defender.assaultCannon)
								defenderTransitions = createSpaceCannonTransitions(problem.defender);
							else
								defenderTransitions = scaleTransitions([], null, problem.defender.length + 1);

							//CALL inter-split
							//applyTransitions(problem.distribution, attackerTransitions, defenderTransitions);
						});
					},
				},
				{
					name: 'Anti-Fighter Barrage',
					appliesTo: game.BattleType.Space,
					execute: function (problemArray) {

						//Barrage prevents main optimisation trick from being used, namely strict ordering of units deaths.
						//With barrage Fighters die earlier than Warsun and Dreadnoughts are damaged.
						//So what we get is a huge collection of separate problems to solve.

						var result = [];
						problemArray.forEach(function (problem) {

							var attackerTransitions = computeSelectedUnitsTransitions(problem.attacker, game.ThrowTypes.Barrage, hasBarrage);
							var defenderTransitions = computeSelectedUnitsTransitions(problem.defender, game.ThrowTypes.Barrage, hasBarrage);

							var attackerVulnerable = getVulnerableUnitsRange(problem.attacker, unitIs(game.UnitType.Fighter));
							var defenderVulnerable = getVulnerableUnitsRange(problem.defender, unitIs(game.UnitType.Fighter));

							var subproblems = interSplit(problem, attackerVulnerable, defenderVulnerable, attackerTransitions, defenderTransitions);

							result.push.apply(result, subproblems);
						});

						return result;

						function hasBarrage(unit) {
							return unit.barrageDice !== 0;
						}
					},
				},
				{
					name: 'Bombardment',
					appliesTo: game.BattleType.Ground,
					execute: function (problemArray, attackerFull, defenderFull) {
						problemArray.forEach(function (problem) {
							var bombardmentPossible = !defenderFull.some(unitIs(game.UnitType.PDS)) // either there are no defending PDS
								|| attackerFull.some(unitIs(game.UnitType.WarSun)); // or there are but attacking WarSuns negate their Planetary Shield
							if (!bombardmentPossible) return;

							var attackerTransitions = scaleTransitions(attackerFull.filter(hasBombardment), game.ThrowTypes.Bombardment, problem.attacker.length + 1);
							var defenderTransitions = scaleTransitions([], null, problem.defender.length + 1);
							applyTransitions(problem.distribution, attackerTransitions, defenderTransitions);
						});
						return problemArray;

						function hasBombardment(unit) {
							return unit.bombardmentDice !== 0;
						}
					},
				},
				{
					name: 'Space Cannon -> Ground Forces',
					appliesTo: game.BattleType.Ground,
					execute: function (problemArray, attackerFull, defenderFull, options) {
						problemArray.forEach(function (problem) {
							var attackerTransitions = scaleTransitions([], null, problem.attacker.length + 1); // attacker does not fire
							var defenderModifier = options.attacker.antimassDeflectors ? -1 : 0;
							var defenderTransitions = scaleTransitions(defenderFull.filter(unitIs(game.UnitType.PDS)), game.ThrowTypes.SpaceCannon, problem.defender.length + 1, defenderModifier);
							applyTransitions(problem.distribution, attackerTransitions, defenderTransitions);
						});
						return problemArray;
					},
				},
			];

			function scaleTransitions(fleet, throwType, repeat, modifier, reroll) {
				var fleetInflicted = computeFleetTransitions(fleet, throwType, modifier, reroll).pop();
				var result = new Array(repeat);
				result.fill(fleetInflicted);
				return result;
			}

			function unitIs(unitType) {
				return function (unit) {
					return unit.type === unitType;
				};
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

			/** Split problem into several subproblems in cases where main optimisation trick (strict ordering of units deaths) cannot be used.
			 * For example with barrage Fighters die earlier than Warsun and Dreadnoughts are damaged.
			 * Or during bombardment Ground Forces die before Mechanised Units are damaged.
			 * So what we get is a huge collection of separate problems to solve.
			 * Potentially up to F_a+F_d+F_a*F_d, where F_a and F_d are numbers of attacking and defending Fighters, Ground Forces or
			 * whichever units that could die before the last one in order.
			 * This method is conceptually similar to applyTransitions in that it applies transitions once. And different
			 * in that this application could lead to problem splitting into several subproblems.
			 * parameter: *Vulnerable {from, to}: range of units that are vulnerable to computed pre-battle action. In case of barrage
			 *   from - index of first Fighter, to - index of first non-Fighter after Fighters. These indices are relative to problem.(attacker|defender)
			 *   which means that for problem.distribution they are shifted by 1 to the left, as zeroth row and column correspond to no units, not zeroth unit
			 * parameter: *Transitions: transitions inflicted by pre-battle-action-specific subset of units within whole range of units. In case of barrage - by destroyers.
			 * returns: array of problems.
			 */
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
				applyTransitions(nonSplittableSubmatrix, attackerTransitions, defenderTransitions, attackerVulnerable.from, defenderVulnerable.from);
				result.push(new structs.Problem(nonSplittableSubmatrix, problem.attacker.slice(0, attackerVulnerable.to), problem.defender.slice(0, defenderVulnerable.to), problem.options));

				var memoize = { attacker: {}, defender: {} }; // forget about this variable

				// Check if splitting makes sense for the attacker.
				// If all units at the end of the list are vulnerable then no splitting is needed
				if (attackerVulnerable.to + 1 < problem.distribution.rows) {
					// try out all possible counts of vulnerable attacker units deaths
					for (var vulA = attackerVulnerable.from; vulA <= attackerVulnerable.to; vulA++) { // "vul" stands for "vulnerable"
						var attackersDied = attackerVulnerable.to - vulA;
						var splitDistribution = structs.createMatrix(problem.distribution.rows - attackersDied, defenderVulnerable.to + 1, 0);
						var subproblemProbabilityMass = 0;
						for (var d = 0; d <= defenderVulnerable.to; d++) {
							if (attackersDied < defenderTransitions[d].length) {
								for (var a = attackerVulnerable.to + 1; a < problem.distribution.rows; a++) {
									var maxDefenderDamage = Math.max(0, d - defenderVulnerable.from);
									var transitionMatrix = orthogonalMultiply(attackerTransitions[a], defenderTransitions[d], maxDefenderDamage, dieableAttackers);
									for (var attackerInflicted = 0; attackerInflicted < attackerTransitions[a].length && attackerInflicted <= maxDefenderDamage; attackerInflicted++) {
										subproblemProbabilityMass += (
											splitDistribution[a - attackersDied][d - attackerInflicted] += problem.distribution[a][d] * transitionMatrix.at(attackerInflicted, attackersDied)
										);
									}
								}
							}
						}
						if (subproblemProbabilityMass !== 0) {
							result.push(new structs.Problem(splitDistribution, splitAttacker(attackersDied), problem.defender, problem.options));
						}
					}
				}
				// Check if splitting makes sense for defender.
				if (defenderVulnerable.to + 1 < problem.distribution.columns) {
					// try out all possible counts of vulnerable defender units deaths
					for (var vulD = defenderVulnerable.from; vulD <= defenderVulnerable.to; vulD++) { // "vul" stands for "vulnerable"
						var defendersDied = defenderVulnerable.to - vulD;
						var splitDistribution = structs.createMatrix(attackerVulnerable.to + 1, problem.distribution.columns - defendersDied, 0);
						var subproblemProbabilityMass = 0;
						for (var a = 0; a <= attackerVulnerable.to; a++) {
							if (defendersDied < attackerTransitions[a].length) {
								for (var d = defenderVulnerable.to + 1; d < problem.distribution.columns; d++) {
									var maxAttackerDamage = Math.max(0, a - attackerVulnerable.from);
									var transitionMatrix = orthogonalMultiply(attackerTransitions[a], defenderTransitions[d], dieableDefenders, maxAttackerDamage);
									for (var defenderInflicted = 0; defenderInflicted < defenderTransitions[d].length && defenderInflicted <= maxAttackerDamage; defenderInflicted++) {
										subproblemProbabilityMass += (
											splitDistribution[a - defenderInflicted][d - defendersDied] += problem.distribution[a][d] * transitionMatrix.at(defendersDied, defenderInflicted)
										);
									}
								}
							}
						}
						if (subproblemProbabilityMass !== 0) {
							result.push(new structs.Problem(splitDistribution, problem.attacker, splitDefender(defendersDied), problem.options));
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
						var splitDistribution = structs.createMatrix(problem.distribution.rows - attackersDied, problem.distribution.columns - defendersDied, 0);
						var subproblemProbabilityMass = 0;
						for (var a = attackerVulnerable.to + 1; a < problem.distribution.rows; a++) {
							for (var d = defenderVulnerable.to + 1; d < problem.distribution.columns; d++) {
								if (attackersDied < defenderTransitions[d].length && defendersDied < attackerTransitions[a].length) {
									var transitionMatrix = orthogonalMultiply(attackerTransitions[a], defenderTransitions[d], dieableDefenders, dieableAttackers);
									subproblemProbabilityMass += (
										splitDistribution[a - attackersDied][d - defendersDied] += problem.distribution[a][d] * transitionMatrix.at(defendersDied, attackersDied)
									);
								}
							}
						}
						if (subproblemProbabilityMass !== 0) {
							result.push(new structs.Problem(splitDistribution, splitAttacker(attackersDied), splitDefender(defendersDied), problem.options));
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

				function extractMinor(distribution, rows, columns) {
					var result = structs.createMatrix(rows, columns, 0);
					for (var i = 0; i < rows; i++) {
						for (var j = 0; j < columns; j++) {
							result[i][j] = distribution[i][j];
						}
					}
					return result;
				}
			}
		}

	})();
})(typeof exports === 'undefined' ? window : exports);
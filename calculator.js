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

		var boosts = initBoosts();
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
			var problemArray = [new structs.Problem(distribution, attacker, defender)];

			//apply all pre-battle actions, like PDS fire and Barrage
			prebattleActions.forEach(function (action) {
				if (action.appliesTo === battleType)
					problemArray = action.execute(problemArray, attackerFull, defenderFull, options);
			});

			// the most interesting part - actually compute outcome probabilities
			for (var i = 0; i < problemArray.length; ++i)
				solveProblem(problemArray[i], battleType, attackerFull, defenderFull, options);

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
		function solveProblem(problem, battleType, attackerFull, defenderFull, options) {

			var attackerBoost = boost(battleType, options.attacker, true);
			var defenderBoost = boost(battleType, options.defender, true);
			var attackerReroll = battleType === game.BattleType.Ground && options.attacker.fireTeam;
			var defenderReroll = battleType === game.BattleType.Ground && options.defender.fireTeam;

			var magenDefenseActivated = battleType === game.BattleType.Ground &&
				options.defender.magenDefense &&
				defenderFull.some(unitIs(game.UnitType.PDS)) &&
				!attackerFull.some(unitIs(game.UnitType.WarSun));

			var effectsFlags = {
				valkyrieParticleWeave: battleType === game.BattleType.Ground,
				winnuFlagship: battleType === game.BattleType.Space,
			};

			if (attackerBoost || defenderBoost || // boosts apply to the first round only
				magenDefenseActivated || // Magen Defence applies to the first round
				attackerReroll || defenderReroll // re-rolls apply to the first round
			) {
				//need to make one round of propagation with either altered probabilities or attacker not firing
				var attackerTransitionsFactory;
				if (magenDefenseActivated)
					attackerTransitionsFactory = function () {
						return scale([1], problem.attacker.length + 1); // attacker does not fire
					};
				else
					attackerTransitionsFactory = function () {
						return computeFleetTransitions(problem.attacker, game.ThrowType.Battle, attackerBoost, attackerReroll);
					};
				var defenderTransitionsFactory = function () {
					return computeFleetTransitions(problem.defender, game.ThrowType.Battle, defenderBoost, defenderReroll);
				};

				applyTransitions(problem, attackerTransitionsFactory, defenderTransitionsFactory, options, effectsFlags);
				if (options.attacker.race === 'L1Z1X' && battleType === game.BattleType.Ground) { // Harrow
					prebattleActions.find(function (action) {
						return action.name === 'Bombardment';
					}).execute([problem], attackerFull, defenderFull, options)
				}
			}

			if (magenDefenseActivated && (attackerBoost || attackerReroll)) {
				// damn it, one more round of propagation with altered probabilities, but just for attacker
				// Harrow ignored, because Magen Defense implies Planetary Shield and no Bombardment.
				var attackerTransitionsFactory = function () {
					return computeFleetTransitions(problem.attacker, game.ThrowType.Battle, attackerBoost, attackerReroll);
				};
				var defenderTransitionsFactory = function () {
					return computeFleetTransitions(problem.defender, game.ThrowType.Battle, boost(battleType, options.defender, false));
				};
				applyTransitions(problem, attackerTransitionsFactory, defenderTransitionsFactory, options, effectsFlags);
			}

			propagateProbabilityUpLeft(problem, battleType, attackerFull, defenderFull, options);
		}

		function propagateProbabilityUpLeft(problem, battleType, attackerFull, defenderFull, options) {
			var distr = problem.distribution;
			// evaluate probabilities of transitions for each fleet
			var attackerTransitions = computeFleetTransitions(problem.attacker, game.ThrowType.Battle, boost(battleType, options.attacker, false));
			var defenderTransitions = computeFleetTransitions(problem.defender, game.ThrowType.Battle, boost(battleType, options.defender, false));
			if (options.attacker.race === 'L1Z1X' && battleType === game.BattleType.Ground) {
				var harrowTransitions = bombardmentTransitionsVector(attackerFull, defenderFull, options);
				if (harrowTransitions.length === 1) //means no bombardment
					harrowTransitions = undefined;
			}
			else
				var harrowTransitions = undefined;
			var winnuFlagshipRelevant = battleType === game.BattleType.Space &&
				(options.attacker.race === 'Winnu' && problem.attacker.some(unitIs(game.UnitType.Flagship)) ||
					options.defender.race === 'Winnu' && problem.defender.some(unitIs(game.UnitType.Flagship)));
			//do propagation
			for (var a = distr.rows - 1; 0 < a; a--) {
				for (var d = distr.columns - 1; 0 < d; d--) {

					if (winnuFlagshipRelevant) {
						if (options.attacker.race === 'Winnu' && modifyWinnuFlagship(problem.attacker, problem.defender, d)) {
							attackerTransitions = computeFleetTransitions(problem.attacker, game.ThrowType.Battle, boost(battleType, options.attacker, false));
						}
						if (options.defender.race === 'Winnu' && modifyWinnuFlagship(problem.defender, problem.attacker, a)) {
							defenderTransitions = computeFleetTransitions(problem.defender, game.ThrowType.Battle, boost(battleType, options.defender, false));
						}
					}
					var attackerTransitionsVector = adjustForNonEuclidean(attackerTransitions[a], problem.defender, d - 1, options.defender);
					var defenderTransitionsVector = adjustForNonEuclidean(defenderTransitions[d], problem.attacker, a - 1, options.attacker);
					var transitionMatrix = orthogonalMultiply(attackerTransitionsVector, defenderTransitionsVector, d + 1, a + 1);
					if (battleType === game.BattleType.Ground)
						transitionMatrix = adjustForValkyrieParticleWeave(transitionMatrix, options, d + 1, a + 1);

					if (harrowTransitions)
						transitionMatrix = harrowMultiply(transitionMatrix, harrowTransitions, d + 1, a + 1); // no Sustain Damage assumption

					var k;
					if (distr[a][d] === 0)
						continue;
					else {
						k = distr[a][d] / (1 - transitionMatrix.at(0, 0));
					}

					// transitions for everything except for attackerInflicted===0&&defenderInflicted===0
					var attackerInflicted = 0;
					for (var defenderInflicted = 1; defenderInflicted < transitionMatrix.columns; defenderInflicted++) {
						distr[a - defenderInflicted][d - attackerInflicted] += transitionMatrix.at(attackerInflicted, defenderInflicted) * k;
					}
					for (var attackerInflicted = 1; attackerInflicted < transitionMatrix.rows; attackerInflicted++) {
						for (var defenderInflicted = 0; defenderInflicted < transitionMatrix.columns && defenderInflicted <= a; defenderInflicted++) {
							distr[a - defenderInflicted][d - attackerInflicted] += transitionMatrix.at(attackerInflicted, defenderInflicted) * k;
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
		 * @param throwType game.ThrowType */
		function computeFleetTransitions(fleet, throwType, modifier, reroll) {
			modifier = modifier || 0;
			var result = [[1]];
			for (var a = 1; a <= fleet.length; ++a) {
				var unit = fleet[a - 1];
				var thisUnitTransitions = computeUnitTransitions(unit, throwType, modifier, reroll);
				result.push(slideMultiply(thisUnitTransitions, result[a - 1]));
			}
			return result;
		}

		/** like computeFleetTransitions, but not all units are allowed to throw dice */
		function computeSelectedUnitsTransitions(fleet, throwType, predicate, modifier) {
			var result = [[1]];
			var currentTransitions = [[1]];
			for (var i = 0; i < fleet.length; i++) {
				var unit = fleet[i];
				if (predicate(unit)) {
					var transitions = computeUnitTransitions(unit, throwType, modifier);
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
			var modifierFunction = typeof modifier === 'function' ? modifier : function (unit) {
				return modifier;
			};
			var singleRoll = [];
			singleRoll[0] = Math.max(Math.min((battleValue - 1 - modifierFunction(unit)) / game.dieSides, 1), 0);
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

		/** Same as unconstrainedOrthogonalMultiply, but will conflate probabilities of damages exceeding rows-1 and columns-1 */
		function orthogonalMultiply(transitions1, transitions2, rows, columns) {
			// Could have been:
			// return constrainTransitionMatrix(unconstrainedOrthogonalMultiply(transitions1, transitions2), rows, columns);
			// but is faster
			return {
				rows: Math.min(rows, transitions1.length),
				columns: Math.min(columns, transitions2.length),
				at: function (i1, i2) {
					var inflicted1 = transitions1[i1];
					if (i1 === rows - 1)
						while (++i1 < transitions1.length)
							inflicted1 += transitions1[i1];
					var inflicted2 = transitions2[i2];
					if (i2 === columns - 1)
						while (++i2 < transitions2.length)
							inflicted2 += transitions2[i2];
					return inflicted1 * inflicted2;
				},
			};
		}

		/** Create matrix-like object providing probabilities of inflicted damage
		 * result.at(1,2) == X means that probability of the first fleet inflicting 1 dmg while the second inflicts 2 is X */
		function unconstrainedOrthogonalMultiply(transitions1, transitions2) {
			return {
				rows: transitions1.length,
				columns: transitions2.length,
				at: function (i1, i2) {
					return transitions1[i1] * transitions2[i2];
				},
			};
		}

		/** Similar in purpose and result to orthogonalMultiply, but takes pre-round firing into account */
		function harrowMultiply(transitionMatrix, postroundAttackerTransitions, rows, columns) {
			if (!postroundAttackerTransitions || postroundAttackerTransitions.length === 1)
				return transitionMatrix;

			return constrainTransitionMatrix({
				rows: transitionMatrix.rows + postroundAttackerTransitions.length - 1,
				columns: transitionMatrix.columns,
				at: function (i1, i2) {
					var result = 0;
					for (var i = 0; i <= i1 && i < postroundAttackerTransitions.length; ++i) {
						if (i1 - i < transitionMatrix.rows) {
							var postRound = postroundAttackerTransitions[i];
							result += postRound * transitionMatrix.at(i1 - i, i2);
						}
					}
					return result;
				},
			}, rows, columns);
		}

		/** Apply transition vectors to the distribution matrix just once
		 * attackerVulnerableFrom and defenderVulnerableFrom could be used*/
		function applyTransitions(problem, attackerTransitions, defenderTransitions, options, effectsFlags) {
			var distribution = problem.distribution;
			if (effectsFlags && !(effectsFlags.winnuFlagship && options.attacker.race === 'Winnu'))
				attackerTransitions = attackerTransitions();
			if (effectsFlags && !(effectsFlags.winnuFlagship && options.defender.race === 'Winnu'))
				defenderTransitions = defenderTransitions();
			effectsFlags = effectsFlags || {};

			for (var a = 0; a < distribution.rows; a++) {
				for (var d = 0; d < distribution.columns; d++) {

					if (distribution[a][d] === 0) continue;

					var computedAttackerTransitions = attackerTransitions;
					var computedDefenderTransitions = defenderTransitions;
					if (effectsFlags.winnuFlagship) {
						if (options.attacker.race === 'Winnu') {
							modifyWinnuFlagship(problem.attacker, problem.defender, d);
							computedAttackerTransitions = attackerTransitions();
						}
						if (options.defender.race === 'Winnu') {
							modifyWinnuFlagship(problem.defender, problem.attacker, a);
							computedDefenderTransitions = defenderTransitions();
						}
					}
					var attackerTransitionsVector = adjustForNonEuclidean(computedAttackerTransitions[a], problem.defender, d - 1, options.defender);
					var defenderTransitionsVector = adjustForNonEuclidean(computedDefenderTransitions[d], problem.attacker, a - 1, options.attacker);
					var transitionMatrix = orthogonalMultiply(attackerTransitionsVector, defenderTransitionsVector, d + 1, a + 1);
					if (effectsFlags.valkyrieParticleWeave)
						transitionMatrix = adjustForValkyrieParticleWeave(transitionMatrix, options, d + 1, a + 1); // no Sustain Damage assumption. Otherwise Valkyrie should be taken into account before Non-Euclidean Shielding somehow

					for (var attackerInflicted = 0; attackerInflicted < transitionMatrix.rows; attackerInflicted++) {
						for (var defenderInflicted = 0; defenderInflicted < transitionMatrix.columns; defenderInflicted++) {
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
						var result = [];

						problemArray.forEach(function (problem) {
							var attackerTransitionsVector = getSpaceCannonTransitionsVector(attackerFull, options.attacker, options.defender);
							var defenderTransitionsVector = getSpaceCannonTransitionsVector(defenderFull, options.defender, options.attacker);

							if (options.attacker.gravitonLaser || options.defender.gravitonLaser) {
								var ensemble = new structs.EnsembleSplit(problem);

								var distribution = problem.distribution;
								for (var a = 0; a < distribution.rows; a++) {
									for (var d = 0; d < distribution.columns; d++) {
										if (distribution[a][d] === 0) continue;

										var transitionMatrix = unconstrainedOrthogonalMultiply(attackerTransitionsVector, defenderTransitionsVector);

										for (var attackerInflicted = 0; attackerInflicted < transitionMatrix.rows; attackerInflicted++) {
											for (var defenderInflicted = 0; defenderInflicted < transitionMatrix.columns; defenderInflicted++) {
												var attackerVictims = gravitonLaserVictims(problem.attacker, a, defenderInflicted, options.attacker, options.defender);
												var defenderVictims = gravitonLaserVictims(problem.defender, d, attackerInflicted, options.defender, options.attacker);
												ensemble.increment(attackerVictims, defenderVictims, a, d, transitionMatrix.at(attackerInflicted, defenderInflicted) * distribution[a][d]);
											}
										}
									}
								}

								result.push.apply(result, ensemble.getSubproblems());
							} else {

								var attackerTransitions = scale(attackerTransitionsVector, problem.attacker.length + 1);
								var defenderTransitions = scale(defenderTransitionsVector, problem.defender.length + 1);
								applyTransitions(problem, attackerTransitions, defenderTransitions, options);
								result.push(problem);
							}
						});
						return result;

						function getSpaceCannonTransitionsVector(fleetFull, thisSideOptions, opponentSideOptions) {
							var modifier = opponentSideOptions.antimassDeflectors ? -1 : 0;
							var spaceCannonFleet = fleetFull.filter(hasSpaceCannon);
							var vector;
							if (thisSideOptions.plasmaScoring)
								vector =  fleetTransitionsVectorWithPlasmaScoring(spaceCannonFleet, game.ThrowType.SpaceCannon, modifier);
							else
								vector = fleetTransitionsVector(spaceCannonFleet, game.ThrowType.SpaceCannon, modifier);
							return cancelHits(vector, opponentSideOptions.maneuveringJets ? 1 : 0)
						}

						function hasSpaceCannon(unit) {
							return unit.spaceCannonDice !== 0;
						}

						function gravitonLaserVictims(fleet, index, hits, thisSideOptions, opposingSideOptions) {
							if (hits === 0 || index === 0)
								return structs.Victim.Null;
							if (!opposingSideOptions.gravitonLaser) {
								var result = new structs.Victim();
								result._dead = Math.min(hits, fleet.map(absorbsHits).reduce(sum));
								return result;
							}

							var result = new structs.Victim();
							var lowerRange = []; // ships more expensive than fighters
							var middleRange = []; // affected Fighters
							var upperRange = [index, index]; // ships cheaper than Fighters (damage ghosts most likely)
							var currentRange = upperRange;
							// try to hit non-fighters
							for (var i = index - 1; 0 <= i && 0 < hits; --i) {
								if (fleet[i].type === game.UnitType.Fighter) {
									middleRange = [i + 1, i + 1];
									do {
										i--;
									} while (0 <= i && fleet[i].type === game.UnitType.Fighter);
									if (i < 0)
										break;
									currentRange = lowerRange = [i + 1, i + 1];
								}
								currentRange[0]--;
								hits -= absorbsHits(fleet[i]);
							}
							// now hit Fighters if needed
							for (var i = index - 1; 0 <= i && 0 < hits; --i) {
								if (fleet[i].type === game.UnitType.Fighter) {
									middleRange[0]--;
									hits -= absorbsHits(fleet[i]); // will always be the same as hits--
								}
							}
							result.addRange(lowerRange[0], lowerRange[1]);
							result.addRange(middleRange[0], middleRange[1]);
							result.addRange(upperRange[0], upperRange[1]);
							return result;

							function absorbsHits(unit) {
								return (unit.isDamageGhost && thisSideOptions.nonEuclidean) ? 2 : 1;
							}

							function sum(a, b) {
								return a + b;
							}
						}
					},
				},
				{
					name: 'Mentak racial',
					appliesTo: game.BattleType.Space,
					execute: function (problemArray, attackerFull, defenderFull, options) {
						problemArray.forEach(function (problem) {
							if (options.attacker.race !== 'Mentak' && options.defender.race !== 'Mentak')
								return;

							function createMentakTransitions(fleet) {
								var firedShips = 0;
								return computeSelectedUnitsTransitions(fleet, game.ThrowType.Battle, function (ship) {
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
							if (options.attacker.race === 'Mentak')
								attackerTransitions = createMentakTransitions(problem.attacker);
							else
								attackerTransitions = scale([1], problem.attacker.length + 1);
							if (options.defender.race === 'Mentak')
								defenderTransitions = createMentakTransitions(problem.defender);
							else
								defenderTransitions = scale([1], problem.defender.length + 1);
							applyTransitions(problem, attackerTransitions, defenderTransitions, options);
						});
						return problemArray;
					},
				},
				{
					name: 'Assault Cannon',
					appliesTo: game.BattleType.Space,
					execute: function (problemArray, attackerFull, defenderFull, options) {
						if (!options.attacker.assaultCannon && !options.defender.assaultCannon) {
							return problemArray;
						}

						var result = [];
						problemArray.forEach(function (problem) {

							var ensemble = new structs.EnsembleSplit(problem);
							var attackerThreshold = findAssaultCannonThreshold(problem.attacker, options.attacker.assaultCannon);
							var defenderThreshold = findAssaultCannonThreshold(problem.defender, options.defender.assaultCannon);
							var attackerVictims = calculateVictims(problem.attacker, defenderThreshold < problem.defender.length);
							var defenderVictims = calculateVictims(problem.defender, attackerThreshold < problem.attacker.length);

							var distribution = problem.distribution;
							for (var a = 0; a < distribution.rows; a++) {
								for (var d = 0; d < distribution.columns; d++) {
									if (distribution[a][d] === 0) continue;
									var attackerVictim = defenderThreshold < d ? attackerVictims[a] : structs.Victim.Null;
									var defenderVictim = attackerThreshold < a ? defenderVictims[d] : structs.Victim.Null;
									ensemble.increment(attackerVictim, defenderVictim, a, d, distribution[a][d]);
								}
							}
							result.push.apply(result, ensemble.getSubproblems());
						});
						return result;

						function findAssaultCannonThreshold(fleet, assaultCannon) {
							var nonFightersFound = 0;
							for (var i = 0; i < fleet.length; i++) {
								if (notFighterShip(fleet[i]))
									nonFightersFound++;
								if (nonFightersFound >= 3 && assaultCannon)
									return i;
							}
							return i;
						}

						function calculateVictims(fleet, victimsNeeded) {
							var result = new Array(fleet.length + 1);
							if (!victimsNeeded)
								result.fill(structs.Victim.Null);
							else {
								result[0] = structs.Victim.Null;
								var victim = undefined;
								var splice1 = undefined;
								var splice2 = undefined;
								for (var i = 0; i < fleet.length; ++i) {
									if (notFighterShip(fleet[i])) {
										victim = fleet[i];
										splice1 = i;
										splice2 = undefined;
									} else if (victim && fleet[i].damageCorporeal === victim) {
										splice2 = i;
									}
									var v = new structs.Victim();
									if (splice1 !== undefined) {
										v.addRange(splice1, undefined);
										if (splice2 !== undefined)
											v.addRange(splice2, undefined);
									}
									result[i + 1] = v;
								}
							}
							return result;
						}
					},
				},
				{
					name: 'Anti-Fighter Barrage',
					appliesTo: game.BattleType.Space,
					execute: function (problemArray, attackerFull, defenderFull, options) {

						var result = [];
						problemArray.forEach(function (problem) {

							var ensemble = new structs.EnsembleSplit(problem);

							var attackerBoost = options.attacker.moraleBoost ? 1 : 0;
							var defenderBoost = options.defender.moraleBoost ? 1 : 0;

							var attackerTransitions = computeSelectedUnitsTransitions(problem.attacker, game.ThrowType.Barrage, hasBarrage, attackerBoost);
							var defenderTransitions = computeSelectedUnitsTransitions(problem.defender, game.ThrowType.Barrage, hasBarrage, defenderBoost);

							var attackerVulnerable = getVulnerableUnitsRange(problem.attacker, unitIs(game.UnitType.Fighter));
							var defenderVulnerable = getVulnerableUnitsRange(problem.defender, unitIs(game.UnitType.Fighter));

							var distribution = problem.distribution;
							for (var a = 0; a < distribution.rows; a++) {
								for (var d = 0; d < distribution.columns; d++) {
									if (distribution[a][d] === 0) continue;

									var transitionMatrix = unconstrainedOrthogonalMultiply(attackerTransitions[a], defenderTransitions[d]);

									for (var attackerInflicted = 0; attackerInflicted < transitionMatrix.rows; attackerInflicted++) {
										for (var defenderInflicted = 0; defenderInflicted < transitionMatrix.columns; defenderInflicted++) {
											var attackerVictims = barrageVictims(attackerVulnerable, a, defenderInflicted);
											var defenderVictims = barrageVictims(defenderVulnerable, d, attackerInflicted);
											ensemble.increment(attackerVictims, defenderVictims, a, d, transitionMatrix.at(attackerInflicted, defenderInflicted) * distribution[a][d]);
										}
									}
								}
							}

							result.push.apply(result, ensemble.getSubproblems());
						});

						return result;

						function hasBarrage(unit) {
							return unit.barrageDice !== 0;
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

						function barrageVictims(fleetVulnerable, index, hits) {
							if (hits === 0 || index < fleetVulnerable.from)
								return structs.Victim.Null;

							var result = new structs.Victim();
							result.addRange(fleetVulnerable.from, Math.min(index, fleetVulnerable.from + hits, fleetVulnerable.to));
							return result;
						}
					},
				},
				{
					name: 'Bombardment',
					appliesTo: game.BattleType.Ground,
					execute: function (problemArray, attackerFull, defenderFull, options) {
						problemArray.forEach(function (problem) {
							var attackerTransitionsVector = bombardmentTransitionsVector(attackerFull, defenderFull, options);
							var attackerTransitions = scale(attackerTransitionsVector, problem.attacker.length + 1);
							var defenderTransitions = scale([1], problem.defender.length + 1);
							applyTransitions(problem, attackerTransitions, defenderTransitions, options);
						});
						return problemArray;
					},
				},
				{
					name: 'Space Cannon -> Ground Forces',
					appliesTo: game.BattleType.Ground,
					execute: function (problemArray, attackerFull, defenderFull, options) {
						problemArray.forEach(function (problem) {
							if (options.attacker.l4Disruptors) return;

							var attackerTransitions = scale([1], problem.attacker.length + 1); // attacker does not fire
							var defenderModifier = options.attacker.antimassDeflectors ? -1 : 0;
							var pdsDefender = defenderFull.filter(unitIs(game.UnitType.PDS));
							var defenderTransitionsVector;
							if (options.defender.plasmaScoring)
								defenderTransitionsVector = fleetTransitionsVectorWithPlasmaScoring(pdsDefender, game.ThrowType.SpaceCannon, defenderModifier);
							else
								defenderTransitionsVector = fleetTransitionsVector(pdsDefender, game.ThrowType.SpaceCannon, defenderModifier);
							var defenderTransitions = scale(cancelHits(defenderTransitionsVector, options.attacker.maneuveringJets ? 1 : 0), problem.defender.length + 1);

							applyTransitions(problem, attackerTransitions, defenderTransitions, options);
						});
						return problemArray;
					},
				},
			];
		}

		function boost(battleType, sideOptions, firstRound) {
			var result = 0;
			for (var i = 0; i < boosts.length; i++) {
				if (!firstRound && boosts[i].firstRoundOnly) continue;

				var boost = boosts[i].apply(battleType, sideOptions);
				if (boost && !result) {
					result = boost;
					continue;
				}
				if (boost) {
					result = compose(result, boost);
				}
			}
			return result;

			function compose(boost1, boost2) {
				var boost1IsFunction = typeof boost1 === 'function';
				var boost2IsFunction = typeof boost2 === 'function';
				if (boost1IsFunction || boost2IsFunction) {
					return function (unit) {
						return (boost1IsFunction ? boost1(unit) : boost1) +
							(boost2IsFunction ? boost2(unit) : boost2);
					};
				}
				else {
					return boost1 + boost2;
				}
			}
		}

		function initBoosts() {
			return [{
				name: 'moraleBoost',
				firstRoundOnly: true,
				apply: function (battleType, sideOptions) {
					return sideOptions.moraleBoost ? 1 : 0;
				}
			}, {
				name: 'fighterPrototype',
				firstRoundOnly: true,
				apply: function (battleType, sideOptions) {
					return battleType === game.BattleType.Space && sideOptions.fighterPrototype ?
						function (unit) {
							return unit.type === game.UnitType.Fighter ? 2 : 0;
						} : 0;
				}
			}, {
				name: 'Sardakk',
				firstRoundOnly: false,
				apply: function (battleType, sideOptions) {
					return sideOptions.race === 'Sardakk' ? 1 : 0;
				}
			}, {
				name: 'JolNar',
				firstRoundOnly: false,
				apply: function (battleType, sideOptions) {
					return sideOptions.race === 'JolNar' ? -1 : 0;
				}
			},];
		}

		function fleetTransitionsVector(fleet, throwType, modifier, reroll) {
			return computeFleetTransitions(fleet, throwType, modifier, reroll).pop();
		}

		function scale(transitionsVector, repeat) {
			var result = new Array(repeat);
			result.fill(transitionsVector);
			return result;
		}

		function bombardmentTransitionsVector(attackerFull, defenderFull, options) {
			var bombardmentPossible = !defenderFull.some(unitIs(game.UnitType.PDS)) // either there are no defending PDS
				|| attackerFull.some(unitIs(game.UnitType.WarSun)); // or there are but attacking WarSuns negate their Planetary Shield
			if (!bombardmentPossible) return [1];

			var attackerModifier = options.defender.bunker ? -4 : 0;
			var bombardmentAttacker = attackerFull.filter(hasBombardment);
			if (options.attacker.plasmaScoring)
				return fleetTransitionsVectorWithPlasmaScoring(bombardmentAttacker, game.ThrowType.Bombardment, attackerModifier);
			else
				return fleetTransitionsVector(bombardmentAttacker, game.ThrowType.Bombardment, attackerModifier);

			function hasBombardment(unit) {
				return unit.bombardmentDice !== 0;
			}
		}

		function fleetTransitionsVectorWithPlasmaScoring(fleet, throwType, modifier, reroll) {
			var fleetInflicted = computeFleetTransitions(fleet, throwType, modifier, reroll).pop();
			var bestUnit = getUnitWithLowest(fleet, throwType + 'Value');
			if (bestUnit) {
				var unitWithOneDie = bestUnit.clone();
				unitWithOneDie[throwType + 'Dice'] = 1;
				var unitTransitions = computeUnitTransitions(unitWithOneDie, throwType, modifier, reroll);
				fleetInflicted = slideMultiply(unitTransitions, fleetInflicted);
			}
			return fleetInflicted;
		}

		function adjustForNonEuclidean(fleetTransitionsVector, opposingFleet, opposingIndex, opposingSideOptions) {
			if (opposingSideOptions.nonEuclidean && fleetTransitionsVector.length > 2) {
				var result = fleetTransitionsVector.slice();
				// as it is implemented, if the fleet is [D, d, C], and two hits are produced against it, then both
				// the Cruiser will be killed and the Dreadnought damaged. Though it suffices to only damage the Dreadnought,
				// because non-euclidean will absorb both hits.
				for (var dmg = 1; dmg < result.length && 0 < opposingIndex; dmg++) {
					if (opposingFleet[opposingIndex].isDamageGhost) {
						cancelHits(result, 1, dmg);
					}
					opposingIndex--;
				}
				return result;
			} else {
				return fleetTransitionsVector;
			}
		}

		function adjustForValkyrieParticleWeave(transitionMatrix, options, rows, columns) {
			if (!options.attacker.valkyrieParticleWeave && !options.defender.valkyrieParticleWeave)
				return transitionMatrix;
			return constrainTransitionMatrix({
				rows: transitionMatrix.rows + (options.attacker.valkyrieParticleWeave ? 1 : 0 ),
				columns: transitionMatrix.columns + (options.defender.valkyrieParticleWeave ? 1 : 0 ),
				at: function (i1, i2) {
					if (i1 === 0 && i2 === 0)
						return transitionMatrix.at(0, 0);
					if (i1 === 0)
						return options.attacker.valkyrieParticleWeave || i2 === transitionMatrix.columns ? 0 : transitionMatrix.at(i1, i2);
					if (i2 === 0)
						return options.defender.valkyrieParticleWeave || i1 === transitionMatrix.rows ? 0 : transitionMatrix.at(i1, i2);
					if (i1 === 1 && i2 === 1 && options.attacker.valkyrieParticleWeave && options.defender.valkyrieParticleWeave)
						return (transitionMatrix.columns === 1 ? 0 : transitionMatrix.at(0, 1)) + (transitionMatrix.rows === 1 ? 0 : transitionMatrix.at(1, 0));
					if (options.attacker.valkyrieParticleWeave && options.defender.valkyrieParticleWeave &&
						( i1 === transitionMatrix.rows && i2 === 1 ||
							i1 === 1 && i2 === transitionMatrix.columns))
						return 0;
					var rowShift = options.attacker.valkyrieParticleWeave && !(options.defender.valkyrieParticleWeave && i2 === 1) ? 1 : 0;
					var columnShift = options.defender.valkyrieParticleWeave && !(options.attacker.valkyrieParticleWeave && i1 === 1) ? 1 : 0;
					return transitionMatrix.at(i1 - rowShift, i2 - columnShift);
				}
			}, rows, columns);
		}

		function constrainTransitionMatrix(transitionMatrix, rows, columns) {
			if (transitionMatrix.rows <= rows && transitionMatrix.columns <= columns)
				return transitionMatrix;
			return {
				rows: Math.min(transitionMatrix.rows, rows),
				columns: Math.min(transitionMatrix.columns, columns),
				at: function (i1, i2) {
					var result = 0;
					var upperRowsLimit = i1 === this.rows - 1 ? transitionMatrix.rows : i1 + 1;
					var upperColumnsLimit = i2 === this.columns - 1 ? transitionMatrix.columns : i2 + 1;
					for (var i = i1; i < upperRowsLimit; ++i) {
						for (var j = i2; j < upperColumnsLimit; ++j) {
							result += transitionMatrix.at(i, j);
						}
					}
					return result;
				},
			}
		}

		function getUnitWithLowest(fleet, property) {
			var result = null;
			var bestBattleValue = Infinity;
			for (var i = 0; i < fleet.length; i++) {
				if (fleet[i][property] < bestBattleValue) {
					result = fleet[i];
					bestBattleValue = fleet[i][property];
				}
			}
			return result;
		}

		function cancelHits(transitionsVector, cancelledHits, cancelFrom) {
			cancelFrom = cancelFrom || 0;
			for (var c = 0; c < cancelledHits; ++c) {
				if (transitionsVector.length > cancelFrom + 1)
					transitionsVector[cancelFrom] += transitionsVector[cancelFrom + 1];
				for (var i = cancelFrom + 2; i < transitionsVector.length; i++)
					transitionsVector[i - 1] = transitionsVector[i];
				if (transitionsVector.length > cancelFrom + 1)
					transitionsVector.pop();
			}
			return transitionsVector;
		}

		function modifyWinnuFlagship(fleet, opposingFleet, opposingFleetCount) {
			var battleDice = null;
			fleet.filter(unitIs(game.UnitType.Flagship)).forEach(function (flagship) {
				flagship.battleDice = battleDice === null ?
					(battleDice = opposingFleet.slice(0, opposingFleetCount).filter(notFighterShip).length) :
					battleDice;
			});
			return battleDice !== null; // means flagship present
		}

		function unitIs(unitType) {
			return function (unit) {
				return unit.type === unitType && !unit.isDamageGhost;
			};
		}

		function notFighterShip(unit) {
			return unit.type !== game.UnitType.Fighter && !unit.isDamageGhost;
		}
	})();
})(typeof exports === 'undefined' ? window : exports);
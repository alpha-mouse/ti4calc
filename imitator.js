(function (root) {

	var structs, game;
	if (typeof require === 'function') {
		structs = require('./structs');
		game = require('./game-elements');
	} else {
		structs = window;
		game = window;
	}

	root.imitationIterations = 10000;
	root.imitator = (function () {

		var prebattleActions = initPrebattleActions();
		var boosts = initBoosts();

		return {
			estimateProbabilities: estimateProbabilities,
		};

		function estimateProbabilities(input) {
			var battleType = input.battleType;
			var options = input.options || { attacker: {}, defender: {} };

			options = options || { attacker: {}, defender: {} };

			var result = new structs.EmpiricalDistribution();
			var finalAttacker = game.expandFleet(input, game.BattleSide.attacker).filterForBattle()
				.map(function (unit) { return [unit.shortType]; });
			var finalDefender = game.expandFleet(input, game.BattleSide.defender).filterForBattle()
				.map(function (unit) { return [unit.shortType]; });
			for (var i = 0; i < root.imitationIterations; ++i) {
				var attacker = game.expandFleet(input, game.BattleSide.attacker);
				var defender = game.expandFleet(input, game.BattleSide.defender);

				var survivors = imitateBattle(attacker, defender, battleType, options);

				if (survivors.attacker.length !== 0) {
					result.increment(-survivors.attacker.length);
					for (var a = 0; a < survivors.attacker.length; a++) {
						if (!finalAttacker[a])
							finalAttacker[a] = [];
						if (finalAttacker[a].indexOf(survivors.attacker[a].shortType) < 0)
							finalAttacker[a].push(survivors.attacker[a].shortType);
					}
				} else if (survivors.defender.length !== 0) {
					result.increment(survivors.defender.length);
					for (var d = 0; d < survivors.defender.length; d++) {
						if (!finalDefender[d])
							finalDefender[d] = [];
						if (finalDefender[d].indexOf(survivors.defender[d].shortType) < 0)
							finalDefender[d].push(survivors.defender[d].shortType);
					}
				} else
					result.increment(0);
			}

			result.normalize();

			return {
				distribution: result,
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

		function imitateBattle(attackerFull, defenderFull, battleType, options) {
			var attacker = attackerFull.filterForBattle();
			var defender = defenderFull.filterForBattle();

			var doAtLeastOneRound = false;
			var actions = prebattleActions;
			if (options.attacker.race === game.Race.Mentak) {
				actions = prebattleActions.slice();
				var t = actions[1];
				actions[1] = actions[2];
				actions[2] = t;
				if (actions[1].name !== 'Mentak racial' ||
					actions[2].name !== 'Assault Cannon')
					throw new Error('unexpected pre-battle actions order');
			}
			for (var i = 0; i < actions.length; i++) {
				var action = actions[i];
				if (action.appliesTo === battleType)
					action.execute(attacker, defender, attackerFull, defenderFull, options);
				if (i === 0) {
					if (action.name === 'Space Cannon -> Ships') {
						// if last unit's are destroyed by Mentak racial ability or Assault Cannon or Barrage,
						// make sure "after combat round" effects still occur
						doAtLeastOneRound = battleType === game.BattleType.Space &&
							(attacker.length || defender.length);
					} else
						throw new Error('first pre-battle action not Space Cannon -> Ships');
				}
			}
			attacker.sort(attacker.comparer);
			defender.sort(defender.comparer);
			var round = 0;

			var magenDefenseActivated = battleType === game.BattleType.Ground &&
				options.defender.magenDefense &&
				defenderFull.some(unitIs(game.UnitType.PDS)) &&
				!attackerFull.some(unitIs(game.UnitType.WarSun));

			while (hasUnits(attacker) && hasUnits(defender) || (doAtLeastOneRound && round === 0)) {
				round++;

				if (options.attacker.race === game.Race.Letnev)
					repairFlagships(attacker);
				if (options.defender.race === game.Race.Letnev)
					repairFlagships(defender);

				var attackerBoost = boost(battleType, round, options.attacker, attacker, options.defender);
				var defenderBoost = boost(battleType, round, options.defender, defender, options.attacker);
				var attackerReroll = false;
				var defenderReroll = false;
				if (round === 1) {
					attackerReroll = options.attacker.fireTeam && battleType === game.BattleType.Ground ||
						options.attacker.letnevMunitionsFunding && battleType === game.BattleType.Space;
					defenderReroll = options.defender.fireTeam && battleType === game.BattleType.Ground ||
						options.defender.letnevMunitionsFunding && battleType === game.BattleType.Space;
				}
				if (round === 2 && magenDefenseActivated) {
					// if Magen Defense was activated - treat the second round as the first for the attacker
					attackerBoost = boost(battleType, 1, options.attacker, attacker, options.defender);
					attackerReroll = options.attacker.fireTeam && battleType === game.BattleType.Ground ||
						options.attacker.letnevMunitionsFunding && battleType === game.BattleType.Space /* space combat is mutually exclusive with magen defense but anyway*/;
				}
				winnuFlagships(attacker, options.attacker, defender);
				winnuFlagships(defender, options.defender, attacker);
				var attackerInflictedToNonFighters = 0, attackerInflictedToEverything = 0;
				var defenderInflictedToNonFighters = 0, defenderInflictedToEverything = 0;

				if (options.attacker.race === game.Race.L1Z1X && attacker.some(unitIs(game.UnitType.Flagship))) {
					attackerInflictedToNonFighters = rollDice(attacker.filter(flagshipOrDreadnought), game.ThrowType.Battle, attackerBoost, attackerReroll);
					attackerInflictedToEverything = rollDice(attacker.filter(not(flagshipOrDreadnought)), game.ThrowType.Battle, attackerBoost, attackerReroll);
				} else
					attackerInflictedToEverything = rollDice(attacker, game.ThrowType.Battle, attackerBoost, attackerReroll);
				if (options.defender.race === game.Race.L1Z1X && defender.some(unitIs(game.UnitType.Flagship))) {
					defenderInflictedToNonFighters = rollDice(defender.filter(flagshipOrDreadnought), game.ThrowType.Battle, defenderBoost, defenderReroll);
					defenderInflictedToEverything = rollDice(defender.filter(not(flagshipOrDreadnought)), game.ThrowType.Battle, defenderBoost, defenderReroll);
				} else
					defenderInflictedToEverything = rollDice(defender, game.ThrowType.Battle, defenderBoost, defenderReroll);
				if (round === 1 && magenDefenseActivated) {
					attackerInflictedToEverything = 0;
				}

				if (battleType === game.BattleType.Ground) {
					var attackerAdditional = 0;
					var defenderAdditional = 0;
					if (options.attacker.valkyrieParticleWeave &&
						defenderInflictedToEverything > 0)
						attackerAdditional = 1;
					if (options.defender.valkyrieParticleWeave &&
						attackerInflictedToEverything > 0)
						defenderAdditional = 1;
					attackerInflictedToEverything += attackerAdditional;
					defenderInflictedToEverything += defenderAdditional;
				}

				var attackerYinFlagshipDied = applyDamage(attacker, defenderInflictedToNonFighters, options.attacker, null, notFighter) || applyDamage(attacker, defenderInflictedToEverything, options.attacker);
				var defenderYinFlagshipDied = applyDamage(defender, attackerInflictedToNonFighters, options.defender, null, notFighter) || applyDamage(defender, attackerInflictedToEverything, options.defender);
				if (attackerYinFlagshipDied || defenderYinFlagshipDied) {
					attacker.splice(0);
					defender.splice(0);
				}

				if (options.attacker.duraniumArmor)
					repairUnit(attacker);
				if (options.defender.duraniumArmor)
					repairUnit(defender);

				if (options.attacker.race === game.Race.L1Z1X && battleType === game.BattleType.Ground) { // Harrow
					actions.find(function (a) {
						return a.name === 'Bombardment';
					}).execute(attacker, defender, attackerFull, defenderFull, options);
				}

				// https://boardgamegeek.com/thread/1904694/how-do-you-resolve-endless-battles
				if (// both sides have Duranium Armor
				options.attacker.duraniumArmor && options.defender.duraniumArmor &&
				// both sides have Non-Euclidean Shielding
				options.attacker.nonEuclidean && options.defender.nonEuclidean &&
				// and both of them have two repairable ships left
				attacker.filter(function (unit) { return unit.sustainDamageHits > 0 && !unit.isDamageGhost; }).length === 2 &&
				defender.filter(function (unit) { return unit.sustainDamageHits > 0 && !unit.isDamageGhost; }).length === 2 &&
				// and at least one of them (for each side) is not damaged
				attacker.filter(function (unit) { return unit.sustainDamageHits > 0 && !unit.isDamageGhost && !unit.damaged; }).length > 0 &&
				defender.filter(function (unit) { return unit.sustainDamageHits > 0 && !unit.isDamageGhost && !unit.damaged; }).length > 0 &&

				// but both cannot inflict more than two damage
				attacker.map(function (unit) {return unit.battleDice || 0; }).reduce(sum) <= 2 &&
				defender.map(function (unit) {return unit.battleDice || 0; }).reduce(sum) <= 2
				) {
					// deadlock detected. report as a draw
					attacker.splice(0);
					defender.splice(0);
					break;
				}
			}

			return { attacker: attacker, defender: defender };

			function winnuFlagships(fleet, sideOptions, opposingFleet) {
				if (battleType === game.BattleType.Space && sideOptions.race === game.Race.Winnu) {
					// according to https://boardgamegeek.com/thread/1916774/nekrowinnu-flagship-interaction
					var battleDice = opposingFleet.filter(notFighterNorGroundForceShip).length;
					// In the game there could be only one flagship, but why the hell not)
					fleet.filter(unitIs(game.UnitType.Flagship)).forEach(function (flagship) {
						flagship.battleDice = battleDice;
					});
				}
			}

			function notFighter(unit) {
				return unit.type !== game.UnitType.Fighter;
			}

			function flagshipOrDreadnought(unit) {
				return unit.type === game.UnitType.Flagship || unit.type === game.UnitType.Dreadnought;
			}

			function not(predicate) {
				return function (unit) {
					return !predicate(unit);
				}
			}

			function repairUnit(fleet) {

				var somethingRepaired = false;
				for (var i = 0; i < fleet.length; i++) {
					var unit = fleet[i];
					if (unit.damaged) {
						if (unit.damagedThisRound) {
							unit.damagedThisRound = false;
						} else {
							if (!somethingRepaired) {
								fleet.push(unit.toDamageGhost());
								somethingRepaired = true;
							}
						}
					}
				}

				fleet.sort(fleet.comparer);
			}

			function repairFlagships(fleet) {

				for (var i = 0; i < fleet.length; i++) {
					var unit = fleet[i];
					if (unit.type === game.UnitType.Flagship && unit.damaged) {
						var damageGhost = unit.toDamageGhost();
						// find proper place for the new damage ghost
						var index = structs.binarySearch(fleet, damageGhost, fleet.comparer);
						if (index < 0)
							index = -index - 1;
						fleet.splice(index, 0, damageGhost);
					}
				}
			}

		}

		/** returns true if Yin flagship was killed */
		function applyDamage(fleet, hits, sideOptions, hardPredicate, softPredicate) {
			hardPredicate = hardPredicate || function (unit) {
				return true;
			};
			for (var i = fleet.length - 1; 0 <= i && 0 < hits; i--) {
				if (hardPredicate(fleet[i]) && (!softPredicate || softPredicate(fleet[i]))) {
					var killed = hit(i);
					if (sideOptions.race === game.Race.Yin && unitIs(game.UnitType.Flagship)(killed))
						return true;
				}
			}
			if (softPredicate) {
				for (var i = fleet.length - 1; 0 <= i && 0 < hits; i--) {
					if (hardPredicate(fleet[i])) {
						var killed = hit(i);
						if (sideOptions.race === game.Race.Yin && unitIs(game.UnitType.Flagship)(killed))
							return true;
					}
				}
			}
			return false;

			function hit(i) {
				var killed = fleet.splice(i, 1)[0];
				if (killed.isDamageGhost) {
					killed.damageCorporeal.damaged = true;
					killed.damageCorporeal.damagedThisRound = true;
					if (sideOptions.nonEuclidean)
						hits--;
				}
				hits--;
				return killed;
			}
		}

		function rollDice(fleet, throwType, modifier, reroll) {
			modifier = modifier || 0;
			var totalRoll = 0;
			var modifierFunction = typeof modifier === 'function' ? modifier : function (unit) {
				return modifier;
			};
			for (var i = 0; i < fleet.length; i++) {
				var unit = fleet[i];
				var battleValue = unit[game.ThrowValues[throwType]];
				var diceCount = unit[game.ThrowDice[throwType]];
				for (var die = 0; die < diceCount; ++die) {
					var rollResult = rollDie();
					if (unit.type === game.UnitType.Flagship && unit.race === game.Race.JolNar && 8 < rollResult)
						totalRoll += 2;
					if (battleValue <= rollResult + modifierFunction(unit))
						totalRoll++;
					else if (reroll) { // There is an assumption that Jol-Nar Flagship won't re-roll rolls that produced hits but not +2 hits. Seems reasonable on expectation.
						rollResult = rollDie();
						if (unit.type === game.UnitType.Flagship && unit.race === game.Race.JolNar && 8 < rollResult)
							totalRoll += 2;
						if (battleValue <= rollResult + modifierFunction(unit))
							totalRoll++;
					}
				}
			}
			return totalRoll;
		}

		function rollDie() {
			return Math.floor(Math.random() * game.dieSides + 1);
		}

		function hasUnits(fleet) {
			return fleet.length > 0;
		}

		function initPrebattleActions() {
			return [
				{
					name: 'Space Cannon -> Ships',
					appliesTo: game.BattleType.Space,
					execute: function (attacker, defender, attackerFull, defenderFull, options) {
						var attackerModifier = options.defender.antimassDeflectors ? -1 : 0;
						var attackerInflicted = rollDice(attackerFull.filter(hasSpaceCannon), game.ThrowType.SpaceCannon, attackerModifier);
						if (options.attacker.plasmaScoring) {
							attackerInflicted += fromPlasmaScoring(attackerFull, game.ThrowType.SpaceCannon, attackerModifier);
						}

						var defenderModifier = options.attacker.antimassDeflectors ? -1 : 0;
						var defenderInflicted = rollDice(defenderFull.filter(hasSpaceCannon), game.ThrowType.SpaceCannon, defenderModifier);
						if (options.defender.plasmaScoring) {
							defenderInflicted += fromPlasmaScoring(defenderFull, game.ThrowType.SpaceCannon, defenderModifier);
						}
						if (options.attacker.maneuveringJets && defenderInflicted > 0)
							defenderInflicted--;
						if (options.defender.maneuveringJets && attackerInflicted > 0)
							attackerInflicted--;

						var defenderYinFlagshipDied = applyDamage(defender, attackerInflicted, options.defender, notGroundForce, gravitonLaserUnitHittable(options.attacker));
						var attackerYinFlagshipDied = applyDamage(attacker, defenderInflicted, options.attacker, notGroundForce, gravitonLaserUnitHittable(options.defender));
						if (attackerYinFlagshipDied || defenderYinFlagshipDied) {
							attacker.splice(0);
							defender.splice(0);
						}

						if (defenderInflicted)
							markDamagedNotThisRound(attacker);
						if (attackerInflicted)
							markDamagedNotThisRound(defender);

						function hasSpaceCannon(unit) {
							return unit.spaceCannonDice !== 0;
						}

						function gravitonLaserUnitHittable(sideOptions) {
							return function (unit) {
								return !(sideOptions.gravitonLaser && unit.type === game.UnitType.Fighter);
							};
						}

						function notGroundForce(unit) {
							return /*because Virus Flagship*/ unit.type !== game.UnitType.Ground;
						}

						function markDamagedNotThisRound(fleet) {
							for (var i = 0; i < fleet.length; i++) {
								if (fleet[i].damagedThisRound) {
									fleet[i].damagedThisRound = false;
								}
							}
						}
					},
				},
				{
					name: 'Assault Cannon',
					appliesTo: game.BattleType.Space,
					execute: function (attacker, defender, attackerFull, defenderFull, options) {

						var attackerDestroys = options.attacker.assaultCannon && attacker.filter(notFighterShip).length >= 3;
						var defenderDestroys = options.defender.assaultCannon && defender.filter(notFighterShip).length >= 3;

						var attackerVictim;
						var defenderVictim;
						if (attackerDestroys)
							defenderVictim = killOffNonFighter(defender, false);
						if (defenderDestroys)
							attackerVictim = killOffNonFighter(attacker, true);
						if (options.attacker.race === game.Race.Yin && attackerVictim && unitIs(game.UnitType.Flagship)(attackerVictim) ||
							options.defender.race === game.Race.Yin && defenderVictim && unitIs(game.UnitType.Flagship)(defenderVictim)) {
							attacker.splice(0);
							defender.splice(0);
						}

						function killOffNonFighter(fleet, canTakeIntoGroundForces) {
							for (var i = fleet.length - 1; i >= 0; i--) {
								var unit = fleet[i];
								if ((canTakeIntoGroundForces ? notFighterShip : notFighterNorGroundForceShip)(unit)) {
									fleet.splice(i, 1);
									if (unit.sustainDamageHits > 0) {
										var damageGhostIndex = fleet.findIndex(function (ghostCandidate) {
											return ghostCandidate.damageCorporeal === unit;
										});
										if (damageGhostIndex >= 0) {
											fleet.splice(damageGhostIndex, 1);
										}
									}
									return unit;
								}
							}
						}
					},
				},
				{
					name: 'Mentak racial',
					appliesTo: game.BattleType.Space,
					execute: function (attacker, defender, attackerFull, defenderFull, options) {

						function getInflicted(fleet, sideOptions) {
							var firing = fleet.filter(unitIs(game.UnitType.Cruiser));
							if (firing.length < 2)
								firing = firing.concat(fleet.filter(unitIs(game.UnitType.Destroyer)));
							if (firing.length > 2)
								firing = firing.slice(0, 2);
							var boost = sideOptions.moraleBoost ? 1 : 0;
							return rollDice(firing, game.ThrowType.Battle, boost);
						}

						var attackerInflicted = 0;
						var defenderInflicted = 0;
						if (options.attacker.race === game.Race.Mentak)
							attackerInflicted = getInflicted(attacker, options.attacker);
						if (options.defender.race === game.Race.Mentak)
							defenderInflicted = getInflicted(defender, options.defender);
						var attackerYinFlagshipDied = applyDamage(attacker, defenderInflicted, options.attacker);
						var defenderYinFlagshipDied = applyDamage(defender, attackerInflicted, options.defender);
						if (attackerYinFlagshipDied || defenderYinFlagshipDied) {
							attacker.splice(0);
							defender.splice(0);
						}
					},
				},
				{
					name: 'Anti-Fighter Barrage',
					appliesTo: game.BattleType.Space,
					execute: function (attacker, defender, attackerFull, defenderFull, options) {

						var attackerBarrageUnits = attacker.filter(hasBarrage);
						var defenderBarrageUnits = defender.filter(hasBarrage);
						var attackerInflicted = rollDice(attackerBarrageUnits, game.ThrowType.Barrage);
						var defenderInflicted = rollDice(defenderBarrageUnits, game.ThrowType.Barrage);
						applyDamage(attacker, defenderInflicted, options.attacker, unitIs(game.UnitType.Fighter));
						applyDamage(defender, attackerInflicted, options.defender, unitIs(game.UnitType.Fighter));

						function hasBarrage(unit) {
							return unit.barrageDice !== 0;
						}
					},
				},
				{
					name: 'Bombardment',
					appliesTo: game.BattleType.Ground,
					execute: function (attacker, defender, attackerFull, defenderFull, options) {
						var bombardmentPossible = !options.defender.conventionsOfWar && (
							!defenderFull.some(unitIs(game.UnitType.PDS)) // either there are no defending PDS
							|| attackerFull.some(unitIs(game.UnitType.WarSun)) // or there are but attacking WarSuns negate their Planetary Shield
							|| options.attacker.race === game.Race.Letnev && attackerFull.some(unitIs(game.UnitType.Flagship)) // Letnev Flagship negates Planetary Shield as well
						);
						if (!bombardmentPossible) return;

						var attackerModifier = options.defender.bunker ? -4 : 0;
						var attackerInflicted = rollDice(attackerFull.filter(hasBombardment), game.ThrowType.Bombardment, attackerModifier);
						if (options.attacker.plasmaScoring) {
							attackerInflicted += fromPlasmaScoring(attackerFull, game.ThrowType.Bombardment, attackerModifier);
						}

						for (var i = defender.length - 1; 0 <= i && 0 < attackerInflicted; i--) {
							defender.splice(i, 1);
							attackerInflicted--;
						}

						function hasBombardment(unit) {
							return unit.bombardmentDice !== 0;
						}
					},
				},
				{
					name: 'Space Cannon -> Ground Forces',
					appliesTo: game.BattleType.Ground,
					execute: function (attacker, defender, attackerFull, defenderFull, options) {
						if (options.attacker.l4Disruptors) return;

						var defenderModifier = options.attacker.antimassDeflectors ? -1 : 0;
						var defenderInflicted = rollDice(defenderFull.filter(unitIs(game.UnitType.PDS)), game.ThrowType.SpaceCannon, defenderModifier);

						if (options.defender.plasmaScoring) {
							defenderInflicted += fromPlasmaScoring(defenderFull.filter(unitIs(game.UnitType.PDS)), game.ThrowType.SpaceCannon, defenderModifier);
						}
						if (options.attacker.maneuveringJets && defenderInflicted > 0)
							defenderInflicted--;

						applyDamage(attacker, defenderInflicted, options.attacker);
					},
				},
			];

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

			function fromPlasmaScoring(fleet, throwType, modifier) {
				var bestUnit = getUnitWithLowest(fleet, game.ThrowValues[throwType]);
				if (bestUnit) {
					var unitWithOneDie = bestUnit.clone();
					unitWithOneDie[game.ThrowDice[throwType]] = 1;
					return rollDice([unitWithOneDie], throwType, modifier);
				}
				return 0;
			}
		}

		function boost(battleType, round, sideOptions, fleet, opponentOptions) {
			var result = 0;
			for (var i = 0; i < boosts.length; i++) {
				var boost = boosts[i].apply(battleType, round, sideOptions, fleet, opponentOptions);
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
			return [
				{
					name: 'moraleBoost',
					apply: function (battleType, round, sideOptions) {
						return round === 1 && sideOptions.moraleBoost ? 1 : 0;
					}
				},
				{
					name: 'fighterPrototype',
					apply: function (battleType, round, sideOptions) {
						return round === 1 && battleType === game.BattleType.Space && sideOptions.fighterPrototype ?
							function (unit) {
								return unit.type === game.UnitType.Fighter ? 2 : 0;
							} : 0;
					}
				},
				{
					name: 'Sardakk',
					apply: function (battleType, round, sideOptions) {
						return sideOptions.race === game.Race.Sardakk ? 1 : 0;
					}
				},
				{
					name: 'Sardakk Flagship',
					apply: function (battleType, round, sideOptions, fleet) {
						return sideOptions.race === game.Race.Sardakk && battleType === game.BattleType.Space &&
						fleet.some(unitIs(game.UnitType.Flagship))
							? function (unit) {
								return unit.type !== game.UnitType.Flagship ? 1 : 0;
							} : 0;
					}
				},
				{
					name: 'JolNar',
					apply: function (battleType, round, sideOptions) {
						return sideOptions.race === game.Race.JolNar ? -1 : 0;
					}
				},
				{
					name: 'prophecyOfIxth',
					apply: function (battleType, round, sideOptions) {
						return sideOptions.prophecyOfIxth ?
							function (unit) {
								return unit.type === game.UnitType.Fighter ? 1 : 0;
							} : 0;
					}
				},
				{
					name: 'tekklarLegion',
					apply: function (battleType, round, sideOptions) {
						return battleType === game.BattleType.Ground && sideOptions.tekklarLegion && sideOptions.race !== game.Race.Sardakk ? 1 : 0;
					}
				},
				{
					name: 'tekklarLegion of the opponent',
					apply: function (battleType, round, sideOptions, fleet, opponentOptions) {
						return battleType === game.BattleType.Ground && opponentOptions.tekklarLegion && sideOptions.race === game.Race.Sardakk ? -1 : 0;
					}
				},
			];
		}

		function unitIs(unitType) {
			return function (unit) {
				return unit.type === unitType && !unit.isDamageGhost;
			};
		}

		function notFighterShip(unit) {
			return unit.type !== game.UnitType.Fighter && !unit.isDamageGhost;
		}

		function notFighterNorGroundForceShip(unit) {
			return unit.type !== game.UnitType.Fighter && unit.type !== game.UnitType.Ground && !unit.isDamageGhost;
		}

		function sum(a, b) {
			return a + b;
		}
	})();
})(typeof exports === 'undefined' ? window : exports);

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
			var attacker = game.expandFleet(input, game.BattleSide.attacker);
			var defender = game.expandFleet(input, game.BattleSide.defender);

			options = options || { attacker: {}, defender: {} };

			var result = new structs.EmpiricalDistribution();
			var finalAttacker = game.filterFleet(attacker, battleType, options.attacker)
				.map(function (unit) {
					return [unit.shortType];
				});
			var finalDefender = game.filterFleet(defender, battleType, options.defender)
				.map(function (unit) {
					return [unit.shortType];
				});
			for (var i = 0; i < root.imitationIterations; ++i) {
				var tmpAttacker = attacker.map(function (unit) {
					return unit.clone();
				});
				var tmpDefender = defender.map(function (unit) {
					return unit.clone();
				});
				relinkDamageGhosts(tmpAttacker, attacker);
				relinkDamageGhosts(tmpDefender, defender);

				var survivors = imitateBattle(tmpAttacker, tmpDefender, battleType, options);

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

			function relinkDamageGhosts(cloneFleet, originalFleet) {
				for (var i = 0; i < cloneFleet.length; i++) {
					var unit = cloneFleet[i];
					if (unit.isDamageGhost) {
						var corporealIndex = originalFleet.indexOf(unit.damageCorporeal);
						unit.damageCorporeal = cloneFleet[corporealIndex];
					}
				}
			}
		}

		function imitateBattle(attackerFull, defenderFull, battleType, options) {
			var attacker = game.filterFleet(attackerFull, battleType, options.attacker);
			var defender = game.filterFleet(defenderFull, battleType, options.defender);

			for (var i = 0; i < prebattleActions.length; i++) {
				var action = prebattleActions[i];
				if (action.appliesTo === battleType)
					action.execute(attacker, defender, attackerFull, defenderFull, options);
			}
			var round = 0;

			var magenDefenseActivated = battleType === game.BattleType.Ground &&
				options.defender.magenDefense &&
				defenderFull.some(unitIs(game.UnitType.PDS)) &&
				!attackerFull.some(unitIs(game.UnitType.WarSun));

			function winnuFlagships(fleet, sideOptions, opposingFleet) {
				if (battleType === game.BattleType.Space && sideOptions.race === game.Race.Winnu) {
					var battleDice = opposingFleet.filter(notFighterShip).length;
					// In the game there could be only one flagship, but why the hell not)
					fleet.filter(unitIs(game.UnitType.Flagship)).forEach(function (flagship) {
						flagship.battleDice = battleDice;
					});
				}
			}

			while (hasUnits(attacker) && hasUnits(defender)) {
				round++;
				var attackerBoost = boost(battleType, round, options.attacker, attacker);
				var defenderBoost = boost(battleType, round, options.defender, defender);
				var attackerReroll = false;
				var defenderReroll = false;
				if (round === 1) {
					attackerReroll = options.attacker.fireTeam && battleType === game.BattleType.Ground;
					defenderReroll = options.defender.fireTeam && battleType === game.BattleType.Ground
				}
				if (round === 2 && magenDefenseActivated) {
					// if Magen Defense was activated - treat the second round as the first for the attacker
					attackerBoost = boost(battleType, 1, options.attacker, attacker);
					attackerReroll = options.attacker.fireTeam && battleType === game.BattleType.Ground;
				}
				winnuFlagships(attacker, options.attacker, defender);
				winnuFlagships(defender, options.defender, attacker);
				var attackerInflicted = rollDice(attacker, game.ThrowType.Battle, attackerBoost, attackerReroll);
				var defenderInflicted = rollDice(defender, game.ThrowType.Battle, defenderBoost, defenderReroll);
				if (round === 1 && magenDefenseActivated) {
					attackerInflicted = 0;
				}

				if (battleType === game.BattleType.Ground) {
					var attackerAdditional = 0;
					var defenderAdditional = 0;
					if (options.attacker.valkyrieParticleWeave &&
						defenderInflicted > 0)
						attackerAdditional = 1;
					if (options.defender.valkyrieParticleWeave &&
						attackerInflicted > 0)
						defenderAdditional = 1;
					attackerInflicted += attackerAdditional;
					defenderInflicted += defenderAdditional;
				}

				var attackerYinFlagshipDied = applyDamage(attacker, defenderInflicted, options.attacker);
				var defenderYinFlagshipDied = applyDamage(defender, attackerInflicted, options.defender);
				if (attackerYinFlagshipDied || defenderYinFlagshipDied) {
					attacker.splice(0);
					defender.splice(0);
				}

				if (options.attacker.duraniumArmor)
					undamageUnit(attacker);
				if (options.defender.duraniumArmor)
					undamageUnit(defender);

				if (options.attacker.race === game.Race.L1Z1X && battleType === game.BattleType.Ground) { // Harrow
					prebattleActions.find(function (a) {
						return a.name === 'Bombardment';
					}).execute(attacker, defender, attackerFull, defenderFull, options);
				}
			}

			return { attacker: attacker, defender: defender };
		}

		/** returns true if Yin flagship was killed */
		function applyDamage(fleet, hits, sideOptions, hittable, softPredicate) {
			hittable = hittable || function (unit) {
				return true;
			};
			for (var i = fleet.length - 1; 0 <= i && 0 < hits; i--) {
				if (hittable(fleet[i])) {
					var killed = hit(i);
					if (sideOptions.race === game.Race.Yin && unitIs(game.UnitType.Flagship)(killed))
						return true;
				}
			}
			if (softPredicate) {
				for (var i = fleet.length - 1; 0 <= i && 0 < hits; i--) {
					hit(i);
					if (sideOptions.race === game.Race.Yin && unitIs(game.UnitType.Flagship)(killed))
						return true;
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
				var battleValue = unit[throwType + 'Value'];
				var diceCount = unit[throwType + 'Dice'];
				for (var die = 0; die < diceCount; ++die) {
					var rollResult = rollDie();
					if (unit.type === game.UnitType.Flagship && unit.race === game.Race.JolNar && 8 < rollResult)
						totalRoll += 2;
					if (battleValue <= rollResult + modifierFunction(unit))
						totalRoll++;
					else if (reroll) {
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

		function undamageUnit(fleet) {

			var somethingRepaired = false;
			for (var i = 0; i < fleet.length; i++) {
				var unit = fleet[i];
				if (unit.damaged) {
					if (unit.damagedThisRound) {
						unit.damagedThisRound = false;
					} else {
						if (!somethingRepaired) {
							var damageGhost = unit.toDamageGhost();
							// find proper place for the new damage ghost
							var index = structs.binarySearch(fleet, damageGhost, fleet.unitComparer);
							if (index < 0)
								index = -index - 1;
							fleet.splice(index, 0, damageGhost);
							somethingRepaired = true;
						}
					}
				}
			}
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

						var attackerYinFlagshipDied = applyDamage(attacker, defenderInflicted, options.attacker, gravitonLaserUnitHittable(options.defender), true);
						var defenderYinFlagshipDied = applyDamage(defender, attackerInflicted, options.defender, gravitonLaserUnitHittable(options.attacker), true);
						if (attackerYinFlagshipDied || defenderYinFlagshipDied) {
							attacker.splice(0);
							defender.splice(0);
						}

						function hasSpaceCannon(unit) {
							return unit.spaceCannonDice !== 0;
						}

						function gravitonLaserUnitHittable(sideOptions) {
							return function (unit) {
								return !(sideOptions.gravitonLaser && unit.type === game.UnitType.Fighter);
							};
						}
					},
				},
				{
					name: 'Mentak racial',
					appliesTo: game.BattleType.Space,
					execute: function (attacker, defender, attackerFull, defenderFull, options) {

						function getInflicted(fleet) {
							var firing = fleet.filter(unitIs(game.UnitType.Cruiser));
							if (firing.length < 2)
								firing = firing.concat(fleet.filter(unitIs(game.UnitType.Destroyer)));
							if (firing.length > 2)
								firing = firing.slice(0, 2);
							return rollDice(firing, game.ThrowType.Battle);
						}

						var attackerInflicted = 0;
						var defenderInflicted = 0;
						if (options.attacker.race === game.Race.Mentak)
							attackerInflicted = getInflicted(attacker);
						if (options.defender.race === game.Race.Mentak)
							defenderInflicted = getInflicted(defender);
						var attackerYinFlagshipDied = applyDamage(attacker, defenderInflicted, options.attacker);
						var defenderYinFlagshipDied = applyDamage(defender, attackerInflicted, options.defender);
						if (attackerYinFlagshipDied || defenderYinFlagshipDied) {
							attacker.splice(0);
							defender.splice(0);
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
							defenderVictim = killOffNonFighter(defender);
						if (defenderDestroys)
							attackerVictim = killOffNonFighter(attacker);
						if (options.attacker.race === game.Race.Yin && attackerVictim && unitIs(game.UnitType.Flagship)(attackerVictim) ||
							options.defender.race === game.Race.Yin && defenderVictim && unitIs(game.UnitType.Flagship)(defenderVictim)) {
							attacker.splice(0);
							defender.splice(0);
						}

						function killOffNonFighter(fleet) {
							for (var i = fleet.length - 1; i >= 0; i--) {
								var unit = fleet[i];
								if (notFighterShip(unit)) {
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
					name: 'Anti-Fighter Barrage',
					appliesTo: game.BattleType.Space,
					execute: function (attacker, defender, attackerFull, defenderFull, options) {

						var attackerBoost = options.attacker.moraleBoost ? 1 : 0;
						var defenderBoost = options.defender.moraleBoost ? 1 : 0;

						var attackerBarrageUnits = attacker.filter(hasBarrage);
						var defenderBarrageUnits = defender.filter(hasBarrage);
						var attackerInflicted = rollDice(attackerBarrageUnits, game.ThrowType.Barrage, attackerBoost);
						var defenderInflicted = rollDice(defenderBarrageUnits, game.ThrowType.Barrage, defenderBoost);
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
						var bombardmentPossible = !defenderFull.some(unitIs(game.UnitType.PDS)) // either there are no defending PDS
							|| attackerFull.some(unitIs(game.UnitType.WarSun)); // or there are but attacking WarSuns negate their Planetary Shield
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
				var bestUnit = getUnitWithLowest(fleet, throwType + 'Value');
				if (bestUnit) {
					var unitWithOneDie = bestUnit.clone();
					unitWithOneDie[throwType + 'Dice'] = 1;
					return rollDice([unitWithOneDie], throwType, modifier);
				}
				return 0;
			}
		}

		function boost(battleType, round, sideOptions, fleet) {
			var result = 0;
			for (var i = 0; i < boosts.length; i++) {
				var boost = boosts[i].apply(battleType, round, sideOptions, fleet);
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
	})();
})(typeof exports === 'undefined' ? window : exports);

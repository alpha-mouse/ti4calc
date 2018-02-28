(function () {
	if (typeof require === 'function') {
		require('./structs');
		require('./game-elements');
		require('./calculator');
	}

	globals.imitator = (function () {

		var prebattleActions = initPrebattleActions();
		var imitationIterations = 10000;

		return {
			estimateProbabilities: estimateProbabilities,
		};

		function estimateProbabilities(attacker, defender, battleType, options) {

			options = options || { attacker: {}, defender: {} };

			var result = new globals.EmpiricalDistribution();
			var finalAttacker = attacker
				.filter(globals.unitBattleFilter(battleType))
				.map(function (unit) {
					return [unit.shortType];
				});
			var finalDefender = defender
				.filter(globals.unitBattleFilter(battleType))
				.map(function (unit) {
					return [unit.shortType];
				});
			for (var i = 0; i < imitationIterations; ++i) {
				var tmpAttacker = attacker.map(function (unit) {
					return unit.clone();
				});
				var tmpDefender = defender.map(function (unit) {
					return unit.clone();
				});

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
		}

		function imitateBattle(attackerFull, defenderFull, battleType, options) {
			var attacker = attackerFull.filter(globals.unitBattleFilter(battleType));
			var defender = defenderFull.filter(globals.unitBattleFilter(battleType));

			for (var i = 0; i < prebattleActions.length; i++) {
				var action = prebattleActions[i];
				if (action.appliesTo === battleType)
					action.execute(attacker, defender, attackerFull, defenderFull, options);
			}
			var round = 0;

			while (hasUnits(attacker) && hasUnits(defender)) {
				round++;
				if (round === 1) {
				}
				var attackerInflicted = rollDice(attacker, globals.ThrowTypes.Battle);
				var defenderInflicted = rollDice(defender, globals.ThrowTypes.Battle);

				applyDamage(attacker, defenderInflicted);
				applyDamage(defender, attackerInflicted);

				//if (options.attacker.duraniumArmor)
				//	undamageUnit(attacker);
				//if (options.defender.duraniumArmor)
				//	undamageUnit(defender);
			}

			return { attacker: attacker, defender: defender };
		}

		function applyDamage(fleet, hits) {
			for (var i = 0; i < hits; i++)
				fleet.pop();
		}

		function rollDice(fleet, throwType, modifier, reroll) {
			modifier = modifier || 0;
			var totalRoll = 0;
			for (var i = 0; i < fleet.length; i++) {
				var unit = fleet[i];
				var battleValue = unit[throwType + 'Value'];
				var diceCount = unit[throwType + 'Dice'];
				for (var die = 0; die < diceCount; ++die)
					if (battleValue <= rollDie() + modifier
						|| reroll && (battleValue <= rollDie() + modifier))
						totalRoll++;
			}
			return totalRoll;
		}

		function rollDie() {
			return Math.floor(Math.random() * globals.dieSides + 1);
		}

		function hasUnits(fleet) {
			return fleet.length > 0;
		}

		function undamageUnit(fleet) {
			//todo implement
			var damageable = fleet.filter(function (unit) {
				return unit.isDamageable && !unit.isDamageGhost;
			});
			var damageGhosts = fleet.filter(function (unit) {
				return unit.isDamageGhost;
			});
			if (damageable.length > damageGhosts.length) {
				// This means that some units are damaged and can be repaired.
				// Which units exactly can be repaired is a separate question
				var damageableTypes = _.countBy(damageable, function (unit) {
					return unit.type;
				});
				var ghostTypes = _.countBy(damageGhosts, function (unit) {
					return unit.type;
				});
				for (var type in damageableTypes)
					if (damageableTypes.hasOwnProperty(type) &&
						damageableTypes[type] > (ghostTypes[type] || 0)) {
						var repairedGhost = damageable.find(function (unit) {
							return unit.type === type;
						}).toDamageGhost();
						// nooow its damage ghost should be put into proper place among other damage ghosts
						damageGhosts.push(repairedGhost);
						var sorted = calc.defaultSort(damageGhosts);
						var index = sorted.indexOf(repairedGhost);
						fleet.splice(damageable.length + index, 0, repairedGhost);
					}
			}
		}

		function initPrebattleActions() {
			return [
				{
					name: 'Space Cannon -> Ships',
					appliesTo: globals.BattleType.Space,
					execute: function (attacker, defender, attackerFull, defenderFull, options) {
						var attackerInflicted = rollDice(attackerFull.filter(hasSpaceCannon), globals.ThrowTypes.SpaceCannon);
						var defenderInflicted = rollDice(defenderFull.filter(hasSpaceCannon), globals.ThrowTypes.SpaceCannon);
						applyDamage(attacker, defenderInflicted);
						applyDamage(defender, attackerInflicted);

						function hasSpaceCannon(unit) {
							return unit.spaceCannonDice !== 0;
						}
					},
				},
				{
					name: 'Mentak racial',
					appliesTo: globals.BattleType.Space,
					execute: function (attacker, defender, attackerFull, defenderFull, options) {

						function getInflicted(fleet) {
							var firing = fleet.filter(unitIs(globals.UnitType.Cruiser));
							if (firing.length < 2)
								firing = firing.concat(fleet.filter(unitIs(globals.UnitType.Destroyer)));
							if (firing.length > 2)
								firing = firing.slice(0, 2);
							return rollDice(firing, globals.ThrowTypes.Battle);
						}

						var attackerInflicted = 0;
						var defenderInflicted = 0;
						if (options.attacker.race === 'Mentak')
							attackerInflicted = getInflicted(attacker);
						if (options.defender.race === 'Mentak')
							defenderInflicted = getInflicted(defender);
						applyDamage(attacker, defenderInflicted);
						applyDamage(defender, attackerInflicted);
					},
				},
				{
					name: 'Assault Cannon',
					appliesTo: globals.BattleType.Space,
					execute: function (attacker, defender, attackerFull, defenderFull, options) {
						// todo implement Assault Cannon

						//var attackerInflicted = options.attacker.assaultCannon ? rollDice(attacker.filter(unitIs(calc.UnitType.Dreadnought))) : 0;
						//var defenderInflicted = options.defender.assaultCannon ? rollDice(defender.filter(unitIs(calc.UnitType.Dreadnought))) : 0;
						//applyDamage(attacker, defenderInflicted);
						//applyDamage(defender, attackerInflicted);
					},
				},
				{
					name: 'Anti-Fighter Barrage',
					appliesTo: globals.BattleType.Space,
					execute: function (attacker, defender, attackerFull, defenderFull, options) {
						// todo implement barrage
						return;
						var attackerDestroyers = attacker.filter(unitIs(calc.UnitType.Destroyer));
						if (options.attacker.defenceTurret) {
							attackerDestroyers = attackerDestroyers.map(applyPlus2);
						}
						var defenderDestroyers = defender.filter(unitIs(calc.UnitType.Destroyer));
						if (options.defender.defenceTurret) {
							defenderDestroyers = defenderDestroyers.map(applyPlus2);
						}
						//each destroyer rolls two dice (three with Defence Turret tech). NB! rollDice returns random results
						var attackerInflicted = rollDice(attackerDestroyers) + rollDice(attackerDestroyers) + (options.attacker.defenceTurret ? rollDice(attackerDestroyers) : 0);
						var defenderInflicted = rollDice(defenderDestroyers) + rollDice(defenderDestroyers) + (options.defender.defenceTurret ? rollDice(defenderDestroyers) : 0);
						for (var i = attacker.length - 1; 0 <= i && 0 < defenderInflicted; i--) {
							if (attacker[i].type === calc.UnitType.Fighter) {
								attacker.splice(i, 1);
								defenderInflicted--;
							}
						}
						for (var i = defender.length - 1; 0 <= i && 0 < attackerInflicted; i--) {
							if (defender[i].type === calc.UnitType.Fighter) {
								defender.splice(i, 1);
								attackerInflicted--;
							}
						}

						function applyPlus2(destroyer) {
							return destroyer.applyModifier(2);
						}
					},
				},
				{
					name: 'Bombardment',
					appliesTo: globals.BattleType.Ground,
					execute: function (attacker, defender, attackerFull, defenderFull) {
						var bombardmentPossible = !defenderFull.some(unitIs(globals.UnitType.PDS)) // either there are no defending PDS
							|| attackerFull.some(unitIs(globals.UnitType.WarSun)); // or there are but attacking WarSuns negate their Planetary Shield
						if (!bombardmentPossible) return;

						var attackerInflicted = rollDice(attackerFull.filter(hasBombardment), globals.ThrowTypes.Bombardment);

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
					appliesTo: globals.BattleType.Ground,
					execute: function (attacker, defender, attackerFull, defenderFull, options) {
						var defenderInflicted = rollDice(defenderFull.filter(unitIs(globals.UnitType.PDS)), globals.ThrowTypes.SpaceCannon);

						for (var i = attacker.length - 1; 0 <= i && 0 < defenderInflicted; i--) {
							if (attacker[i].type === globals.UnitType.Ground) {
								attacker.splice(i, 1);
								defenderInflicted--;
							}
						}
					},
				},
			];

			function unitIs(unitType) {
				return function (unit) {
					return unit.type === unitType;
				};
			}
		}
	})();
})();

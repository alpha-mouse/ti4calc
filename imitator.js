(function (root) {

	var structs, game;
	if (typeof require === 'function') {
		structs = require('./structs');
		game = require('./game-elements');
	} else {
		structs = window;
		game = window;
	}

	root.imitator = (function () {

		var prebattleActions = initPrebattleActions();
		var imitationIterations = 10000;

		return {
			estimateProbabilities: estimateProbabilities,
		};

		function estimateProbabilities(attacker, defender, battleType, options) {

			options = options || { attacker: {}, defender: {} };

			var result = new structs.EmpiricalDistribution();
			var finalAttacker = attacker
				.filter(game.unitBattleFilter(battleType))
				.map(function (unit) {
					return [unit.shortType];
				});
			var finalDefender = defender
				.filter(game.unitBattleFilter(battleType))
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
			var attacker = attackerFull.filter(game.unitBattleFilter(battleType));
			var defender = defenderFull.filter(game.unitBattleFilter(battleType));

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
				var attackerInflicted = rollDice(attacker, game.ThrowTypes.Battle);
				var defenderInflicted = rollDice(defender, game.ThrowTypes.Battle);

				applyDamage(attacker, defenderInflicted);
				applyDamage(defender, attackerInflicted);

				//if (options.attacker.duraniumArmor)
				//	undamageUnit(attacker);
				//if (options.defender.duraniumArmor)
				//	undamageUnit(defender);
			}

			return { attacker: attacker, defender: defender };
		}

		function applyDamage(fleet, hits, hittable) {
			hittable = hittable || function (unit) {
					return true;
				};
			for (var i = fleet.length - 1; 0 <= i && 0 < hits; i--) {
				if (hittable(fleet[i])) {
					fleet.splice(i, 1);
					hits--;
				}
			}
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
			return Math.floor(Math.random() * game.dieSides + 1);
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
					appliesTo: game.BattleType.Space,
					execute: function (attacker, defender, attackerFull, defenderFull, options) {
						var attackerModifier = options.defender.antimassDeflectors ? -1 : 0;
						var attackerInflicted = rollDice(attackerFull.filter(hasSpaceCannon), game.ThrowTypes.SpaceCannon, attackerModifier);
						var defenderModifier = options.attacker.antimassDeflectors ? -1 : 0;
						var defenderInflicted = rollDice(defenderFull.filter(hasSpaceCannon), game.ThrowTypes.SpaceCannon, defenderModifier);
						applyDamage(attacker, defenderInflicted, gravitonLaserUnitHittable(options.defender));
						applyDamage(defender, attackerInflicted, gravitonLaserUnitHittable(options.attacker));

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
							return rollDice(firing, game.ThrowTypes.Battle);
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
					appliesTo: game.BattleType.Space,
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
					appliesTo: game.BattleType.Space,
					execute: function (attacker, defender) {
						var attackerBarrageUnits = attacker.filter(hasBarrage);
						var defenderBarrageUnits = defender.filter(hasBarrage);
						var attackerInflicted = rollDice(attackerBarrageUnits, game.ThrowTypes.Barrage);
						var defenderInflicted = rollDice(defenderBarrageUnits, game.ThrowTypes.Barrage);
						applyDamage(attacker, defenderInflicted, unitIs(game.UnitType.Fighter));
						applyDamage(defender, attackerInflicted, unitIs(game.UnitType.Fighter));

						function hasBarrage(unit) {
							return unit.barrageDice !== 0;
						}
					},
				},
				{
					name: 'Bombardment',
					appliesTo: game.BattleType.Ground,
					execute: function (attacker, defender, attackerFull, defenderFull) {
						var bombardmentPossible = !defenderFull.some(unitIs(game.UnitType.PDS)) // either there are no defending PDS
							|| attackerFull.some(unitIs(game.UnitType.WarSun)); // or there are but attacking WarSuns negate their Planetary Shield
						if (!bombardmentPossible) return;

						var attackerInflicted = rollDice(attackerFull.filter(hasBombardment), game.ThrowTypes.Bombardment);

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
						var defenderModifier = options.attacker.antimassDeflectors ? -1 : 0;
						var defenderInflicted = rollDice(defenderFull.filter(unitIs(game.UnitType.PDS)), game.ThrowTypes.SpaceCannon, defenderModifier);

						for (var i = attacker.length - 1; 0 <= i && 0 < defenderInflicted; i--) {
							if (attacker[i].type === game.UnitType.Ground) {
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
})(typeof exports === 'undefined' ? window : exports);

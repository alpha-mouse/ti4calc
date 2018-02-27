if (typeof require === "function")
	var calculatorPackage = require("./calculator");
else
	var calculatorPackage = exports;
var calc = calculatorPackage.calculator;

var createEmpiricalProbabilities = function () {
	var min, max;

	var result = Object.create(calculatorPackage.distributionBase);

	//increment count at index
	result.increment = function (index) {
		this[index] = this.at(index) + 1;
		if (min === undefined)
			min = index;
		else if (index < min)
			min = index;

		if (max === undefined)
			max = index;
		else if (max < index)
			max = index;
	};

	//convert counts to probabilities
	result.normalize = function () {
		var sum = 0;
		for (var i = min; i <= max; ++i)
			sum += this.at(i);
		sum += this.deadlock || 0;
		if (sum != 0)
			for (var i = min; i <= max; ++i)
				this[i] = this.at(i) / sum;
		if (this.deadlock)
			this.deadlock = this.deadlock / sum;
	};

	result.min = function() {
		return Math.min(0, min || 0);
	};

	result.max = function() {
		return Math.max(max || 0, 0);
	};

	return result;
};

var Imitator = function () {
	var im = this;

	this.imitationIterations = 10000;

	this.imitateBattle = function (attackerFull, defenderFull, battleType, options) {
		options = options || {attacker:{},defender:{}};
		var attacker = attackerFull.filter(function (unit) { return calc.belongsToBattle(unit, battleType, options.attacker.gravitonNegator); });
		var defender = defenderFull.filter(function (unit) { return calc.belongsToBattle(unit, battleType); });

		for (var i = 0; i < prebattleActions.length; i++) {
			var action = prebattleActions[i];
			if (action.appliesTo === battleType)
				action.execute(attacker, defender, attackerFull, defenderFull, options);
		}
		var round = 0;

		while (hasUnits(attacker) && hasUnits(defender)) {
			round++;
			var attackerBoost = 0;
			var defenderBoost = 0;
			if (round === 1){
				attackerBoost += options.attacker.moraleBoost1 ? 1 : 0;
				defenderBoost += options.defender.moraleBoost1 ? 1 : 0;
				attackerBoost -= options.defender.xxcha ? 1 : 0;
				defenderBoost -= options.attacker.xxcha ? 1 : 0;
			}
			var attackerInflicted = rollDice(attacker, attackerBoost, false, options.attacker.admiral);
			var defenderInflicted = rollDice(defender, defenderBoost, false, options.defender.admiral);

			if (// both sides have Duranium Armor
				options.attacker.duraniumArmor && options.defender.duraniumArmor &&
				// and both of them have one repairable ship left
				attacker.length === 2 && defender.length === 2 &&
				attacker[1].isDamageGhost && defender[1].isDamageGhost &&
				// but both cannot inflict more than one damage
				attacker[0].diceRolled === 1 && options.attacker.admiral !== attacker[0].type &&
				defender[0].diceRolled === 1 && options.defender.admiral !== defender[0].type
				){
				// deadlock detected
				return { deadlock: true };
			}
			
			applyDamage(attacker, defenderInflicted, options.attacker.duraniumArmor);
			applyDamage(defender, attackerInflicted, options.defender.duraniumArmor);

			if (options.attacker.duraniumArmor)
				undamageUnit(attacker);
			if (options.defender.duraniumArmor)
				undamageUnit(defender);
		}

		return { attacker: attacker, defender: defender };
	};

	this.estimateProbabilities = function (attacker, defender, battleType, options) {
		options = options || {attacker:{},defender:{}};
		var result = createEmpiricalProbabilities();
		var finalAttacker = attacker
			.filter(function (unit) { return calc.belongsToBattle(unit, battleType, options.attacker.gravitonNegator); })
			.map(function(unit){return [unit.shortType()];});
		var finalDefender = defender
			.filter(function (unit) { return calc.belongsToBattle(unit, battleType); })
			.map(function(unit){return [unit.shortType()];});
		for (var i = 0; i < im.imitationIterations; ++i) {
			var tmpAttacker = attacker.map(function (unit) { return unit.clone(); });
			var tmpDefender = defender.map(function (unit) { return unit.clone(); });

			var survivors = im.imitateBattle(tmpAttacker, tmpDefender, battleType, options);

			if (survivors.deadlock)
				result.deadlock = (result.deadlock || 0) + 1;
			else if (survivors.attacker.length !== 0) {
				result.increment(-survivors.attacker.length);
				for (var a = 0; a < survivors.attacker.length; a++){
					if (!finalAttacker[a])
						finalAttacker[a] = [];
					if (finalAttacker[a].indexOf(survivors.attacker[a].shortType())<0)
						finalAttacker[a].push(survivors.attacker[a].shortType());
				}
			} else if (survivors.defender.length !== 0) {
				result.increment(survivors.defender.length);
				for (var d = 0; d < survivors.defender.length; d++){
					if (!finalDefender[d])
						finalDefender[d] = [];
					if (finalDefender[d].indexOf(survivors.defender[d].shortType())<0)
						finalDefender[d].push(survivors.defender[d].shortType());
				}
			} else
				result.increment(0);
		}
		result.normalize();

		return {
			distribution: result,
			attacker: finalAttacker.map(function(set){return set.reduce(function (prev, item){return prev + item; });}),
			defender: finalDefender.map(function(set){return set.reduce(function (prev, item){return prev + item; });})
		};
	};

	var applyDamage = function (fleet, hits) {
		//for (var i = 0; i < fleet.length && hits > 0; i++) {
		//	if (fleet[i].isDamageable && !fleet[i].isDamaged) {
		//		fleet[i].isDamaged = true;
		//		hits--;
		//	}
		//}

		for (var i = 0; i < hits; i++)
			fleet.pop();
	};

	var rollDice = function (fleet, boost, reroll, admiral) {
		var processedAdmiral = false;
		boost = boost || 0;
		var totalRoll = 0;
		for (var i = 0; i < fleet.length; i++) {
			var unit = fleet[i];
			var isAdmiral = !processedAdmiral && admiral === unit.type;
			for (var die = 0; die < unit.diceRolled + (isAdmiral ? 1 : 0); ++die)
				if (unit.dmgDice <= rollDie() + boost
					|| reroll && (unit.dmgDice <= rollDie() + boost))
					totalRoll++;
			processedAdmiral |= isAdmiral;
		}
		return totalRoll;
	};

	var rollDie = function () {
		return Math.floor(Math.random() * calc.dieSides() + 1);
	};

	var hasUnits = function (fleet) {
		//return _.any(fleet, function (unit) { return belongsToBattle(unit, battleType); });
		return fleet.length > 0;
	};

	var unitIs = function(unitType) {
		return function(unit) {
			return unit.type === unitType;
		};
	};

	var undamageUnit = function (fleet) {
		var damageable = fleet.filter(function (unit) {
			return unit.isDamageable && !unit.isDamageGhost;
		});
		var damageGhosts = fleet.filter(function (unit) {
			return unit.isDamageGhost;
		});
		if (damageable.length > damageGhosts.length) {
			// This means that some units are damaged and can be repaired.
			// Which units exactly can be repaired is a separate question
			#error rewrite
			var damageableTypes = _.countBy(damageable, function (unit) {return unit.type});
			var ghostTypes = _.countBy(damageGhosts, function (unit) {return unit.type});
			for (var type in damageableTypes)
				if (damageableTypes.hasOwnProperty(type) &&
					damageableTypes[type] > (ghostTypes[type] || 0)) {
					var repairedGhost = damageable.find(function (unit) { return unit.type === type; }).toDamageGhost();
					// nooow its damage ghost should be put into proper place among other damage ghosts
					damageGhosts.push(repairedGhost);
					var sorted = calc.defaultSort(damageGhosts);
					var index = sorted.indexOf(repairedGhost);
					fleet.splice(damageable.length + index, 0, repairedGhost);
				}
		}
	};

	var prebattleActions = [
		{
			name: "pds -> ships",
			appliesTo: calc.BattleType.Space,
			execute: function (attacker, defender, attackerFull, defenderFull, options) {
				var attackerInflicted = rollDice(attackerFull.filter(unitIs(calc.UnitType.PDS)), 0, options.attacker.gravitonLaser);
				var defenderInflicted = rollDice(defenderFull.filter(unitIs(calc.UnitType.PDS)), 0, options.defender.gravitonLaser);
				applyDamage(attacker, defenderInflicted);
				applyDamage(defender, attackerInflicted);
			}
		},
		{
			name: "mentak racial",
			appliesTo: calc.BattleType.Space,
			execute: function (attacker, defender, attackerFull, defenderFull, options) {

				var getInflicted = function(fleet){
					var firing = fleet.filter(unitIs(calc.UnitType.Cruiser));
					if (firing.length < 2)
						firing = firing.concat(fleet.filter(unitIs(calc.UnitType.Destroyer)));
					if (firing.length > 2)
						firing = firing.slice(0,2);
					return rollDice(firing);
				};
				var attackerInflicted = 0;
				var defenderInflicted = 0;
				if (options.attacker.mentak)
					attackerInflicted = getInflicted(attacker);
				if (options.defender.mentak)
					defenderInflicted = getInflicted(defender);
				applyDamage(attacker, defenderInflicted);
				applyDamage(defender, attackerInflicted);
			}
		},
		{
			name: "assault cannon",
			appliesTo: calc.BattleType.Space,
			execute: function (attacker, defender, attackerFull, defenderFull, options) {

				var attackerInflicted = options.attacker.assaultCannon ? rollDice(attacker.filter(unitIs(calc.UnitType.Dreadnought))) : 0;
				var defenderInflicted = options.defender.assaultCannon ? rollDice(defender.filter(unitIs(calc.UnitType.Dreadnought))) : 0;
				applyDamage(attacker, defenderInflicted);
				applyDamage(defender, attackerInflicted);
			}
		},
		{
			name: "anti-fighter barrage",
			appliesTo: calc.BattleType.Space,
			execute: function (attacker, defender, attackerFull, defenderFull, options) {
				var attackerDestroyers = attacker.filter(unitIs(calc.UnitType.Destroyer));
				if (options.attacker.defenceTurret) {
					attackerDestroyers = attackerDestroyers.map(applyPlus2);
				}
				var defenderDestroyers = defender.filter(unitIs(calc.UnitType.Destroyer));
				if (options.defender.defenceTurret) {
					defenderDestroyers = defenderDestroyers.map(applyPlus2);
				}
				//each destroyer rolls two dice (three with Defence Turret tech). NB! rollDice returns random results
				var attackerInflicted = rollDice(attackerDestroyers) + rollDice(attackerDestroyers) + (options.attacker.defenceTurret ? rollDice(attackerDestroyers): 0);
				var defenderInflicted = rollDice(defenderDestroyers) + rollDice(defenderDestroyers) + (options.defender.defenceTurret ? rollDice(defenderDestroyers): 0);
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
			}
		},
		{
			name: "pds -> ground forces",
			appliesTo: calc.BattleType.Ground,
			execute: function (attacker, defender, attackerFull, defenderFull, options) {
				var defenderInflicted = rollDice(defenderFull.filter(unitIs(calc.UnitType.PDS)), 0, options.defender.gravitonLaser);

				for (var i = attacker.length - 1; 0 <= i && 0 < defenderInflicted; i--) {
					if (attacker[i].type === calc.UnitType.Ground) {
						attacker.splice(i, 1);
						defenderInflicted--;
					}
				}
			}
		},
		{
			name: "WarSun bombardment",
			appliesTo: calc.BattleType.Ground,
			execute: function (attacker, defender, attackerFull, defenderFull) {
				var attackerInflicted = rollDice(attackerFull.filter(unitIs(calc.UnitType.WarSun)));

				for (var i = defender.length - 1; 0 <= i && 0 < attackerInflicted; i--) {
					if (defender[i].type === calc.UnitType.Ground) {
						defender.splice(i, 1);
						attackerInflicted--;
					}
				}
			}
		},
		{
			name: "Dreadnought bombardment",
			appliesTo: calc.BattleType.Ground,
			execute: function (attacker, defender, attackerFull, defenderFull, options) {

				if (!attackerFull.some(unitIs(calc.UnitType.Dreadnought))) return; //if no dreadnaughts no bombardment
				if (!attackerFull.some(unitIs(calc.UnitType.Ground)) && !_.any(attackerFull, unitIs(calc.UnitType.Mech))) return  //if no ground forces & no mechs no bombardment
				if (!defenderFull.some(unitIs(calc.UnitType.Ground))) return; //if no defending ground forces no bombardment as mechs immune
				if (defenderFull.some(unitIs(calc.UnitType.PDS)) && !options.attacker.gravitonNegator) return; //dreadnoughts do not bombard over PDS. unless Graviton Negator

				var attackerInflicted = rollDice(attackerFull.filter(unitIs(calc.UnitType.Dreadnought)));

				for (var i = defender.length - 1; 0 <= i && 0 < attackerInflicted; i--) {
					if (defender[i].type === calc.UnitType.Ground) {
						defender.splice(i, 1);
						attackerInflicted--;
					}
				}
			}
		}
	];
};


//----- EXPORTS ----
if (!exports)
	exports = {};

exports.imitator = new Imitator();
exports.createEmpiricalProbabilities = createEmpiricalProbabilities;

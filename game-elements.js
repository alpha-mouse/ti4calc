if (typeof globals === 'undefined')
	globals = {};

globals.dieSides = 10;

globals.BattleType = {
	Space: 'Space',
	Ground: 'Ground',
};

var UnitType = {
	Flagship: 'Flagship',
	WarSun: 'WarSun',
	Dreadnought: 'Dreadnought',
	Cruiser: 'Cruiser',
	Destroyer: 'Destroyer',
	Carrier: 'Carrier',
	Fighter: 'Fighter',
	PDS: 'PDS',
	Infantry: 'Infantry',
};

globals.UnitType = UnitType;

globals.ShortUnitType = {
	Flagship: 'X',
	WarSun: 'W',
	Dreadnought: 'D',
	Cruiser: 'C',
	Destroyer: '+',
	Carrier: 'V',
	Fighter: 'F',
	PDS: 'P',
	Infantry: 'I',
};

globals.Races = {
	Sardakk: 'Sardakk N\'orr',
	JolNar: 'Jol-Nar',
	Winnu: 'Winnu',
	Xxcha: 'Xxcha',
	Yin: 'Yin',
	Yssaril: 'Yssaril',
	Sol: 'Sol',
	Creuss: 'Creuss',
	L1z1x: 'L1Z1X',
	Mentak: 'Mentak',
	Naalu: 'Naalu',
	Virus: 'Nekro Virus',
	Arborec: 'Arborec',
	Letnev: 'Letnev',
	Saar: 'Saar',
	Muaat: 'Muaat',
	Hacan: 'Hacan',
};

function Option(title, description) {
	this.title = title;
	this.description = description;
}

globals.ActionCards = {
	moraleBoost: new Option('Morale Boost 1st round', '+1 dice modifier to all units during the first battle round'),
	fireTeam: new Option('Fire team 1st round', 'Reroll dice after first round of invasion combat'),
	fighterPrototype: new Option('Fighter prototype', '+2 dice modifier to Fighters during the first battle round'),
	bunker: new Option('Bunker', '-4 dice modifier to Bombardment rolls'),
	emergencyRepairs: new Option('Emergency Repairs', 'Repair damaged units КОГДА БЛИН'),
	riskDirectHit: new Option('Risk direct hit', 'Damage units vulnerable to Direct Hit before killing off fodder'),

	shieldsHolding: new Option('to hell with it', ''),
	experimentalBattlestation: new Option('to hell with it', ''),
	courageous: new Option('to hell with it', ''),
};

globals.Technologies = {
	antimassDeflectors: new Option('Antimass Deflectors', '-1 to opponents Space Cannon rolls'),
	gravitonLaser: new Option('Graviton Laser System', 'Space Cannon hits should be applied to non-fighters if possible'),
	plasmeScoring: new Option('Plasma Scoring', 'One additional die for one unit during Space Cannon or Bombardment'),
	magenDefense: new Option('Magen Defense Grid', 'Opponent doesn\'t throw dice for one round if you have Planetary Shield'),
	duraniumArmor: new Option('Duranium Armor', 'After each round repair 1 unit that wasn\'t damaged this round'),
	assaultCannon: new Option('Assault Cannon', 'Opponent destroys 1 non-Fighter ship if you have at least 3 non-Fighters'),
};

globals.UnitInfo = (function () {

	function UnitInfo(type, stats) {

		Object.assign(this, {
			type: type,
			sustainDamageHits: 0,

			battleValue: NaN,
			battleDice: 1,

			bombardmentValue: NaN,
			bombardmentDice: 0,

			spaceCannonValue: NaN,
			spaceCannonDice: 0,

			barrageValue: NaN,
			barrageDice: 0,

			isDamageGhost: false,
		}, stats);

		var shortType = globals.ShortUnitType[this.type];
		this.shortType = this.isDamageGhost ? shortType.toLowerCase() : shortType;
	}

	UnitInfo.prototype.clone = function () {
		return new UnitInfo(this.type, this);
	};

	//create damage ghost for damageable units
	UnitInfo.prototype.toDamageGhost = function () {
		return new UnitInfo(this.type, {
			sustainDamageHits: this.sustainDamageHits,
			battleDice: 0,
			isDamageGhost: true,
		});
	};

	return UnitInfo;
})();

/** These correspond to fields of UnitInfo, like 'battleValue', 'bombardmentValue' etc. */
globals.ThrowTypes = {
	Battle: 'battle',
	Bombardment: 'bombardment',
	SpaceCannon: 'spaceCannon',
	Barrage: 'barrage',
};

globals.StandardUnits = {
	WarSun: new globals.UnitInfo(UnitType.WarSun, {
		sustainDamageHits: 1,
		battleValue: 3,
		battleDice: 3,
		bombardmentValue: 3,
		bombardmentDice: 3,
	}),
	Dreadnought: new globals.UnitInfo(UnitType.Dreadnought, {
		sustainDamageHits: 1,
		battleValue: 5,
		bombardmentValue: 5,
		bombardmentDice: 1,
	}),
	Cruiser: new globals.UnitInfo(UnitType.Cruiser, {
		battleValue: 7,
	}),
	Destroyer: new globals.UnitInfo(UnitType.Destroyer, {
		battleValue: 9,
		barrageValue: 9,
		barrageDice: 2,
	}),
	Carrier: new globals.UnitInfo(UnitType.Carrier, {
		battleValue: 9,
	}),
	Fighter: new globals.UnitInfo(UnitType.Fighter, {
		battleValue: 9,
	}),
	PDS: new globals.UnitInfo(UnitType.PDS, {
		spaceCannonValue: 6,
		spaceCannonDice: 1,
	}),
	Infantry: new globals.UnitInfo(UnitType.Infantry, {
		battleValue: 8,
	}),
};

globals.RaceSpecificUnits = {
	Sardakk: {
		Flagship: new globals.UnitInfo(UnitType.Flagship, {
			sustainDamageHits: 1,
			battleValue: 6, //todo special racial ability
			battleDice: 2,
		}),
		Dreadnought: new globals.UnitInfo(UnitType.Dreadnought, {
			sustainDamageHits: 1,
			battleValue: 5,
			bombardmentValue: 4,
			bombardmentDice: 2,
		}),
	},
	JolNar: {
		Flagship: new globals.UnitInfo(UnitType.Flagship, {
			sustainDamageHits: 1,
			battleValue: 6, //todo special racial ability
			battleDice: 2,
		}),
	},
	Winnu: {
		Flagship: new globals.UnitInfo(UnitType.Flagship, {
			sustainDamageHits: 1,
			battleValue: 7, //todo special racial ability
			battleDice: undefined,
		}),
	},
	Xxcha: {
		Flagship: new globals.UnitInfo(UnitType.Flagship, {
			sustainDamageHits: 1,
			battleValue: 7,
			battleDice: 2,
			spaceCannonValue: 5,
			spaceCannonDice: 3,
		}),
	},
	Yin: {
		Flagship: new globals.UnitInfo(UnitType.Flagship, {
			sustainDamageHits: 1,
			battleValue: 9, //todo special racial ability
			battleDice: 2,
		}),
	},
	Yssaril: {
		Flagship: new globals.UnitInfo(UnitType.Flagship, {
			sustainDamageHits: 1,
			battleValue: 5,
			battleDice: 2,
		}),
	},
	Sol: {
		Flagship: new globals.UnitInfo(UnitType.Flagship, {
			sustainDamageHits: 1,
			battleValue: 5,
			battleDice: 2,
		}),
		Infantry: new globals.UnitInfo(UnitType.Infantry, {
			battleValue: 7,
		}),
	},
	Creuss: {
		Flagship: new globals.UnitInfo(UnitType.Flagship, {
			sustainDamageHits: 1,
			battleValue: 5,
			battleDice: 1,
		}),
	},
	L1z1x: {
		Flagship: new globals.UnitInfo(UnitType.Flagship, {
			sustainDamageHits: 1,
			battleValue: 5, //todo special racial ability
			battleDice: 2,
		}),
	},
	Mentak: {
		Flagship: new globals.UnitInfo(UnitType.Flagship, {
			sustainDamageHits: 1,
			battleValue: 7, //todo special racial ability
			battleDice: 2,
		}),
	},
	Naalu: {
		Flagship: new globals.UnitInfo(UnitType.Flagship, {
			sustainDamageHits: 1,
			battleValue: 9, //todo special racial ability
			battleDice: 2,
		}),
		Fighter: new globals.UnitInfo(UnitType.Fighter, {
			battleValue: 8,
		}),
	},
	Virus: {
		Flagship: new globals.UnitInfo(UnitType.Flagship, {
			sustainDamageHits: 1,
			battleValue: 9, //todo special racial ability
			battleDice: 2,
		}),
	},
	Arborec: {
		Flagship: new globals.UnitInfo(UnitType.Flagship, {
			sustainDamageHits: 1,
			battleValue: 7,
			battleDice: 2,
		}),
	},
	Letnev: {
		Flagship: new globals.UnitInfo(UnitType.Flagship, {
			sustainDamageHits: 1,
			battleValue: 5, //todo special racial ability
			battleDice: 2,
			bombardmentValue: 5,
			bombardmentDice: 3,
		}),
	},
	Saar: {
		Flagship: new globals.UnitInfo(UnitType.Flagship, {
			sustainDamageHits: 1,
			battleValue: 5,
			battleDice: 2,
			barrageValue: 6,
			barrageDice: 4,
		}),
	},
	Muaat: {
		Flagship: new globals.UnitInfo(UnitType.Flagship, {
			sustainDamageHits: 1,
			battleValue: 5,
			battleDice: 2,
		}),
	},
	Hacan: {
		Flagship: new globals.UnitInfo(UnitType.Flagship, {
			sustainDamageHits: 1,
			battleValue: 7, //todo special racial ability
			battleDice: 2,
		}),
	},
};

globals.StandardUpgrades = {
	Cruiser: new globals.UnitInfo(UnitType.Cruiser, {
		battleValue: 6,
	}),
	Destroyer: new globals.UnitInfo(UnitType.Destroyer, {
		battleValue: 8,
		barrageValue: 6,
		barrageDice: 3,
	}),
	Fighter: new globals.UnitInfo(UnitType.Fighter, {
		battleValue: 8,
	}),
	PDS: new globals.UnitInfo(UnitType.PDS, {
		spaceCannonValue: 5,
		spaceCannonDice: 1,
	}),
	Infantry: new globals.UnitInfo(UnitType.Infantry, {
		battleValue: 7,
	}),
};

globals.RaceSpecificUpgrades = {
	Sol: {
		Infantry: new globals.UnitInfo(UnitType.Infantry, {
			battleValue: 6,
		}),
		Carrier: new globals.UnitInfo(UnitType.Carrier, {
			sustainDamageHits: 1,
			battleValue: 9,
		}),
	},
	L1z1x: {
		Dreadnought: new globals.UnitInfo(UnitType.Dreadnought, {
			sustainDamageHits: 1,
			battleValue: 4,
			bombardmentValue: 4,
			bombardmentDice: 1,
		}),
	},
	Naalu: {
		Fighter: new globals.UnitInfo(UnitType.Fighter, {
			battleValue: 7,
		}),
	},
};

/** Make an array of units in their reversed order of dying
 * @param {string} race - one of 'Sardakk', 'JolNar', etc.
 * @param {object} counters - object of the form
 *     { Flagship: { count: 0, upgraded: false },
 *       ..
 *       Cruiser: { count: 3, upgraded: true }
 *       ..
 *     }
 */
globals.expandFleet = function (race, counters) {

	var standardUnits = Object.assign({}, globals.StandardUnits, globals.RaceSpecificUnits[race]);
	var upgradedUnits = Object.assign({}, globals.StandardUpgrades, globals.RaceSpecificUpgrades[race]);
	var result = [];
	var damageGhosts = [];
	for (var unitType in UnitType) {
		var counter = counters[unitType] || { count: 0 };
		for (var i = 0; i < counter.count; i++) {
			var unit = (counter.upgraded ? upgradedUnits : standardUnits)[unitType];
			result.push(unit.clone());
			if (unit.sustainDamageHits > 0) {
				damageGhosts.push(unit.toDamageGhost());
			}
		}
	}
	return result.concat(damageGhosts);
};

/** Check whether the unit can receive hits in the specific battle type. E.g. Infantry doesn't receive hits in Space Battle */
globals.belongsToBattle = function (unit, battleType) {

	var ships = [
		UnitType.Flagship,
		UnitType.WarSun,
		UnitType.Dreadnought,
		UnitType.Cruiser,
		UnitType.Destroyer,
		UnitType.Carrier,
		UnitType.Fighter,
	];

	if (battleType === globals.BattleType.Space)
		return ships.indexOf(unit.type) >= 0;
	else //battleType === globals.BattleType.Ground
		return unit.type === UnitType.Infantry;
};

globals.unitBattleFilter = function (battleType) {
	return function (unit) {
		return globals.belongsToBattle(unit, battleType);
	};
};

//todo check all racial abilities
//todo Sardakk Valkyrie tech
//todo Sardakk Tekklar promisory
//todo Mentak racial take into account when estimating Direct Hit
//todo How the hell to take Nekro racial tech taking into account
//todo Letnev promisary
//todo Letnev Non-Euclidean Shielding
//todo Letnev L4 disruptors
//todo Sardakk racial
//todo Yin Brotherhood racial abilities ignored
//todo JolNar racial
//todo L1Z1X racial Harrow

//todo Letnev racial
//todo generic tech
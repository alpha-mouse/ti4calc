if (typeof globals === 'undefined')
	globals = {};

globals.dieSides = 10;

globals.BattleType = {
	Space: 'Space',
	Ground: 'Ground',
};

var UnitType = {
	Flagship: 'Flagship',
	WarSun: 'Warsun',
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
	Warsun: 'W',
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

globals.UnitInfo = (function () {

	function UnitInfo(type, stats) {

		Object.assign(this, {
			type: type,
			sustainDamageHits: 0,

			battleValue: NaN,
			battleDice: 1,

			bombardmentBattleValue: NaN,
			bombardmentDice: 0,

			spaceCannonBattleValue: NaN,
			spaceCannonDice: 0,

			barrageBattleValue: NaN,
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
			sustainDamageHits: 0,
			battleDice: 0,
			isDamageGhost: true,
		});
	};

	return UnitInfo;
})();

globals.StandardUnits = {
	Warsun: new globals.UnitInfo(UnitType.Warsun,  {
		sustainDamageHits: 1,
		battleValue: 3,
		battleDice: 3,
		bombardmentBattleValue: 3,
		bombardmentDice: 3,
	}),
	Dreadnought: new globals.UnitInfo(UnitType.Dreadnought, {
		sustainDamageHits: 1,
		battleValue: 5,
		bombardmentBattleValue: 5,
		bombardmentDice: 1,
	}),
	Cruiser: new globals.UnitInfo(UnitType.Cruiser, {
		battleValue: 7,
	}),
	Destroyer: new globals.UnitInfo(UnitType.Destroyer, {
		battleValue: 9,
		barrageBattleValue: 9,
		barrageDice: 2,
	}),
	Carrier: new globals.UnitInfo(UnitType.Carrier, {
		battleValue: 9,
	}),
	Fighter: new globals.UnitInfo(UnitType.Fighter, {
		battleValue: 9,
	}),
	PDS : new globals.UnitInfo(UnitType.PDS, {
		spaceCannonBattleValue: 6,
		spaceCannonDice: 1,
	}),
	Infantry: new globals.UnitInfo(UnitType.Infantry, {
		battleValue: 8,
	}),
};

globals.RaceSpecificUnits = {
	Sardakk: {
		Flagship: new globals.UnitInfo({
			sustainDamageHits: 1,
			battleValue: 6, //todo special racial ability
			battleDice: 2,
		}),
		Dreadnought: new globals.UnitInfo(UnitType.Dreadnought, {
			sustainDamageHits: 1,
			battleValue: 5,
			bombardmentBattleValue: 4,
			bombardmentDice: 2,
		}),
	},
	JolNar: {
		Flagship: new globals.UnitInfo({
			sustainDamageHits: 1,
			battleValue: 6, //todo special racial ability
			battleDice: 2,
		}),
	},
	Winnu: {
		Flagship: new globals.UnitInfo({
			sustainDamageHits: 1,
			battleValue: 7, //todo special racial ability
			battleDice: undefined,
		}),
	},
	Xxcha: {
		Flagship: new globals.UnitInfo({
			sustainDamageHits: 1,
			battleValue: 7,
			battleDice: 2,
			spaceCannonBattleValue: 5,
			spaceCannonDice: 3,
		}),
	},
	Yin: {
		Flagship: new globals.UnitInfo({
			sustainDamageHits: 1,
			battleValue: 9, //todo special racial ability
			battleDice: 2,
		}),
	},
	Yssaril: {
		Flagship: new globals.UnitInfo({
			sustainDamageHits: 1,
			battleValue: 5,
			battleDice: 2,
		}),
	},
	Sol: {
		Flagship: new globals.UnitInfo({
			sustainDamageHits: 1,
			battleValue: 5,
			battleDice: 2,
		}),
		Infantry: new globals.UnitInfo(UnitType.Infantry, {
			battleValue: 7,
		}),
	},
	Creuss: {
		Flagship: new globals.UnitInfo({
			sustainDamageHits: 1,
			battleValue: 5,
			battleDice: 1,
		}),
	},
	L1z1x: {
		Flagship: new globals.UnitInfo({
			sustainDamageHits: 1,
			battleValue: 5, //todo special racial ability
			battleDice: 2,
		}),
	},
	Mentak: {
		Flagship: new globals.UnitInfo({
			sustainDamageHits: 1,
			battleValue: 7, //todo special racial ability
			battleDice: 2,
		}),
	},
	Naalu: {
		Flagship: new globals.UnitInfo({
			sustainDamageHits: 1,
			battleValue: 9, //todo special racial ability
			battleDice: 2,
		}),
		Fighter: new globals.UnitInfo(UnitType.Fighter, {
			battleValue: 8,
		}),
	},
	Virus: {
		Flagship: new globals.UnitInfo({
			sustainDamageHits: 1,
			battleValue: 9, //todo special racial ability
			battleDice: 2,
		}),
	},
	Arborec: {
		Flagship: new globals.UnitInfo({
			sustainDamageHits: 1,
			battleValue: 7,
			battleDice: 2,
		}),
	},
	Letnev: {
		Flagship: new globals.UnitInfo({
			sustainDamageHits: 1,
			battleValue: 5, //todo special racial ability
			battleDice: 2,
			bombardmentBattleValue: 5,
			bombardmentDice: 3,
		}),
	},
	Saar: {
		Flagship: new globals.UnitInfo({
			sustainDamageHits: 1,
			battleValue: 5,
			battleDice: 2,
			barrageBattleValue: 6,
			barrageDice: 4,
		}),
	},
	Muaat: {
		Flagship: new globals.UnitInfo({
			sustainDamageHits: 1,
			battleValue: 5,
			battleDice: 2,
		}),
	},
	Hacan: {
		Flagship: new globals.UnitInfo({
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
		barrageBattleValue: 6,
		barrageDice: 3,
	}),
	Fighter: new globals.UnitInfo(UnitType.Fighter, {
		battleValue: 8,
	}),
	PDS : new globals.UnitInfo(UnitType.PDS, {
		spaceCannonBattleValue: 5,
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
			bombardmentBattleValue: 4,
			bombardmentDice: 1,
		}),
	},
	Naalu: {
		Fighter: new globals.UnitInfo(UnitType.Fighter, {
			battleValue: 7,
		}),
	},
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
//todo Mentak racial
//todo Letnev racial

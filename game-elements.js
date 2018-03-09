(function (root) {

	root.dieSides = 10;

	root.BattleType = {
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
		Ground: 'Ground',
		PDS: 'PDS',
	};

	root.UnitType = UnitType;

	var shortUnitType = {
		Flagship: 'X',
		WarSun: 'W',
		Dreadnought: 'D',
		Cruiser: 'C',
		Destroyer: '+',
		Carrier: 'V',
		Fighter: 'F',
		Ground: 'G',
		PDS: 'P',
	};

	root.Races = {
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

	function Option(title, description, limitedTo) {
		this.title = title;
		this.description = description;
		this.limitedTo = limitedTo;
	}

	Option.prototype.availableFor = function (battleSide) {
		return this.limitedTo === undefined || this.limitedTo === battleSide;
	};

	root.ActionCards = {
		moraleBoost: new Option('Morale Boost 1st round', '+1 dice modifier to all units during the first battle round'),
		fireTeam: new Option('Fire team 1st round', 'Reroll dice after first round of invasion combat'),
		fighterPrototype: new Option('Fighter prototype', '+2 dice modifier to Fighters during the first battle round'),
		bunker: new Option('Bunker', '-4 dice modifier to Bombardment rolls', 'defender'),
		emergencyRepairs: new Option('Emergency Repairs', 'Repair damaged units КОГДА БЛИН'),
		riskDirectHit: new Option('Risk direct hit', 'Damage units vulnerable to Direct Hit before killing off fodder'),

		shieldsHolding: new Option('to hell with it', ''),
		experimentalBattlestation: new Option('to hell with it', ''),
		courageous: new Option('to hell with it', ''),
	};

	root.Technologies = {
		antimassDeflectors: new Option('Antimass Deflectors', '-1 to opponents Space Cannon rolls'),
		gravitonLaser: new Option('Graviton Laser System', 'Space Cannon hits should be applied to non-fighters if possible'),
		plasmaScoring: new Option('Plasma Scoring', 'One additional die for one unit during Space Cannon or Bombardment'),
		magenDefense: new Option('Magen Defense Grid', 'Opponent doesn\'t throw dice for one round if you have Planetary Shield', 'defender'),
		duraniumArmor: new Option('Duranium Armor', 'After each round repair 1 unit that wasn\'t damaged this round'),
		assaultCannon: new Option('Assault Cannon', 'Opponent destroys 1 non-Fighter ship if you have at least 3 non-Fighters'),
	};

	root.UnitInfo = (function () {

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

			var shortType = shortUnitType[this.type];
			this.shortType = this.isDamageGhost ? shortType.toLowerCase() : shortType;
		}

		UnitInfo.prototype.clone = function () {
			return new UnitInfo(this.type, this);
		};

		/** Create damage ghost for damageable units */
		UnitInfo.prototype.toDamageGhost = function () {
			var result = new UnitInfo(this.type, {
				sustainDamageHits: this.sustainDamageHits,
				battleDice: 0,
				isDamageGhost: true,
			});
			// 'corporeal' as an antonym to 'ghost' =)
			result.damageCorporeal = this;
			this.damaged = false;
			this.damagedThisRound = false;
			return result;
		};

		return UnitInfo;
	})();

	/** These correspond to fields of UnitInfo, like 'battleValue', 'bombardmentValue' etc. */
	root.ThrowType = {
		Battle: 'battle',
		Bombardment: 'bombardment',
		SpaceCannon: 'spaceCannon',
		Barrage: 'barrage',
	};

	root.StandardUnits = {
		WarSun: new root.UnitInfo(UnitType.WarSun, {
			sustainDamageHits: 1,
			battleValue: 3,
			battleDice: 3,
			bombardmentValue: 3,
			bombardmentDice: 3,
		}),
		Dreadnought: new root.UnitInfo(UnitType.Dreadnought, {
			sustainDamageHits: 1,
			battleValue: 5,
			bombardmentValue: 5,
			bombardmentDice: 1,
		}),
		Cruiser: new root.UnitInfo(UnitType.Cruiser, {
			battleValue: 7,
		}),
		Destroyer: new root.UnitInfo(UnitType.Destroyer, {
			battleValue: 9,
			barrageValue: 9,
			barrageDice: 2,
		}),
		Carrier: new root.UnitInfo(UnitType.Carrier, {
			battleValue: 9,
		}),
		Fighter: new root.UnitInfo(UnitType.Fighter, {
			battleValue: 9,
		}),
		PDS: new root.UnitInfo(UnitType.PDS, {
			spaceCannonValue: 6,
			spaceCannonDice: 1,
		}),
		Ground: new root.UnitInfo(UnitType.Ground, {
			battleValue: 8,
		}),
	};

	root.RaceSpecificUnits = {
		Sardakk: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 6, //todo special racial ability
				battleDice: 2,
			}),
			Dreadnought: new root.UnitInfo(UnitType.Dreadnought, {
				sustainDamageHits: 1,
				battleValue: 5,
				bombardmentValue: 4,
				bombardmentDice: 2,
			}),
		},
		JolNar: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 6, //todo special racial ability
				battleDice: 2,
			}),
		},
		Winnu: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 7, //todo special racial ability
				battleDice: undefined,
			}),
		},
		Xxcha: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 7,
				battleDice: 2,
				spaceCannonValue: 5,
				spaceCannonDice: 3,
			}),
		},
		Yin: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 9, //todo special racial ability
				battleDice: 2,
			}),
		},
		Yssaril: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 2,
			}),
		},
		Sol: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 2,
			}),
			Ground: new root.UnitInfo(UnitType.Ground, {
				battleValue: 7,
			}),
		},
		Creuss: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 1,
			}),
		},
		L1z1x: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5, //todo special racial ability
				battleDice: 2,
			}),
		},
		Mentak: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 7, //todo special racial ability
				battleDice: 2,
			}),
		},
		Naalu: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 9, //todo special racial ability
				battleDice: 2,
			}),
			Fighter: new root.UnitInfo(UnitType.Fighter, {
				battleValue: 8,
			}),
		},
		Virus: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 9, //todo special racial ability
				battleDice: 2,
			}),
		},
		Arborec: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 7,
				battleDice: 2,
			}),
		},
		Letnev: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5, //todo special racial ability
				battleDice: 2,
				bombardmentValue: 5,
				bombardmentDice: 3,
			}),
		},
		Saar: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 2,
				barrageValue: 6,
				barrageDice: 4,
			}),
		},
		Muaat: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 2,
			}),
		},
		Hacan: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 7, //todo special racial ability
				battleDice: 2,
			}),
		},
	};

	root.StandardUpgrades = {
		Cruiser: new root.UnitInfo(UnitType.Cruiser, {
			battleValue: 6,
		}),
		Destroyer: new root.UnitInfo(UnitType.Destroyer, {
			battleValue: 8,
			barrageValue: 6,
			barrageDice: 3,
		}),
		Fighter: new root.UnitInfo(UnitType.Fighter, {
			battleValue: 8,
		}),
		PDS: new root.UnitInfo(UnitType.PDS, {
			spaceCannonValue: 5,
			spaceCannonDice: 1,
		}),
		Ground: new root.UnitInfo(UnitType.Ground, {
			battleValue: 7,
		}),
	};

	root.RaceSpecificUpgrades = {
		Sol: {
			Ground: new root.UnitInfo(UnitType.Ground, {
				battleValue: 6,
			}),
			Carrier: new root.UnitInfo(UnitType.Carrier, {
				sustainDamageHits: 1,
				battleValue: 9,
			}),
		},
		L1z1x: {
			Dreadnought: new root.UnitInfo(UnitType.Dreadnought, {
				sustainDamageHits: 1,
				battleValue: 4,
				bombardmentValue: 4,
				bombardmentDice: 1,
			}),
		},
		Naalu: {
			Fighter: new root.UnitInfo(UnitType.Fighter, {
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
	root.expandFleet = function (race, counters) {

		var standardUnits = Object.assign({}, root.StandardUnits, root.RaceSpecificUnits[race]);
		var upgradedUnits = Object.assign({}, root.StandardUpgrades, root.RaceSpecificUpgrades[race]);
		var result = [];
		var damageGhosts = [];
		for (var unitType in UnitType) {
			var counter = counters[unitType] || { count: 0 };
			for (var i = 0; i < counter.count; i++) {
				var unit = (counter.upgraded ? upgradedUnits : standardUnits)[unitType];
				var addedUnit = unit.clone();
				result.push(addedUnit);
				if (unit.sustainDamageHits > 0) {
					damageGhosts.push(addedUnit.toDamageGhost());
				}
			}
		}
		return result.concat(damageGhosts);
	};

	var unitOrder = createUnitOrder();

	root.unitComparer = function(unit1, unit2) {
		var typeOrder = unitOrder[unit1.type] - unitOrder[unit2.type];
		if (unit1.isDamageGhost === unit2.isDamageGhost)
			return typeOrder;
		if (unit1.isDamageGhost)
			return 1;
		else
			return -1;
	};

	/** Check whether the unit can receive hits in the specific battle type.
	 * E.g. Ground Forces don't receive hits in Space Battle */
	root.belongsToBattle = function (unit, battleType) {

		var ships = [
			UnitType.Flagship,
			UnitType.WarSun,
			UnitType.Dreadnought,
			UnitType.Cruiser,
			UnitType.Destroyer,
			UnitType.Carrier,
			UnitType.Fighter,
		];

		if (battleType === root.BattleType.Space)
			return ships.indexOf(unit.type) >= 0;
		else //battleType === root.BattleType.Ground
			return unit.type === UnitType.Ground;
	};

	root.unitBattleFilter = function (battleType) {
		return function (unit) {
			return root.belongsToBattle(unit, battleType);
		};
	};

	/** Check whether the race has an upgrade for the unit */
	root.upgradeable = function (race, unitType) {
		return !!(root.StandardUpgrades.hasOwnProperty(unitType) ||
		root.RaceSpecificUpgrades[race] &&
		root.RaceSpecificUpgrades[race].hasOwnProperty(unitType));
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

	function createUnitOrder() {
		var result = [];
		var i = 0;
		for (var unitType in UnitType) {
			result[unitType] = i++;
		}
		return result;
	}
})(typeof exports === 'undefined' ? window : exports);
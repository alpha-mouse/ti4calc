(function (root) {

	root.dieSides = 10;

	root.BattleType = {
		Space: 'Space',
		Ground: 'Ground',
	};

	root.BattleSide = {
		attacker: 'attacker',
		defender: 'defender',
		opponent: function (battleSide) {
			return {
				attacker: 'defender',
				defender: 'attacker',
			}[battleSide];
		}
	};

	root.SideUnits = {
		attacker: 'attackerUnits',
		defender: 'defenderUnits',
	};

	var UnitType = {
		Flagship: 'Flagship',
		WarSun: 'WarSun',
		Dreadnought: 'Dreadnought',
		Cruiser: 'Cruiser',
		Carrier: 'Carrier',
		Destroyer: 'Destroyer',
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

	root.Race = {
		Arborec: 'Arborec',
		Creuss: 'Creuss',
		Hacan: 'Hacan',
		JolNar: 'JolNar',
		L1Z1X: 'L1Z1X',
		Letnev: 'Letnev',
		Mentak: 'Mentak',
		Muaat: 'Muaat',
		Naalu: 'Naalu',
		Saar: 'Saar',
		Sardakk: 'Sardakk',
		Sol: 'Sol',
		Virus: 'Virus',
		Winnu: 'Winnu',
		Xxcha: 'Xxcha',
		Yin: 'Yin',
		Yssaril: 'Yssaril',
	};

	root.RacesDisplayNames = {
		Arborec: 'Arborec',
		Creuss: 'Creuss',
		Hacan: 'Hacan',
		JolNar: 'Jol-Nar',
		L1Z1X: 'L1Z1X',
		Letnev: 'Letnev',
		Mentak: 'Mentak',
		Muaat: 'Muaat',
		Naalu: 'Naalu',
		Virus: 'Nekro Virus',
		Saar: 'Saar',
		Sardakk: 'Sardakk N\'orr',
		Sol: 'Sol',
		Winnu: 'Winnu',
		Xxcha: 'Xxcha',
		Yin: 'Yin',
		Yssaril: 'Yssaril',
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
		fireTeam: new Option('Fire Team 1st round', 'Reroll dice after first round of invasion combat'),
		fighterPrototype: new Option('Fighter Prototype', '+2 dice modifier to Fighters during the first battle round'),
		bunker: new Option('Bunker', '-4 dice modifier to Bombardment rolls', 'defender'),
		experimentalBattlestation: new Option('Experimental Battlestation', 'Additional unit with Space Cannon 5(x3)'),
		maneuveringJets: new Option('Maneuvering Jets', 'Cancel 1 Space Cannon hit'),
		riskDirectHit: new Option('Risk Direct Hit', 'Damage units vulnerable to Direct Hit before killing off fodder'),
	};

	root.Technologies = {
		antimassDeflectors: new Option('Antimass Deflectors', '-1 to opponents\' Space Cannon rolls'),
		gravitonLaser: new Option('Graviton Laser System', 'Space Cannon hits should be applied to non-fighters if possible'),
		plasmaScoring: new Option('Plasma Scoring', 'One additional die for one unit during Space Cannon or Bombardment'),
		magenDefense: new Option('Magen Defense Grid', 'Opponent doesn\'t throw dice for one round if you have Planetary Shield', 'defender'),
		duraniumArmor: new Option('Duranium Armor', 'After each round repair 1 unit that wasn\'t damaged this round'),
		assaultCannon: new Option('Assault Cannon', 'Opponent destroys 1 non-Fighter ship if you have at least 3 non-Fighters'),
	};

	root.Agendas = {
		publicizeSchematics: new Option('Publicize Weapon Schematics', 'WarSuns don\'t sustain damage'),
		conventionsOfWar: new Option('Conventions of War', 'No bombardment', 'defender'),
		prophecyOfIxth: new Option('Prophecy of IXTH', '+1 to Fighters rolls'),
	};

	root.Promissory = {
		letnevMunitionsFunding: new Option('Munitions Reserves / War Funding 1st round', 'Reroll dice during first space combat round'),
		tekklarLegion: new Option('Tekklar Legion', '+1 in invasion combat. -1 to Sardakk if he\'s the opponent'),
	};

	root.RaceSpecificTechnologies = {
		Letnev: {
			nonEuclidean: new Option('Non-Euclidean Shielding', 'Sustain Damage absorbs 2 hits'),
			l4Disruptors: new Option('L4 Disruptors', 'During an Invasion units cannot use Space Cannon against you', 'attacker'),
		},
		Sardakk: {
			valkyrieParticleWeave: new Option('Valkyrie Particle Weave', 'If opponent produces at least one hit in Ground combat, you produce one additional hit'),
		},
	};

	root.UnitInfo = (function () {

		function UnitInfo(type, stats) {

			this.type = type;
			var shortType = shortUnitType[this.type];
			this.shortType = stats.isDamageGhost ? shortType.toLowerCase() : shortType;

			this.battleValue = stats.battleValue || NaN;
			this.battleDice = stats.battleDice !== undefined ? stats.battleDice : 1;

			this.bombardmentValue = stats.bombardmentValue || NaN;
			this.bombardmentDice = stats.bombardmentDice || 0;

			this.spaceCannonValue = stats.spaceCannonValue || NaN;
			this.spaceCannonDice = stats.spaceCannonDice || 0;

			this.barrageValue = stats.barrageValue || NaN;
			this.barrageDice = stats.barrageDice || 0;

			this.sustainDamageHits = stats.sustainDamageHits || 0;
			this.isDamageGhost = stats.isDamageGhost || false;

			this.damageCorporeal = undefined;
			this.damaged = false;
			this.damagedThisRound = false;

			this.race = stats.race;
			this.cost = stats.cost;
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
	root.ThrowValues = {
		battle: 'battleValue',
		bombardment: 'bombardmentValue',
		spaceCannon: 'spaceCannonValue',
		barrage: 'barrageValue',
	};
	root.ThrowDice = {
		battle: 'battleDice',
		bombardment: 'bombardmentDice',
		spaceCannon: 'spaceCannonDice',
		barrage: 'barrageDice',
	};

	root.StandardUnits = {
		WarSun: new root.UnitInfo(UnitType.WarSun, {
			sustainDamageHits: 1,
			battleValue: 3,
			battleDice: 3,
			bombardmentValue: 3,
			bombardmentDice: 3,
			cost: 12,
		}),
		Dreadnought: new root.UnitInfo(UnitType.Dreadnought, {
			sustainDamageHits: 1,
			battleValue: 5,
			bombardmentValue: 5,
			bombardmentDice: 1,
			cost: 4,
		}),
		Cruiser: new root.UnitInfo(UnitType.Cruiser, {
			battleValue: 7,
			cost: 2,
		}),
		Carrier: new root.UnitInfo(UnitType.Carrier, {
			battleValue: 9,
			cost: 3,
		}),
		Destroyer: new root.UnitInfo(UnitType.Destroyer, {
			battleValue: 9,
			barrageValue: 9,
			barrageDice: 2,
			cost: 1,
		}),
		Fighter: new root.UnitInfo(UnitType.Fighter, {
			battleValue: 9,
			cost: 0.5,
		}),
		PDS: new root.UnitInfo(UnitType.PDS, {
			spaceCannonValue: 6,
			spaceCannonDice: 1,
		}),
		Ground: new root.UnitInfo(UnitType.Ground, {
			battleValue: 8,
			cost: 0.5,
		}),
		ExperimentalBattlestation: new root.UnitInfo('Bloodthirsty Space Dock', {
			spaceCannonValue: 5,
			spaceCannonDice: 3,
		}),
	};

	root.RaceSpecificUnits = {
		Sardakk: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 6,
				battleDice: 2,
				race: root.Race.Sardakk,
				cost: 8,
			}),
			Dreadnought: new root.UnitInfo(UnitType.Dreadnought, {
				sustainDamageHits: 1,
				battleValue: 5,
				bombardmentValue: 4,
				bombardmentDice: 2,
				cost: 4,
			}),
		},
		JolNar: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 6,
				battleDice: 2,
				race: root.Race.JolNar,
				cost: 8,
			}),
		},
		Winnu: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 7,
				battleDice: undefined,
				race: root.Race.Winnu,
				cost: 8,
			}),
		},
		Xxcha: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 7,
				battleDice: 2,
				spaceCannonValue: 5,
				spaceCannonDice: 3,
				race: root.Race.Xxcha,
				cost: 8,
			}),
		},
		Yin: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 9,
				battleDice: 2,
				race: root.Race.Yin,
				cost: 8,
			}),
		},
		Yssaril: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 2,
				race: root.Race.Yssaril,
				cost: 8,
			}),
		},
		Sol: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 2,
				race: root.Race.Sol,
				cost: 8,
			}),
			Ground: new root.UnitInfo(UnitType.Ground, {
				battleValue: 7,
				cost: 0.5,
			}),
		},
		Creuss: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 1,
				race: root.Race.Creuss,
				cost: 8,
			}),
		},
		L1Z1X: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 2,
				race: root.Race.L1Z1X,
				cost: 8,
			}),
		},
		Mentak: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 7,
				battleDice: 2,
				race: root.Race.Mentak,
				cost: 8,
			}),
		},
		Naalu: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 9,
				battleDice: 2,
				race: root.Race.Naalu,
				cost: 8,
			}),
			Fighter: new root.UnitInfo(UnitType.Fighter, {
				battleValue: 8,
			}),
		},
		Virus: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 9,
				battleDice: 2,
				race: root.Race.Virus,
				cost: 8,
			}),
		},
		Arborec: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 7,
				battleDice: 2,
				race: root.Race.Arborec,
				cost: 8,
			}),
		},
		Letnev: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 2,
				bombardmentValue: 5,
				bombardmentDice: 3,
				race: root.Race.Letnev,
				cost: 8,
			}),
		},
		Saar: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 2,
				barrageValue: 6,
				barrageDice: 4,
				race: root.Race.Saar,
				cost: 8,
			}),
		},
		Muaat: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 2,
				race: root.Race.Muaat,
				cost: 8,
			}),
		},
		Hacan: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 7,
				battleDice: 2,
				race: root.Race.Hacan,
				cost: 8,
			}),
		},
	};

	root.StandardUpgrades = {
		// same as the regular Dreadnought, but upgrade affects ordering
		Dreadnought: new root.UnitInfo(UnitType.Dreadnought, {
			sustainDamageHits: 1,
			battleValue: 5,
			bombardmentValue: 5,
			bombardmentDice: 1,
			cost: 4,
		}),
		Cruiser: new root.UnitInfo(UnitType.Cruiser, {
			battleValue: 6,
			cost: 2,
		}),
		Destroyer: new root.UnitInfo(UnitType.Destroyer, {
			battleValue: 8,
			barrageValue: 6,
			barrageDice: 3,
			cost: 1,
		}),
		Fighter: new root.UnitInfo(UnitType.Fighter, {
			battleValue: 8,
			cost: 0.5,
		}),
		PDS: new root.UnitInfo(UnitType.PDS, {
			spaceCannonValue: 5,
			spaceCannonDice: 1,
		}),
		Ground: new root.UnitInfo(UnitType.Ground, {
			battleValue: 7,
			cost: 0.5,
		}),
	};

	root.RaceSpecificUpgrades = {
		Sol: {
			Carrier: new root.UnitInfo(UnitType.Carrier, {
				sustainDamageHits: 1,
				battleValue: 9,
				cost: 3,
			}),
			Ground: new root.UnitInfo(UnitType.Ground, {
				battleValue: 6,
				cost: 0.5,
			}),
		},
		L1Z1X: {
			Dreadnought: new root.UnitInfo(UnitType.Dreadnought, {
				sustainDamageHits: 1,
				battleValue: 4,
				bombardmentValue: 4,
				bombardmentDice: 1,
				cost: 4,
			}),
		},
		Naalu: {
			Fighter: new root.UnitInfo(UnitType.Fighter, {
				battleValue: 7,
				cost: 0.5,
			}),
		},
		Muaat: {
			WarSun: new root.UnitInfo(UnitType.WarSun, {
				sustainDamageHits: 1,
				battleValue: 3,
				battleDice: 3,
				bombardmentValue: 3,
				bombardmentDice: 3,
				cost: 10,
			}),
		},
	};

	root.MergedUnits = {};
	root.MergedUpgrades = {};
	for (var race in root.Race) {
		root.MergedUnits[race] = Object.assign({}, root.StandardUnits, root.RaceSpecificUnits[race]);
		root.MergedUpgrades[race] = Object.assign({}, root.StandardUpgrades, root.RaceSpecificUpgrades[race]);
	}

	/** Make an array of units in their reversed order of dying */
	root.expandFleet = function (input, battleSide) {

		var options = input.options || { attacker: {}, defender: {} };
		var battleType = input.battleType;
		var thisSideOptions = options[battleSide];
		var opponentSide = root.BattleSide.opponent(battleSide);
		var opponentSideOptions = options[opponentSide];

		var standardUnits = root.MergedUnits[thisSideOptions.race];
		var upgradedUnits = root.MergedUpgrades[thisSideOptions.race];

		var opponentMentakFlagship = battleType === root.BattleType.Space && opponentSideOptions.race === root.Race.Mentak &&
			(input[root.SideUnits[opponentSide]][UnitType.Flagship] || { count: 0 }).count !== 0;

		var result = [];
		var thisSideCounters = input[root.SideUnits[battleSide]];
		for (var unitType in UnitType) {
			var counter = thisSideCounters[unitType] || { count: 0 };
			for (var i = 0; i < counter.count; i++) {
				var unit = (counter.upgraded ? upgradedUnits : standardUnits)[unitType];
				var addedUnit = unit.clone();
				result.push(addedUnit);
				if (unit.sustainDamageHits > 0 &&
					!opponentMentakFlagship &&
					!(unitType === UnitType.WarSun && thisSideOptions.publicizeSchematics)
				) {
					if (i < counter.count - (counter.damaged || 0))
						result.push(addedUnit.toDamageGhost());
					else
						addedUnit.damaged = true;
				}
			}
		}

		var ships = createShips();
		var virusFlagship = battleType === root.BattleType.Space && thisSideOptions.race === root.Race.Virus &&
			(thisSideCounters[UnitType.Flagship] || { count: 0 }).count !== 0;
		var naaluFlagship = battleType === root.BattleType.Ground && thisSideOptions.race === root.Race.Naalu &&
			(thisSideCounters[UnitType.Flagship] || { count: 0 }).count !== 0;

		var unitOrder = createUnitOrder(virusFlagship);
		var naaluGoundUnitOrder = {};
		naaluGoundUnitOrder[UnitType.Ground] = 1;
		naaluGoundUnitOrder[UnitType.Fighter] = 2;
		var comparer;
		var vipGround;
		if (naaluFlagship) {
			// in case Fighters are stronger than Ground Forces, I'd like Ground Forces to die first, then sacrifice the
			// Fighters. But, Fighters cannot take control of the planet, so I'd like to save one Ground Force
			vipGround = (thisSideCounters[UnitType.Fighter] || {}).upgraded &&
				!(thisSideCounters[UnitType.Ground] || {}).upgraded &&
				result.find(function (unit) { return unit.type === UnitType.Ground; });
			comparer = naaluComparer;
		} else if ((thisSideCounters[UnitType.Dreadnought] || {}).upgraded)
			comparer = upgradedDreadnoughtsComparer;
		else
			comparer = defaultComparer;
		result.sort(comparer);
		if (battleType === root.BattleType.Space && thisSideOptions.experimentalBattlestation)
			result.push(root.StandardUnits.ExperimentalBattlestation);
		result.comparer = comparer;
		result.filterForBattle = filterFleet;
		return result;

		function createShips() {
			return [
				UnitType.Flagship,
				UnitType.WarSun,
				UnitType.Dreadnought,
				UnitType.Cruiser,
				UnitType.Destroyer,
				UnitType.Carrier,
				UnitType.Fighter,
			];
		}

		function createUnitOrder(virus) {
			var result = [];
			var i = 0;
			for (var unitType in UnitType) {
				result[unitType] = i++;
			}
			if (virus) {
				var tmp = result[UnitType.Ground]; // Virus will need Grounds to die after Fighters, as they are stronger
				result[UnitType.Ground] = result[UnitType.Fighter];
				result[UnitType.Fighter] = tmp;
			}
			return result;
		}

		function defaultComparer(unit1, unit2) {
			var typeOrder = unitOrder[unit1.type] - unitOrder[unit2.type];
			// damage ghosts come after corresponding units
			var damageGhostOrder = (unit1.isDamageGhost ? 1 : 0) - (unit2.isDamageGhost ? 1 : 0);
			// Damaged units come _before_ undamaged ones (within one type of course), which means they die later,
			// this way more Duranium armor has better chance to be applied.
			var damagedOrder = (unit2.damaged ? 1 : 0) - (unit1.damaged ? 1 : 0);
			if (thisSideOptions.riskDirectHit) {
				// means damage ghosts will come last
				var defaultComparison = damageGhostOrder * 1000 + typeOrder * 10 + damagedOrder;
				if (thisSideOptions.race !== root.Race.Letnev) {
					return defaultComparison;
				} else {
					// damage ghosts will still come last, but Flagship ghost should be the very very last, as the Flagship can repair itself
					if (unit1.type === UnitType.Flagship && unit1.isDamageGhost) {
						return unit2.type === UnitType.Flagship && unit2.isDamageGhost ? 0 : 1;
					} else if (unit2.type === UnitType.Flagship && unit2.isDamageGhost) {
						return -1;
					} else {
						return defaultComparison;
					}
				}
			} else {
				// means units are grouped with their damage ghosts
				return typeOrder * 1000 + damageGhostOrder * 10 + damagedOrder;
			}
		}

		function upgradedDreadnoughtsComparer(unit1, unit2) {
			if (thisSideOptions.riskDirectHit) {
				return defaultComparer(unit1, unit2);
			} else if (unit1.type === UnitType.Dreadnought && unit1.isDamageGhost) {
				return unit2.type === UnitType.Dreadnought && unit2.isDamageGhost ? 0 : 1;
			} else if (unit2.type === UnitType.Dreadnought && unit2.isDamageGhost) {
				return -1;
			} else {
				return defaultComparer(unit1, unit2);
			}
		}

		function naaluComparer(unit1, unit2) {
			var typeOrder = naaluGoundUnitOrder[unit1.type] - naaluGoundUnitOrder[unit2.type];
			if (vipGround) {
				// Fighters are stronger than Ground
				if (unit1 === vipGround)
					return -1;
				else if (unit2 === vipGround)
					return 1;
				else
					return -typeOrder;
			} else {
				return typeOrder;
			}
		}

		function filterFleet() {
			var result = this.filter(function (unit) {
				if (battleType === root.BattleType.Space)
					return ships.indexOf(unit.type) >= 0 || virusFlagship && unit.type === root.UnitType.Ground;
				else //battleType === root.BattleType.Ground
					return unit.type === UnitType.Ground || naaluFlagship && unit.type === root.UnitType.Fighter;
			});
			result.comparer = this.comparer;
			return result;
		}
	};

	/** Check whether the race has an upgrade for the unit */
	root.upgradeable = function (race, unitType) {
		return !!(root.StandardUpgrades.hasOwnProperty(unitType) ||
			root.RaceSpecificUpgrades[race] &&
			root.RaceSpecificUpgrades[race].hasOwnProperty(unitType));
	};

	root.damageable = function (race, unitType, upgraded) {
		return (upgraded ? root.MergedUpgrades : root.MergedUnits)[race][unitType].sustainDamageHits > 0;
	};

})(typeof exports === 'undefined' ? window : exports);
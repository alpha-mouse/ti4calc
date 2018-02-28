require('./calculator');
require('./imitator');
////var f = new calc.Fleet(4);
////im.imitateBattle(f,f);
//console.log(calc);
////var unit = new calc.UnitType(5, 3);
////console.log(unit.dmgDice);
////unit = unit.applyModifier(-2, 3);
////console.log(unit.dmgDice);
//console.log("©dfa Ç°€ê");


var fleet1 = {};
var fleet2 = {};

fleet1[globals.UnitType.Dreadnought] = { count: 1 };

fleet2[globals.UnitType.Fighter] = { count: 1 };

var options = null;

fleet1 = globals.expandFleet('Sardakk', fleet1);
fleet2 = globals.expandFleet('Sardakk', fleet2);

var expected = globals.imitator.estimateProbabilities(fleet1, fleet2, globals.BattleType.Space, options).distribution;
console.log(expected.toString());
var got = globals.calculator.computeProbabilities(fleet1, fleet2, globals.BattleType.Space, options).distribution;
console.log(got.toString());


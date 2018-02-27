var calc = require("./calculator").calculator;
var im = require("./imitator").imitator;
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

fleet1[calc.UnitType.Dreadnought] = 1;

fleet2[calc.UnitType.Fighter] = 1;

var options = {attacker:{moraleBoost1:true},defender:{moraleBoost1:true}};

fleet1 = calc.defaultSort(calc.expandFleet(fleet1));
fleet2 = calc.defaultSort(calc.expandFleet(fleet2));

var expected = im.estimateProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
console.log(expected.toString());
var got = calc.computeProbabilities(fleet1, fleet2, calc.BattleType.Space, options).distribution;
console.log(got.toString());


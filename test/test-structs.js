var structs = require('../structs');

function rangesEqual(a, b) {
	if (a === b) return true;
	if (a === null || b === null) return false;
	if (a.length !== b.length) return false;

	for (var i = 0; i < a.length; ++i) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

function compareKey(test, victim, expected) {
	test.ok(victim.rangesKey() === expected, 'wrong ranges key, expected ' + expected + ' got ' + victim.rangesKey());
	test.done();
}

function compareRanges(test, victim, expected) {
	test.ok(rangesEqual(victim.ranges, expected), 'wrong ranges, expected ' + expected + ' got ' + victim.ranges);
	test.done();
}

function compareRangesAndDead(test, victim, expectedRanges, expectedDead) {
	test.ok(victim.dead() === expectedDead, 'wrong dead, expected ' + expectedDead + ' got ' + victim.dead());
	test.ok(rangesEqual(victim.ranges, expectedRanges), 'wrong ranges, expected ' + expectedRanges + ' got ' + victim.ranges);
	test.done();
}

exports.victim = {
	addRange: {
		First: function (test) {
			var v = new structs.Victim();
			v.addRange(1, 2);

			compareRanges(test, v, [1, undefined]);
		},
		singleSingleMatch: function (test) {
			var v = new structs.Victim();
			v.addRange(1);
			v.addRange(2);

			compareRanges(test, v, [1, 3]);
		},
		singleSingleNoMatch: function (test) {
			var v = new structs.Victim();
			v.addRange(1);
			v.addRange(3);

			compareRanges(test, v, [1, undefined, 3, undefined]);
		},
		singlePairMatch: function (test) {
			var v = new structs.Victim();
			v.addRange(1);
			v.addRange(2, 4);

			compareRanges(test, v, [1, 4]);
		},
		pairSingleMatch: function (test) {
			var v = new structs.Victim();
			v.addRange(1, 3);
			v.addRange(3);

			compareRanges(test, v, [1, 4]);
		},
		pairPairMatch: function (test) {
			var v = new structs.Victim();
			v.addRange(1, 3);
			v.addRange(3, 5);

			compareRanges(test, v, [1, 5]);
		},
	},
	collapseRanges: {
		oneRangeMatch: function (test) {
			var v = new structs.Victim();
			v.addRange(1, 3);
			var collapsed = v.collapseRanges(3);
			compareRangesAndDead(test, collapsed, [], 2);
		},
		oneSingleMatch: function (test) {
			var v = new structs.Victim();
			v.addRange(1);
			var collapsed = v.collapseRanges(2);
			compareRangesAndDead(test, collapsed, [], 1);
		},
		twoRangesMatch: function (test) {
			var v = new structs.Victim();
			v.addRange(1, 3);
			v.addRange(5, 8);
			var collapsed = v.collapseRanges(8);
			compareRangesAndDead(test, collapsed, [1, 3], 5);
		},
		twoRangeSingleMatch: function (test) {
			var v = new structs.Victim();
			v.addRange(1, 3);
			v.addRange(5);
			var collapsed = v.collapseRanges(6);
			compareRangesAndDead(test, collapsed, [1, 3], 3);
		},
		noMatch: function (test) {
			var v = new structs.Victim();
			v.addRange(1, 3);
			var collapsed = v.collapseRanges(4);
			compareRangesAndDead(test, collapsed, [1, 3], 2);
		}
	},
	rangesKey: {
		single: function (test) {
			var v = new structs.Victim();
			v.addRange(1, 2);
			compareKey(test, v, '1');
		},
		singleRange: function (test) {
			var v = new structs.Victim();
			v.addRange(1);
			v.addRange(3, 5);
			compareKey(test, v, '1,3-5');
		},
		rangeRange: function (test) {
			var v = new structs.Victim();
			v.addRange(1, 3);
			v.addRange(5, 8);
			compareKey(test, v, '1-3,5-8');
		},
	}
};
(function (root) {

	root.createMatrix = function (rows, columns, init) {
		var result = new Array(rows);
		for (var i = 0; i < rows; i++) {
			result[i] = new Array(columns);
			if (init !== undefined)
				result[i].fill(init);
		}
		result.rows = rows;
		result.columns = columns;
		return result;
	};


	root.Problem = function (distribution, attacker, defender) {
		this.distribution = distribution;
		this.attacker = attacker;
		this.defender = defender;
	};


	root.DistributionBase = function (min, max) {
		this.min = min;
		this.max = max;
	};

	root.DistributionBase.prototype.at = function (index) {
		return this[index] || 0;
	};

	root.DistributionBase.prototype.toString = function () {
		if (this.min === undefined || this.max === undefined) {
			return 'no stats';
		} else {
			var result = 'Min: ' + this.min + ', Max: ' + this.max + '. ';
			var sum = 0;
			result += '[';
			for (var i = Math.min(this.min, -1); i <= Math.max(this.max, 1); ++i) {
				if (i === 0)
					result += '| ';
				result += round(this.at(i), 3) + ' ';
				sum += this.at(i);
				if (i === 0)
					result += '| ';
			}
			result += ']';
			result += ' ' + round(sum, 3);
			result += '. ' + round(this.downTo(-1), 3) + ':' + round(this.downTo(1), 3);
			return result;
		}

		function round(number, precision) {
			var factor = Math.pow(10, precision);
			return Math.round(number * factor) / factor;
		}
	};

	root.DistributionBase.prototype.downTo = function (index) {
		if (index === 0)
			return this.at(index);
		var result = 0;
		if (index < 0)
			for (var i = this.min; i <= index; i++)
				result += this.at(i);
		else
			for (var i = index; i <= this.max; i++)
				result += this.at(i);
		return result;
	};


	root.EmpiricalDistribution = function () {
	};

	root.EmpiricalDistribution.prototype = Object.create(root.DistributionBase.prototype);

	/** Increment count at index */
	root.EmpiricalDistribution.prototype.increment = function (index) {
		this[index] = this.at(index) + 1;
		if (this.min === undefined)
			this.min = index;
		else if (index < this.min)
			this.min = index;

		if (this.max === undefined)
			this.max = index;
		else if (this.max < index)
			this.max = index;
	};

	/** Convert counts to probabilities */
	root.EmpiricalDistribution.prototype.normalize = function () {
		var sum = 0;
		for (var i = this.min; i <= this.max; ++i)
			sum += this.at(i);
		if (sum !== 0)
			for (var i = this.min; i <= this.max; ++i)
				this[i] = this.at(i) / sum;
	};


	/** Problem ensembles are needed when linear units dying order is violated.
	 * E.g.
	 * 	Barrage - only Fighters die
	 * 	Assault Cannon - only non Fighters die
	 * 	Graviton Lazer - preferably non Fighters die
	 *
	 * So original problem is split into several subproblems, depending on which units died.
	 */
	root.EnsembleSplit = function (parentProblem) {
		this.subproblems = {};
		this.parentProblem = parentProblem;
	};

	root.EnsembleSplit.prototype.increment = function (attackerVictims, defenderVictims, fromRow, fromColumn, value) {
		if (value === 0) return;
		attackerVictims = attackerVictims.collapseRanges(fromRow);
		defenderVictims = defenderVictims.collapseRanges(fromColumn);
		var subproblemKey = this._subproblemKey(attackerVictims, defenderVictims);
		if (!this.subproblems[subproblemKey])
			this.subproblems[subproblemKey] = this._problemFactory(attackerVictims, defenderVictims);
		this.subproblems[subproblemKey].distribution[fromRow - attackerVictims.dead()][fromColumn - defenderVictims.dead()] += value;
	};

	root.EnsembleSplit.prototype.getSubproblems = function () {
		var subproblems = this.subproblems;
		return Object.keys(this.subproblems).map(function (key) {
			return subproblems[key];
		});
	};

	root.EnsembleSplit.prototype._problemFactory = function (attackerVictims, defenderVictims) {
		var attackerDeficit = attackerVictims.rangesLength();
		var defenderDeficit = defenderVictims.rangesLength();
		var distribution = root.createMatrix(this.parentProblem.distribution.rows - attackerDeficit, this.parentProblem.distribution.columns - defenderDeficit, 0);
		var attacker = splice(this.parentProblem.attacker, attackerVictims.ranges);
		var defender = splice(this.parentProblem.defender, defenderVictims.ranges);
		return new root.Problem(distribution, attacker, defender);

		function rangesLength(ranges) {
			var result = 0;
			for (var i = 0; i < ranges.length / 2; ++i)
				result += rangeLength(ranges, i);
			return result;

			function rangeLength(ranges, rangeIndex) {
				var rangeStart = rangeIndex * 2;
				if (isNaN(ranges[rangeStart]))
					return 0;
				return isNaN(ranges[rangeStart + 1]) ? 1 : ranges[rangeStart + 1] - ranges[rangeStart];
			}
		}

		function splice(fleet, ranges) {
			var allRangesNull = true;
			for (var i = 0; i < ranges.length / 2; ++i) {
				if (!isNaN(ranges[i * 2])) {
					allRangesNull = false;
					break;
				}
			}
			if (allRangesNull)
				return fleet;
			else {
				var result = fleet.slice();
				for (var i = ranges.length / 2 - 1; 0 <= i; --i) {
					if (!isNaN(ranges[i * 2])) {
						result.splice(ranges[i * 2], (ranges[i * 2 + 1] - ranges[i * 2]) || 1);
					}
				}
				return result;
			}
		}
	};

	root.EnsembleSplit.prototype._subproblemKey = function (attackerVictims, defenderVictimms) {
		return 'a' + attackerVictims.rangesKey() + 'd' + defenderVictimms.rangesKey();


	};


	root.Victim = function () {
		this.ranges = [];
	}

	root.Victim.prototype.addRange = function (from, to) {
		var ranges = this.ranges;
		if (!isNaN(from) && from !== to) {
			if (ranges.length) {
				if (ranges[ranges.length - 1] === from) {
					ranges[ranges.length - 1] = to === undefined ? from + 1 : to;
					return;
				}
				if (ranges[ranges.length - 1] === undefined && ranges[ranges.length - 2] + 1 === from) {
					if (to === undefined)
						ranges[ranges.length - 1] = from + 1;
					else
						ranges[ranges.length - 1] = to;
					return;
				}
			}
			if (from + 1 === to)
				this.ranges.push(from, undefined);
			else
				this.ranges.push(from, to);
		}
	};

	root.Victim.prototype.rangesLength = function () {
		var result = 0;
		for (var i = 0; i < this.ranges.length / 2; ++i)
			result += rangeLength(this.ranges, i);
		return result;

		function rangeLength(ranges, rangeIndex) {
			var rangeStart = rangeIndex * 2;
			if (isNaN(ranges[rangeStart]))
				return 0;
			return isNaN(ranges[rangeStart + 1]) ? 1 : (ranges[rangeStart + 1] - ranges[rangeStart]);
		}
	};

	root.Victim.prototype.dead = function () {
		return this._dead !== undefined ? this._dead : this.rangesLength();
	};

	root.Victim.prototype.collapseRanges = function (fleetCeiling) {
		var ranges = this.ranges;
		if (ranges.length && (
				ranges[ranges.length - 1] === fleetCeiling ||
				ranges[ranges.length - 1] === undefined && ranges[ranges.length - 2] + 1 === fleetCeiling)) {
			var result;
			result = new root.Victim();
			result.ranges = ranges.slice(0, ranges.length - 2);
			result._dead = this.rangesLength();
			return result;
		}
		return this;
	};

	root.Victim.prototype.rangesKey = function () {
		var rangeKeys = [];
		for (var i = 0; i < this.ranges.length / 2; ++i) {
			rangeKeys.push(this.ranges[i * 2] + (this.ranges[i * 2 + 1] === undefined ? '' : '-' + this.ranges[i * 2 + 1]));
		}
		return rangeKeys.join(',');
	};

	root.Victim.Null = new root.Victim();


	/** taken from https://stackoverflow.com/questions/22697936/binary-search-in-javascript
	 * God only knows why javascript doesn't have it's own binary search
	 */
	root.binarySearch = function (ar, el, compare_fn) {
		var m = 0;
		var n = ar.length - 1;
		while (m <= n) {
			var k = (n + m) >> 1;
			var cmp = compare_fn(el, ar[k]);
			if (cmp > 0) {
				m = k + 1;
			} else if (cmp < 0) {
				n = k - 1;
			} else {
				return k;
			}
		}
		return -m - 1;
	};
})(typeof exports === 'undefined' ? window : exports);
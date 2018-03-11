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
			for (var i = this.min; i <= this.max; ++i) {
				if (i === 0)
					result += '| ';
				result += round(this.at(i), 3) + ' ';
				sum += this.at(i);
				if (i === 0)
					result += '| ';
			}
			result += ']';
			result += ' ' + round(sum, 3);
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
		if (index < this.min || index > this.max)
			return 0;
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
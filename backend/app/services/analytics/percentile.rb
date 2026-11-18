module Analytics
  # Percentiles by linear interpolation between the two nearest ranks, the
  # same method as Excel's PERCENTILE.INC and SQL's percentile_cont, so
  # numbers match what HR got from their spreadsheets.
  #
  # SQLite has no percentile function, so the engine hands this class the
  # values of each group. At 10,000 rows that is cheap, and it keeps the
  # arithmetic exact and in one tested place.
  #
  #   Percentile.call([10, 20, 30, 40], 0.25) # => (35/2)
  class Percentile
    # @param values [Array<Numeric>] any order; not modified
    # @param fraction [Numeric] 0 (minimum) through 1 (maximum)
    # @return [Rational, nil] nil when +values+ is empty. A Rational keeps the
    #   interpolation exact; callers round to whole cents.
    def self.call(values, fraction)
      raise ArgumentError, "fraction must be between 0 and 1" unless (0..1).cover?(fraction)
      return nil if values.empty?

      sorted = values.sort
      rank = (sorted.size - 1) * fraction.rationalize
      lower = rank.floor
      weight = rank - lower
      return Rational(sorted[lower]) if weight.zero?

      Rational(sorted[lower]) + weight * (sorted[lower + 1] - sorted[lower])
    end

    def self.median(values) = call(values, Rational(1, 2))
  end
end

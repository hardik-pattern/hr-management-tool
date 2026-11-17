module Seeds
  # Picks an item with probability proportional to its weight, using the
  # caller's Random so results stay reproducible.
  class WeightedPicker
    def initialize(pairs)
      total = 0.0
      @cumulative = pairs.map { |item, weight| [ total += weight, item ] }
      @total = total
    end

    def pick(rng)
      target = rng.rand * @total
      @cumulative.bsearch { |upper_bound, _item| upper_bound > target }.last
    end
  end
end

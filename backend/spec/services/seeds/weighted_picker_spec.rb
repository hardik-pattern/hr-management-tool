require "rails_helper"

RSpec.describe Seeds::WeightedPicker do
  it "always returns the only item" do
    expect(described_class.new([ [ :only, 5 ] ]).pick(Random.new(1))).to eq(:only)
  end

  it "never picks an item with zero weight" do
    picker = described_class.new([ [ :never, 0 ], [ :always, 1 ] ])
    rng = Random.new(1)

    expect(Array.new(200) { picker.pick(rng) }.uniq).to eq([ :always ])
  end

  it "follows the weights over many draws" do
    picker = described_class.new([ [ :a, 3 ], [ :b, 1 ] ])
    rng = Random.new(42)
    draws = Array.new(4_000) { picker.pick(rng) }.tally

    expect(draws[:a].to_f / draws[:b]).to be_within(0.4).of(3.0)
  end

  it "is reproducible for the same Random seed" do
    picker = described_class.new([ [ :a, 1 ], [ :b, 1 ], [ :c, 1 ] ])

    first = Array.new(20) { picker.pick(Random.new(7)) }
    second = Array.new(20) { picker.pick(Random.new(7)) }

    expect(first).to eq(second)
  end
end

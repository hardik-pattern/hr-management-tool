require "rails_helper"

RSpec.describe Analytics::Percentile do
  describe ".call" do
    it "returns nil for no values" do
      expect(described_class.call([], 0.5)).to be_nil
    end

    it "returns the only value for any fraction" do
      [ 0, 0.5, 1 ].each { |fraction| expect(described_class.call([ 42 ], fraction)).to eq(42) }
    end

    it "returns the minimum at 0 and the maximum at 1" do
      expect(described_class.call([ 30, 10, 20 ], 0)).to eq(10)
      expect(described_class.call([ 30, 10, 20 ], 1)).to eq(30)
    end

    it "picks the middle value for the median of an odd count" do
      expect(described_class.call([ 1, 2, 3, 4, 5 ], 0.5)).to eq(3)
    end

    it "averages the two middle values for the median of an even count" do
      expect(described_class.call([ 1, 2, 3, 4 ], 0.5)).to eq(Rational(5, 2))
    end

    it "lands exactly on a value when the rank is whole" do
      expect(described_class.call([ 1, 2, 3, 4, 5 ], 0.25)).to eq(2)
      expect(described_class.call([ 1, 2, 3, 4, 5 ], 0.75)).to eq(4)
    end

    it "interpolates between ranks" do
      # rank = 3 * 0.25 = 0.75, so 10 + 0.75 * (20 - 10)
      expect(described_class.call([ 10, 20, 30, 40 ], 0.25)).to eq(Rational(35, 2))
    end

    it "matches known PERCENTILE.INC results" do
      expect(described_class.call([ 15, 20, 35, 40, 50 ], 0.4)).to eq(29)
      expect(described_class.call([ 1, 2, 3, 4 ], 0.3)).to eq(Rational(19, 10))
    end

    it "does not depend on input order and does not modify the input" do
      values = [ 50, 10, 40, 20, 30 ]

      expect(described_class.call(values, 0.5)).to eq(30)
      expect(values).to eq([ 50, 10, 40, 20, 30 ])
    end

    it "handles ties" do
      expect(described_class.call([ 5, 5, 5, 9 ], 0.5)).to eq(5)
      expect(described_class.call([ 5, 5, 9, 9 ], 0.5)).to eq(7)
    end

    it "accepts integer, float and rational fractions alike" do
      values = [ 10, 20, 30, 40 ]

      expect(described_class.call(values, 0.25)).to eq(described_class.call(values, Rational(1, 4)))
    end

    it "is exact, so rounding to cents is the caller's single, explicit step" do
      expect(described_class.call([ 100, 101 ], 0.5)).to eq(Rational(201, 2))
      expect(described_class.call([ 100, 101 ], 0.5).round(half: :up)).to eq(101)
    end

    it "rejects a fraction outside 0..1" do
      expect { described_class.call([ 1, 2 ], -0.1) }.to raise_error(ArgumentError, /between 0 and 1/)
      expect { described_class.call([ 1, 2 ], 1.1) }.to raise_error(ArgumentError, /between 0 and 1/)
    end
  end

  describe ".median" do
    it "is the 50th percentile" do
      expect(described_class.median([ 3, 1, 2 ])).to eq(2)
      expect(described_class.median([])).to be_nil
    end
  end
end

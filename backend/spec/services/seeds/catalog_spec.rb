require "rails_helper"

RSpec.describe Seeds::Catalog do
  describe ".round_to_hundreds" do
    it "rounds to the nearest 100 major units" do
      expect(described_class.round_to_hundreds(123_456, 2)).to eq(120_000)
    end

    it "rounds halves up" do
      expect(described_class.round_to_hundreds(125_000, 2)).to eq(130_000)
    end

    it "uses whole units for a zero-exponent currency" do
      expect(described_class.round_to_hundreds(7_641_791, 0)).to eq(7_641_800)
    end
  end

  describe ".band_cents" do
    it "spans 80%..125% of the US mid-point for USD" do
      usd = build(:currency, :usd)

      # Level 3 mid-point is 80,000 USD = 8,000,000 cents.
      expect(described_class.band_cents(level: 3, pay_factor: "1.00", currency: usd)).to eq([ 6_400_000, 10_000_000 ])
    end

    it "converts through the currency rate and honours a zero exponent" do
      jpy = build(:currency, :jpy)

      # 80,000 USD * 0.80 country factor / 0.0067 = ~9.55M yen mid-point.
      expect(described_class.band_cents(level: 3, pay_factor: "0.80", currency: jpy)).to eq([ 7_641_800, 11_940_300 ])
    end
  end

  it "describes 40 job titles, each used by exactly one department" do
    names = described_class::DEPARTMENTS.values.flat_map { |d| d[:titles].map(&:first) }

    expect(names.size).to eq(40)
    expect(names.uniq.size).to eq(40)
  end

  it "only plants the gender gap in titles that exist" do
    names = described_class::DEPARTMENTS.values.flat_map { |d| d[:titles].map(&:first) }

    expect(described_class::GAP_TITLES - names).to be_empty
  end
end

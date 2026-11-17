require "rails_helper"

RSpec.describe Money do
  let(:usd) { build(:currency, :usd) }
  let(:jpy) { build(:currency, :jpy) }

  describe "#initialize" do
    it "rejects non-integer cents so floats cannot sneak in" do
      expect { described_class.new(10.5, usd) }.to raise_error(ArgumentError, /Integer/)
    end
  end

  describe "#format" do
    it "shows two decimals for a 2-exponent currency" do
      expect(described_class.new(123_456, usd).format).to eq("1,234.56 USD")
    end

    it "shows no decimals for a zero-exponent currency" do
      expect(described_class.new(1_234_567, jpy).format).to eq("1,234,567 JPY")
    end

    it "keeps trailing zeros" do
      expect(described_class.new(100_000, usd).to_s).to eq("1,000.00 USD")
    end
  end

  describe "#to_usd_cents" do
    it "is the identity for USD" do
      expect(described_class.new(500_000, usd).to_usd_cents).to eq(500_000)
    end

    it "converts a zero-exponent currency using whole units" do
      # 10,000 JPY * 0.0067 = 67.00 USD = 6,700 cents
      expect(described_class.new(10_000, jpy).to_usd_cents).to eq(6_700)
    end

    it "converts a two-exponent currency using the rate" do
      eur = build(:currency, rate_to_usd: "1.10") # 100.00 -> 110.00
      expect(described_class.new(10_000, eur).to_usd_cents).to eq(11_000)
    end

    it "rounds half up to the nearest cent" do
      half = build(:currency, rate_to_usd: "0.005") # 1 cent * 0.005 = 0.005 cent
      expect(described_class.new(100, half).to_usd_cents).to eq(1)  # 0.5 cent -> 1
      expect(described_class.new(99, half).to_usd_cents).to eq(0)   # 0.495 -> 0
    end

    it "handles zero" do
      expect(described_class.new(0, jpy).to_usd_cents).to eq(0)
    end
  end

  describe "#==" do
    it "compares cents and currency" do
      expect(described_class.new(100, usd)).to eq(described_class.new(100, usd))
      expect(described_class.new(100, usd)).not_to eq(described_class.new(101, usd))
      expect(described_class.new(100, usd)).not_to eq(described_class.new(100, jpy))
    end
  end
end

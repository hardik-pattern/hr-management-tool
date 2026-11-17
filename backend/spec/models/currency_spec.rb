require "rails_helper"

RSpec.describe Currency, type: :model do
  subject(:currency) { build(:currency, :usd) }

  it { is_expected.to be_valid }
  it { is_expected.to validate_presence_of(:code) }
  it { is_expected.to validate_presence_of(:name) }
  it { is_expected.to validate_uniqueness_of(:code) }
  it { is_expected.to validate_numericality_of(:rate_to_usd).is_greater_than(0) }
  it { is_expected.to validate_numericality_of(:minor_unit_exponent).only_integer.is_in(0..4) }
  it { is_expected.to have_many(:countries).dependent(:restrict_with_error) }

  it "rejects codes that are not three uppercase letters" do
    %w[usd US USDX U5D].each do |bad|
      expect(build(:currency, code: bad)).not_to be_valid
    end
  end

  describe "database constraints" do
    it "refuses a non-positive rate even when validations are skipped" do
      currency.rate_to_usd = 0

      expect { currency.save!(validate: false) }.to raise_error(ActiveRecord::StatementInvalid)
    end

    it "refuses an exponent outside 0..4 even when validations are skipped" do
      currency.minor_unit_exponent = 5

      expect { currency.save!(validate: false) }.to raise_error(ActiveRecord::StatementInvalid)
    end
  end
end

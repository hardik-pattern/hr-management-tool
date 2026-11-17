require "rails_helper"

RSpec.describe Country, type: :model do
  subject(:country) { build(:country, code: "IN") }

  it { is_expected.to be_valid }
  it { is_expected.to belong_to(:currency) }
  it { is_expected.to have_many(:employees).dependent(:restrict_with_error) }
  it { is_expected.to validate_presence_of(:name) }
  it { is_expected.to validate_uniqueness_of(:code) }

  it "rejects codes that are not two uppercase letters" do
    %w[in IND I1].each do |bad|
      expect(build(:country, code: bad)).not_to be_valid
    end
  end

  it "exposes its currency code" do
    country = build(:country, currency: build(:currency, :jpy))

    expect(country.currency_code).to eq("JPY")
  end

  it "cannot be orphaned from its currency" do
    country.save!

    expect { country.currency.destroy }.not_to change(Currency, :count)
    expect(country.currency.errors[:base]).to be_present
  end
end

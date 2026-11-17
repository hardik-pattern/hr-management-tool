require "rails_helper"

RSpec.describe PayBand, type: :model do
  subject(:pay_band) { build(:pay_band, min_cents: 1_000, max_cents: 2_000) }

  it { is_expected.to be_valid }
  it { is_expected.to belong_to(:job_title) }
  it { is_expected.to belong_to(:country) }
  it { is_expected.to validate_numericality_of(:min_cents).only_integer.is_greater_than(0) }
  it { is_expected.to validate_numericality_of(:max_cents).only_integer.is_greater_than(0) }

  it "allows one band per job title and country" do
    pay_band.save!

    duplicate = build(:pay_band, job_title: pay_band.job_title, country: pay_band.country)
    expect(duplicate).not_to be_valid
    expect(duplicate.errors[:job_title_id]).to be_present
  end

  it "allows the same job title in another country" do
    pay_band.save!

    expect(build(:pay_band, job_title: pay_band.job_title)).to be_valid
  end

  describe "min/max ordering" do
    it "rejects a min above the max" do
      pay_band.min_cents = 3_000

      expect(pay_band).not_to be_valid
      expect(pay_band.errors[:min_cents]).to include("must not exceed max_cents")
    end

    it "accepts equal min and max" do
      pay_band.min_cents = pay_band.max_cents

      expect(pay_band).to be_valid
    end

    it "is enforced by the database too" do
      pay_band.min_cents = 3_000

      expect { pay_band.save!(validate: false) }.to raise_error(ActiveRecord::StatementInvalid)
    end
  end

  describe "#covers?" do
    it "includes both bounds" do
      expect(pay_band.covers?(1_000)).to be true
      expect(pay_band.covers?(2_000)).to be true
    end

    it "excludes values outside the band" do
      expect(pay_band.covers?(999)).to be false
      expect(pay_band.covers?(2_001)).to be false
    end
  end
end

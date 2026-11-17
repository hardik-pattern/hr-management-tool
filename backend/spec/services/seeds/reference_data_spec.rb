require "rails_helper"

RSpec.describe Seeds::ReferenceData do
  before { described_class.call }

  it "loads the catalog" do
    expect(Currency.count).to eq(9)
    expect(Country.count).to eq(10)
    expect(Department.count).to eq(8)
    expect(JobTitle.count).to eq(40)
  end

  it "creates one pay band per job title and country" do
    expect(PayBand.count).to eq(40 * 10)
  end

  it "links countries to the right currency" do
    expect(Country.find_by!(code: "JP").currency_code).to eq("JPY")
    expect(Country.find_by!(code: "DE").currency_code).to eq("EUR")
  end

  it "makes every band a valid range in the country's currency" do
    expect(PayBand.where("min_cents > max_cents")).to be_empty
    expect(PayBand.all).to all(be_valid)
  end

  it "is idempotent" do
    expect { described_class.call }.not_to change { [ Currency.count, Country.count, JobTitle.count, PayBand.count ] }
  end

  it "restores catalog values that were changed by hand" do
    Currency.find_by!(code: "EUR").update!(rate_to_usd: 9)

    described_class.call

    expect(Currency.find_by!(code: "EUR").rate_to_usd).to eq(BigDecimal("1.08"))
  end
end

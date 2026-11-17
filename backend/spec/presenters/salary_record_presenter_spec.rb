require "rails_helper"

RSpec.describe SalaryRecordPresenter do
  it "formats the amount using the currency's minor unit" do
    jpy = create(:currency, :jpy)
    employee = create(:employee, country: create(:country, currency: jpy))
    record = create(:salary_record, employee: employee, amount_cents: 8_000_000,
                                    effective_from: Date.new(2024, 3, 1), reason: "hire")

    expect(described_class.new(record, currency: jpy).as_json).to include(
      id: record.id, amount_cents: 8_000_000, currency: "JPY", formatted: "8,000,000 JPY",
      effective_from: Date.new(2024, 3, 1), reason: "hire"
    )
  end
end

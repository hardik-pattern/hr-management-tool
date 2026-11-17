require "rails_helper"

RSpec.describe EmployeePresenter do
  let(:jpy) { create(:currency, :jpy) }
  let(:country) { create(:country, code: "JP", name: "Japan", currency: jpy) }
  let(:employee) do
    create(:employee, country: country, current_salary_cents: 8_000_000,
                      full_name: "Asha Rao", email: "asha@acme.test", hire_date: Date.new(2024, 3, 1))
  end

  subject(:json) { described_class.new(employee).as_json }

  it "exposes the profile" do
    expect(json).to include(
      id: employee.id, full_name: "Asha Rao", email: "asha@acme.test",
      hire_date: Date.new(2024, 3, 1), status: "active", termination_date: nil, deleted_at: nil
    )
  end

  it "nests country, department and job title" do
    expect(json[:country]).to eq("id" => country.id, "code" => "JP", "name" => "Japan")
    expect(json[:department]).to eq("id" => employee.department_id, "name" => employee.department.name)
    expect(json[:job_title]).to include("id" => employee.job_title_id, "level" => 3)
  end

  it "formats the salary using the currency's minor unit" do
    expect(json[:salary]).to eq(amount_cents: 8_000_000, currency: "JPY", formatted: "8,000,000 JPY")
  end
end

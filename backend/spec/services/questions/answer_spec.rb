require "rails_helper"

RSpec.describe Questions::Answer do
  let(:today) { Date.new(2025, 6, 15) }
  let(:usd) { create(:currency, :usd) }
  let(:us) { create(:country, name: "United States", currency: usd) }
  let(:engineering) { create(:department, name: "Engineering") }
  let(:sales) { create(:department, name: "Sales") }
  let(:engineer) { create(:job_title, name: "Engineer", department: engineering) }
  let(:rep) { create(:job_title, name: "Rep", department: sales) }

  def staff(cents, title: engineer, **attributes)
    create(:employee, country: us, department: title.department, job_title: title, current_salary_cents: cents, **attributes)
  end

  def answer(id) = described_class.call(Questions::Catalog.find(id), today: today)
  def json(answer) = answer[:result].as_json.deep_stringify_keys

  it "describes the question and how it was asked" do
    result = answer("payroll-by-department")

    expect(result).to include(
      id: "payroll-by-department", kind: :summary,
      params: { "metric" => "sum", "group_by" => "department" },
      title: "What is the total payroll by department?",
    )
  end

  describe "the answers" do
    before do
      staff(1_000, title: engineer)
      staff(3_000, title: engineer)
      staff(8_000, title: rep)
    end

    it "payroll by department sums each department in USD" do
      rows = json(answer("payroll-by-department"))["rows"]

      expect(rows.map { |r| [ r.dig("group", "department", "label"), r["value"] ] }).to eq([ [ "Engineering", 4_000 ], [ "Sales", 8_000 ] ])
    end

    it "median pay by role and country groups by both" do
      rows = json(answer("median-pay-by-role-and-country"))["rows"]

      expect(rows.map { |r| [ r.dig("group", "job_title", "label"), r.dig("group", "country", "label"), r["value"] ] })
        .to eq([ [ "Engineer", "United States", 2_000 ], [ "Rep", "United States", 8_000 ] ])
    end

    it "the widest pay spread is the gap between the quartiles of each department" do
      staff(5_000, title: engineer)
      staff(7_000, title: engineer) # engineering: 1,000 3,000 5,000 7,000 -> quartiles 2,500 and 5,500

      rows = json(answer("widest-pay-spread"))["rows"]

      expect(rows.find { |r| r.dig("group", "department", "label") == "Engineering" }["value"]).to eq(3_000)
    end

    it "gender pay gap runs the like-for-like comparison" do
      expect(json(answer("gender-pay-gap"))).to include("min_group_size" => 3, "rows" => be_an(Array))
    end
  end

  describe "who has left in the last year" do
    before do
      staff(1_000, status: "terminated", termination_date: Date.new(2025, 1, 1))
      staff(3_000, status: "terminated", termination_date: Date.new(2024, 6, 15))   # exactly a year ago
      staff(9_000, status: "terminated", termination_date: Date.new(2024, 6, 14))   # a day too long ago
      staff(7_000)                                                                    # still employed
    end

    it "asks about leavers since the same date a year earlier" do
      result = answer("leavers-last-year")

      expect(result[:params]).to include("terminated_after" => "2024-06-15")
      expect(json(result)["total"]).to include("headcount" => 2, "value" => 2_000) # average of 1,000 and 3,000
    end

    it "uses the date it is asked on, not a fixed one" do
      later = described_class.call(Questions::Catalog.find("leavers-last-year"), today: Date.new(2025, 12, 31))

      # A year before 31 December 2025 is 31 December 2024: only the January 2025 leaver is inside it.
      expect(later[:params]["terminated_after"]).to eq("2024-12-31")
      expect(json(later)["total"]).to include("headcount" => 1, "value" => 1_000)
    end
  end

  describe "who is paid below their band, and who has gone without a change" do
    it "reports those under the minimum" do
      create(:pay_band, job_title: engineer, country: us, min_cents: 5_000, max_cents: 9_000)
      staff(4_000, full_name: "Underpaid")
      staff(6_000)

      rows = json(answer("paid-below-band"))["rows"]

      expect(rows.map { |r| r["full_name"] }).to eq([ "Underpaid" ])
    end

    it "reports who has had no salary change in 24 months, as of the date asked" do
      person = staff(1_000, full_name: "Overlooked", hire_date: Date.new(2020, 1, 1))
      create(:salary_record, employee: person, effective_from: Date.new(2022, 1, 1), reason: "hire")

      result = answer("no-raise-24-months")

      expect(json(result)["rows"].map { |r| r["full_name"] }).to eq([ "Overlooked" ])
      expect(json(result)["months"]).to eq(24)
    end
  end

  it "answers every question on an empty organisation" do
    Questions::Catalog.all.each do |question|
      expect(described_class.call(question, today: today)[:result].as_json).to be_a(Hash)
    end
  end
end

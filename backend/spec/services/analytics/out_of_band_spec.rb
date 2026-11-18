require "rails_helper"

RSpec.describe Analytics::OutOfBand do
  let(:usd) { create(:currency, :usd) }
  let(:jpy) { create(:currency, :jpy) }
  let(:us) { create(:country, name: "United States", currency: usd) }
  let(:jp) { create(:country, name: "Japan", currency: jpy) }
  let(:department) { create(:department, name: "Engineering") }
  let(:engineer) { create(:job_title, name: "Engineer", department: department) }
  let(:other_department) { create(:department, name: "Sales") }
  let(:rep) { create(:job_title, name: "Rep", department: other_department) }

  before do
    create(:pay_band, job_title: engineer, country: us, min_cents: 5_000, max_cents: 9_000)
    create(:pay_band, job_title: engineer, country: jp, min_cents: 500_000, max_cents: 900_000)
  end

  def paid(cents, country: us, title: engineer, **attributes)
    create(:employee, country: country, department: title.department, job_title: title, current_salary_cents: cents, **attributes)
  end

  def run(params = {}) = described_class.call(params)
  def names(result) = result.rows.map { |row| row.employee.full_name }

  describe "who is outside a band" do
    let!(:below) { paid(4_000, full_name: "Below") }       # 20% under the 5,000 minimum
    let!(:above) { paid(10_800, full_name: "Above") }      # 20% over the 9,000 maximum
    let!(:at_min) { paid(5_000) }
    let!(:at_max) { paid(9_000) }
    let!(:inside) { paid(7_000) }

    it "reports those below the minimum or above the maximum" do
      expect(names(run)).to contain_exactly("Below", "Above")
    end

    it "counts the band edges as inside the band" do
      expect(run.total).to eq(2)
    end

    it "treats one unit outside as outside" do
      paid(4_999, full_name: "One under")
      paid(9_001, full_name: "One over")

      expect(names(run(limit: 200))).to include("One under", "One over")
    end

    it "says which way, and how far beyond the nearest edge as a fraction of it" do
      rows = run.rows.index_by { |row| row.employee.full_name }

      expect(rows["Below"]).to have_attributes(direction: "below", distance: Rational(1, 5), band_min: 5_000, band_max: 9_000)
      expect(rows["Above"]).to have_attributes(direction: "above", distance: Rational(1, 5))
    end

    it "orders the furthest outside first" do
      paid(2_500, full_name: "Far below")  # 50% under

      expect(names(run).first).to eq("Far below")
    end

    it "counts each direction, whatever is being shown" do
      result = run(direction: "below")

      expect(result).to have_attributes(total: 1, below: 1, above: 1)
      expect(names(result)).to eq([ "Below" ])
    end

    it "can show only those above" do
      expect(names(run(direction: "above"))).to eq([ "Above" ])
    end
  end

  describe "what counts as a band" do
    it "uses the band for the employee's own country, in that country's currency" do
      paid(700_000, country: jp, full_name: "Fine in yen")      # inside 500,000..900,000
      paid(7_000, country: jp, full_name: "Too little yen")      # far below the yen band

      expect(names(run)).to eq([ "Too little yen" ])
    end

    it "does not report someone whose job title has no band in their country" do
      paid(1, title: rep, full_name: "No band")

      expect(run.total).to eq(0)
    end
  end

  describe "who is counted" do
    before do
      paid(1_000, full_name: "Active")
      paid(1_000, full_name: "Left", status: "terminated", termination_date: Date.new(2025, 1, 1))
      paid(1_000, full_name: "Deleted", deleted_at: Time.current)
    end

    it "defaults to active employees and never includes deleted ones" do
      expect(names(run)).to eq([ "Active" ])
      expect(names(run(status: "all"))).to contain_exactly("Active", "Left")
      expect(names(run(status: "terminated"))).to eq([ "Left" ])
    end

    it "can be narrowed by country, department and job title" do
      paid(1_000, country: jp, full_name: "In Japan")
      sales_band = create(:pay_band, job_title: rep, country: us, min_cents: 5_000, max_cents: 9_000)
      paid(100, title: sales_band.job_title, full_name: "In sales")

      expect(names(run(country_id: jp.id.to_s))).to eq([ "In Japan" ])
      expect(names(run(department_id: other_department.id.to_s))).to eq([ "In sales" ])
      expect(names(run(job_title_id: rep.id.to_s))).to eq([ "In sales" ])
    end
  end

  describe "the limit" do
    before { 5.times { |i| paid(1_000 + i, full_name: "Person #{i}") } }

    it "caps the rows but not the total" do
      result = run(limit: 2)

      expect(result.rows.size).to eq(2)
      expect(result.total).to eq(5)
    end

    it "defaults to 50 and is capped at 200" do
      expect(described_class::DEFAULT_LIMIT).to eq(50)
      expect { run(limit: 201) }.to raise_error(InvalidRequest, /limit must be an integer between 1 and 200/)
      expect { run(limit: 0) }.to raise_error(InvalidRequest, /limit/)
    end
  end

  it "reports nothing when nobody is outside a band" do
    paid(7_000)

    expect(run).to have_attributes(total: 0, below: 0, above: 0, rows: [])
  end

  it "does not run a query per employee" do
    5.times { paid(1_000) }
    queries = 0
    counter = ->(*, payload) { queries += 1 unless payload[:name] == "SCHEMA" }

    ActiveSupport::Notifications.subscribed(counter, "sql.active_record") do
      run.rows.each { |row| [ row.employee.country.currency, row.employee.department, row.employee.job_title ] }
    end

    expect(queries).to be <= 9
  end

  it "refuses what it does not understand" do
    expect { run(colour: "red") }.to raise_error(InvalidRequest, /unknown parameter/)
    expect { run(direction: "sideways") }.to raise_error(InvalidRequest, /direction must be one of/)
    expect { run(status: "retired") }.to raise_error(InvalidRequest, /status must be one of/)
    expect { run(country_id: "x") }.to raise_error(InvalidRequest, /country_id/)
  end
end

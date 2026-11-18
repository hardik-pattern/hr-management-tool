require "rails_helper"

RSpec.describe Analytics::QueryEngine do
  let(:usd) { create(:currency, :usd) }
  let(:jpy) { create(:currency, :jpy) }
  let(:us) { create(:country, name: "United States", currency: usd) }
  let(:jp) { create(:country, name: "Japan", currency: jpy) }
  let(:engineering) { create(:department, name: "Engineering") }
  let(:sales) { create(:department, name: "Sales") }
  let(:engineer) { create(:job_title, name: "Engineer", department: engineering, level: 3) }
  let(:manager) { create(:job_title, name: "Manager", department: engineering, level: 5) }
  let(:rep) { create(:job_title, name: "Rep", department: sales, level: 2) }

  def hire(cents, country: us, title: engineer, **attributes)
    create(:employee, country: country, department: title.department, job_title: title, current_salary_cents: cents, **attributes)
  end

  def run(params = {}) = described_class.call(Analytics::Spec.from_params(params))
  def values(result) = result.rows.to_h { |row| [ row.group.values.map { |g| g[:label] }, row.value ] }

  describe "measures" do
    before { [ 1_000, 2_000, 3_000, 4_000, 5_000 ].each { |cents| hire(cents) } }

    {
      "sum" => 15_000, "avg" => 3_000, "median" => 3_000, "p25" => 2_000, "p75" => 4_000,
      "min" => 1_000, "max" => 5_000, "iqr" => 2_000
    }.each do |metric, expected|
      it "computes #{metric}" do
        expect(run("metric" => metric).total.value).to eq(expected)
      end
    end

    it "counts people for headcount" do
      result = run("metric" => "headcount")

      expect(result.total.value).to eq(5)
      expect(result.total.headcount).to eq(5)
    end

    it "rounds an average half up to a whole cent" do
      Employee.delete_all
      [ 100, 101 ].each { |cents| hire(cents) }

      expect(run("metric" => "avg").total.value).to eq(101) # 100.5
    end

    it "interpolates the median of an even count" do
      Employee.delete_all
      [ 100, 200, 300, 400 ].each { |cents| hire(cents) }

      expect(run("metric" => "median").total.value).to eq(250)
    end
  end

  describe "currencies" do
    it "converts every salary to USD cents, so countries can be compared" do
      hire(5_000_000, country: us)               # 50,000.00 USD
      hire(10_000_000, country: jp, title: rep)  # 10,000,000 yen * 0.0067 = 67,000.00 USD

      expect(run("metric" => "sum").total.value).to eq(5_000_000 + 6_700_000)
    end

    it "converts using the currency's own decimals, not a flat factor" do
      hire(10_000, country: jp) # 10,000 yen is whole units: 67.00 USD, not 0.67

      expect(run("metric" => "max").total.value).to eq(6_700)
    end

    it "takes a median across countries on the converted values" do
      hire(3_000_000, country: us)
      hire(5_000_000, country: us)
      hire(10_000_000, country: jp) # 6,700,000 USD cents

      expect(run("metric" => "median").total.value).to eq(5_000_000)
    end
  end

  describe "grouping" do
    before do
      hire(2_000, country: us, title: engineer)
      hire(4_000, country: us, title: engineer)
      hire(10_000, country: us, title: manager)
      hire(1_000, country: us, title: rep)
    end

    it "does not group by default, giving only the total" do
      result = run("metric" => "sum")

      expect(result.rows).to eq([])
      expect(result.total.value).to eq(17_000)
    end

    it "groups by department, in name order, with each group's headcount" do
      result = run("metric" => "sum", "group_by" => "department")

      expect(result.rows.map { |r| [ r.group["department"][:label], r.headcount, r.value ] })
        .to eq([ [ "Engineering", 3, 16_000 ], [ "Sales", 1, 1_000 ] ])
      expect(result.total).to have_attributes(headcount: 4, value: 17_000)
    end

    it "groups by job title" do
      expect(run("group_by" => "job_title").rows.map { |r| [ r.group["job_title"][:label], r.headcount ] })
        .to eq([ [ "Engineer", 2 ], [ "Manager", 1 ], [ "Rep", 1 ] ])
    end

    it "groups by country" do
      hire(6_700, country: jp, title: engineer)

      expect(run("group_by" => "country").rows.map { |r| [ r.group["country"][:label], r.headcount ] })
        .to eq([ [ "Japan", 1 ], [ "United States", 4 ] ])
    end

    it "groups by gender with readable labels" do
      Employee.delete_all
      hire(1_000, gender: "female")
      hire(2_000, gender: "non_binary")
      hire(3_000, gender: "undisclosed")

      labels = run("group_by" => "gender").rows.map { |r| r.group["gender"][:label] }
      expect(labels).to eq([ "Female", "Non-binary", "Not disclosed" ])
    end

    it "groups by level, labelled and ordered as numbers" do
      level_ten = create(:job_title, name: "Lead", department: engineering, level: 7)
      hire(1_000, title: level_ten)

      rows = run("group_by" => "level").rows
      expect(rows.map { |r| r.group["level"] }).to eq(
        [ { id: 2, label: "Level 2" }, { id: 3, label: "Level 3" }, { id: 5, label: "Level 5" }, { id: 7, label: "Level 7" } ],
      )
    end

    it "groups by two things at once" do
      hire(3_000, country: jp, title: rep)

      result = run("metric" => "headcount", "group_by" => "department,country")

      expect(result.rows.map { |r| [ r.group["department"][:label], r.group["country"][:label], r.headcount ] }).to eq(
        [ [ "Engineering", "United States", 3 ], [ "Sales", "Japan", 1 ], [ "Sales", "United States", 1 ] ],
      )
    end

    it "leaves out groups nobody belongs to" do
      expect(run("group_by" => "department").rows.size).to eq(2)
      create(:department, name: "Legal")

      expect(run("group_by" => "department").rows.map { |r| r.group["department"][:label] }).not_to include("Legal")
    end
  end

  describe "filters" do
    before do
      hire(1_000, country: us, title: engineer, gender: "female")
      hire(2_000, country: us, title: manager, gender: "male")
      hire(3_000, country: jp, title: rep, gender: "female")
    end

    it "narrows by country, department, job title, gender and level" do
      expect(run("country_id" => us.id.to_s).total.headcount).to eq(2)
      expect(run("department_id" => sales.id.to_s).total.headcount).to eq(1)
      expect(run("job_title_id" => manager.id.to_s).total.headcount).to eq(1)
      expect(run("gender" => "female").total.headcount).to eq(2)
      expect(run("level" => "5").total.headcount).to eq(1)
    end

    it "combines filters with AND" do
      expect(run("gender" => "female", "country_id" => us.id.to_s).total.headcount).to eq(1)
      expect(run("gender" => "male", "level" => "2").total.headcount).to eq(0)
    end

    it "filters within a grouping" do
      result = run("metric" => "sum", "group_by" => "job_title", "department_id" => engineering.id.to_s)

      expect(result.rows.map { |r| r.group["job_title"][:label] }).to eq([ "Engineer", "Manager" ])
    end
  end

  describe "who is counted" do
    let!(:active) { hire(1_000) }
    let!(:terminated) { hire(2_000, status: "terminated", termination_date: Date.new(2025, 3, 1)) }
    let!(:older_leaver) { hire(4_000, status: "terminated", termination_date: Date.new(2024, 1, 1)) }
    let!(:deleted) { hire(8_000, deleted_at: Time.current) }

    it "counts active employees by default" do
      expect(run("metric" => "sum").total.value).to eq(1_000)
    end

    it "can count leavers, or everyone kept" do
      expect(run("metric" => "sum", "status" => "terminated").total.value).to eq(6_000)
      expect(run("metric" => "sum", "status" => "all").total.value).to eq(7_000)
    end

    it "never counts soft-deleted employees, whatever the status" do
      expect(run("metric" => "headcount", "status" => "active").total.headcount).to eq(1)
      expect(run("metric" => "headcount", "status" => "terminated").total.headcount).to eq(2)
      expect(run("metric" => "headcount", "status" => "all").total.headcount).to eq(3)
      expect(run("metric" => "sum", "status" => "all").total.value).to eq(7_000) # 1,000 + 2,000 + 4,000, not the deleted 8,000
    end

    it "limits leavers to those who left after a date" do
      result = run("metric" => "sum", "terminated_after" => "2025-01-01")

      expect(result.spec.status).to eq("terminated")
      expect(result.total.value).to eq(2_000)
      expect(result.total.headcount).to eq(1)
    end

    it "includes someone who left exactly on the date" do
      expect(run("terminated_after" => "2025-03-01").total.headcount).to eq(1)
      expect(run("terminated_after" => "2025-03-02").total.headcount).to eq(0)
    end
  end

  describe "nothing to measure" do
    it "reports no value, rather than zero or an error, for a money measure" do
      result = run("metric" => "median", "group_by" => "department")

      expect(result.rows).to eq([])
      expect(result.total).to have_attributes(headcount: 0, value: nil)
    end

    it "reports a headcount of zero as zero, since a count of nobody is 0" do
      expect(run("metric" => "headcount").total).to have_attributes(headcount: 0, value: 0)
    end
  end
end

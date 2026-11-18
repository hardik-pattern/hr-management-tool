require "rails_helper"

RSpec.describe Analytics::Spec do
  def build_spec(params = {}) = described_class.from_params(params)

  describe "defaults" do
    it "counts active employees, ungrouped" do
      spec = build_spec

      expect(spec).to have_attributes(metric: "headcount", group_by: [], status: "active", filters: {}, unit: "count")
    end

    it "reports money measures in USD cents" do
      expect(build_spec("metric" => "median").unit).to eq("usd_cents")
    end
  end

  describe "reading parameters" do
    it "accepts every metric" do
      described_class::METRICS.each { |metric| expect(build_spec("metric" => metric).metric).to eq(metric) }
    end

    it "reads group_by as a comma separated list or as an array" do
      expect(build_spec("group_by" => "department, country").group_by).to eq(%w[department country])
      expect(build_spec("group_by" => %w[gender]).group_by).to eq(%w[gender])
    end

    it "reads filters as the right types" do
      spec = build_spec("country_id" => "3", "level" => "5", "gender" => "female", "department_id" => "2", "job_title_id" => "9")

      expect(spec.filters).to eq(country_id: 3, level: 5, gender: "female", department_id: 2, job_title_id: 9)
    end

    it "accepts symbol keys, as from a Ruby caller" do
      expect(build_spec(metric: "sum").metric).to eq("sum")
    end

    it "reports the question back" do
      spec = build_spec("metric" => "median", "group_by" => "level", "country_id" => "1")

      expect(spec.to_h).to eq(metric: "median", group_by: [ "level" ], status: "active", filters: { country_id: 1 })
    end
  end

  describe "terminated_after" do
    it "implies the terminated status" do
      spec = build_spec("terminated_after" => "2025-01-31")

      expect(spec.status).to eq("terminated")
      expect(spec.to_h[:filters]).to eq(terminated_after: "2025-01-31")
    end

    it "agrees with an explicit terminated status" do
      expect(build_spec("terminated_after" => "2025-01-31", "status" => "terminated").status).to eq("terminated")
    end

    it "contradicts any other status" do
      expect { build_spec("terminated_after" => "2025-01-31", "status" => "active") }
        .to raise_error(InvalidRequest, /only applies to terminated/)
    end

    it "must be a real date" do
      expect { build_spec("terminated_after" => "last year") }.to raise_error(InvalidRequest, /terminated_after must be a date/)
      expect { build_spec("terminated_after" => "2025-13-45") }.to raise_error(InvalidRequest, /terminated_after/)
    end
  end

  describe "refusing what it does not understand" do
    {
      "an unknown parameter" => [ { "contry_id" => "1" }, /unknown parameter\(s\): contry_id/ ],
      "an unknown metric" => [ { "metric" => "mode" }, /metric must be one of/ ],
      "an unknown status" => [ { "status" => "retired" }, /status must be one of/ ],
      "an unknown grouping" => [ { "group_by" => "salary" }, /group_by must be from/ ],
      "a repeated grouping" => [ { "group_by" => "country,country" }, /cannot repeat/ ],
      "three groupings" => [ { "group_by" => "country,department,gender" }, /at most 2/ ],
      "a non-numeric id" => [ { "country_id" => "abc" }, /country_id must be an integer at least 1/ ],
      "a zero id" => [ { "department_id" => "0" }, /department_id must be an integer/ ],
      "a level above 7" => [ { "level" => "8" }, /level must be an integer between 1 and 7/ ],
      "an unknown gender" => [ { "gender" => "x" }, /gender must be one of/ ]
    }.each do |description, (params, message)|
      it "rejects #{description}" do
        expect { build_spec(params) }.to raise_error(InvalidRequest, message)
      end
    end
  end
end

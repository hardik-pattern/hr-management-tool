require "rails_helper"

RSpec.describe "Analytics", type: :request do
  let(:usd) { create(:currency, :usd) }
  let(:jpy) { create(:currency, :jpy) }
  let(:us) { create(:country, name: "United States", currency: usd) }
  let(:jp) { create(:country, name: "Japan", currency: jpy) }
  let(:engineering) { create(:department, name: "Engineering") }
  let(:engineer) { create(:job_title, name: "Engineer", department: engineering) }

  def hire(cents, country: us, **attributes)
    create(:employee, country: country, department: engineering, job_title: engineer, current_salary_cents: cents, **attributes)
  end

  def data = response.parsed_body.fetch("data")
  def error = response.parsed_body.fetch("error")

  describe "GET /api/v1/analytics/summary" do
    before do
      hire(5_000_000)
      hire(7_000_000)
      hire(10_000_000, country: jp) # 67,000.00 USD
    end

    it "answers a grouped question, with formatted USD values and a total" do
      get "/api/v1/analytics/summary", params: { metric: "median", group_by: "country" }

      expect(response).to have_http_status(:ok)
      expect(data).to include(
        "metric" => "median", "unit" => "usd_cents", "currency" => "USD", "group_by" => [ "country" ], "status" => "active",
      )
      expect(data["rows"]).to eq([
        { "group" => { "country" => { "id" => jp.id, "label" => "Japan" } }, "headcount" => 1, "value" => 6_700_000, "formatted" => "67,000.00 USD" },
        { "group" => { "country" => { "id" => us.id, "label" => "United States" } }, "headcount" => 2, "value" => 6_000_000, "formatted" => "60,000.00 USD" }
      ])
      expect(data["total"]).to eq("group" => {}, "headcount" => 3, "value" => 6_700_000, "formatted" => "67,000.00 USD")
    end

    it "reports counts as numbers with no currency" do
      get "/api/v1/analytics/summary", params: { metric: "headcount", group_by: "department" }

      expect(data).to include("unit" => "count", "currency" => nil)
      expect(data["rows"].first).to include("value" => 3, "formatted" => "3")
    end

    it "defaults to a headcount of active employees, ungrouped" do
      get "/api/v1/analytics/summary"

      expect(data).to include("metric" => "headcount", "group_by" => [], "rows" => [])
      expect(data["total"]).to include("headcount" => 3, "value" => 3)
    end

    it "echoes the filters it applied" do
      get "/api/v1/analytics/summary", params: { metric: "sum", country_id: us.id, status: "all" }

      expect(data["filters"]).to eq("country_id" => us.id)
      expect(data["status"]).to eq("all")
      expect(data["total"]["value"]).to eq(12_000_000)
    end

    it "says there is no value, rather than failing, when nobody matches" do
      get "/api/v1/analytics/summary", params: { metric: "median", gender: "male", country_id: jp.id }

      expect(response).to have_http_status(:ok)
      expect(data["total"]).to eq("group" => {}, "headcount" => 0, "value" => nil, "formatted" => nil)
    end

    it "counts leavers since a date" do
      hire(2_000_000, status: "terminated", termination_date: Date.new(2025, 6, 1))

      get "/api/v1/analytics/summary", params: { metric: "sum", terminated_after: "2025-01-01" }

      expect(data).to include("status" => "terminated")
      expect(data["total"]).to include("headcount" => 1, "value" => 2_000_000)
    end

    {
      "an unknown parameter" => [ { contry_id: 1 }, "contry_id" ],
      "an unknown metric" => [ { metric: "mode" }, "metric must be one of" ],
      "an unknown grouping" => [ { group_by: "salary" }, "group_by must be from" ],
      "too many groupings" => [ { group_by: "country,department,gender" }, "at most 2" ],
      "a bad id" => [ { country_id: "abc" }, "country_id must be an integer" ],
      "a contradictory status" => [ { terminated_after: "2025-01-01", status: "active" }, "only applies to terminated" ]
    }.each do |description, (params, message)|
      it "returns 400 for #{description}" do
        get "/api/v1/analytics/summary", params: params

        expect(response).to have_http_status(:bad_request)
        expect(error["code"]).to eq("bad_request")
        expect(error["message"]).to include(message)
      end
    end

    it "does not run a query per group" do
      hire(1_000_000, country: jp)
      queries = 0
      counter = ->(*, payload) { queries += 1 unless payload[:name] == "SCHEMA" }

      ActiveSupport::Notifications.subscribed(counter, "sql.active_record") do
        get "/api/v1/analytics/summary", params: { metric: "median", group_by: "country,job_title" }
      end

      expect(queries).to be <= 4
    end
  end
end

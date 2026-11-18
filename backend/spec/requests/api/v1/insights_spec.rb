require "rails_helper"

RSpec.describe "Insights", type: :request do
  let(:usd) { create(:currency, :usd) }
  let(:us) { create(:country, name: "United States", currency: usd) }
  let(:department) { create(:department, name: "Engineering") }
  let(:title) { create(:job_title, name: "Senior Engineer", department: department, level: 4) }

  def staff(gender, salaries)
    salaries.each do |cents|
      create(:employee, gender: gender, country: us, department: department, job_title: title, current_salary_cents: cents)
    end
  end

  def data = response.parsed_body.fetch("data")
  def error = response.parsed_body.fetch("error")

  describe "GET /api/v1/insights/gender_pay_gap" do
    it "reports the like-for-like gap overall and for each job title" do
      staff("female", [ 90 ] * 3)
      staff("male", [ 100 ] * 3)

      get "/api/v1/insights/gender_pay_gap"

      expect(response).to have_http_status(:ok)
      expect(data).to include(
        "status" => "active", "min_group_size" => 3, "small_sample_below" => 20,
        "adjusted_gap_percent" => -10.0, "unadjusted_gap_percent" => -10.0,
        "women" => 3, "men" => 3, "women_compared" => 3, "comparisons_made" => 1, "comparisons_possible" => 1,
      )
      expect(data["rows"]).to eq([
        {
          "job_title" => { "id" => title.id, "name" => "Senior Engineer", "level" => 4, "department" => "Engineering" },
          "women" => 3, "men" => 3, "women_compared" => 3, "gap_percent" => -10.0, "small_sample" => true
        }
      ])
    end

    it "does not flag a gap resting on many women as a small sample" do
      staff("female", [ 90 ] * 20)
      staff("male", [ 100 ] * 20)

      get "/api/v1/insights/gender_pay_gap"

      expect(data["rows"].first).to include("women_compared" => 20, "small_sample" => false)
    end

    it "gives no gap, and does not call it a small sample, when there is nothing to compare" do
      staff("female", [ 90 ])

      get "/api/v1/insights/gender_pay_gap"

      expect(data).to include("adjusted_gap_percent" => nil, "unadjusted_gap_percent" => nil)
      expect(data["rows"].first).to include("gap_percent" => nil, "small_sample" => false)
    end

    it "answers an empty organisation without failing" do
      get "/api/v1/insights/gender_pay_gap"

      expect(response).to have_http_status(:ok)
      expect(data).to include("rows" => [], "women" => 0, "men" => 0)
    end

    it "can be narrowed, and refuses what it does not understand" do
      get "/api/v1/insights/gender_pay_gap", params: { department_id: department.id, status: "all" }
      expect(response).to have_http_status(:ok)
      expect(data["filters"]).to eq("department_id" => department.id)

      get "/api/v1/insights/gender_pay_gap", params: { colour: "red" }
      expect(response).to have_http_status(:bad_request)
      expect(error["message"]).to include("colour")

      get "/api/v1/insights/gender_pay_gap", params: { status: "retired" }
      expect(response).to have_http_status(:bad_request)
    end
  end

  describe "GET /api/v1/insights/out_of_band" do
    let(:band) { create(:pay_band, job_title: title, country: us, min_cents: 5_000_000, max_cents: 9_000_000) }

    before do
      band
      create(:employee, full_name: "Underpaid", gender: "female", country: us, department: department, job_title: title, current_salary_cents: 4_000_000)
      create(:employee, full_name: "Fine", country: us, department: department, job_title: title, current_salary_cents: 7_000_000)
    end

    it "lists who is outside their band, with the direction, distance and band" do
      get "/api/v1/insights/out_of_band"

      expect(response).to have_http_status(:ok)
      expect(data).to include("status" => "active", "direction" => "any", "limit" => 50, "total" => 1, "below" => 1, "above" => 0)
      expect(data["rows"].size).to eq(1)
      expect(data["rows"].first).to include(
        "full_name" => "Underpaid", "direction" => "below", "distance_percent" => 20.0,
        "salary" => { "amount_cents" => 4_000_000, "currency" => "USD", "formatted" => "40,000.00 USD" },
        "band" => { "min_cents" => 5_000_000, "max_cents" => 9_000_000, "formatted" => "50,000.00 USD to 90,000.00 USD" },
        "country" => include("name" => "United States"), "department" => include("name" => "Engineering"),
        "job_title" => include("name" => "Senior Engineer")
      )
    end

    it "can be filtered by direction, and answers an empty result without failing" do
      get "/api/v1/insights/out_of_band", params: { direction: "above" }

      expect(response).to have_http_status(:ok)
      expect(data).to include("total" => 0, "rows" => [])
    end

    it "returns 400 for what it does not understand" do
      get "/api/v1/insights/out_of_band", params: { direction: "sideways" }
      expect(response).to have_http_status(:bad_request)

      get "/api/v1/insights/out_of_band", params: { limit: 999 }
      expect(error["message"]).to include("limit")
    end
  end

  describe "GET /api/v1/insights/stale_salaries" do
    around { |example| travel_to(Date.new(2025, 6, 15)) { example.run } }

    before do
      person = create(:employee, full_name: "Overlooked", country: us, department: department, job_title: title, hire_date: Date.new(2020, 1, 1))
      create(:salary_record, employee: person, effective_from: Date.new(2020, 1, 1), reason: "hire")
      create(:salary_record, employee: person, effective_from: Date.new(2022, 3, 10), reason: "merit")
    end

    it "lists who has gone longest without a change" do
      get "/api/v1/insights/stale_salaries"

      expect(response).to have_http_status(:ok)
      expect(data).to include("status" => "active", "months" => 24, "total" => 1)
      expect(data["rows"].first).to include("full_name" => "Overlooked", "last_change_on" => "2022-03-10", "months_since" => 39)
    end

    it "uses the number of months asked for" do
      get "/api/v1/insights/stale_salaries", params: { months: 60 }

      expect(data).to include("months" => 60, "total" => 0)
    end

    it "returns 400 for what it does not understand" do
      get "/api/v1/insights/stale_salaries", params: { months: 0 }
      expect(response).to have_http_status(:bad_request)
      expect(error["message"]).to include("months")
    end
  end
end

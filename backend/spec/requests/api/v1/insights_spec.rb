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
end

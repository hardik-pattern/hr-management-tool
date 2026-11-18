require "rails_helper"

RSpec.describe "Questions", type: :request do
  def data = response.parsed_body.fetch("data")
  def error = response.parsed_body.fetch("error")

  describe "GET /api/v1/questions" do
    it "lists the catalog without running any of it" do
      get "/api/v1/questions"

      expect(response).to have_http_status(:ok)
      expect(data.size).to eq(7)
      expect(data.first.keys).to match_array(%w[id title description kind])
      expect(data.pluck("id")).to include("gender-pay-gap", "payroll-by-department")
    end
  end

  describe "GET /api/v1/questions/:id/answer" do
    it "answers a question, saying how it was asked" do
      department = create(:department, name: "Engineering")
      country = create(:country, currency: create(:currency, :usd))
      create(:employee, country: country, department: department, job_title: create(:job_title, department: department), current_salary_cents: 5_000_00)

      get "/api/v1/questions/payroll-by-department/answer"

      expect(response).to have_http_status(:ok)
      expect(data).to include("id" => "payroll-by-department", "kind" => "summary", "params" => { "metric" => "sum", "group_by" => "department" })
      expect(data["result"]["rows"].first).to include("headcount" => 1, "value" => 500_000, "formatted" => "5,000.00 USD")
    end

    it "answers every question in the catalog" do
      Questions::Catalog.all.each do |question|
        get "/api/v1/questions/#{question.id}/answer"

        expect(response).to have_http_status(:ok), "#{question.id} failed: #{response.body}"
        expect(data["result"]).to be_a(Hash)
      end
    end

    it "returns 404 for a question that does not exist" do
      get "/api/v1/questions/no-such-question/answer"

      expect(response).to have_http_status(:not_found)
      expect(error).to include("code" => "not_found", "message" => "Question not found")
    end

    it "refuses parameters, since a question is a fixed definition" do
      get "/api/v1/questions/payroll-by-department/answer", params: { metric: "avg" }

      expect(response).to have_http_status(:bad_request)
      expect(error["message"]).to include("metric")
    end
  end
end

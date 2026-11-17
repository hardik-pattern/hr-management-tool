require "rails_helper"

RSpec.describe "Reference data", type: :request do
  def data = response.parsed_body.fetch("data")

  describe "GET /api/v1/reference/countries" do
    it "lists countries by name with their currency code" do
      jpy = create(:currency, :jpy)
      create(:country, code: "JP", name: "Japan", currency: jpy)
      create(:country, code: "IN", name: "India", currency: create(:currency, code: "INR"))

      get "/api/v1/reference/countries"

      expect(response).to have_http_status(:ok)
      expect(data.pluck("name")).to eq(%w[India Japan])
      expect(data.last).to include("code" => "JP", "currency_code" => "JPY")
    end

    it "does not run a query per country" do
      create_list(:country, 3)

      queries = count_queries { get "/api/v1/reference/countries" }

      expect(queries).to be <= 2
    end
  end

  describe "GET /api/v1/reference/currencies" do
    it "lists currencies by code with the rate as an exact string" do
      create(:currency, :usd)
      create(:currency, :jpy)

      get "/api/v1/reference/currencies"

      expect(data.pluck("code")).to eq(%w[JPY USD])
      expect(data.first).to include("minor_unit_exponent" => 0, "rate_to_usd" => "0.0067")
    end
  end

  describe "GET /api/v1/reference/departments" do
    it "lists departments by name" do
      create(:department, name: "Sales")
      create(:department, name: "Engineering")

      get "/api/v1/reference/departments"

      expect(data.pluck("name")).to eq(%w[Engineering Sales])
    end
  end

  describe "GET /api/v1/reference/job_titles" do
    it "lists job titles with level and department" do
      engineering = create(:department, name: "Engineering")
      create(:job_title, name: "Staff Engineer", level: 5, department: engineering)

      get "/api/v1/reference/job_titles"

      expect(data.first).to include(
        "name" => "Staff Engineer", "level" => 5,
        "department_id" => engineering.id, "department_name" => "Engineering"
      )
    end

    it "does not run a query per job title" do
      create_list(:job_title, 3)

      queries = count_queries { get "/api/v1/reference/job_titles" }

      expect(queries).to be <= 2
    end
  end

  it "returns an empty list, not an error, when there is no data" do
    get "/api/v1/reference/departments"

    expect(response).to have_http_status(:ok)
    expect(data).to eq([])
  end

  def count_queries(&block)
    count = 0
    counter = ->(*, payload) { count += 1 unless payload[:name] == "SCHEMA" }
    ActiveSupport::Notifications.subscribed(counter, "sql.active_record", &block)
    count
  end
end

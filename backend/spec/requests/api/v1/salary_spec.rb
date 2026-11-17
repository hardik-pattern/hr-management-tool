require "rails_helper"

RSpec.describe "Salary changes and history", type: :request do
  let(:today) { Date.new(2025, 6, 15) }
  let(:employee) { create(:employee, hire_date: Date.new(2020, 1, 1), current_salary_cents: 6_000_000) }

  around { |example| travel_to(today) { example.run } }

  before do
    create(:salary_record, employee: employee, amount_cents: 6_000_000,
                           effective_from: Date.new(2020, 1, 1), reason: "hire")
  end

  def data = response.parsed_body.fetch("data")
  def error = response.parsed_body.fetch("error")

  describe "POST /api/v1/employees/:id/salary_changes" do
    let(:params) { { salary_change: { amount_cents: 6_600_000, effective_from: "2025-06-01", reason: "merit" } } }

    it "appends a record and returns it with the updated employee" do
      expect { post "/api/v1/employees/#{employee.id}/salary_changes", params: params, as: :json }
        .to change { employee.salary_records.count }.by(1)

      expect(response).to have_http_status(:created)
      expect(data["salary_record"]).to include(
        "amount_cents" => 6_600_000, "effective_from" => "2025-06-01", "reason" => "merit",
        "currency" => employee.current_currency
      )
      expect(data["employee"]["salary"]["amount_cents"]).to eq(6_600_000)
      expect(employee.reload.current_salary_cents).to eq(6_600_000)
    end

    {
      "a non-positive amount" => [ { amount_cents: 0 }, "amount_cents" ],
      "a future date" => [ { effective_from: "2025-06-16" }, "effective_from" ],
      "a date before the latest record" => [ { effective_from: "2019-12-31" }, "effective_from" ],
      "the hire reason" => [ { reason: "hire" }, "reason" ],
      "an unknown reason" => [ { reason: "bonus" }, "reason" ],
      "a missing reason" => [ { reason: nil }, "reason" ],
      "a missing date" => [ { effective_from: nil }, "effective_from" ]
    }.each do |description, (overrides, field)|
      it "returns 422 for #{description} and changes nothing" do
        params[:salary_change].merge!(overrides)

        post "/api/v1/employees/#{employee.id}/salary_changes", params: params, as: :json

        expect(response).to have_http_status(:unprocessable_content)
        expect(error["details"]).to have_key(field)
        expect(employee.reload.current_salary_cents).to eq(6_000_000)
        expect(employee.salary_records.count).to eq(1)
      end
    end

    it "returns 422 for a missing amount" do
      params[:salary_change].delete(:amount_cents)

      post "/api/v1/employees/#{employee.id}/salary_changes", params: params, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(error["details"]).to have_key("amount_cents")
    end

    it "returns 422 for a terminated employee" do
      employee.update!(status: "terminated", termination_date: Date.new(2025, 1, 1))

      post "/api/v1/employees/#{employee.id}/salary_changes", params: params, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(error["details"]).to have_key("employee")
    end

    it "refuses a client-supplied currency" do
      params[:salary_change][:currency] = "USD"

      post "/api/v1/employees/#{employee.id}/salary_changes", params: params, as: :json

      expect(response).to have_http_status(:bad_request)
      expect(error["message"]).to include("currency")
    end

    it "returns 400 without the salary_change key" do
      post "/api/v1/employees/#{employee.id}/salary_changes", params: {}, as: :json

      expect(response).to have_http_status(:bad_request)
    end

    it "returns 404 for unknown and soft-deleted employees" do
      post "/api/v1/employees/0/salary_changes", params: params, as: :json
      expect(response).to have_http_status(:not_found)

      employee.update!(deleted_at: Time.current)
      post "/api/v1/employees/#{employee.id}/salary_changes", params: params, as: :json
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /api/v1/employees/:id/salary_records" do
    it "lists the history newest first with formatted amounts" do
      Salaries::Change.call(employee: employee, amount_cents: 6_600_000, effective_from: "2024-01-01", reason: "merit")
      Salaries::Change.call(employee: employee, amount_cents: 7_000_000, effective_from: "2025-01-01", reason: "promotion")

      get "/api/v1/employees/#{employee.id}/salary_records"

      expect(response).to have_http_status(:ok)
      expect(data.pluck("reason")).to eq(%w[promotion merit hire])
      expect(data.first).to include("amount_cents" => 7_000_000, "formatted" => a_string_matching(/\A70,000\.00 /))
    end

    it "orders records on the same date by creation, newest first" do
      Salaries::Change.call(employee: employee, amount_cents: 6_100_000, effective_from: "2025-01-01", reason: "merit")
      Salaries::Change.call(employee: employee, amount_cents: 6_200_000, effective_from: "2025-01-01", reason: "correction")

      get "/api/v1/employees/#{employee.id}/salary_records"

      expect(data.first(2).pluck("reason")).to eq(%w[correction merit])
    end

    it "does not run a query per record" do
      3.times do |i|
        Salaries::Change.call(employee: employee, amount_cents: 6_100_000 + i, effective_from: "2025-01-0#{i + 1}", reason: "merit")
      end
      queries = 0
      counter = ->(*, payload) { queries += 1 unless payload[:name] == "SCHEMA" }

      ActiveSupport::Notifications.subscribed(counter, "sql.active_record") do
        get "/api/v1/employees/#{employee.id}/salary_records"
      end

      expect(queries).to be <= 6
    end

    it "keeps the history of a terminated employee readable" do
      employee.update!(status: "terminated", termination_date: Date.new(2025, 1, 1))

      get "/api/v1/employees/#{employee.id}/salary_records"

      expect(response).to have_http_status(:ok)
      expect(data.size).to eq(1)
    end

    it "returns 404 for a soft-deleted employee" do
      employee.update!(deleted_at: Time.current)

      get "/api/v1/employees/#{employee.id}/salary_records"

      expect(response).to have_http_status(:not_found)
    end
  end
end

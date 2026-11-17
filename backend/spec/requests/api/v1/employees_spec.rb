require "rails_helper"

RSpec.describe "Employees", type: :request do
  let(:country) { create(:country, currency: create(:currency, :usd)) }
  let(:department) { create(:department) }
  let(:job_title) { create(:job_title, department: department) }
  let(:valid_params) do
    {
      employee: {
        full_name: "Asha Rao", email: "asha@acme.test", gender: "female", hire_date: "2024-03-01",
        country_id: country.id, department_id: department.id, job_title_id: job_title.id,
        salary_cents: 8_000_000
      }
    }
  end

  def data = response.parsed_body.fetch("data")
  def error = response.parsed_body.fetch("error")

  describe "POST /api/v1/employees" do
    it "creates the employee with a hire record and returns it" do
      expect { post "/api/v1/employees", params: valid_params, as: :json }
        .to change(Employee, :count).by(1).and change(SalaryRecord, :count).by(1)

      expect(response).to have_http_status(:created)
      expect(data).to include("full_name" => "Asha Rao", "status" => "active")
      expect(data["salary"]).to eq("amount_cents" => 8_000_000, "currency" => "USD", "formatted" => "80,000.00 USD")
      expect(data["employee_number"]).to match(/\AE\d{6}\z/)
    end

    it "returns field errors and saves nothing when invalid" do
      valid_params[:employee][:email] = "nope"

      expect { post "/api/v1/employees", params: valid_params, as: :json }.not_to change(Employee, :count)

      expect(response).to have_http_status(:unprocessable_content)
      expect(error).to include("code" => "validation_failed")
      expect(error["details"]).to have_key("email")
    end

    it "reports a missing salary as a validation error, not a server error" do
      valid_params[:employee].delete(:salary_cents)

      post "/api/v1/employees", params: valid_params, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(error["details"]).to have_key("current_salary_cents")
    end

    it "rejects fields clients may not set, such as status" do
      valid_params[:employee][:status] = "terminated"

      post "/api/v1/employees", params: valid_params, as: :json

      expect(response).to have_http_status(:bad_request)
      expect(error["message"]).to include("status")
    end

    it "returns 400 when the employee key is missing" do
      post "/api/v1/employees", params: {}, as: :json

      expect(response).to have_http_status(:bad_request)
    end
  end

  describe "GET /api/v1/employees/:id" do
    it "returns the employee" do
      employee = create(:employee)

      get "/api/v1/employees/#{employee.id}"

      expect(response).to have_http_status(:ok)
      expect(data["id"]).to eq(employee.id)
    end

    it "returns 404 for an unknown id" do
      get "/api/v1/employees/0"

      expect(response).to have_http_status(:not_found)
      expect(error["code"]).to eq("not_found")
    end

    it "returns 404 for a soft-deleted employee" do
      employee = create(:employee, :deleted)

      get "/api/v1/employees/#{employee.id}"

      expect(response).to have_http_status(:not_found)
    end

    it "does not fire a query per association" do
      employee = create(:employee)
      queries = 0
      counter = ->(*, payload) { queries += 1 unless payload[:name] == "SCHEMA" }

      ActiveSupport::Notifications.subscribed(counter, "sql.active_record") do
        get "/api/v1/employees/#{employee.id}"
      end

      expect(queries).to be <= 6
    end
  end

  describe "PATCH /api/v1/employees/:id" do
    let(:employee) { create(:employee, full_name: "Old Name", department: department, job_title: job_title) }

    it "updates profile fields" do
      patch "/api/v1/employees/#{employee.id}", params: { employee: { full_name: "New Name" } }, as: :json

      expect(response).to have_http_status(:ok)
      expect(data["full_name"]).to eq("New Name")
      expect(employee.reload.full_name).to eq("New Name")
    end

    it "moves the employee to another department and job title together" do
      other_department = create(:department)
      other_title = create(:job_title, department: other_department)

      patch "/api/v1/employees/#{employee.id}",
            params: { employee: { department_id: other_department.id, job_title_id: other_title.id } }, as: :json

      expect(response).to have_http_status(:ok)
      expect(data["department"]["id"]).to eq(other_department.id)
    end

    it "rejects a department change that leaves the job title behind" do
      patch "/api/v1/employees/#{employee.id}",
            params: { employee: { department_id: create(:department).id } }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(error["details"]).to have_key("job_title")
    end

    it "refuses to change country, hire date, salary or status" do
      %i[country_id hire_date current_salary_cents salary_cents status].each do |field|
        patch "/api/v1/employees/#{employee.id}", params: { employee: { field => "x" } }, as: :json

        expect(response).to have_http_status(:bad_request), "expected #{field} to be refused"
      end
    end

    it "returns validation errors" do
      patch "/api/v1/employees/#{employee.id}", params: { employee: { email: "" } }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(error["details"]).to have_key("email")
    end

    it "returns 404 for a soft-deleted employee" do
      deleted = create(:employee, :deleted)

      patch "/api/v1/employees/#{deleted.id}", params: { employee: { full_name: "X" } }, as: :json

      expect(response).to have_http_status(:not_found)
    end
  end
end

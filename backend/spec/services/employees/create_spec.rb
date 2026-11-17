require "rails_helper"

RSpec.describe Employees::Create do
  let(:country) { create(:country, currency: create(:currency, :jpy)) }
  let(:department) { create(:department) }
  let(:job_title) { create(:job_title, department: department) }
  let(:params) do
    {
      full_name: "Asha Rao", email: " Asha.Rao@ACME.test ", gender: "female",
      hire_date: Date.new(2024, 3, 1), country_id: country.id,
      department_id: department.id, job_title_id: job_title.id, salary_cents: 8_000_000
    }
  end

  describe "a valid request" do
    subject(:employee) { described_class.call(**params) }

    it "creates the employee with the salary in the country's currency" do
      expect(employee).to be_persisted
      expect(employee).to have_attributes(
        full_name: "Asha Rao", email: "asha.rao@acme.test", status: "active",
        current_salary_cents: 8_000_000, current_currency: "JPY"
      )
    end

    it "creates the initial hire record dated on the hire date" do
      expect(employee.salary_records.count).to eq(1)
      expect(employee.salary_records.first).to have_attributes(
        amount_cents: 8_000_000, currency: "JPY",
        effective_from: Date.new(2024, 3, 1), reason: "hire"
      )
    end

    it "assigns a sequential employee number derived from the id" do
      first = described_class.call(**params)
      second = described_class.call(**params.merge(email: "second@acme.test"))

      expect(first.employee_number).to eq(format("E%06d", first.id))
      expect(second.employee_number).to eq(format("E%06d", second.id))
      expect(second.id).to be > first.id
    end

    it "allows a hire date in the future so new starters can be entered early" do
      travel_to(Date.new(2025, 1, 1)) do
        future = described_class.call(**params.merge(hire_date: Date.new(2025, 2, 1)))

        expect(future.salary_records.first.effective_from).to eq(Date.new(2025, 2, 1))
      end
    end
  end

  describe "an invalid request" do
    def expect_nothing_saved(error_field)
      expect { described_class.call(**params) }
        .to raise_error(ActiveRecord::RecordInvalid) { |error|
          expect(error.record.errors).to have_key(error_field)
        }
      expect(Employee.count).to eq(0)
      expect(SalaryRecord.count).to eq(0)
    end

    it "rejects a missing name" do
      params[:full_name] = ""

      expect_nothing_saved(:full_name)
    end

    it "rejects a non-positive salary" do
      params[:salary_cents] = 0

      expect_nothing_saved(:current_salary_cents)
    end

    it "rejects an unknown country" do
      params[:country_id] = 0

      expect_nothing_saved(:country)
    end

    it "rejects a job title from another department" do
      params[:job_title_id] = create(:job_title).id

      expect_nothing_saved(:job_title)
    end

    it "rejects an email already used by a kept employee" do
      create(:employee, email: "asha.rao@acme.test")

      expect { described_class.call(**params) }
        .to raise_error(ActiveRecord::RecordInvalid) { |error|
          expect(error.record.errors[:email]).to include("has already been taken")
        }
      expect(Employee.count).to eq(1)
    end
  end

  it "rolls back the employee if the hire record cannot be created" do
    allow_any_instance_of(SalaryRecord).to receive(:save!).and_raise(ActiveRecord::RecordInvalid)

    expect { described_class.call(**params) }.to raise_error(ActiveRecord::RecordInvalid)
    expect(Employee.count).to eq(0)
  end
end

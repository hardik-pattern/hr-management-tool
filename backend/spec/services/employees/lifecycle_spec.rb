require "rails_helper"

RSpec.describe "Employee lifecycle services" do
  let(:today) { Date.new(2025, 6, 15) }
  let(:employee) { create(:employee, hire_date: Date.new(2020, 1, 1), current_salary_cents: 6_000_000) }

  around { |example| travel_to(today) { example.run } }

  before { create(:salary_record, employee: employee, amount_cents: 6_000_000, effective_from: Date.new(2020, 1, 1)) }

  def expect_rejected(field, message)
    expect { yield }.to raise_error(ActiveRecord::RecordInvalid) { |error|
      expect(error.record.errors[field].join).to include(message)
    }
  end

  describe Employees::Terminate do
    it "marks the employee terminated on the given date" do
      described_class.call(employee: employee, termination_date: "2025-06-01")

      expect(employee.reload).to have_attributes(status: "terminated", termination_date: Date.new(2025, 6, 1))
    end

    it "accepts today and a Date object" do
      described_class.call(employee: employee, termination_date: today)

      expect(employee.reload).to be_terminated
    end

    it "requires a date" do
      expect_rejected(:termination_date, "required") { described_class.call(employee: employee, termination_date: nil) }
      expect(employee.reload).to be_active
    end

    it "refuses an unparseable date" do
      expect_rejected(:termination_date, "required") do
        described_class.call(employee: employee, termination_date: "not-a-date")
      end
    end

    it "refuses a future date" do
      expect_rejected(:termination_date, "cannot be in the future") do
        described_class.call(employee: employee, termination_date: today + 1)
      end
      expect(employee.reload).to be_active
    end

    it "refuses a date before the hire date" do
      expect_rejected(:termination_date, "before the hire date") do
        described_class.call(employee: employee, termination_date: Date.new(2019, 12, 31))
      end
    end

    it "refuses terminating twice" do
      described_class.call(employee: employee, termination_date: today)

      expect_rejected(:base, "already terminated") { described_class.call(employee: employee, termination_date: today) }
    end

    it "refuses a soft-deleted employee" do
      employee.update!(deleted_at: Time.current)

      expect_rejected(:base, "has been deleted") { described_class.call(employee: employee, termination_date: today) }
    end
  end

  describe Employees::Rehire do
    before { employee.update!(status: "terminated", termination_date: Date.new(2025, 1, 1)) }

    it "reactivates the employee and clears the termination date" do
      described_class.call(employee: employee)

      expect(employee.reload).to have_attributes(status: "active", termination_date: nil, current_salary_cents: 6_000_000)
      expect(employee.salary_records.count).to eq(1)
    end

    it "adds a rehire record when a new salary is given" do
      described_class.call(employee: employee, salary_cents: 7_000_000)

      expect(employee.reload.current_salary_cents).to eq(7_000_000)
      expect(employee.salary_records.order(:id).last).to have_attributes(
        reason: "rehire", amount_cents: 7_000_000, effective_from: today
      )
    end

    it "uses the given effective date" do
      described_class.call(employee: employee, salary_cents: 7_000_000, effective_from: "2025-06-10")

      expect(employee.salary_records.order(:id).last.effective_from).to eq(Date.new(2025, 6, 10))
    end

    it "rolls back the reactivation if the salary change is invalid" do
      expect { described_class.call(employee: employee, salary_cents: -5) }.to raise_error(ActiveRecord::RecordInvalid)

      expect(employee.reload).to be_terminated
      expect(employee.salary_records.count).to eq(1)
    end

    it "refuses an employee who is not terminated" do
      employee.update!(status: "active", termination_date: nil)

      expect_rejected(:base, "not terminated") { described_class.call(employee: employee) }
    end

    it "refuses a soft-deleted employee" do
      employee.update!(deleted_at: Time.current)

      expect_rejected(:base, "has been deleted") { described_class.call(employee: employee) }
    end
  end

  describe Employees::SoftDelete do
    it "sets deleted_at and keeps the row and its history" do
      described_class.call(employee: employee)

      expect(employee.reload).to be_deleted
      expect(Employee.kept).not_to include(employee)
      expect(employee.salary_records.count).to eq(1)
    end

    it "works on a terminated employee" do
      employee.update!(status: "terminated", termination_date: today)

      expect { described_class.call(employee: employee) }.not_to raise_error
    end

    it "refuses an already deleted employee" do
      described_class.call(employee: employee)

      expect_rejected(:base, "already been deleted") { described_class.call(employee: employee) }
    end
  end

  describe Employees::Restore do
    before { employee.update!(deleted_at: Time.current) }

    it "clears deleted_at" do
      described_class.call(employee: employee)

      expect(employee.reload).not_to be_deleted
      expect(Employee.kept).to include(employee)
    end

    it "fails on email when another kept employee now uses the address" do
      create(:employee, email: employee.email)

      expect_rejected(:email, "already been taken") { described_class.call(employee: employee) }
      expect(employee.reload).to be_deleted
    end

    it "refuses an employee who is not deleted" do
      employee.update!(deleted_at: nil)

      expect_rejected(:base, "not deleted") { described_class.call(employee: employee) }
    end
  end

  it "keeps the full salary history through terminate, rehire, delete and restore" do
    Employees::Terminate.call(employee: employee, termination_date: today)
    Employees::Rehire.call(employee: employee, salary_cents: 6_500_000)
    Employees::SoftDelete.call(employee: employee)
    Employees::Restore.call(employee: employee)

    expect(employee.reload.salary_records.order(:id).pluck(:reason)).to eq(%w[hire rehire])
    expect(employee).to have_attributes(status: "active", current_salary_cents: 6_500_000)
  end
end

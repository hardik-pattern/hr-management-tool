require "rails_helper"

RSpec.describe Salaries::Change do
  let(:today) { Date.new(2025, 6, 15) }
  let(:employee) { create(:employee, current_salary_cents: 6_000_000) }
  let(:params) { { employee: employee, amount_cents: 6_600_000, effective_from: today, reason: "merit" } }

  around { |example| travel_to(today) { example.run } }

  before { create(:salary_record, employee: employee, amount_cents: 6_000_000, effective_from: Date.new(2020, 1, 1)) }

  describe "a valid change" do
    it "appends a record in the employee's currency" do
      record = nil
      expect { record = described_class.call(**params) }.to change { employee.salary_records.count }.by(1)

      expect(record).to have_attributes(
        amount_cents: 6_600_000, currency: employee.current_currency,
        effective_from: today, reason: "merit"
      )
    end

    it "updates the employee's current salary" do
      described_class.call(**params)

      expect(employee.reload.current_salary_cents).to eq(6_600_000)
    end

    it "accepts a record on the same date as the latest one" do
      described_class.call(**params)

      expect { described_class.call(**params.merge(amount_cents: 6_700_000, reason: "correction")) }
        .not_to raise_error
      expect(employee.reload.current_salary_cents).to eq(6_700_000)
    end

    it "accepts a salary decrease" do
      described_class.call(**params.merge(amount_cents: 5_000_000, reason: "adjustment"))

      expect(employee.reload.current_salary_cents).to eq(5_000_000)
    end
  end

  describe "rejected changes write nothing" do
    def expect_rejected(message_part, field)
      expect { described_class.call(**params) }
        .to raise_error(ActiveRecord::RecordInvalid) { |error|
          expect(error.record.errors[field].join).to include(message_part)
        }
      expect(employee.reload.current_salary_cents).to eq(6_000_000)
      expect(employee.salary_records.count).to eq(1)
    end

    it "refuses a non-positive amount" do
      params[:amount_cents] = 0

      expect_rejected("greater than 0", :amount_cents)
    end

    it "refuses a non-integer amount" do
      params[:amount_cents] = 10.5

      expect_rejected("integer", :amount_cents)
    end

    it "refuses an unknown reason" do
      params[:reason] = "bonus"

      expect_rejected("not included", :reason)
    end

    it "refuses the hire reason, which belongs to employee creation" do
      params[:reason] = "hire"

      expect_rejected("only used when the employee is created", :reason)
    end

    it "refuses a date before the latest record" do
      params[:effective_from] = Date.new(2019, 12, 31)

      expect_rejected("cannot be before the latest salary record", :effective_from)
    end

    it "refuses a future date" do
      params[:effective_from] = today + 1

      expect_rejected("cannot be in the future", :effective_from)
    end

    it "refuses a terminated employee" do
      employee.update!(status: "terminated", termination_date: Date.new(2025, 1, 1))

      expect_rejected("has been terminated", :employee)
    end

    it "refuses a soft-deleted employee" do
      employee.update!(deleted_at: Time.current)

      expect_rejected("has been deleted", :employee)
    end
  end

  it "rolls back the record if updating the employee fails" do
    allow_any_instance_of(Employee).to receive(:update!).and_raise(ActiveRecord::RecordInvalid)

    expect { described_class.call(**params) }.to raise_error(ActiveRecord::RecordInvalid)
    expect(employee.salary_records.count).to eq(1)
  end

  it "judges the date against fresh state, not a stale in-memory employee" do
    stale = Employee.find(employee.id)
    described_class.call(**params)

    expect { described_class.call(**params.merge(employee: stale, effective_from: today - 1)) }
      .to raise_error(ActiveRecord::RecordInvalid)
  end
end

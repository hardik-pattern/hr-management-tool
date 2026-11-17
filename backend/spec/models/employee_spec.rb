require "rails_helper"

RSpec.describe Employee, type: :model do
  subject(:employee) { build(:employee) }

  it { is_expected.to be_valid }
  it { is_expected.to belong_to(:country) }
  it { is_expected.to belong_to(:department) }
  it { is_expected.to belong_to(:job_title) }
  it { is_expected.to have_many(:salary_records).dependent(:restrict_with_error) }
  it { is_expected.to validate_presence_of(:employee_number) }
  it { is_expected.to validate_presence_of(:full_name) }
  it { is_expected.to validate_presence_of(:hire_date) }
  it { is_expected.to validate_presence_of(:email) }
  it { is_expected.to validate_numericality_of(:current_salary_cents).only_integer.is_greater_than(0) }

  describe "email" do
    it "is normalized to lowercase without surrounding spaces" do
      employee.email = "  Jane.Doe@ACME.test "

      expect(employee.email).to eq("jane.doe@acme.test")
    end

    it "must look like an email" do
      employee.email = "not-an-email"

      expect(employee).not_to be_valid
    end

    it "is unique among kept employees, ignoring case" do
      create(:employee, email: "dup@acme.test")
      duplicate = build(:employee, email: "DUP@acme.test")

      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:email]).to include("has already been taken")
    end

    it "can be reused once the previous owner is soft-deleted" do
      create(:employee, :deleted, email: "reuse@acme.test")

      expect(build(:employee, email: "reuse@acme.test")).to be_valid
    end

    it "is enforced by the database for kept rows only" do
      create(:employee, email: "dup@acme.test")

      expect { build(:employee, email: "dup@acme.test").save!(validate: false) }
        .to raise_error(ActiveRecord::RecordNotUnique)
      expect { build(:employee, :deleted, email: "dup@acme.test").save!(validate: false) }
        .not_to raise_error
    end
  end

  describe "employee_number" do
    it "is unique even across soft-deleted rows, so numbers are never recycled" do
      create(:employee, :deleted, employee_number: "E1")

      expect(build(:employee, employee_number: "E1")).not_to be_valid
    end
  end

  describe "status and termination date" do
    it "defaults to active" do
      expect(described_class.new.status).to eq("active")
    end

    it "rejects an unknown status" do
      employee.status = "retired"

      expect(employee).not_to be_valid
    end

    it "requires a termination date when terminated" do
      employee.status = "terminated"

      expect(employee).not_to be_valid
      expect(employee.errors[:termination_date]).to include("is required when terminated")
    end

    it "forbids a termination date on an active employee" do
      employee.termination_date = Date.new(2024, 1, 1)

      expect(employee).not_to be_valid
      expect(employee.errors[:termination_date]).to include("must be blank unless terminated")
    end

    it "rejects a termination date before the hire date" do
      employee.assign_attributes(status: "terminated", hire_date: Date.new(2022, 5, 1),
                                 termination_date: Date.new(2022, 4, 30))

      expect(employee).not_to be_valid
      expect(employee.errors[:termination_date]).to include("cannot be before the hire date")
    end

    it "accepts a termination on the hire date" do
      employee.assign_attributes(status: "terminated", hire_date: Date.new(2022, 5, 1),
                                 termination_date: Date.new(2022, 5, 1))

      expect(employee).to be_valid
    end
  end

  describe "gender" do
    it "rejects values outside the allowed list" do
      employee.gender = "other"

      expect(employee).not_to be_valid
    end
  end

  describe "currency and job title consistency" do
    it "requires the salary currency to be the country's currency" do
      employee.current_currency = "XXX"

      expect(employee).not_to be_valid
      expect(employee.errors[:current_currency].first).to match(/must be the country's currency/)
    end

    it "requires the job title to belong to the employee's department" do
      employee.job_title = create(:job_title)

      expect(employee).not_to be_valid
      expect(employee.errors[:job_title]).to include("does not belong to the department")
    end
  end

  describe "scopes" do
    let!(:kept_active) { create(:employee) }
    let!(:kept_terminated) { create(:employee, :terminated) }
    let!(:soft_deleted) { create(:employee, :deleted) }

    it ".kept excludes soft-deleted employees" do
      expect(described_class.kept).to contain_exactly(kept_active, kept_terminated)
    end

    it ".deleted returns only soft-deleted employees" do
      expect(described_class.deleted).to contain_exactly(soft_deleted)
    end

    it ".active and .terminated filter by status" do
      expect(described_class.kept.active).to contain_exactly(kept_active)
      expect(described_class.kept.terminated).to contain_exactly(kept_terminated)
    end
  end

  describe "#deleted?" do
    it "reflects deleted_at" do
      expect(build(:employee)).not_to be_deleted
      expect(build(:employee, :deleted)).to be_deleted
    end
  end

  describe "database constraints" do
    it "refuses a non-positive salary" do
      employee.current_salary_cents = 0

      expect { employee.save!(validate: false) }.to raise_error(ActiveRecord::StatementInvalid)
    end

    it "refuses a terminated status without a termination date" do
      employee.status = "terminated"

      expect { employee.save!(validate: false) }.to raise_error(ActiveRecord::StatementInvalid)
    end

    it "refuses an unknown gender" do
      employee.gender = "x"

      expect { employee.save!(validate: false) }.to raise_error(ActiveRecord::StatementInvalid)
    end

    it "refuses a termination date before the hire date" do
      employee.assign_attributes(status: "terminated", hire_date: Date.new(2022, 5, 1),
                                 termination_date: Date.new(2022, 1, 1))

      expect { employee.save!(validate: false) }.to raise_error(ActiveRecord::StatementInvalid)
    end
  end
end

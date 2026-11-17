require "rails_helper"

RSpec.describe SalaryRecord, type: :model do
  subject(:record) { build(:salary_record) }

  it { is_expected.to be_valid }
  it { is_expected.to belong_to(:employee) }
  it { is_expected.to validate_presence_of(:currency) }
  it { is_expected.to validate_presence_of(:effective_from) }
  it { is_expected.to validate_numericality_of(:amount_cents).only_integer.is_greater_than(0) }
  it { is_expected.to validate_inclusion_of(:reason).in_array(%w[hire merit promotion adjustment correction rehire]) }

  it "cannot be edited once saved, so history stays a trustworthy audit" do
    record.save!

    expect { record.update!(amount_cents: 1) }.to raise_error(ActiveRecord::ReadOnlyRecord)
  end

  it "cannot be destroyed once saved" do
    record.save!

    expect { record.destroy! }.to raise_error(ActiveRecord::ReadOnlyRecord)
  end

  it "refuses a non-positive amount at the database level" do
    record.amount_cents = 0

    expect { record.save!(validate: false) }.to raise_error(ActiveRecord::StatementInvalid)
  end

  it "refuses an unknown reason at the database level" do
    record.reason = "bonus"

    expect { record.save!(validate: false) }.to raise_error(ActiveRecord::StatementInvalid)
  end

  describe "rules applied when a record is created" do
    around { |example| travel_to(Date.new(2025, 6, 15)) { example.run } }

    it "rejects a record for a terminated employee" do
      record.employee = build(:employee, :terminated)

      expect(record).not_to be_valid
      expect(record.errors[:employee]).to include("has been terminated")
    end

    it "rejects a record for a soft-deleted employee" do
      record.employee = build(:employee, :deleted)

      expect(record).not_to be_valid
      expect(record.errors[:employee]).to include("has been deleted")
    end

    it "rejects a future effective date" do
      record.effective_from = Date.new(2025, 6, 16)

      expect(record).not_to be_valid
      expect(record.errors[:effective_from]).to include("cannot be in the future")
    end

    it "accepts today" do
      record.effective_from = Date.new(2025, 6, 15)

      expect(record).to be_valid
    end

    it "rejects a date before the employee's latest record" do
      employee = create(:employee)
      create(:salary_record, employee: employee, effective_from: Date.new(2024, 1, 1))

      earlier = build(:salary_record, employee: employee, effective_from: Date.new(2023, 12, 31))

      expect(earlier).not_to be_valid
      expect(earlier.errors[:effective_from].first).to match(/before the latest salary record/)
    end
  end
end

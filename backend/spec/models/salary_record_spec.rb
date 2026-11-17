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
end

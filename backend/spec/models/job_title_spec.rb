require "rails_helper"

RSpec.describe JobTitle, type: :model do
  subject(:job_title) { build(:job_title, name: "Backend Engineer") }

  it { is_expected.to be_valid }
  it { is_expected.to belong_to(:department) }
  it { is_expected.to have_many(:pay_bands).dependent(:restrict_with_error) }
  it { is_expected.to have_many(:employees).dependent(:restrict_with_error) }
  it { is_expected.to validate_presence_of(:name) }
  it { is_expected.to validate_uniqueness_of(:name).scoped_to(:department_id).case_insensitive }
  it { is_expected.to validate_numericality_of(:level).only_integer.is_in(1..7) }

  it "allows the same title name in different departments" do
    create(:job_title, name: "Manager")

    expect(build(:job_title, name: "Manager")).to be_valid
  end

  it "refuses a level outside 1..7 at the database level" do
    job_title.level = 8

    expect { job_title.save!(validate: false) }.to raise_error(ActiveRecord::StatementInvalid)
  end
end

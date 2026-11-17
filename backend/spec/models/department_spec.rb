require "rails_helper"

RSpec.describe Department, type: :model do
  subject(:department) { build(:department, name: "Engineering") }

  it { is_expected.to be_valid }
  it { is_expected.to validate_presence_of(:name) }
  it { is_expected.to validate_uniqueness_of(:name).case_insensitive }
  it { is_expected.to have_many(:job_titles).dependent(:restrict_with_error) }
  it { is_expected.to have_many(:employees).dependent(:restrict_with_error) }
end

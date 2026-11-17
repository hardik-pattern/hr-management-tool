# Builds one generated workforce for a whole example group instead of per
# example, which keeps read-only specs about large datasets fast. The data is
# committed (it must outlive each example's transaction) and removed again
# after the group, so it never leaks into other specs.
module SeededDataset
  TABLES_IN_DELETE_ORDER = [ SalaryRecord, Employee, PayBand, JobTitle, Department, Country, Currency ].freeze

  def seed_dataset(count, today:, **options)
    before(:context) do
      Seeds::ReferenceData.call
      Seeds::EmployeeGenerator.call(count: count, today: today, **options)
    end

    after(:context) { TABLES_IN_DELETE_ORDER.each(&:delete_all) }
  end
end

RSpec.configure { |config| config.extend SeededDataset }

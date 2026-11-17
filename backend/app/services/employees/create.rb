module Employees
  # Creates an employee together with the initial +hire+ salary record, so an
  # employee never exists without a history entry. All-or-nothing: if either
  # part is invalid, nothing is saved and ActiveRecord::RecordInvalid is
  # raised (rendered as a 422).
  #
  # The salary currency is always the country's currency.
  class Create
    def self.call(...) = new(...).call

    def initialize(salary_cents:, **profile)
      @salary_cents = salary_cents
      @profile = profile
    end

    # @return [Employee]
    def call
      Employee.transaction do
        employee = Employee.new(profile.merge(attributes_from_country))
        employee.save!
        assign_employee_number(employee)
        employee.salary_records.create!(
          amount_cents: salary_cents, currency: employee.current_currency,
          effective_from: employee.hire_date, reason: "hire"
        )
        employee
      end
    end

    private

    attr_reader :salary_cents, :profile

    def attributes_from_country
      country = Country.find_by(id: profile[:country_id])

      {
        current_salary_cents: salary_cents,
        current_currency: country&.currency_code,
        # Placeholder so the NOT NULL unique column is satisfied until the id
        # is known; replaced in assign_employee_number within the same transaction.
        employee_number: SecureRandom.uuid
      }
    end

    # Derived from the row id so numbers are sequential and race-free, which a
    # "max + 1" lookup would not be under concurrent creates.
    def assign_employee_number(employee)
      employee.update!(employee_number: format("E%06d", employee.id))
    end
  end
end

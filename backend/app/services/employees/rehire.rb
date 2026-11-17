module Employees
  # Brings a terminated employee back. The salary is unchanged unless a new
  # amount is given, in which case a +rehire+ history entry is appended.
  class Rehire < Command
    def initialize(employee:, salary_cents: nil, effective_from: nil)
      super(employee: employee)
      @salary_cents = salary_cents
      @effective_from = effective_from
    end

    def call
      employee.with_lock do
        reject!(:base, "has been deleted") if employee.deleted?
        reject!(:base, "is not terminated") unless employee.terminated?

        employee.update!(status: "active", termination_date: nil)
        change_salary if salary_cents.present?
        employee
      end
    end

    private

    attr_reader :salary_cents, :effective_from

    # Runs after reactivation, because Salaries::Change refuses terminated
    # employees.
    def change_salary
      Salaries::Change.call(
        employee: employee, amount_cents: salary_cents,
        effective_from: effective_from.presence || Date.current, reason: "rehire"
      )
    end
  end
end

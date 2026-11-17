module Salaries
  # Records a salary change: appends a SalaryRecord and updates the
  # employee's denormalized current salary in one transaction, so the two
  # cannot drift apart. Raises ActiveRecord::RecordInvalid (rendered as a 422)
  # when a rule is broken; nothing is written in that case.
  #
  # The currency is never an input: it is always the employee's current one.
  # Moving someone to another country or currency is a separate operation.
  class Change
    def self.call(...) = new(...).call

    def initialize(employee:, amount_cents:, effective_from:, reason:)
      @employee = employee
      @amount_cents = amount_cents
      @effective_from = effective_from
      @reason = reason
    end

    # @return [SalaryRecord] the record that was appended
    def call
      employee.with_lock do
        record = build_record
        record.save!
        employee.update!(current_salary_cents: record.amount_cents)
        record
      end
    end

    private

    attr_reader :employee, :amount_cents, :effective_from, :reason

    # +with_lock+ reloads the employee, so the rules are checked against
    # fresh state. SQLite serializes writers; on Postgres this is a row lock.
    def build_record
      employee.salary_records.build(
        amount_cents: amount_cents,
        currency: employee.current_currency,
        effective_from: effective_from,
        reason: reason
      ).tap { |record| reject_hire_reason(record) }
    end

    # The "hire" entry belongs to employee creation (Employees::Create).
    def reject_hire_reason(record)
      return unless reason.to_s == "hire"

      record.errors.add(:reason, "hire is only used when the employee is created")
      raise ActiveRecord::RecordInvalid, record
    end
  end
end

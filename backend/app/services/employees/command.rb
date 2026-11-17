module Employees
  # Base for the employee lifecycle services (terminate, rehire, soft delete,
  # restore). Subclasses implement +call+ and use +reject!+ to refuse a
  # transition: the reason is attached to the employee's errors and
  # ActiveRecord::RecordInvalid is raised, so it renders as a 422 like any
  # other validation failure.
  class Command
    def self.call(...) = new(...).call

    def initialize(employee:)
      @employee = employee
    end

    private

    attr_reader :employee

    def reject!(attribute, message)
      employee.errors.add(attribute, message)
      raise ActiveRecord::RecordInvalid, employee
    end
  end
end

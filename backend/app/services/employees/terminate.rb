module Employees
  # Records that an employee left. The employee stays in the data, with their
  # salary history, so historical pay questions remain correct.
  #
  # The date may not be in the future: the status is not scheduled to flip, so
  # a future leaving date would make an employee "terminated" too early.
  class Terminate < Command
    def initialize(employee:, termination_date:)
      super(employee: employee)
      @termination_date = termination_date
    end

    def call
      employee.with_lock do
        reject!(:base, "has been deleted") if employee.deleted?
        reject!(:base, "is already terminated") if employee.terminated?

        # Assigning lets Active Record cast the value (string or Date), so the
        # future-date check and the model's own date rules see the same thing.
        employee.assign_attributes(status: "terminated", termination_date: termination_date)
        reject!(:termination_date, "cannot be in the future") if employee.termination_date&.after?(Date.current)

        employee.save!
        employee
      end
    end

    private

    attr_reader :termination_date
  end
end

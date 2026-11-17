module Employees
  # Un-hides a soft-deleted employee. Fails with a validation error on email
  # when another kept employee has taken the address in the meantime.
  class Restore < Command
    def call
      employee.with_lock do
        reject!(:base, "is not deleted") unless employee.deleted?

        employee.update!(deleted_at: nil)
        employee
      end
    end
  end
end

module Employees
  # Hides a record that should not exist (a duplicate or mistaken entry). It
  # is not for people who left; use Terminate for that. Nothing is
  # hard-deleted, so the row and its salary history can be restored.
  class SoftDelete < Command
    def call
      employee.with_lock do
        reject!(:base, "has already been deleted") if employee.deleted?

        employee.update!(deleted_at: Time.current)
        employee
      end
    end
  end
end

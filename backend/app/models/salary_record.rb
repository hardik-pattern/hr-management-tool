# One row in an employee's salary history. Append-only: a mistake is fixed
# by adding a +correction+ record, never by editing, so the history stays a
# trustworthy audit.
class SalaryRecord < ApplicationRecord
  REASONS = %w[hire merit promotion adjustment correction rehire].freeze

  belongs_to :employee

  validates :amount_cents, numericality: { only_integer: true, greater_than: 0 }
  validates :currency, presence: true
  validates :effective_from, presence: true
  validates :reason, inclusion: { in: REASONS }
  validate :employee_accepts_new_record, on: :create
  validate :effective_from_not_in_future, on: :create
  validate :effective_from_not_before_latest, on: :create

  def readonly?
    persisted? || super
  end

  private

  def employee_accepts_new_record
    return if employee.nil?

    errors.add(:employee, "has been deleted") if employee.deleted?
    errors.add(:employee, "has been terminated") if employee.terminated?
  end

  # Future-dated records are refused because employees.current_salary_cents
  # would otherwise show a salary that is not yet in effect. The hire record
  # is exempt: HR enters new hires before their start date, and that first
  # salary is the only one the employee has.
  def effective_from_not_in_future
    return if effective_from.blank? || reason == "hire"

    errors.add(:effective_from, "cannot be in the future") if effective_from > Date.current
  end

  # The history is a timeline; back-dating before the latest entry would make
  # "current salary" ambiguous. Equal dates are allowed (the later row wins).
  def effective_from_not_before_latest
    return if effective_from.blank? || employee.nil?

    latest = employee.salary_records.maximum(:effective_from)
    return if latest.nil? || effective_from >= latest

    errors.add(:effective_from, "cannot be before the latest salary record (#{latest})")
  end
end

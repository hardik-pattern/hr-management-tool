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

  def readonly?
    persisted? || super
  end
end

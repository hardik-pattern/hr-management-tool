# An ISO-4217 currency with a static USD rate. Rates are seeded constants,
# not a live feed (see docs/DESIGN_NOTES.md), so cross-country comparisons
# are consistent but not market-accurate.
class Currency < ApplicationRecord
  has_many :countries, dependent: :restrict_with_error

  validates :code, presence: true, uniqueness: true, format: { with: /\A[A-Z]{3}\z/ }
  validates :name, presence: true
  validates :minor_unit_exponent, numericality: { only_integer: true, in: 0..4 }
  validates :rate_to_usd, numericality: { greater_than: 0 }
end

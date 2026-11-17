# The expected salary range for a job title in a country. Amounts are in
# the country's currency, so a band is only comparable to salaries held in
# that same currency.
class PayBand < ApplicationRecord
  belongs_to :job_title
  belongs_to :country

  validates :job_title_id, uniqueness: { scope: :country_id }
  validates :min_cents, :max_cents, numericality: { only_integer: true, greater_than: 0 }
  validate :min_not_above_max

  # True when +cents+ falls inside the band, bounds included.
  def covers?(cents)
    cents.between?(min_cents, max_cents)
  end

  private

  def min_not_above_max
    return if min_cents.blank? || max_cents.blank?

    errors.add(:min_cents, "must not exceed max_cents") if min_cents > max_cents
  end
end

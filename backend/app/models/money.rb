# An amount held as integer minor units (cents) in one currency. Floats are
# never used, so sums and comparisons stay exact.
class Money
  attr_reader :cents, :currency

  def initialize(cents, currency)
    raise ArgumentError, "cents must be an Integer" unless cents.is_a?(Integer)

    @cents = cents
    @currency = currency
  end

  # Amount in USD cents, rounded half up. The USD side always has 2 decimals,
  # while the source side depends on the currency's minor unit (JPY has 0).
  def to_usd_cents
    major_units = BigDecimal(cents) / (10**currency.minor_unit_exponent)
    (major_units * currency.rate_to_usd * 100).round(0, half: :up).to_i
  end

  # "1,234.50 USD", "1,234 JPY".
  def format
    exponent = currency.minor_unit_exponent
    amount = ActiveSupport::NumberHelper.number_to_delimited(
      "%.#{exponent}f" % (BigDecimal(cents) / (10**exponent))
    )
    "#{amount} #{currency.code}"
  end
  alias_method :to_s, :format

  def ==(other)
    other.is_a?(Money) && cents == other.cents && currency == other.currency
  end
end

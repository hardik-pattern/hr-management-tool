# Shapes an Analytics::QueryEngine::Result for the API: what was asked, the
# rows, and the overall figure, each with a human-readable +formatted+ value.
class AnalyticsSummaryPresenter
  def initialize(result)
    @result = result
  end

  def as_json(*)
    spec = result.spec
    spec.to_h.merge(
      unit: spec.unit,
      currency: (usd.code if spec.unit == "usd_cents"),
      rows: result.rows.map { |row| row_json(row) },
      total: row_json(result.total)
    )
  end

  private

  attr_reader :result

  def row_json(row)
    { group: row.group, headcount: row.headcount, value: row.value, formatted: format(row.value) }
  end

  def format(value)
    return nil if value.nil?
    return ActiveSupport::NumberHelper.number_to_delimited(value) if result.spec.unit == "count"

    Money.new(value, usd).format
  end

  # Every money figure is in USD; the fallback keeps formatting working when
  # the currencies table has not been loaded with USD.
  def usd
    @usd ||= Currency.find_by(code: "USD") || Currency.new(code: "USD", minor_unit_exponent: 2, rate_to_usd: 1)
  end
end

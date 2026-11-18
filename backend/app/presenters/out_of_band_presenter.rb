class OutOfBandPresenter
  def initialize(result)
    @result = result
  end

  def as_json(*)
    {
      status: result.status, direction: result.direction, filters: result.filters, limit: result.limit,
      total: result.total, below: result.below, above: result.above,
      rows: result.rows.map { |row| row_json(row) }
    }
  end

  private

  attr_reader :result

  # distance_percent is how far beyond the nearest edge of the band the salary is.
  def row_json(row)
    currency = row.employee.country.currency
    EmployeeBriefPresenter.new(row.employee).as_json.merge(
      direction: row.direction,
      distance_percent: (row.distance * 100).to_f.round(2),
      band: {
        min_cents: row.band_min, max_cents: row.band_max,
        formatted: "#{Money.new(row.band_min, currency).format} to #{Money.new(row.band_max, currency).format}"
      }
    )
  end
end

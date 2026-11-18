class StaleSalariesPresenter
  def initialize(result)
    @result = result
  end

  def as_json(*)
    {
      status: result.status, months: result.months, filters: result.filters, limit: result.limit,
      total: result.total,
      rows: result.rows.map do |row|
        EmployeeBriefPresenter.new(row.employee).as_json.merge(
          last_change_on: row.last_change_on.iso8601, months_since: row.months_since
        )
      end
    }
  end

  private

  attr_reader :result
end

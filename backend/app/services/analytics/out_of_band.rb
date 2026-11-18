module Analytics
  # Employees paid outside the pay band for their job title in their country,
  # furthest outside first. A band and the salary are both in the country's
  # currency, so they compare directly. An employee whose title has no band in
  # their country is not reported: there is nothing to be outside of.
  class OutOfBand
    DIRECTIONS = %w[any below above].freeze
    STATUSES = %w[active terminated all].freeze
    PARAMS = %w[status direction country_id department_id job_title_id limit].freeze
    DEFAULT_LIMIT = 50
    MAX_LIMIT = 200

    Row = Data.define(:employee, :direction, :distance, :band_min, :band_max)
    Result = Data.define(:status, :direction, :filters, :limit, :total, :below, :above, :rows)

    DISTANCE_SQL = <<~SQL.squish.freeze
      CASE WHEN employees.current_salary_cents < pay_bands.min_cents
           THEN (pay_bands.min_cents - employees.current_salary_cents) * 1.0 / pay_bands.min_cents
           ELSE (employees.current_salary_cents - pay_bands.max_cents) * 1.0 / pay_bands.max_cents END
    SQL

    def self.from_params(params)
      params = params.to_h.stringify_keys
      unknown = params.keys - PARAMS
      raise InvalidRequest, "unknown parameter(s): #{unknown.join(', ')}" if unknown.any?

      status = params["status"].presence || "active"
      raise InvalidRequest, "status must be one of: #{STATUSES.join(', ')}" unless STATUSES.include?(status)

      direction = params["direction"].presence || "any"
      raise InvalidRequest, "direction must be one of: #{DIRECTIONS.join(', ')}" unless DIRECTIONS.include?(direction)

      filters = {}
      %w[country_id department_id job_title_id].each do |key|
        filters[key.to_sym] = Spec.integer(params[key], key, 1) if params[key].present?
      end
      limit = params["limit"].present? ? Spec.integer(params["limit"], "limit", 1, max: MAX_LIMIT) : DEFAULT_LIMIT

      new(status: status, direction: direction, filters: filters, limit: limit)
    end

    def self.call(...) = from_params(...).call

    def initialize(status: "active", direction: "any", filters: {}, limit: DEFAULT_LIMIT)
      @status = status
      @direction = direction
      @filters = filters
      @limit = limit
    end

    # @return [Result]
    def call
      Result.new(
        status: status, direction: direction, filters: filters, limit: limit,
        total: scope(direction).count, below: scope("below").count, above: scope("above").count,
        rows: rows
      )
    end

    private

    attr_reader :status, :direction, :filters, :limit

    def rows
      scope(direction)
        .select("employees.*", "pay_bands.min_cents AS band_min", "pay_bands.max_cents AS band_max")
        .includes(:department, :job_title, country: :currency)
        .order(Arel.sql("#{DISTANCE_SQL} DESC"), "employees.id")
        .limit(limit)
        .map { |employee| row(employee) }
    end

    def row(employee)
      min = employee.band_min
      max = employee.band_max
      below = employee.current_salary_cents < min
      distance = below ? Rational(min - employee.current_salary_cents, min) : Rational(employee.current_salary_cents - max, max)

      Row.new(employee: employee, direction: below ? "below" : "above", distance: distance, band_min: min, band_max: max)
    end

    def scope(which)
      relation = Employee.kept.joins("JOIN pay_bands ON pay_bands.job_title_id = employees.job_title_id AND pay_bands.country_id = employees.country_id")
      relation = relation.where(status: status) unless status == "all"
      relation = relation.where(country_id: filters[:country_id]) if filters.key?(:country_id)
      relation = relation.where(department_id: filters[:department_id]) if filters.key?(:department_id)
      relation = relation.where(job_title_id: filters[:job_title_id]) if filters.key?(:job_title_id)

      below = "employees.current_salary_cents < pay_bands.min_cents"
      above = "employees.current_salary_cents > pay_bands.max_cents"
      relation.where({ "below" => below, "above" => above, "any" => "#{below} OR #{above}" }.fetch(which))
    end
  end
end

module Analytics
  # Employees whose pay has not changed for a long time: their latest salary
  # record, which for someone never raised is their hire record, is older than
  # a number of months. Longest without a change first.
  #
  # This counts any salary record as a change (merit, promotion, adjustment,
  # correction), because the data does not say which were raises.
  class StaleSalaries
    STATUSES = %w[active terminated all].freeze
    PARAMS = %w[status months country_id department_id limit].freeze
    DEFAULT_MONTHS = 24
    MAX_MONTHS = 120
    DEFAULT_LIMIT = 50
    MAX_LIMIT = 200

    LAST_CHANGE_SQL = "(SELECT MAX(salary_records.effective_from) FROM salary_records WHERE salary_records.employee_id = employees.id)".freeze

    Row = Data.define(:employee, :last_change_on, :months_since)
    Result = Data.define(:status, :months, :filters, :limit, :total, :rows)

    def self.from_params(params, today: Date.current)
      params = params.to_h.stringify_keys
      unknown = params.keys - PARAMS
      raise InvalidRequest, "unknown parameter(s): #{unknown.join(', ')}" if unknown.any?

      status = params["status"].presence || "active"
      raise InvalidRequest, "status must be one of: #{STATUSES.join(', ')}" unless STATUSES.include?(status)

      filters = {}
      %w[country_id department_id].each do |key|
        filters[key.to_sym] = Spec.integer(params[key], key, 1) if params[key].present?
      end
      months = params["months"].present? ? Spec.integer(params["months"], "months", 1, max: MAX_MONTHS) : DEFAULT_MONTHS
      limit = params["limit"].present? ? Spec.integer(params["limit"], "limit", 1, max: MAX_LIMIT) : DEFAULT_LIMIT

      new(status: status, months: months, filters: filters, limit: limit, today: today)
    end

    def self.call(...) = from_params(...).call

    def initialize(status: "active", months: DEFAULT_MONTHS, filters: {}, limit: DEFAULT_LIMIT, today: Date.current)
      @status = status
      @months = months
      @filters = filters
      @limit = limit
      @today = today
    end

    # @return [Result]
    def call
      Result.new(status: status, months: months, filters: filters, limit: limit, total: scope.count, rows: rows)
    end

    private

    attr_reader :status, :months, :filters, :limit, :today

    def rows
      scope
        .select("employees.*", "#{LAST_CHANGE_SQL} AS last_change_on")
        .includes(:department, :job_title, country: :currency)
        .order(Arel.sql("#{LAST_CHANGE_SQL} ASC"), "employees.id")
        .limit(limit)
        .map { |employee| row(employee) }
    end

    def row(employee)
      last = Date.parse(employee.last_change_on.to_s)
      Row.new(employee: employee, last_change_on: last, months_since: whole_months(last))
    end

    # Stale means older than the cutoff, so someone changed exactly N months ago is not yet stale.
    def scope
      relation = Employee.kept.where("#{LAST_CHANGE_SQL} < ?", today.advance(months: -months))
      relation = relation.where(status: status) unless status == "all"
      relation = relation.where(country_id: filters[:country_id]) if filters.key?(:country_id)
      relation = relation.where(department_id: filters[:department_id]) if filters.key?(:department_id)
      relation
    end

    def whole_months(from)
      count = ((today.year * 12) + today.month) - ((from.year * 12) + from.month)
      count -= 1 if today.day < from.day
      count
    end
  end
end

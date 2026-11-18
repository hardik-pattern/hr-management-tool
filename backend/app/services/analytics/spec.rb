module Analytics
  # A validated description of one analytics question: which measure, grouped
  # by what, over which employees. Everything is checked against a whitelist
  # when it is built, so the engine never sees a value it has not vetted and
  # a typo is an error (HTTP 400), not a silently different question.
  class Spec
    METRICS = %w[headcount sum avg median p25 p75 min max iqr].freeze
    GROUPS = %w[country department job_title gender level].freeze
    STATUSES = %w[active terminated all].freeze
    MAX_GROUPS = 2
    PARAMS = %w[metric group_by status country_id department_id job_title_id gender level terminated_after].freeze

    attr_reader :metric, :group_by, :status, :filters

    # @param params [Hash] string-keyed, as from a query string
    # @raise [InvalidRequest] for anything not understood
    def self.from_params(params)
      params = params.to_h.stringify_keys
      unknown = params.keys - PARAMS
      raise InvalidRequest, "unknown parameter(s): #{unknown.join(', ')}" if unknown.any?

      new(
        metric: params["metric"].presence || "headcount",
        group_by: parse_groups(params["group_by"]),
        status: params["status"].presence,
        filters: parse_filters(params)
      )
    end

    def self.parse_groups(raw)
      Array(raw.is_a?(String) ? raw.split(",") : raw).map { |group| group.to_s.strip }.reject(&:empty?)
    end

    def self.parse_filters(params)
      filters = {}
      %w[country_id department_id job_title_id].each do |key|
        filters[key.to_sym] = integer(params[key], key, 1) if params[key].present?
      end
      filters[:level] = integer(params["level"], "level", 1, max: 7) if params["level"].present?
      filters[:gender] = params["gender"] if params["gender"].present?
      filters[:terminated_after] = date(params["terminated_after"]) if params["terminated_after"].present?
      filters
    end

    def self.integer(raw, name, minimum, max: nil)
      value = Integer(raw.to_s, 10)
      raise ArgumentError if value < minimum || (max && value > max)

      value
    rescue ArgumentError
      range = max ? "between #{minimum} and #{max}" : "at least #{minimum}"
      raise InvalidRequest, "#{name} must be an integer #{range}"
    end

    def self.date(raw)
      Date.iso8601(raw.to_s)
    rescue Date::Error
      raise InvalidRequest, "terminated_after must be a date like 2025-01-31"
    end

    def initialize(metric:, group_by: [], status: nil, filters: {})
      @metric = metric
      @group_by = group_by
      @filters = filters
      @status = resolve_status(status)
      validate!
    end

    # Headcount is a count; everything else is money, in USD cents.
    def unit = metric == "headcount" ? "count" : "usd_cents"

    # The question as the API reports it back, so a screen can show what was asked.
    def to_h
      { metric: metric, group_by: group_by, status: status, filters: filters.transform_values { |v| v.is_a?(Date) ? v.iso8601 : v } }
    end

    private

    # Asking for people who left since a date is a question about leavers, so it
    # implies status "terminated"; combining it with another status is a contradiction.
    def resolve_status(requested)
      return requested || "active" unless filters.key?(:terminated_after)
      raise InvalidRequest, "terminated_after only applies to terminated employees" if requested && requested != "terminated"

      "terminated"
    end

    def validate!
      raise InvalidRequest, "metric must be one of: #{METRICS.join(', ')}" unless METRICS.include?(metric)
      raise InvalidRequest, "status must be one of: #{STATUSES.join(', ')}" unless STATUSES.include?(status)

      unknown = group_by - GROUPS
      raise InvalidRequest, "group_by must be from: #{GROUPS.join(', ')}" if unknown.any?
      raise InvalidRequest, "group_by cannot repeat a grouping" if group_by.uniq.size != group_by.size
      raise InvalidRequest, "group_by takes at most #{MAX_GROUPS} groupings" if group_by.size > MAX_GROUPS

      return if filters[:gender].nil? || Employee.genders.key?(filters[:gender])

      raise InvalidRequest, "gender must be one of: #{Employee.genders.keys.join(', ')}"
    end
  end
end

module Analytics
  # How much less (or more) women are paid than men, comparing like with like.
  #
  # A plain average of women's pay against men's pay misleads: if women are
  # concentrated in lower-paid roles the gap looks large even when every role
  # pays women and men the same. So women are compared with men in the same
  # job title and the same country (which also keeps the comparison in one
  # currency), and those like-for-like gaps are combined, weighted by the
  # number of women in each. The raw gap is reported alongside for context.
  #
  # Only women and men are compared; other genders are too few to say anything
  # about. A job title and country with fewer than MIN_GROUP of either are left
  # out, because an average of one or two salaries says little. This measures a
  # difference in pay, not its cause: it does not account for tenure,
  # performance or anything else.
  class GenderPayGap
    MIN_GROUP = 3
    # A gap resting on fewer women than this is flagged as a small sample: with
    # so few people one salary can swing it by several points.
    SMALL_SAMPLE = 20
    STATUSES = %w[active terminated all].freeze
    PARAMS = %w[status country_id department_id].freeze

    Row = Data.define(:job_title, :women, :men, :women_compared, :gap)
    Result = Data.define(:status, :filters, :rows, :adjusted_gap, :unadjusted_gap, :women, :men,
                         :women_compared, :cells_compared, :cells_total)

    def self.from_params(params)
      params = params.to_h.stringify_keys
      unknown = params.keys - PARAMS
      raise InvalidRequest, "unknown parameter(s): #{unknown.join(', ')}" if unknown.any?

      status = params["status"].presence || "active"
      raise InvalidRequest, "status must be one of: #{STATUSES.join(', ')}" unless STATUSES.include?(status)

      filters = {}
      %w[country_id department_id].each do |key|
        filters[key.to_sym] = Spec.integer(params[key], key, 1) if params[key].present?
      end
      new(status: status, filters: filters)
    end

    def self.call(...) = from_params(...).call

    def initialize(status: "active", filters: {})
      @status = status
      @filters = filters
    end

    # @return [Result]
    def call
      records = fetch_records
      cells = records.group_by { |record| [ record[:title_id], record[:country_id] ] }.values.map { |members| cell(members) }
      compared = cells.select { |cell| cell[:gap] }

      Result.new(
        status: status, filters: filters,
        rows: sort(build_rows(records, cells)),
        adjusted_gap: weighted_gap(compared),
        unadjusted_gap: unadjusted_gap(records),
        women: records.count { |r| r[:gender] == "female" }, men: records.count { |r| r[:gender] == "male" },
        women_compared: compared.sum { |cell| cell[:women] }, cells_compared: compared.size, cells_total: cells.size
      )
    end

    private

    attr_reader :status, :filters

    def fetch_records
      relation = Employee.kept.joins(:job_title, :department).where(gender: %w[female male])
      relation = relation.where(status: status) unless status == "all"
      relation = relation.where(country_id: filters[:country_id]) if filters.key?(:country_id)
      relation = relation.where(department_id: filters[:department_id]) if filters.key?(:department_id)

      relation.pluck(
        "employees.job_title_id", "job_titles.name", "job_titles.level", "departments.name",
        "employees.country_id", "employees.gender", "employees.current_salary_cents", "employees.current_currency"
      ).map do |title_id, title, level, department, country_id, gender, cents, code|
        { title_id: title_id, title: title, level: level, department: department, country_id: country_id,
          gender: gender, cents: cents, usd: Money.new(cents, currencies.fetch(code)).to_usd_cents }
      end
    end

    def currencies = @currencies ||= Currency.all.index_by(&:code)

    # One job title in one country: both genders' pay, and the gap if there are enough of each.
    def cell(members)
      women = members.select { |m| m[:gender] == "female" }.map { |m| m[:cents] }
      men = members.select { |m| m[:gender] == "male" }.map { |m| m[:cents] }
      enough = women.size >= MIN_GROUP && men.size >= MIN_GROUP

      { title_id: members.first[:title_id], women: women.size, men: men.size,
        gap: enough ? relative_gap(mean(women), mean(men)) : nil }
    end

    def build_rows(records, cells)
      cells.group_by { |cell| cell[:title_id] }.map do |title_id, title_cells|
        sample = records.find { |record| record[:title_id] == title_id }
        compared = title_cells.select { |cell| cell[:gap] }

        Row.new(
          job_title: { id: title_id, name: sample[:title], level: sample[:level], department: sample[:department] },
          women: title_cells.sum { |cell| cell[:women] }, men: title_cells.sum { |cell| cell[:men] },
          women_compared: compared.sum { |cell| cell[:women] }, gap: weighted_gap(compared)
        )
      end
    end

    # Most negative (women paid least relative to men) first; titles with no gap last.
    def sort(rows)
      rows.sort_by { |row| [ row.gap.nil? ? 1 : 0, row.gap || 0, row.job_title[:name] ] }
    end

    def weighted_gap(cells)
      weight = cells.sum { |cell| cell[:women] }
      return nil if weight.zero?

      cells.sum { |cell| cell[:gap] * cell[:women] } / weight
    end

    # The simple comparison, in USD so countries can be mixed. Shown for context only.
    def unadjusted_gap(records)
      women = records.select { |r| r[:gender] == "female" }.map { |r| r[:usd] }
      men = records.select { |r| r[:gender] == "male" }.map { |r| r[:usd] }
      return nil if women.empty? || men.empty?

      relative_gap(mean(women), mean(men))
    end

    def mean(values) = Rational(values.sum, values.size)

    # (women - men) / men: -0.05 means women are paid 5% less.
    def relative_gap(women_mean, men_mean) = (women_mean - men_mean) / men_mean
  end
end

module Analytics
  # Answers an Analytics::Spec over the current employees.
  #
  # Every salary is converted to USD cents first (with the same exact, half-up
  # Money conversion used everywhere else), so a median across countries
  # compares like with like. The conversion and the grouping happen in Ruby on
  # the filtered rows rather than in SQL: SQLite has no percentile function,
  # floating-point SQL would not round the way Money does, and 10,000 small
  # rows are cheap to read once. Each figure is rounded to whole cents once,
  # at the end.
  class QueryEngine
    Row = Data.define(:group, :headcount, :value)
    Result = Data.define(:spec, :rows, :total)

    GENDER_LABELS = {
      "female" => "Female", "male" => "Male", "non_binary" => "Non-binary", "undisclosed" => "Not disclosed"
    }.freeze

    # The columns that identify and name each grouping.
    DIMENSIONS = {
      "country" => [ "countries.id", "countries.name" ],
      "department" => [ "departments.id", "departments.name" ],
      "job_title" => [ "job_titles.id", "job_titles.name" ],
      "gender" => [ "employees.gender", "employees.gender" ],
      "level" => [ "job_titles.level", "job_titles.level" ]
    }.freeze

    def self.call(spec) = new(spec).call

    def initialize(spec)
      @spec = spec
    end

    # @return [Result]
    def call
      records = fetch_records
      width = spec.group_by.size * 2

      # Without a grouping there is only the total, not a single nameless row.
      rows = spec.group_by.empty? ? [] : records.group_by { |record| record.first(width) }.map do |key, members|
        values = members.map(&:last)
        Row.new(group: describe(key), headcount: values.size, value: measure(values))
      end

      everyone = records.map(&:last)
      Result.new(spec: spec, rows: sort(rows), total: Row.new(group: {}, headcount: everyone.size, value: measure(everyone)))
    end

    private

    attr_reader :spec

    # One array per employee: [id, label] for each grouping, then USD cents.
    def fetch_records
      columns = spec.group_by.flat_map { |group| DIMENSIONS.fetch(group) }
      scope.pluck(*columns, "employees.current_currency", "employees.current_salary_cents").map do |*cells, code, cents|
        [ *cells, to_usd_cents(code, cents) ]
      end
    end

    def scope
      relation = Employee.kept.joins(:country, :department, :job_title)
      relation = relation.where(status: spec.status) unless spec.status == "all"

      filters = spec.filters
      %i[country_id department_id job_title_id gender].each do |key|
        relation = relation.where(employees: { key => filters[key] }) if filters.key?(key)
      end
      relation = relation.where(job_titles: { level: filters[:level] }) if filters.key?(:level)
      relation = relation.where("employees.termination_date >= ?", filters[:terminated_after]) if filters.key?(:terminated_after)
      relation
    end

    def to_usd_cents(code, cents)
      Money.new(cents, currencies.fetch(code)).to_usd_cents
    end

    def currencies
      @currencies ||= Currency.all.index_by(&:code)
    end

    def describe(key)
      spec.group_by.each_with_index.to_h do |group, index|
        id, label = key[index * 2], key[(index * 2) + 1]
        [ group, { id: id, label: label_for(group, label) } ]
      end
    end

    def label_for(group, label)
      case group
      when "gender" then GENDER_LABELS.fetch(label, label)
      when "level" then "Level #{label}"
      else label
      end
    end

    # Rows read in the order the groupings were asked for; levels sort as numbers.
    def sort(rows)
      rows.sort_by do |row|
        spec.group_by.map { |group| group == "level" ? [ row.group[group][:id] ] : [ row.group[group][:label].to_s.downcase ] }
      end
    end

    def measure(values)
      return values.size if spec.metric == "headcount"
      return nil if values.empty?

      case spec.metric
      when "sum" then values.sum
      when "avg" then round(Rational(values.sum, values.size))
      when "median" then round(Percentile.median(values))
      when "p25" then round(Percentile.call(values, Rational(1, 4)))
      when "p75" then round(Percentile.call(values, Rational(3, 4)))
      when "min" then values.min
      when "max" then values.max
      when "iqr" then round(Percentile.call(values, Rational(3, 4)) - Percentile.call(values, Rational(1, 4)))
      end
    end

    def round(rational) = rational.round(half: :up)
  end
end

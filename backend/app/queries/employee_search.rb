# Finds employees for the list screen: filtering, sorting and keyset
# pagination.
#
# Keyset (cursor) pagination is used instead of OFFSET so a page costs the
# same however deep it is, and rows do not shift between pages while HR edits
# data. The cursor is opaque to clients: the last row's sort value and id.
#
# Raises InvalidRequest for anything it does not understand, so typos in a
# filter name fail loudly instead of silently returning everyone.
class EmployeeSearch
  Result = Data.define(:employees, :total, :next_cursor, :per_page)

  FILTERS = %w[q country_id department_id job_title_id status salary_min salary_max deleted].freeze
  PAGING = %w[sort per_page cursor].freeze
  SORTABLE = %w[full_name hire_date current_salary_cents employee_number].freeze
  STATUSES = %w[active terminated all].freeze
  DEFAULT_SORT = "full_name"
  DEFAULT_PER_PAGE = 25
  MAX_PER_PAGE = 100

  def self.call(params) = new(params).call

  def initialize(params)
    @params = params.to_h.with_indifferent_access
    reject_unknown_params
  end

  # @return [Result]
  def call
    rows = page_scope.to_a
    page = rows.first(per_page)

    Result.new(
      employees: page,
      total: filtered.count,
      next_cursor: rows.size > per_page ? encode_cursor(page.last) : nil,
      per_page: per_page
    )
  end

  private

  attr_reader :params

  def reject_unknown_params
    unknown = params.keys - FILTERS - PAGING
    raise InvalidRequest, "unknown parameter(s): #{unknown.join(', ')}" if unknown.any?
  end

  # --- filtering ---------------------------------------------------------

  def filtered
    @filtered ||= begin
      scope = deleted_only? ? Employee.deleted : Employee.kept
      scope = filter_status(scope)
      scope = filter_text(scope)
      scope = filter_ids(scope)
      filter_salary(scope)
    end
  end

  def deleted_only?
    case params[:deleted]
    when nil, "" then false
    when "only" then true
    else raise InvalidRequest, "deleted must be 'only'"
    end
  end

  # Deleted records are listed so they can be restored, whatever their
  # employment status was, unless a status is asked for explicitly.
  def filter_status(scope)
    status = params[:status].presence || (deleted_only? ? "all" : "active")
    raise InvalidRequest, "status must be one of: #{STATUSES.join(', ')}" unless STATUSES.include?(status)

    status == "all" ? scope : scope.where(status: status)
  end

  # Prefix match on any word of the name, or on the email or employee number.
  # SQLite's LIKE ignores ASCII case; Postgres would need ILIKE.
  def filter_text(scope)
    text = params[:q].to_s.strip
    return scope if text.empty?

    prefix = "#{Employee.sanitize_sql_like(text)}%"
    scope.where(
      "employees.full_name LIKE :prefix ESCAPE '\\' OR employees.full_name LIKE :word ESCAPE '\\' " \
      "OR employees.email LIKE :prefix ESCAPE '\\' OR employees.employee_number LIKE :prefix ESCAPE '\\'",
      prefix: prefix, word: "% #{prefix}"
    )
  end

  def filter_ids(scope)
    %w[country_id department_id job_title_id].each do |name|
      value = integer_param(name)
      scope = scope.where(name => value) if value
    end
    scope
  end

  # The salary is in each employee's local currency, so a range only makes
  # sense within one country.
  def filter_salary(scope)
    min = integer_param("salary_min", minimum: 0)
    max = integer_param("salary_max", minimum: 0)
    return scope unless min || max

    raise InvalidRequest, "salary_min and salary_max require country_id" if params[:country_id].blank?
    raise InvalidRequest, "salary_min cannot exceed salary_max" if min && max && min > max

    scope = scope.where(Employee.arel_table[:current_salary_cents].gteq(min)) if min
    max ? scope.where(Employee.arel_table[:current_salary_cents].lteq(max)) : scope
  end

  def integer_param(name, minimum: 1)
    raw = params[name]
    return nil if raw.blank?

    value = Integer(raw.to_s, 10)
    raise ArgumentError if value < minimum

    value
  rescue ArgumentError
    raise InvalidRequest, "#{name} must be an integer of at least #{minimum}"
  end

  # --- sorting and paging -----------------------------------------------

  def page_scope
    scope = filtered.includes(:department, :job_title, country: :currency)
    scope = after_cursor(scope) if params[:cursor].present?
    scope.order(sort_column => direction, id: direction).limit(per_page + 1)
  end

  def sort_column
    @sort_column ||= begin
      column = sort_param.delete_prefix("-")
      raise InvalidRequest, "sort must be one of: #{SORTABLE.join(', ')} (prefix with - for descending)" unless SORTABLE.include?(column)

      column
    end
  end

  def direction = sort_param.start_with?("-") ? :desc : :asc

  def sort_param = params[:sort].presence || DEFAULT_SORT

  def per_page
    @per_page ||= [ integer_param("per_page") || DEFAULT_PER_PAGE, MAX_PER_PAGE ].min
  end

  # Rows strictly after the cursor row in (sort column, id) order. Built with
  # Arel so values are always bound, never interpolated.
  def after_cursor(scope)
    value, id = decode_cursor
    column = Employee.arel_table[sort_column]
    id_column = Employee.arel_table[:id]
    compare = direction == :asc ? :gt : :lt

    scope.where(column.public_send(compare, value).or(column.eq(value).and(id_column.public_send(compare, id))))
  end

  def encode_cursor(employee)
    value = employee[sort_column]
    value = value.iso8601 if value.respond_to?(:iso8601)

    Base64.urlsafe_encode64(JSON.generate([ value, employee.id ]), padding: false)
  end

  def decode_cursor
    value, id = JSON.parse(Base64.urlsafe_decode64(params[:cursor]))
    raise ArgumentError unless id.is_a?(Integer) && (value.is_a?(String) || value.is_a?(Integer))

    [ value, id ]
  rescue ArgumentError, JSON::ParserError, TypeError
    raise InvalidRequest, "cursor is not valid"
  end
end

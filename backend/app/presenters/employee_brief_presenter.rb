# The few facts needed to list an employee in a finding (who, where, what they
# earn). Expects country (with currency), department and job_title preloaded.
class EmployeeBriefPresenter
  def initialize(employee)
    @employee = employee
  end

  def as_json(*)
    {
      id: employee.id,
      employee_number: employee.employee_number,
      full_name: employee.full_name,
      status: employee.status,
      country: employee.country.slice(:id, :code, :name),
      department: employee.department.slice(:id, :name),
      job_title: employee.job_title.slice(:id, :name, :level),
      salary: { amount_cents: employee.current_salary_cents, currency: employee.current_currency, formatted: format(employee.current_salary_cents) }
    }
  end

  private

  attr_reader :employee

  def format(cents) = Money.new(cents, employee.country.currency).format
end

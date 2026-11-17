# Shapes an Employee for the API. Expects country (with currency),
# department and job_title to be preloaded by the caller.
class EmployeePresenter
  def initialize(employee)
    @employee = employee
  end

  def as_json(*)
    {
      id: employee.id,
      employee_number: employee.employee_number,
      full_name: employee.full_name,
      email: employee.email,
      gender: employee.gender,
      hire_date: employee.hire_date,
      status: employee.status,
      termination_date: employee.termination_date,
      deleted_at: employee.deleted_at,
      country: employee.country.slice(:id, :code, :name),
      department: employee.department.slice(:id, :name),
      job_title: employee.job_title.slice(:id, :name, :level),
      salary: salary
    }
  end

  private

  attr_reader :employee

  # The country's currency equals the salary currency (an Employee invariant),
  # which spares a lookup by code.
  def salary
    money = Money.new(employee.current_salary_cents, employee.country.currency)

    { amount_cents: money.cents, currency: employee.current_currency, formatted: money.format }
  end
end

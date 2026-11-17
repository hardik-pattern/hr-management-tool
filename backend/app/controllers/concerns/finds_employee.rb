# Loads the employee a nested resource (+/employees/:employee_id/...+) belongs
# to. Soft-deleted employees are treated as not found.
module FindsEmployee
  extend ActiveSupport::Concern

  private

  def employee
    @employee ||= Employee.kept.includes(:department, :job_title, country: :currency).find(params[:employee_id])
  end
end

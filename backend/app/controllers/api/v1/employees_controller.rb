module Api
  module V1
    class EmployeesController < ApplicationController
      CREATE_FIELDS = %i[full_name email gender hire_date country_id department_id job_title_id salary_cents].freeze
      # Country is fixed at creation (it determines the salary currency), the
      # hire date is mirrored by the hire salary record, and salary only
      # changes through Salaries::Change.
      UPDATE_FIELDS = %i[full_name email gender department_id job_title_id].freeze

      def create
        attributes = permitted_employee_params(CREATE_FIELDS)
        employee = Employees::Create.call(salary_cents: nil, **attributes.symbolize_keys)

        render_employee employee, status: :created
      end

      def show
        render_employee find_employee
      end

      def update
        employee = find_employee
        employee.update!(permitted_employee_params(UPDATE_FIELDS))

        render_employee employee
      end

      def destroy
        render_employee Employees::SoftDelete.call(employee: find_employee)
      end

      def terminate
        render_employee Employees::Terminate.call(
          employee: find_employee, termination_date: params.require(:termination_date)
        )
      end

      def rehire
        render_employee Employees::Rehire.call(
          employee: find_employee, salary_cents: params[:salary_cents], effective_from: params[:effective_from]
        )
      end

      def restore
        render_employee Employees::Restore.call(employee: find_employee(Employee.deleted))
      end

      private

      def find_employee(scope = Employee.kept)
        scope.includes(:department, :job_title, country: :currency).find(params[:id])
      end

      # Unknown keys are rejected rather than silently dropped, so a client
      # that tries to set status or salary here learns it is not allowed.
      def permitted_employee_params(fields)
        attributes = params.require(:employee)
        unpermitted = attributes.keys.map(&:to_sym) - fields
        raise ActionController::UnpermittedParameters, unpermitted if unpermitted.any?

        attributes.permit(*fields).to_h
      end

      def render_employee(employee, status: :ok)
        render json: { data: EmployeePresenter.new(employee) }, status: status
      end
    end
  end
end

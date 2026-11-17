module Api
  module V1
    class SalaryChangesController < ApplicationController
      include FindsEmployee
      include StrictParams

      # The currency is deliberately not accepted: it is always the employee's.
      FIELDS = %i[amount_cents effective_from reason].freeze

      def create
        record = Salaries::Change.call(
          employee: employee, amount_cents: nil, effective_from: nil, reason: nil,
          **strict_params(:salary_change, FIELDS).symbolize_keys
        )

        render json: {
          data: {
            salary_record: SalaryRecordPresenter.new(record, currency: employee.country.currency),
            employee: EmployeePresenter.new(employee)
          }
        }, status: :created
      end
    end
  end
end

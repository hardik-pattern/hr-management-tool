module Api
  module V1
    # An employee has a handful of records over a career, so the history is
    # returned whole, newest first, without pagination.
    class SalaryRecordsController < ApplicationController
      include FindsEmployee

      def index
        currency = employee.country.currency
        records = employee.salary_records.order(effective_from: :desc, id: :desc)

        render json: { data: records.map { |record| SalaryRecordPresenter.new(record, currency: currency) } }
      end
    end
  end
end

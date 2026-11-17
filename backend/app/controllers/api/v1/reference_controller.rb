module Api
  module V1
    # Small, rarely-changing lookup lists that feed the UI's dropdowns.
    # They are returned whole (no pagination): the lists hold dozens of rows,
    # not thousands.
    class ReferenceController < ApplicationController
      def countries
        render_data Country.includes(:currency).order(:name).map { |country|
          country.slice(:id, :code, :name).merge(currency_code: country.currency_code)
        }
      end

      def currencies
        render_data Currency.order(:code).map { |currency|
          currency.slice(:id, :code, :name, :minor_unit_exponent).merge(rate_to_usd: currency.rate_to_usd.to_s("F"))
        }
      end

      def departments
        render_data Department.order(:name).map { |department| department.slice(:id, :name) }
      end

      def job_titles
        render_data JobTitle.includes(:department).order(:name).map { |job_title|
          job_title.slice(:id, :name, :level, :department_id).merge(department_name: job_title.department.name)
        }
      end

      private

      def render_data(rows)
        render json: { data: rows }
      end
    end
  end
end

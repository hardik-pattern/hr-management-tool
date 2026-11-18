module Api
  module V1
    # Findings about how the organisation pays people. Like the summary,
    # every parameter is validated and anything unknown is a 400.
    class InsightsController < ApplicationController
      def gender_pay_gap
        result = Analytics::GenderPayGap.call(request.query_parameters)

        render json: { data: GenderPayGapPresenter.new(result) }
      end

      def out_of_band
        render json: { data: OutOfBandPresenter.new(Analytics::OutOfBand.call(request.query_parameters)) }
      end

      def stale_salaries
        render json: { data: StaleSalariesPresenter.new(Analytics::StaleSalaries.call(request.query_parameters)) }
      end
    end
  end
end

module Api
  module V1
    # Findings about how the organisation pays people. Like the summary,
    # every parameter is validated and anything unknown is a 400.
    class InsightsController < ApplicationController
      def gender_pay_gap
        result = Analytics::GenderPayGap.call(request.query_parameters)

        render json: { data: GenderPayGapPresenter.new(result) }
      end
    end
  end
end

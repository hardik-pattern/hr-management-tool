module Api
  module V1
    # Pay figures across the organisation. Every parameter is validated by
    # Analytics::Spec; anything unknown or invalid is a 400.
    class AnalyticsController < ApplicationController
      def summary
        result = Analytics::QueryEngine.call(Analytics::Spec.from_params(request.query_parameters))

        render json: { data: AnalyticsSummaryPresenter.new(result) }
      end
    end
  end
end

module Api
  module V1
    # The catalog of common pay questions, and one-click answers to them.
    class QuestionsController < ApplicationController
      include StrictParams

      def index
        render json: {
          data: Questions::Catalog.all.map { |q| q.to_h.slice(:id, :title, :description, :kind) }
        }
      end

      def answer
        reject_unknown_params
        render json: { data: Questions::Answer.call(Questions::Catalog.find(params[:id])) }
      end
    end
  end
end

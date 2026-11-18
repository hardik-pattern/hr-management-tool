module Questions
  # Answers one catalog question by running the analytics it names. The result
  # is shaped exactly as the corresponding analytics endpoint would shape it, so
  # a screen can render a question's answer the same way as the analytics it
  # comes from.
  class Answer
    def self.call(question, today: Date.current) = new(question, today).call

    def initialize(question, today)
      @question = question
      @today = today
    end

    def call
      params = question.params.call(today)

      {
        id: question.id, title: question.title, description: question.description,
        kind: question.kind, params: params, result: result(params)
      }
    end

    private

    attr_reader :question, :today

    def result(params)
      case question.kind
      when :summary then AnalyticsSummaryPresenter.new(Analytics::QueryEngine.call(Analytics::Spec.from_params(params)))
      when :gender_pay_gap then GenderPayGapPresenter.new(Analytics::GenderPayGap.call(params))
      when :out_of_band then OutOfBandPresenter.new(Analytics::OutOfBand.call(params))
      when :stale_salaries then StaleSalariesPresenter.new(Analytics::StaleSalaries.from_params(params, today: today).call)
      end
    end
  end
end

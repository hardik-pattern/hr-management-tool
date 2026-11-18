module Questions
  # The questions an HR manager most often asks about pay, each a fixed
  # definition of how to answer it with the analytics engine or an insight.
  # Nothing here is generated or guessed: a question is a name, a kind of
  # answer and the exact parameters used, so the same question always means the
  # same calculation.
  class Catalog
    # +params+ is called with today's date, for questions about "the last year".
    Question = Data.define(:id, :title, :description, :kind, :params)

    QUESTIONS = [
      Question.new(
        id: "median-pay-by-role-and-country",
        title: "What is the median salary for each role in each country?",
        description: "The middle salary for every job title in every country, in USD so countries compare. Active employees.",
        kind: :summary,
        params: ->(_today) { { "metric" => "median", "group_by" => "job_title,country" } }
      ),
      Question.new(
        id: "gender-pay-gap",
        title: "What is the gender pay gap, comparing like with like?",
        description: "Women's pay against men's in the same job title and country, combined by the number of women. Active employees.",
        kind: :gender_pay_gap,
        params: ->(_today) { {} }
      ),
      Question.new(
        id: "paid-below-band",
        title: "Who is paid below the band for their role?",
        description: "Employees whose salary is under the minimum of the pay band for their job title in their country, furthest below first.",
        kind: :out_of_band,
        params: ->(_today) { { "direction" => "below" } }
      ),
      Question.new(
        id: "payroll-by-department",
        title: "What is the total payroll by department?",
        description: "The sum of current salaries for each department, in USD. Active employees.",
        kind: :summary,
        params: ->(_today) { { "metric" => "sum", "group_by" => "department" } }
      ),
      Question.new(
        id: "widest-pay-spread",
        title: "Which departments have the widest pay spread?",
        description: "The gap between the 25th and 75th percentile of salary in each department, in USD. A wide spread means very different pay inside one team.",
        kind: :summary,
        params: ->(_today) { { "metric" => "iqr", "group_by" => "department" } }
      ),
      Question.new(
        id: "no-raise-24-months",
        title: "Who has not had a salary change in 24 months?",
        description: "Active employees whose latest salary change, including the hire record, is more than 24 months old, longest first.",
        kind: :stale_salaries,
        params: ->(_today) { { "months" => "24" } }
      ),
      Question.new(
        id: "leavers-last-year",
        title: "What did employees who left in the last year earn?",
        description: "The average salary of employees who left in the last 12 months, by department, in USD.",
        kind: :summary,
        params: ->(today) { { "metric" => "avg", "group_by" => "department", "terminated_after" => (today << 12).iso8601 } }
      )
    ].freeze

    def self.all = QUESTIONS

    # @raise [ActiveRecord::RecordNotFound] for an unknown id (rendered as a 404)
    def self.find(id)
      QUESTIONS.find { |question| question.id == id } || raise(ActiveRecord::RecordNotFound.new("Question not found", "Question"))
    end
  end
end

require "rails_helper"

RSpec.describe Questions::Catalog do
  it "has the seven questions an HR manager asks most" do
    expect(described_class.all.map(&:id)).to eq(
      %w[median-pay-by-role-and-country gender-pay-gap paid-below-band payroll-by-department
         widest-pay-spread no-raise-24-months leavers-last-year],
    )
  end

  it "gives every question a unique id, a title that is a question, and a description" do
    questions = described_class.all

    expect(questions.map(&:id).uniq.size).to eq(questions.size)
    expect(questions).to all(satisfy { |q| q.title.end_with?("?") && q.description.present? })
  end

  it "finds a question by id" do
    expect(described_class.find("payroll-by-department").title).to eq("What is the total payroll by department?")
  end

  it "raises not-found for an unknown id, which the API renders as a 404" do
    expect { described_class.find("nope") }.to raise_error(ActiveRecord::RecordNotFound, "Question not found")
  end

  it "only uses parameters the analytics will accept, so no question can fail on a valid database" do
    described_class.all.each do |question|
      expect { Questions::Answer.call(question) }.not_to raise_error, "#{question.id} raised"
    end
  end
end

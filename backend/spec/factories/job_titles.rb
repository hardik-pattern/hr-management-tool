FactoryBot.define do
  factory :job_title do
    sequence(:name) { |n| "Job title #{n}" }
    department
    level { 3 }
  end
end

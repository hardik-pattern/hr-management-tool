FactoryBot.define do
  factory :employee do
    sequence(:employee_number) { |n| format("E%05d", n) }
    sequence(:full_name) { |n| "Employee #{n}" }
    sequence(:email) { |n| "employee#{n}@acme.test" }
    gender { "female" }
    hire_date { Date.new(2020, 1, 1) }
    country
    department
    job_title { association :job_title, department: department }
    current_salary_cents { 6_000_000 }
    current_currency { country.currency_code }

    trait :terminated do
      status { "terminated" }
      termination_date { Date.new(2024, 1, 1) }
    end

    trait :deleted do
      deleted_at { Time.zone.local(2024, 6, 1) }
    end
  end
end

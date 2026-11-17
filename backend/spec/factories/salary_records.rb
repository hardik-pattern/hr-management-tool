FactoryBot.define do
  factory :salary_record do
    employee
    amount_cents { 6_000_000 }
    currency { employee.current_currency }
    effective_from { Date.new(2020, 1, 1) }
    reason { "hire" }
  end
end

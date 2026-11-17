FactoryBot.define do
  factory :pay_band do
    job_title
    country
    min_cents { 5_000_000 }
    max_cents { 9_000_000 }
  end
end

FactoryBot.define do
  factory :country do
    sequence(:code) { |n| "#{(64 + (n % 26 + 1)).chr}#{(64 + ((n / 26) % 26 + 1)).chr}" }
    name { "Testland" }
    currency
  end
end

FactoryBot.define do
  factory :currency do
    sequence(:code) { |n| "C#{(64 + (n % 26 + 1)).chr}#{(64 + ((n / 26) % 26 + 1)).chr}" }
    name { "Test currency" }
    minor_unit_exponent { 2 }
    rate_to_usd { 1 }

    trait :usd do
      code { "USD" }
      name { "US Dollar" }
    end

    trait :jpy do
      code { "JPY" }
      name { "Japanese Yen" }
      minor_unit_exponent { 0 }
      rate_to_usd { "0.0067" }
    end
  end
end

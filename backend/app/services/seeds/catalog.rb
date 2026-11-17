require "bigdecimal/util"

module Seeds
  # Static description of the demo organisation. Everything random lives in
  # EmployeeGenerator; this file is plain data so the shape of the company is
  # easy to read and change.
  module Catalog
    # code, name, minor unit exponent, USD rate. Rates are fixed constants,
    # not a live feed (docs/DESIGN_NOTES.md).
    CURRENCIES = [
      [ "USD", "US Dollar", 2, "1" ],
      [ "GBP", "Pound Sterling", 2, "1.27" ],
      [ "EUR", "Euro", 2, "1.08" ],
      [ "INR", "Indian Rupee", 2, "0.012" ],
      [ "JPY", "Japanese Yen", 0, "0.0067" ],
      [ "CAD", "Canadian Dollar", 2, "0.73" ],
      [ "AUD", "Australian Dollar", 2, "0.66" ],
      [ "BRL", "Brazilian Real", 2, "0.20" ],
      [ "SGD", "Singapore Dollar", 2, "0.74" ]
    ].freeze

    # code, name, currency, headcount weight, pay level relative to the US.
    COUNTRIES = [
      [ "US", "United States", "USD", 30, "1.00" ],
      [ "IN", "India", "INR", 20, "0.35" ],
      [ "GB", "United Kingdom", "GBP", 10, "0.85" ],
      [ "DE", "Germany", "EUR", 8, "0.85" ],
      [ "CA", "Canada", "CAD", 7, "0.85" ],
      [ "JP", "Japan", "JPY", 6, "0.80" ],
      [ "AU", "Australia", "AUD", 5, "0.85" ],
      [ "BR", "Brazil", "BRL", 5, "0.45" ],
      [ "SG", "Singapore", "SGD", 5, "0.90" ],
      [ "FR", "France", "EUR", 4, "0.80" ]
    ].freeze

    # Mid-point salary in USD for a job level in the US.
    LEVEL_BASE_USD = { 1 => 45_000, 2 => 60_000, 3 => 80_000, 4 => 105_000, 5 => 135_000, 6 => 175_000, 7 => 240_000 }.freeze

    # How common each level is within a department; senior roles are rare.
    LEVEL_WEIGHT = { 1 => 30, 2 => 28, 3 => 20, 4 => 12, 5 => 6, 6 => 3, 7 => 0.15 }.freeze

    # A pay band spans 80%..125% of the mid-point.
    BAND_LOW = "0.80".to_d
    BAND_HIGH = "1.25".to_d

    # department => headcount weight and its job titles as [name, level].
    DEPARTMENTS = {
      "Engineering" => { weight: 30, titles: [
        [ "Junior Software Engineer", 1 ], [ "Software Engineer", 2 ], [ "Senior Software Engineer", 3 ],
        [ "Staff Engineer", 5 ], [ "Director of Engineering", 6 ]
      ] },
      "Sales" => { weight: 20, titles: [
        [ "Sales Development Rep", 1 ], [ "Account Executive", 2 ], [ "Senior Account Executive", 3 ],
        [ "Sales Manager", 4 ], [ "VP Sales", 7 ]
      ] },
      "Operations" => { weight: 14, titles: [
        [ "Operations Associate", 1 ], [ "Operations Analyst", 2 ], [ "Senior Operations Analyst", 3 ],
        [ "Operations Manager", 4 ], [ "Director of Operations", 6 ]
      ] },
      "Customer Support" => { weight: 12, titles: [
        [ "Support Agent", 1 ], [ "Senior Support Agent", 2 ], [ "Support Team Lead", 3 ],
        [ "Support Manager", 4 ], [ "Head of Support", 6 ]
      ] },
      "Marketing" => { weight: 8, titles: [
        [ "Marketing Coordinator", 1 ], [ "Marketing Specialist", 2 ], [ "Senior Marketing Specialist", 3 ],
        [ "Marketing Manager", 4 ], [ "Director of Marketing", 6 ]
      ] },
      "Finance" => { weight: 6, titles: [
        [ "Accounts Clerk", 1 ], [ "Financial Analyst", 2 ], [ "Senior Financial Analyst", 3 ],
        [ "Finance Manager", 4 ], [ "CFO", 7 ]
      ] },
      "Human Resources" => { weight: 5, titles: [
        [ "HR Coordinator", 1 ], [ "HR Generalist", 2 ], [ "HR Business Partner", 3 ],
        [ "HR Manager", 4 ], [ "CHRO", 7 ]
      ] },
      "Legal" => { weight: 5, titles: [
        [ "Paralegal", 1 ], [ "Legal Counsel", 3 ], [ "Senior Legal Counsel", 4 ],
        [ "Associate General Counsel", 5 ], [ "General Counsel", 7 ]
      ] }
    }.freeze

    # Titles where the demo data deliberately pays women less, so the gender
    # pay gap insight has something to find. The gap is small and is a
    # property of the fake data only.
    GAP_TITLES = [
      "Senior Software Engineer", "Staff Engineer", "Senior Account Executive",
      "Sales Manager", "Finance Manager", "Marketing Manager"
    ].freeze
    GAP = "0.04".to_d

    # @return [Array<Integer>] [min_cents, max_cents] for a level in a country,
    #   in the country's currency.
    def self.band_cents(level:, pay_factor:, currency:)
      exponent = currency.minor_unit_exponent
      usd = LEVEL_BASE_USD.fetch(level) * pay_factor.to_d
      midpoint = usd / currency.rate_to_usd * (10**exponent)

      [ round_to_hundreds(midpoint * BAND_LOW, exponent), round_to_hundreds(midpoint * BAND_HIGH, exponent) ]
    end

    # Rounds an amount in minor units to the nearest 100 major units, which
    # keeps seeded salaries looking like real, round figures in any currency.
    def self.round_to_hundreds(minor_units, exponent)
      unit = 100 * (10**exponent)
      ((minor_units.to_d / unit).round * unit).to_i
    end
  end
end

module Seeds
  # Loads currencies, countries, departments, job titles and pay bands from
  # Catalog. Safe to run repeatedly: existing rows are updated in place.
  class ReferenceData
    def self.call = new.call

    def call
      ActiveRecord::Base.transaction do
        load_currencies
        load_countries
        load_departments_and_titles
        load_pay_bands
      end
    end

    private

    def load_currencies
      Catalog::CURRENCIES.each do |code, name, exponent, rate|
        Currency.find_or_initialize_by(code: code).update!(name: name, minor_unit_exponent: exponent, rate_to_usd: rate)
      end
    end

    def load_countries
      Catalog::COUNTRIES.each do |code, name, currency_code, *|
        Country.find_or_initialize_by(code: code).update!(name: name, currency: Currency.find_by!(code: currency_code))
      end
    end

    def load_departments_and_titles
      Catalog::DEPARTMENTS.each do |department_name, definition|
        department = Department.find_or_create_by!(name: department_name)
        definition[:titles].each do |title_name, level|
          JobTitle.find_or_initialize_by(name: title_name, department: department).update!(level: level)
        end
      end
    end

    # One upsert for all bands (40 titles x 10 countries) instead of a
    # find-and-update per row; the catalog is trusted input, and the spec
    # checks every band is valid.
    def load_pay_bands
      pay_factors = Catalog::COUNTRIES.to_h { |code, _name, _currency, _weight, factor| [ code, factor ] }
      titles = JobTitle.all.to_a

      rows = Country.includes(:currency).flat_map do |country|
        titles.map do |title|
          min, max = Catalog.band_cents(level: title.level, pay_factor: pay_factors.fetch(country.code), currency: country.currency)
          { job_title_id: title.id, country_id: country.id, min_cents: min, max_cents: max }
        end
      end

      PayBand.upsert_all(rows, unique_by: %i[job_title_id country_id])
    end
  end
end

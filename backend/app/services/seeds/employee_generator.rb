require "bigdecimal/util"

module Seeds
  # Inserts a reproducible demo workforce with realistic salary histories.
  #
  # The same +random_seed+ and +today+ always produce identical rows, so tests
  # and demos are stable. Rows go in with +insert_all+ in batches, which skips
  # validations and callbacks on purpose for speed; the generator's own specs
  # check that what it writes satisfies the model rules.
  #
  # Cases planted for the insights to find:
  # * a small share of employees paid outside their pay band,
  # * employees whose last raise is more than 24 months old,
  # * a small gender pay gap in Catalog::GAP_TITLES,
  # * terminated employees and a few soft-deleted rows.
  class EmployeeGenerator
    DEFAULT_RANDOM_SEED = 20_240_101
    BATCH_SIZE = 1_000

    GENDER_WEIGHTS = [ [ "female", 46 ], [ "male", 46 ], [ "non_binary", 3 ], [ "undisclosed", 5 ] ].freeze
    OUT_OF_BAND_RATE = 0.005
    STALE_RATE = 0.09
    TERMINATED_RATE = 0.085
    STALE_AFTER_DAYS = 760 # a little over the 24 months the insight looks at

    FIRST_NAMES = {
      "female" => %w[Aisha Maria Priya Emma Sofia Yuki Chloe Hannah Fatima Grace Lucia Mei Olivia Nadia Isabelle Ananya Zoe Elena Hana Ruth],
      "male" => %w[Arjun James Liam Carlos Hiro Omar Lucas Noah Daniel Felix Mateo Ravi Ethan Tomas Samuel Kenji Hugo Victor Idris Paul],
      "neutral" => %w[Alex Sam Jordan Taylor Robin Casey Morgan Quinn Avery Jamie Riley Dana Kai Rowan Sasha Charlie Eden Noa Remy Skyler]
    }.freeze
    LAST_NAMES = %w[
      Sharma Smith Garcia Tanaka Muller Dubois Silva Patel Johnson Lee Nguyen Brown Khan Rossi Kim
      Martin Singh Wilson Costa Clark Ito Fischer Moreau Santos Verma Taylor Chen Lopez Walker Reddy
      Nakamura Evans Weber Rao Ford Gupta Hall Mehta Young Bauer
    ].freeze

    def self.call(...) = new(...).call

    # @param count [Integer] employees to create
    # @param today [Date] the "now" the history is built relative to
    # @param deleted_count [Integer] how many employees to soft-delete
    def initialize(count:, random_seed: DEFAULT_RANDOM_SEED, today: Date.current, deleted_count: 8)
      @count = count
      @rng = Random.new(random_seed)
      @today = today
      @deleted_count = deleted_count
    end

    # @return [Integer] number of employees created
    def call
      load_reference_data
      first_id = Employee.maximum(:id).to_i + 1
      deleted_ids = (first_id...(first_id + count)).to_a.sample(deleted_count, random: rng).to_set

      Employee.transaction do
        (first_id...(first_id + count)).each_slice(BATCH_SIZE) do |ids|
          rows = ids.map { |id| build_employee(id, deleted: deleted_ids.include?(id)) }
          Employee.insert_all(rows.map { |row| row.fetch(:employee) })
          SalaryRecord.insert_all(rows.flat_map { |row| row.fetch(:salary_records) })
        end
      end

      count
    end

    private

    attr_reader :count, :rng, :today, :deleted_count

    def load_reference_data
      pay_weights = Catalog::COUNTRIES.to_h { |code, _name, _currency, weight, _factor| [ code, weight ] }
      @country_picker = WeightedPicker.new(Country.includes(:currency).map { |c| [ c, pay_weights.fetch(c.code) ] })
      @gender_picker = WeightedPicker.new(GENDER_WEIGHTS)
      @department_picker = WeightedPicker.new(
        Department.all.map { |d| [ d, Catalog::DEPARTMENTS.fetch(d.name).fetch(:weight) ] }
      )
      @title_pickers = JobTitle.all.group_by(&:department_id).transform_values do |titles|
        WeightedPicker.new(titles.map { |t| [ t, Catalog::LEVEL_WEIGHT.fetch(t.level) ] })
      end
      @bands = PayBand.pluck(:job_title_id, :country_id, :min_cents, :max_cents)
                      .to_h { |title_id, country_id, min, max| [ [ title_id, country_id ], [ min, max ] ] }
    end

    def build_employee(id, deleted:)
      country = @country_picker.pick(rng)
      department = @department_picker.pick(rng)
      title = @title_pickers.fetch(department.id).pick(rng)
      gender = @gender_picker.pick(rng)
      hire_date = today - rng.rand(30..3650)
      termination_date = pick_termination_date(hire_date)
      salary = current_salary(title, country, gender)

      {
        employee: employee_row(id, country, department, title, gender, hire_date, termination_date, salary, deleted),
        salary_records: salary_history(id, country.currency, hire_date, termination_date, salary)
      }
    end

    def employee_row(id, country, department, title, gender, hire_date, termination_date, salary, deleted)
      first, last = pick_name(gender)
      created = hire_date.in_time_zone("UTC")

      {
        id: id, employee_number: format("E%06d", id), full_name: "#{first} #{last}",
        email: "#{first}.#{last}.#{id}@acme.test".downcase, gender: gender, hire_date: hire_date,
        status: termination_date ? "terminated" : "active", termination_date: termination_date,
        deleted_at: deleted ? today.in_time_zone("UTC") - rng.rand(1..90).days : nil,
        country_id: country.id, department_id: department.id, job_title_id: title.id,
        current_salary_cents: salary, current_currency: country.currency.code,
        created_at: created, updated_at: created
      }
    end

    def pick_name(gender)
      pool = FIRST_NAMES.fetch(FIRST_NAMES.key?(gender) ? gender : "neutral")
      [ pool.fetch(rng.rand(pool.size)), LAST_NAMES.fetch(rng.rand(LAST_NAMES.size)) ]
    end

    def pick_termination_date(hire_date)
      tenure_days = (today - hire_date).to_i
      return nil unless tenure_days > 120 && rng.rand < TERMINATED_RATE

      hire_date + rng.rand(60..(tenure_days - 1))
    end

    # Salary sits inside the title's band for the country, clustered around
    # the middle, with the planted gap and out-of-band cases applied on top.
    def current_salary(title, country, gender)
      min, max = @bands.fetch([ title.id, country.id ])
      position = (0.5 + 0.22 * gaussian).clamp(0.0, 1.0)
      salary = min + position * (max - min)

      if gender == "female" && Catalog::GAP_TITLES.include?(title.name)
        salary = [ salary * (1 - Catalog::GAP.to_f), min ].max
      end
      salary = push_out_of_band(salary, min, max) if rng.rand < OUT_OF_BAND_RATE

      [ Catalog.round_to_hundreds(salary, country.currency.minor_unit_exponent), 1 ].max
    end

    def push_out_of_band(salary, min, max)
      rng.rand < 0.5 ? min * rng.rand(0.85..0.95) : max * rng.rand(1.05..1.15)
    end

    # Box-Muller transform; +1 - rand+ keeps the log argument above zero.
    def gaussian
      Math.sqrt(-2 * Math.log(1 - rng.rand)) * Math.cos(2 * Math::PI * rng.rand)
    end

    # Builds the dated history ending at +salary+. For people who are not
    # planted as stale, the last change is within the last 24 months; stale
    # people last had a change more than STALE_AFTER_DAYS ago.
    def salary_history(employee_id, currency, hire_date, termination_date, salary)
      end_date = termination_date || today
      dates = history_dates(hire_date, end_date, stale: termination_date.nil? && stale?(hire_date))
      reasons = dates.each_index.map { |i| i.zero? ? "hire" : (rng.rand < 0.15 ? "promotion" : "merit") }
      amounts = amounts_ending_at(salary, reasons, currency.minor_unit_exponent)

      dates.zip(reasons, amounts).map do |date, reason, amount|
        { employee_id: employee_id, amount_cents: amount, currency: currency.code, effective_from: date,
          reason: reason, created_at: date.in_time_zone("UTC") }
      end
    end

    def stale?(hire_date)
      (today - hire_date).to_i > 900 && rng.rand < STALE_RATE
    end

    # The last change is 14..700 days before the end date (so within 24 months
    # for active staff), unless the person is planted as stale.
    def history_dates(hire_date, end_date, stale:)
      span = (end_date - hire_date).to_i
      last_offset =
        if stale then rng.rand(0..(span - STALE_AFTER_DAYS))
        elsif span > 700 then span - rng.rand(14..700)
        else 0
        end
      return [ hire_date ] if last_offset.zero?

      middle = Array.new(last_offset > 2 ? rng.rand(0..2) : 0) { hire_date + rng.rand(1...last_offset) }
      ([ hire_date ] + middle + [ hire_date + last_offset ]).uniq.sort
    end

    # Works backwards from the current salary: each earlier record is the later
    # one divided by that change's growth.
    def amounts_ending_at(salary, reasons, exponent)
      amounts = [ salary ]
      reasons.drop(1).reverse_each do |reason|
        growth = reason == "promotion" ? rng.rand(0.10..0.18) : rng.rand(0.03..0.07)
        amounts.unshift([ Catalog.round_to_hundreds(amounts.first / (1 + growth), exponent), 1 ].max)
      end
      amounts
    end
  end
end

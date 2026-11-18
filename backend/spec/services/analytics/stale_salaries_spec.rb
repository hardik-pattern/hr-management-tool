require "rails_helper"

RSpec.describe Analytics::StaleSalaries do
  let(:today) { Date.new(2025, 6, 15) }
  let(:us) { create(:country, name: "United States") }
  let(:jp) { create(:country, name: "Japan") }

  around { |example| travel_to(today) { example.run } }

  # The history is written first: records cannot be added once someone has left
  # or been deleted, so their status is applied afterwards.
  def employee(last_change, name: "Person", country: us, **status)
    person = create(:employee, full_name: name, country: country, hire_date: Date.new(2015, 1, 1))
    create(:salary_record, employee: person, effective_from: Date.new(2015, 1, 1), reason: "hire")
    create(:salary_record, employee: person, effective_from: last_change, reason: "merit") unless last_change == Date.new(2015, 1, 1)
    person.update!(status) if status.any?
    person
  end

  def run(params = {}) = described_class.from_params(params, today: today).call
  def names(result) = result.rows.map { |row| row.employee.full_name }

  describe "what is stale" do
    it "is a latest change older than the number of months" do
      employee(Date.new(2023, 6, 14), name: "A day over two years")
      employee(Date.new(2023, 6, 15), name: "Exactly two years")
      employee(Date.new(2024, 1, 1), name: "Recent")

      expect(names(run)).to eq([ "A day over two years" ])
    end

    it "looks at the latest change, not the first" do
      person = employee(Date.new(2016, 1, 1), name: "Raised recently")
      create(:salary_record, employee: person, effective_from: Date.new(2025, 1, 1), reason: "merit")

      expect(run.total).to eq(0)
    end

    it "counts someone never raised since being hired" do
      employee(Date.new(2015, 1, 1), name: "Hire only")

      expect(names(run)).to eq([ "Hire only" ])
    end

    it "uses the number of months asked for" do
      employee(Date.new(2024, 5, 1), name: "Thirteen months")

      expect(run(months: 24).total).to eq(0)
      expect(run(months: 12).total).to eq(1)
      expect(run(months: 1).total).to eq(1)
    end
  end

  describe "the rows" do
    it "give the date of the last change and whole months since" do
      employee(Date.new(2023, 3, 10), name: "Long")

      expect(run.rows.first).to have_attributes(last_change_on: Date.new(2023, 3, 10), months_since: 27)
    end

    it "do not count a month until it is complete" do
      employee(Date.new(2023, 3, 20), name: "Not quite")

      expect(run.rows.first.months_since).to eq(26) # 20 March to 15 June 2025 is not yet 27 months
    end

    it "list the longest without a change first" do
      employee(Date.new(2022, 1, 1), name: "Older")
      employee(Date.new(2021, 1, 1), name: "Oldest")
      employee(Date.new(2023, 1, 1), name: "Old")

      expect(names(run)).to eq([ "Oldest", "Older", "Old" ])
    end
  end

  describe "who is counted" do
    before do
      employee(Date.new(2020, 1, 1), name: "Active", country: us)
      employee(Date.new(2020, 1, 1), name: "Left", country: jp, status: "terminated", termination_date: Date.new(2021, 1, 1))
      employee(Date.new(2020, 1, 1), name: "Deleted", deleted_at: Time.current)
    end

    it "defaults to active employees and never includes deleted ones" do
      expect(names(run)).to eq([ "Active" ])
      expect(names(run(status: "all"))).to contain_exactly("Active", "Left")
    end

    it "can be narrowed by country and department" do
      expect(names(run(status: "all", country_id: jp.id.to_s))).to eq([ "Left" ])
      expect(run(department_id: create(:department).id.to_s).total).to eq(0)
    end
  end

  describe "the limit" do
    before { 4.times { |i| employee(Date.new(2020, 1, 1 + i), name: "Person #{i}") } }

    it "caps the rows but not the total" do
      result = run(limit: 2)

      expect(result.rows.size).to eq(2)
      expect(result.total).to eq(4)
    end
  end

  it "does not run a query per employee" do
    4.times { |i| employee(Date.new(2020, 1, 1 + i), name: "Person #{i}") }
    queries = 0
    counter = ->(*, payload) { queries += 1 unless payload[:name] == "SCHEMA" }

    ActiveSupport::Notifications.subscribed(counter, "sql.active_record") do
      run.rows.each { |row| [ row.employee.country.currency, row.employee.department, row.employee.job_title ] }
    end

    expect(queries).to be <= 9
  end

  it "refuses what it does not understand" do
    expect { run(colour: "red") }.to raise_error(InvalidRequest, /unknown parameter/)
    expect { run(months: 0) }.to raise_error(InvalidRequest, /months must be an integer between 1 and 120/)
    expect { run(months: 121) }.to raise_error(InvalidRequest, /months/)
    expect { run(limit: 500) }.to raise_error(InvalidRequest, /limit/)
    expect { run(status: "retired") }.to raise_error(InvalidRequest, /status must be one of/)
  end
end

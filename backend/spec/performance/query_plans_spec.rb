require "rails_helper"

# The analytics read the whole organisation, so what matters is that the lookups
# inside them (the pay band for each employee, the latest salary change) use
# indexes instead of scanning a table once per employee. These specs read
# SQLite's own query plan for the real queries and fail if an index goes missing.
RSpec.describe "Query plans for the analytics" do
  let(:usd) { create(:currency, :usd) }
  let(:country) { create(:country, currency: usd) }
  let(:department) { create(:department) }
  let(:title) { create(:job_title, department: department) }

  before do
    create(:pay_band, job_title: title, country: country, min_cents: 5_000, max_cents: 9_000)
    person = create(:employee, country: country, department: department, job_title: title, current_salary_cents: 1_000)
    create(:salary_record, employee: person, effective_from: Date.new(2020, 1, 1), reason: "hire")
  end

  # Runs the block and returns the query plan of every SELECT it issued.
  def plans_for
    selects = []
    subscriber = ->(*, payload) { selects << payload if payload[:sql].start_with?("SELECT") && payload[:name] != "SCHEMA" }
    ActiveSupport::Notifications.subscribed(subscriber, "sql.active_record") { yield }

    selects.map do |payload|
      connection = ActiveRecord::Base.connection
      connection.select_all("EXPLAIN QUERY PLAN #{payload[:sql]}", "EXPLAIN", payload[:binds]).map { |row| row["detail"] }
    end.flatten
  end

  def scans_of(plan, table) = plan.grep(/\ASCAN #{table}\b/)

  it "looks up each employee's pay band by index" do
    plan = plans_for { Analytics::OutOfBand.call({}) }

    expect(plan).to include(a_string_matching(/SEARCH pay_bands USING (COVERING )?INDEX index_pay_bands_on_job_title_id_and_country_id/))
    expect(scans_of(plan, "pay_bands")).to be_empty
  end

  it "finds each employee's latest salary change by index, not by scanning their history" do
    plan = plans_for { Analytics::StaleSalaries.call({}) }

    expect(plan).to include(a_string_matching(/SEARCH salary_records USING COVERING INDEX index_salary_records_on_employee_id_and_effective_from/))
    expect(scans_of(plan, "salary_records")).to be_empty
  end

  it "joins the names the engine groups by through primary keys, never scanning those tables" do
    plan = plans_for do
      Analytics::QueryEngine.call(Analytics::Spec.from_params("metric" => "median", "group_by" => "department,country"))
      Analytics::QueryEngine.call(Analytics::Spec.from_params("metric" => "median", "group_by" => "job_title"))
    end

    %w[countries departments job_titles].each { |table| expect(scans_of(plan, table)).to be_empty, "#{table} was scanned" }
  end

  it "narrows the employees by index when asked for a status, rather than reading every row" do
    plan = plans_for { Analytics::QueryEngine.call(Analytics::Spec.from_params("metric" => "headcount", "status" => "terminated")) }

    expect(plan).to include(a_string_matching(/SEARCH employees USING INDEX index_employees_on_status/))
  end

  it "runs the same number of queries however many groups there are" do
    counts = [ "department", "department,country", "job_title,country" ].map do |group|
      queries = 0
      counter = ->(*, payload) { queries += 1 unless payload[:name] == "SCHEMA" }
      ActiveSupport::Notifications.subscribed(counter, "sql.active_record") do
        Analytics::QueryEngine.call(Analytics::Spec.from_params("metric" => "median", "group_by" => group))
      end
      queries
    end

    expect(counts.uniq.size).to eq(1)
  end
end

require "rails_helper"

RSpec.describe EmployeeSearch do
  def search(**params) = described_class.call(params)
  def names(**params) = search(**params).employees.map(&:full_name)

  describe "defaults" do
    let!(:active) { create(:employee, full_name: "Active Person") }
    let!(:terminated) { create(:employee, :terminated, full_name: "Gone Person") }
    let!(:deleted) { create(:employee, :deleted, full_name: "Deleted Person") }

    it "lists kept, active employees only" do
      expect(search.employees).to contain_exactly(active)
    end

    it "reports the total of the filtered set" do
      expect(search.total).to eq(1)
    end
  end

  describe "status" do
    let!(:active) { create(:employee) }
    let!(:terminated) { create(:employee, :terminated) }
    let!(:deleted_active) { create(:employee, :deleted) }

    it "can list terminated employees" do
      expect(search(status: "terminated").employees).to contain_exactly(terminated)
    end

    it "can list everyone who is kept" do
      expect(search(status: "all").employees).to contain_exactly(active, terminated)
    end

    it "rejects an unknown status" do
      expect { search(status: "retired") }.to raise_error(InvalidRequest, /status must be one of/)
    end
  end

  describe "deleted=only" do
    let!(:kept) { create(:employee) }
    let!(:deleted_active) { create(:employee, :deleted) }
    let!(:deleted_terminated) { create(:employee, :deleted, :terminated) }

    it "lists soft-deleted employees whatever their employment status" do
      expect(search(deleted: "only").employees).to contain_exactly(deleted_active, deleted_terminated)
    end

    it "still honours an explicit status" do
      expect(search(deleted: "only", status: "terminated").employees).to contain_exactly(deleted_terminated)
    end

    it "rejects other values" do
      expect { search(deleted: "yes") }.to raise_error(InvalidRequest, /deleted must be 'only'/)
    end
  end

  describe "q (text search)" do
    let!(:asha) { create(:employee, full_name: "Asha Rao", email: "asha.r@acme.test", employee_number: "E000100") }
    let!(:ravi) { create(:employee, full_name: "Ravi Menon Rao", email: "ravi@acme.test", employee_number: "E000200") }
    let!(:other) { create(:employee, full_name: "Zed Quinn", email: "zed@acme.test", employee_number: "E000300") }

    it "matches the start of the name, ignoring case" do
      expect(search(q: "asha").employees).to contain_exactly(asha)
    end

    it "matches the start of any word in the name" do
      expect(search(q: "rao").employees).to contain_exactly(asha, ravi)
    end

    it "does not match the middle of a word" do
      expect(search(q: "sha").employees).to be_empty
    end

    it "matches an email prefix" do
      expect(search(q: "zed@").employees).to contain_exactly(other)
    end

    it "matches an employee number prefix" do
      expect(search(q: "E0002").employees).to contain_exactly(ravi)
    end

    it "treats LIKE wildcards as plain text" do
      expect(search(q: "%").employees).to be_empty
      expect(search(q: "_").employees).to be_empty
    end

    it "ignores a blank query" do
      expect(search(q: "  ").total).to eq(3)
    end
  end

  describe "id filters" do
    let!(:target) { create(:employee) }
    let!(:other) { create(:employee) }

    it "filters by country" do
      expect(search(country_id: target.country_id).employees).to contain_exactly(target)
    end

    it "filters by department" do
      expect(search(department_id: target.department_id).employees).to contain_exactly(target)
    end

    it "filters by job title" do
      expect(search(job_title_id: target.job_title_id).employees).to contain_exactly(target)
    end

    it "combines filters with AND" do
      expect(search(country_id: target.country_id, department_id: other.department_id).employees).to be_empty
    end

    it "accepts ids sent as strings, as query strings do" do
      expect(search(country_id: target.country_id.to_s).employees).to contain_exactly(target)
    end

    it "rejects a non-numeric id" do
      expect { search(country_id: "abc") }.to raise_error(InvalidRequest, /country_id must be an integer/)
    end
  end

  describe "salary range" do
    let(:country) { create(:country) }
    let!(:low) { create(:employee, country: country, current_salary_cents: 3_000_000) }
    let!(:mid) { create(:employee, country: country, current_salary_cents: 6_000_000) }
    let!(:high) { create(:employee, country: country, current_salary_cents: 9_000_000) }

    it "filters by a minimum, inclusive" do
      expect(search(country_id: country.id, salary_min: 6_000_000).employees).to contain_exactly(mid, high)
    end

    it "filters by a maximum, inclusive" do
      expect(search(country_id: country.id, salary_max: 6_000_000).employees).to contain_exactly(low, mid)
    end

    it "filters by both" do
      expect(search(country_id: country.id, salary_min: 4_000_000, salary_max: 8_000_000).employees).to contain_exactly(mid)
    end

    it "requires a country, because salaries are in local currencies" do
      expect { search(salary_min: 1) }.to raise_error(InvalidRequest, /require country_id/)
    end

    it "rejects a minimum above the maximum" do
      expect { search(country_id: country.id, salary_min: 9, salary_max: 1) }
        .to raise_error(InvalidRequest, /cannot exceed/)
    end

    it "rejects a negative amount" do
      expect { search(country_id: country.id, salary_min: -5) }.to raise_error(InvalidRequest, /salary_min/)
    end
  end

  describe "sorting" do
    let!(:b) { create(:employee, full_name: "Bea", hire_date: Date.new(2022, 1, 1), current_salary_cents: 7_000_000, employee_number: "E3") }
    let!(:c) { create(:employee, full_name: "Cal", hire_date: Date.new(2020, 1, 1), current_salary_cents: 5_000_000, employee_number: "E1") }
    let!(:a) { create(:employee, full_name: "Abe", hire_date: Date.new(2021, 1, 1), current_salary_cents: 9_000_000, employee_number: "E2") }

    it "sorts by name ascending by default" do
      expect(names).to eq(%w[Abe Bea Cal])
    end

    it "sorts descending with a leading minus" do
      expect(names(sort: "-full_name")).to eq(%w[Cal Bea Abe])
    end

    it "sorts by hire date" do
      expect(names(sort: "hire_date")).to eq(%w[Cal Abe Bea])
    end

    it "sorts by salary" do
      expect(names(sort: "-current_salary_cents")).to eq(%w[Abe Bea Cal])
    end

    it "sorts by employee number" do
      expect(names(sort: "employee_number")).to eq(%w[Cal Abe Bea])
    end

    it "rejects a column that is not whitelisted" do
      expect { search(sort: "email") }.to raise_error(InvalidRequest, /sort must be one of/)
      expect { search(sort: "id; DROP TABLE employees") }.to raise_error(InvalidRequest)
    end
  end

  describe "pagination" do
    # Duplicated names and salaries force the id tie-break to do its job.
    before do
      12.times { |i| create(:employee, full_name: "Same Name", current_salary_cents: 5_000_000 + ((i % 3) * 100_000), hire_date: Date.new(2020, 1, 1) + (i % 4)) }
      6.times { |i| create(:employee, full_name: "Name #{i}") }
    end

    def walk(per_page:, **params)
      pages = []
      cursor = nil
      loop do
        result = search(per_page: per_page, cursor: cursor, **params)
        pages << result.employees.map(&:id)
        cursor = result.next_cursor
        break unless cursor
      end
      pages
    end

    %w[full_name -full_name hire_date -hire_date current_salary_cents -current_salary_cents employee_number -employee_number].each do |sort|
      it "visits every employee exactly once, in order, when sorted by #{sort}" do
        pages = walk(per_page: 5, sort: sort)
        paged_ids = pages.flatten

        expect(paged_ids.size).to eq(18)
        expect(paged_ids.uniq).to eq(paged_ids)
        expect(paged_ids).to eq(search(per_page: 100, sort: sort).employees.map(&:id))
        expect(pages.map(&:size)).to eq([ 5, 5, 5, 3 ])
      end
    end

    it "returns no cursor on the last page" do
      expect(search(per_page: 18).next_cursor).to be_nil
    end

    it "returns no cursor when the results exactly fill the page" do
      expect(search(per_page: 18).employees.size).to eq(18)
      expect(search(per_page: 17).next_cursor).to be_present
    end

    it "reports the total regardless of the page size" do
      expect(search(per_page: 5).total).to eq(18)
    end

    it "defaults to 25 per page and caps at 100" do
      expect(search.per_page).to eq(25)
      expect(search(per_page: 5_000).per_page).to eq(100)
    end

    it "rejects a non-positive per_page" do
      expect { search(per_page: 0) }.to raise_error(InvalidRequest, /per_page/)
    end

    it "keeps filters applied across pages" do
      create(:employee, :terminated, full_name: "Same Name")

      expect(walk(per_page: 4).flatten.size).to eq(18)
      expect(walk(per_page: 4, status: "all").flatten.size).to eq(19)
    end

    it "rejects a cursor that is not ours" do
      expect { search(cursor: "garbage") }.to raise_error(InvalidRequest, /cursor/)
      expect { search(cursor: Base64.urlsafe_encode64("[1]", padding: false)) }.to raise_error(InvalidRequest, /cursor/)
    end
  end

  describe "unknown parameters" do
    it "are rejected so typos do not silently return everyone" do
      expect { search(contry_id: 1) }.to raise_error(InvalidRequest, /unknown parameter\(s\): contry_id/)
    end
  end

  describe "query count" do
    it "does not grow with the number of rows on the page" do
      create_list(:employee, 12)

      small = count_queries { search(per_page: 2).employees.each { |e| [ e.country.currency, e.department, e.job_title ] } }
      large = count_queries { search(per_page: 12).employees.each { |e| [ e.country.currency, e.department, e.job_title ] } }

      expect(large).to eq(small)
    end
  end

  def count_queries(&block)
    count = 0
    counter = ->(*, payload) { count += 1 unless payload[:name] == "SCHEMA" }
    ActiveSupport::Notifications.subscribed(counter, "sql.active_record", &block)
    count
  end
end

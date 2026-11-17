require "rails_helper"

RSpec.describe Seeds::EmployeeGenerator do
  TODAY = Date.new(2025, 6, 15)

  let(:today) { TODAY }

  def generate(count, **options)
    described_class.call(count: count, today: today, **options)
  end

  # Salary record ids are left out: auto-increment keeps counting after a delete.
  def snapshot
    [ Employee.order(:id).pluck(Arel.sql("*")),
      SalaryRecord.order(:id).pluck(:employee_id, :amount_cents, :currency, :effective_from, :reason, :created_at) ]
  end

  describe "volume and identity" do
    before { Seeds::ReferenceData.call }

    it "creates the requested number of employees with sequential numbers" do
      generate(120)

      expect(Employee.count).to eq(120)
      expect(Employee.order(:id).pluck(:employee_number)).to eq((1..120).map { |n| format("E%06d", n) })
    end

    it "continues numbering when run again" do
      generate(30)
      generate(20)

      expect(Employee.count).to eq(50)
      expect(Employee.pluck(:employee_number).uniq.size).to eq(50)
      expect(Employee.maximum(:id)).to eq(50)
    end

    it "gives every employee a unique email" do
      generate(300)

      expect(Employee.pluck(:email).uniq.size).to eq(300)
    end
  end

  describe "reproducibility" do
    before { Seeds::ReferenceData.call }

    it "produces identical data for the same seed and date" do
      generate(150)
      first = snapshot
      SalaryRecord.delete_all
      Employee.delete_all

      generate(150)

      expect(snapshot).to eq(first)
    end

    it "produces different data for a different seed" do
      generate(150)
      first = Employee.order(:id).pluck(:full_name, :current_salary_cents)
      SalaryRecord.delete_all
      Employee.delete_all

      generate(150, random_seed: 7)

      expect(Employee.order(:id).pluck(:full_name, :current_salary_cents)).not_to eq(first)
    end
  end

  describe "generated dataset" do
    seed_dataset 3_000, today: TODAY, deleted_count: 8

    describe "data integrity" do
      it "writes employees that satisfy the model rules" do
        expect(Employee.limit(200).reject(&:valid?)).to be_empty
      end

      it "keeps job titles inside their department and the currency inside the country" do
        expect(Employee.joins(:job_title).where("job_titles.department_id != employees.department_id")).to be_empty
        expect(Employee.joins(country: :currency).where("currencies.code != employees.current_currency")).to be_empty
      end

      it "makes the current salary equal the latest salary record" do
        latest = SalaryRecord.order(:effective_from, :id).group_by(&:employee_id).transform_values(&:last)

        mismatches = Employee.all.reject { |e| latest.fetch(e.id).amount_cents == e.current_salary_cents }
        expect(mismatches).to be_empty
      end

      it "starts every history with a hire record dated on the hire date" do
        first_records = SalaryRecord.order(:effective_from, :id).group_by(&:employee_id).transform_values(&:first)

        expect(Employee.all).to all(satisfy { |e|
          record = first_records.fetch(e.id)
          record.reason == "hire" && record.effective_from == e.hire_date
        })
      end

      it "never dates a record in the future, before hire, or after termination" do
        expect(SalaryRecord.where("effective_from > ?", TODAY)).to be_empty
        expect(SalaryRecord.joins(:employee).where("salary_records.effective_from < employees.hire_date")).to be_empty
        expect(SalaryRecord.joins(:employee).where("salary_records.effective_from > employees.termination_date")).to be_empty
      end

      it "uses only positive amounts" do
        expect(SalaryRecord.where("amount_cents <= 0")).to be_empty
        expect(Employee.where("current_salary_cents <= 0")).to be_empty
      end
    end

    describe "lifecycle states" do
      it "terminates roughly 8% of employees with valid dates" do
        terminated = Employee.terminated

        expect(terminated.count).to be_between(150, 340)
        expect(terminated.where("termination_date < hire_date OR termination_date > ?", TODAY)).to be_empty
      end

      it "soft-deletes exactly the requested number" do
        expect(Employee.deleted.count).to eq(8)
      end
    end

    describe "planted cases for the insights" do
      it "plants a few employees outside their band, but only a few" do
        expect(out_of_band_count).to be_between(3, 60)
      end

      it "plants employees whose last raise is over 24 months old, but most are recent" do
        active = Employee.kept.active.count

        expect(stale_count).to be_between((active * 0.02).ceil, (active * 0.12).floor)
      end

      it "pays women slightly less in the gap titles only" do
        expect(mean_position(gap_titles: true, gender: "female")).to be < mean_position(gap_titles: true, gender: "male") - 0.02
        expect(mean_position(gap_titles: false, gender: "female"))
          .to be_within(0.02).of(mean_position(gap_titles: false, gender: "male"))
      end
    end

    def out_of_band_count
      Employee.kept.active
              .joins("JOIN pay_bands pb ON pb.job_title_id = employees.job_title_id AND pb.country_id = employees.country_id")
              .where("employees.current_salary_cents < pb.min_cents OR employees.current_salary_cents > pb.max_cents")
              .count
    end

    def stale_count
      Employee.kept.active
              .where("(SELECT MAX(effective_from) FROM salary_records s WHERE s.employee_id = employees.id) < ?", TODAY - 730)
              .count
    end

    # Salary as a fraction of its band mid-point, so countries and titles compare.
    def mean_position(gap_titles:, gender:)
      gap_ids = JobTitle.where(name: Seeds::Catalog::GAP_TITLES).select(:id)
      scope = Employee.kept.active.where(gender: gender)
      scope = gap_titles ? scope.where(job_title_id: gap_ids) : scope.where.not(job_title_id: gap_ids)
      values = scope.joins("JOIN pay_bands pb ON pb.job_title_id = employees.job_title_id AND pb.country_id = employees.country_id")
                    .pluck(Arel.sql("employees.current_salary_cents * 2.0 / (pb.min_cents + pb.max_cents)"))
      values.sum / values.size
    end
  end
end

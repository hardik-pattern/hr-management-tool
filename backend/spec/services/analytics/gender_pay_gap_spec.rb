require "rails_helper"

RSpec.describe Analytics::GenderPayGap do
  let(:usd) { create(:currency, :usd) }
  let(:jpy) { create(:currency, :jpy) }
  let(:us) { create(:country, name: "United States", currency: usd) }
  let(:jp) { create(:country, name: "Japan", currency: jpy) }
  let(:department) { create(:department, name: "Engineering") }
  let(:senior) { create(:job_title, name: "Senior", department: department, level: 4) }
  let(:junior) { create(:job_title, name: "Junior", department: department, level: 1) }

  def staff(gender, salaries, title: senior, country: us, **attributes)
    salaries.each do |cents|
      create(:employee, gender: gender, country: country, department: title.department, job_title: title,
                        current_salary_cents: cents, **attributes)
    end
  end

  def gap(params = {}) = described_class.call(params)
  def percent(value) = (value * 100).to_f.round(4)

  describe "comparing like with like" do
    it "is the gap between women's and men's average pay in the same job title and country" do
      staff("female", [ 8_000, 9_000, 10_000 ])  # mean 9,000
      staff("male", [ 9_000, 10_000, 11_000 ])   # mean 10,000

      result = gap

      expect(percent(result.adjusted_gap)).to eq(-10.0)
      expect(result.rows.size).to eq(1)
      expect(result.rows.first).to have_attributes(women: 3, men: 3, women_compared: 3)
      expect(percent(result.rows.first.gap)).to eq(-10.0)
    end

    it "combines separate comparisons, weighted by the number of women in each" do
      staff("female", [ 8_000, 9_000, 10_000 ], country: us)   # mean 9,000
      staff("male", [ 9_000, 10_000, 11_000 ], country: us)    # mean 10,000: gap -10%, 3 women
      staff("female", [ 100_000 ] * 6, country: jp)            # mean 100,000
      staff("male", [ 100_000 ] * 3, country: jp)              # mean 100,000: gap 0%, 6 women

      # (3 * -10% + 6 * 0%) / 9 women = -3.33%
      expect(percent(gap.adjusted_gap)).to eq(-3.3333)
      expect(gap.cells_compared).to eq(2)
    end

    it "does not mistake women being in lower-paid roles for being paid less" do
      # Every role pays women and men exactly the same...
      staff("female", [ 200 ] * 3, title: senior)
      staff("male", [ 200 ] * 3, title: senior)
      staff("female", [ 100 ] * 9, title: junior)
      staff("male", [ 100 ] * 3, title: junior)

      result = gap

      expect(percent(result.adjusted_gap)).to eq(0.0)
      # ...yet most women are in the junior role, so the raw averages differ.
      expect(percent(result.unadjusted_gap)).to eq(-16.6667) # women 125 against men 150
    end

    it "keeps each country in its own currency, so yen are never compared with dollars" do
      staff("female", [ 5_000_000 ] * 3, country: jp)
      staff("male", [ 5_000_000 ] * 3, country: jp)
      staff("female", [ 8_000 ] * 3, country: us)
      staff("male", [ 10_000 ] * 3, country: us)

      expect(percent(gap.adjusted_gap)).to eq(-10.0) # (3 * 0% + 3 * -20%) / 6 women
    end
  end

  describe "who is compared" do
    it "needs at least three women and three men in a job title and country" do
      staff("female", [ 8_000, 9_000 ])           # only two women
      staff("male", [ 9_000, 10_000, 11_000 ])

      result = gap

      expect(result.adjusted_gap).to be_nil
      expect(result.cells_compared).to eq(0)
      expect(result.cells_total).to eq(1)
    end

    it "shows a job title that could not be compared, with its headcounts and no gap" do
      staff("female", [ 8_000, 9_000 ])
      staff("male", [ 9_000, 10_000, 11_000 ])

      row = gap.rows.first

      expect(row).to have_attributes(women: 2, men: 3, women_compared: 0, gap: nil)
    end

    it "accepts exactly three of each" do
      staff("female", [ 1, 1, 1 ])
      staff("male", [ 1, 1, 1 ])

      expect(gap.cells_compared).to eq(1)
    end

    it "ignores genders other than female and male" do
      staff("female", [ 8_000 ] * 3)
      staff("male", [ 10_000 ] * 3)
      staff("non_binary", [ 1 ] * 5)
      staff("undisclosed", [ 99_999 ] * 5)

      result = gap

      expect(result.women).to eq(3)
      expect(result.men).to eq(3)
      expect(percent(result.adjusted_gap)).to eq(-20.0)
    end

    it "counts active employees by default, and never soft-deleted ones" do
      staff("female", [ 8_000 ] * 3)
      staff("male", [ 10_000 ] * 3)
      staff("female", [ 1 ] * 3, status: "terminated", termination_date: Date.new(2025, 1, 1))
      staff("male", [ 1 ] * 3, deleted_at: Time.current)

      expect(gap.women).to eq(3)
      expect(gap.men).to eq(3)
      expect(gap(status: "all").women).to eq(6)
      expect(gap(status: "all").men).to eq(3)
      expect(gap(status: "terminated").men).to eq(0)
    end

    it "can be narrowed to a country or a department" do
      other = create(:department, name: "Sales")
      sales_title = create(:job_title, name: "Rep", department: other)
      staff("female", [ 8_000 ] * 3)
      staff("male", [ 10_000 ] * 3)
      staff("female", [ 1 ] * 3, title: sales_title, country: jp)
      staff("male", [ 1 ] * 3, title: sales_title, country: jp)

      expect(gap(department_id: department.id.to_s).rows.map { |r| r.job_title[:name] }).to eq([ "Senior" ])
      expect(gap(country_id: jp.id.to_s).rows.map { |r| r.job_title[:name] }).to eq([ "Rep" ])
    end
  end

  describe "the rows" do
    it "describe each job title, ordered from women paid least relative to men" do
      staff("female", [ 90 ] * 3, title: senior)
      staff("male", [ 100 ] * 3, title: senior)         # -10%
      staff("female", [ 70 ] * 3, title: junior)
      staff("male", [ 100 ] * 3, title: junior)         # -30%
      staff("female", [ 1 ], title: create(:job_title, name: "Tiny", department: department)) # not comparable

      rows = gap.rows

      expect(rows.map { |r| r.job_title[:name] }).to eq([ "Junior", "Senior", "Tiny" ])
      expect(rows.first.job_title).to include(name: "Junior", level: 1, department: "Engineering")
      expect(rows.last.gap).to be_nil
    end

    it "report women paid more than men as a positive gap" do
      staff("female", [ 110 ] * 3)
      staff("male", [ 100 ] * 3)

      expect(percent(gap.adjusted_gap)).to eq(10.0)
    end
  end

  describe "nothing to compare" do
    it "reports no gap rather than failing" do
      result = gap

      expect(result).to have_attributes(adjusted_gap: nil, unadjusted_gap: nil, rows: [], women: 0, men: 0)
    end

    it "reports no unadjusted gap when only one gender is present" do
      staff("female", [ 100 ] * 3)

      expect(gap.unadjusted_gap).to be_nil
    end
  end

  describe "parameters" do
    it "refuses what it does not understand" do
      expect { gap(contry_id: 1) }.to raise_error(InvalidRequest, /unknown parameter/)
      expect { gap(status: "retired") }.to raise_error(InvalidRequest, /status must be one of/)
      expect { gap(country_id: "abc") }.to raise_error(InvalidRequest, /country_id must be an integer/)
    end
  end
end

# Shapes an Analytics::GenderPayGap::Result. Gaps are percentages, rounded to
# two decimals; -4.0 means women are paid 4% less than men in like-for-like roles.
class GenderPayGapPresenter
  def initialize(result)
    @result = result
  end

  def as_json(*)
    {
      status: result.status,
      filters: result.filters,
      min_group_size: Analytics::GenderPayGap::MIN_GROUP,
      small_sample_below: Analytics::GenderPayGap::SMALL_SAMPLE,
      adjusted_gap_percent: percent(result.adjusted_gap),
      unadjusted_gap_percent: percent(result.unadjusted_gap),
      women: result.women,
      men: result.men,
      women_compared: result.women_compared,
      comparisons_made: result.cells_compared,
      comparisons_possible: result.cells_total,
      rows: result.rows.map { |row| row_json(row) }
    }
  end

  private

  attr_reader :result

  def row_json(row)
    { job_title: row.job_title, women: row.women, men: row.men,
      women_compared: row.women_compared, gap_percent: percent(row.gap),
      small_sample: !row.gap.nil? && row.women_compared < Analytics::GenderPayGap::SMALL_SAMPLE }
  end

  def percent(gap) = gap && (gap * 100).to_f.round(2)
end

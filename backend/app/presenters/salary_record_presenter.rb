# +currency+ is the employee's currency, passed in so a list of records does
# not look it up once per row.
class SalaryRecordPresenter
  def initialize(record, currency:)
    @record = record
    @currency = currency
  end

  def as_json(*)
    {
      id: record.id,
      amount_cents: record.amount_cents,
      currency: record.currency,
      formatted: Money.new(record.amount_cents, currency).format,
      effective_from: record.effective_from,
      reason: record.reason,
      created_at: record.created_at
    }
  end

  private

  attr_reader :record, :currency
end

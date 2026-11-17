# +current_salary_cents+ / +current_currency+ are a denormalized copy of the
# latest SalaryRecord so list and analytics queries need no join. Only
# Salaries::Change should write them, together with a new record.
#
# Soft deletion uses +deleted_at+ and an explicit +kept+ scope instead of a
# default_scope: a default scope silently leaks into joins and raw SQL, and
# the reads that matter all go through query objects anyway.
class Employee < ApplicationRecord
  belongs_to :country
  belongs_to :department
  belongs_to :job_title
  has_many :salary_records, dependent: :restrict_with_error

  enum :status, { active: "active", terminated: "terminated" }, validate: true
  enum :gender, { female: "female", male: "male", non_binary: "non_binary", undisclosed: "undisclosed" },
       validate: true

  normalizes :email, with: ->(email) { email.strip.downcase }

  scope :kept, -> { where(deleted_at: nil) }
  scope :deleted, -> { where.not(deleted_at: nil) }

  validates :employee_number, :full_name, :hire_date, presence: true
  validates :employee_number, uniqueness: true
  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP },
                    uniqueness: { conditions: -> { kept } }
  validates :current_salary_cents, numericality: { only_integer: true, greater_than: 0 }
  validates :current_currency, presence: true
  validate :termination_matches_status
  validate :currency_matches_country
  validate :job_title_belongs_to_department

  def deleted? = deleted_at.present?

  private

  def termination_matches_status
    if terminated? && termination_date.blank?
      errors.add(:termination_date, "is required when terminated")
    elsif active? && termination_date.present?
      errors.add(:termination_date, "must be blank unless terminated")
    elsif termination_date.present? && hire_date.present? && termination_date < hire_date
      errors.add(:termination_date, "cannot be before the hire date")
    end
  end

  def currency_matches_country
    return if country.nil? || current_currency == country.currency_code

    errors.add(:current_currency, "must be the country's currency (#{country.currency_code})")
  end

  def job_title_belongs_to_department
    return if job_title.nil? || department_id == job_title.department_id

    errors.add(:job_title, "does not belong to the department")
  end
end

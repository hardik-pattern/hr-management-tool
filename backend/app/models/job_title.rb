# A role within a department. +level+ (1 = junior .. 7 = executive) lets
# analytics compare like with like, for example in the gender pay gap.
class JobTitle < ApplicationRecord
  LEVELS = (1..7)

  belongs_to :department
  has_many :pay_bands, dependent: :restrict_with_error

  validates :name, presence: true, uniqueness: { scope: :department_id, case_sensitive: false }
  validates :level, numericality: { only_integer: true, in: LEVELS }
end

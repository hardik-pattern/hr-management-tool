class Country < ApplicationRecord
  belongs_to :currency
  has_many :employees, dependent: :restrict_with_error

  validates :code, presence: true, uniqueness: true, format: { with: /\A[A-Z]{2}\z/ }
  validates :name, presence: true

  delegate :code, to: :currency, prefix: true
end

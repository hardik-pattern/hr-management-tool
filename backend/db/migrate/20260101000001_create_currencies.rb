class CreateCurrencies < ActiveRecord::Migration[8.1]
  def change
    create_table :currencies do |t|
      t.string :code, null: false
      t.string :name, null: false
      t.integer :minor_unit_exponent, null: false, default: 2
      t.decimal :rate_to_usd, precision: 18, scale: 8, null: false

      t.timestamps
    end

    add_index :currencies, :code, unique: true
    add_check_constraint :currencies, "rate_to_usd > 0", name: "currencies_rate_positive"
    add_check_constraint :currencies, "minor_unit_exponent BETWEEN 0 AND 4", name: "currencies_exponent_range"
  end
end

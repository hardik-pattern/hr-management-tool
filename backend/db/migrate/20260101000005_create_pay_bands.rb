class CreatePayBands < ActiveRecord::Migration[8.1]
  def change
    create_table :pay_bands do |t|
      t.references :job_title, null: false, foreign_key: true
      t.references :country, null: false, foreign_key: true
      t.bigint :min_cents, null: false
      t.bigint :max_cents, null: false

      t.timestamps
    end

    add_index :pay_bands, %i[job_title_id country_id], unique: true
    add_check_constraint :pay_bands, "min_cents > 0", name: "pay_bands_min_positive"
    add_check_constraint :pay_bands, "min_cents <= max_cents", name: "pay_bands_min_not_above_max"
  end
end

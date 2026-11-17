class CreateSalaryRecords < ActiveRecord::Migration[8.1]
  def change
    # Append-only history: no updated_at, rows are never edited.
    create_table :salary_records do |t|
      t.references :employee, null: false, foreign_key: true, index: false
      t.bigint :amount_cents, null: false
      t.string :currency, null: false, limit: 3
      t.date :effective_from, null: false
      t.string :reason, null: false
      t.datetime :created_at, null: false
    end

    add_index :salary_records, %i[employee_id effective_from]
    add_check_constraint :salary_records, "amount_cents > 0", name: "salary_records_amount_positive"
    add_check_constraint :salary_records,
                         "reason IN ('hire', 'merit', 'promotion', 'adjustment', 'correction', 'rehire')",
                         name: "salary_records_reason_values"
  end
end

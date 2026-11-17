class CreateEmployees < ActiveRecord::Migration[8.1]
  def change
    create_table :employees do |t|
      t.string :employee_number, null: false
      t.string :full_name, null: false
      t.string :email, null: false
      t.string :gender, null: false
      t.date :hire_date, null: false
      t.string :status, null: false, default: "active"
      t.date :termination_date
      t.datetime :deleted_at
      t.references :country, null: false, foreign_key: true
      t.references :department, null: false, foreign_key: true
      t.references :job_title, null: false, foreign_key: true
      t.bigint :current_salary_cents, null: false
      t.string :current_currency, null: false, limit: 3

      t.timestamps
    end

    add_index :employees, :employee_number, unique: true
    # Partial, so a soft-deleted person's email can be reused (docs/DESIGN_NOTES.md).
    add_index :employees, :email, unique: true, where: "deleted_at IS NULL", name: "index_employees_on_email_kept"
    add_index :employees, :status
    add_index :employees, :current_salary_cents
    add_index :employees, :full_name
    add_index :employees, :deleted_at

    add_check_constraint :employees, "current_salary_cents > 0", name: "employees_salary_positive"
    add_check_constraint :employees, "status IN ('active', 'terminated')", name: "employees_status_values"
    add_check_constraint :employees, "gender IN ('female', 'male', 'non_binary', 'undisclosed')",
                         name: "employees_gender_values"
    add_check_constraint :employees,
                         "(status = 'terminated' AND termination_date IS NOT NULL) OR " \
                         "(status = 'active' AND termination_date IS NULL)",
                         name: "employees_termination_matches_status"
    add_check_constraint :employees, "termination_date IS NULL OR termination_date >= hire_date",
                         name: "employees_termination_after_hire"
  end
end

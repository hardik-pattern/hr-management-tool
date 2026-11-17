class CreateJobTitles < ActiveRecord::Migration[8.1]
  def change
    create_table :job_titles do |t|
      t.string :name, null: false
      t.references :department, null: false, foreign_key: true
      t.integer :level, null: false

      t.timestamps
    end

    add_index :job_titles, %i[name department_id], unique: true
    add_check_constraint :job_titles, "level BETWEEN 1 AND 7", name: "job_titles_level_range"
  end
end

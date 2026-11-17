# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_01_01_000005) do
  create_table "countries", force: :cascade do |t|
    t.string "code", null: false
    t.string "name", null: false
    t.integer "currency_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["code"], name: "index_countries_on_code", unique: true
    t.index ["currency_id"], name: "index_countries_on_currency_id"
  end

  create_table "currencies", force: :cascade do |t|
    t.string "code", null: false
    t.string "name", null: false
    t.integer "minor_unit_exponent", default: 2, null: false
    t.decimal "rate_to_usd", precision: 18, scale: 8, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["code"], name: "index_currencies_on_code", unique: true
    t.check_constraint "minor_unit_exponent BETWEEN 0 AND 4", name: "currencies_exponent_range"
    t.check_constraint "rate_to_usd > 0", name: "currencies_rate_positive"
  end

  create_table "departments", force: :cascade do |t|
    t.string "name", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_departments_on_name", unique: true
  end

  create_table "job_titles", force: :cascade do |t|
    t.string "name", null: false
    t.integer "department_id", null: false
    t.integer "level", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["department_id"], name: "index_job_titles_on_department_id"
    t.index ["name", "department_id"], name: "index_job_titles_on_name_and_department_id", unique: true
    t.check_constraint "level BETWEEN 1 AND 7", name: "job_titles_level_range"
  end

  create_table "pay_bands", force: :cascade do |t|
    t.integer "job_title_id", null: false
    t.integer "country_id", null: false
    t.bigint "min_cents", null: false
    t.bigint "max_cents", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["country_id"], name: "index_pay_bands_on_country_id"
    t.index ["job_title_id", "country_id"], name: "index_pay_bands_on_job_title_id_and_country_id", unique: true
    t.index ["job_title_id"], name: "index_pay_bands_on_job_title_id"
    t.check_constraint "min_cents <= max_cents", name: "pay_bands_min_not_above_max"
    t.check_constraint "min_cents > 0", name: "pay_bands_min_positive"
  end

  add_foreign_key "countries", "currencies"
  add_foreign_key "job_titles", "departments"
  add_foreign_key "pay_bands", "countries"
  add_foreign_key "pay_bands", "job_titles"
end

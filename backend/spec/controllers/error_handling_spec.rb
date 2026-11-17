require "rails_helper"

RSpec.describe ApplicationController, type: :controller do
  controller do
    def not_found = raise(ActiveRecord::RecordNotFound.new("missing", "Employee"))
    def invalid = raise(ActiveRecord::RecordInvalid.new(invalid_record))
    def missing_param = params.require(:employee)

    private

    def invalid_record
      Class.new do
        include ActiveModel::Model
        attr_accessor :email

        validates :email, presence: true

        def self.name = "Employee"
      end.new.tap(&:valid?)
    end
  end

  before do
    routes.draw do
      get "not_found" => "anonymous#not_found"
      get "invalid" => "anonymous#invalid"
      get "missing_param" => "anonymous#missing_param"
    end
  end

  def error_body = response.parsed_body.fetch("error")

  it "renders RecordNotFound as a 404 naming the model" do
    get :not_found

    expect(response).to have_http_status(:not_found)
    expect(error_body).to eq("code" => "not_found", "message" => "Employee not found")
  end

  it "renders RecordInvalid as a 422 with field-level details" do
    get :invalid

    expect(response).to have_http_status(:unprocessable_content)
    expect(error_body).to include("code" => "validation_failed", "message" => "Validation failed")
    expect(error_body["details"]).to eq("email" => [ "can't be blank" ])
  end

  it "renders a missing required param as a 400 without leaking the multi-line Rails hint" do
    get :missing_param

    expect(response).to have_http_status(:bad_request)
    expect(error_body["code"]).to eq("bad_request")
    expect(error_body["message"]).to eq("param is missing or the value is empty or invalid: employee")
    expect(error_body).not_to have_key("details")
  end
end

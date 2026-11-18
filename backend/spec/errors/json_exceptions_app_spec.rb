require "rails_helper"

RSpec.describe JsonExceptionsApp do
  def respond_to(exception)
    status, headers, body = described_class.call("action_dispatch.exception" => exception)
    [ status, headers, JSON.parse(body.join) ]
  end

  # ParseError wraps the exception being handled, so it can only be built inside a rescue.
  def parse_error
    JSON.parse("{bad json")
  rescue JSON::ParserError
    ActionDispatch::Http::Parameters::ParseError.new
  end

  it "answers an unparseable request body with a 400 in the API's error shape" do
    status, headers, body = respond_to(parse_error)

    expect(status).to eq(400)
    expect(headers["content-type"]).to include("application/json")
    expect(body).to eq("error" => { "code" => "bad_request", "message" => "The request could not be understood." })
  end

  it "answers a missing record with a 404" do
    status, _headers, body = respond_to(ActiveRecord::RecordNotFound.new)

    expect(status).to eq(404)
    expect(body.dig("error", "code")).to eq("not_found")
  end

  it "answers anything unexpected with a 500 that does not reveal what went wrong" do
    status, _headers, body = respond_to(RuntimeError.new("password=hunter2 at /app/secret.rb:12"))

    expect(status).to eq(500)
    expect(body).to eq("error" => { "code" => "internal_error", "message" => "Something went wrong on our side." })
  end

  it "reports a Content-Length that matches the body" do
    _status, headers, body = described_class.call("action_dispatch.exception" => RuntimeError.new)

    expect(headers["content-length"].to_i).to eq(body.join.bytesize)
  end
end

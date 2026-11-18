require "rails_helper"
require "rack/mock"

RSpec.describe RequestSizeLimit do
  let(:app) { ->(_env) { [ 200, { "content-type" => "text/plain" }, [ "ok" ] ] } }
  let(:middleware) { described_class.new(app) }

  def call(body, declare_length: true)
    env = Rack::MockRequest.env_for("/api/v1/employees", method: "POST", input: body)
    env.delete("CONTENT_LENGTH") unless declare_length
    middleware.call(env)
  end

  def body_of(response) = JSON.parse(response[2].join)

  it "lets a request under the limit through" do
    with_env("MAX_REQUEST_BYTES" => "100") do
      expect(call("a" * 100).first).to eq(200)
    end
  end

  it "refuses a request over the limit with a 413 in the API's error shape" do
    with_env("MAX_REQUEST_BYTES" => "100") do
      response = call("a" * 101)

      expect(response.first).to eq(413)
      expect(response[1]["content-type"]).to include("application/json")
      expect(body_of(response)).to eq(
        "error" => { "code" => "payload_too_large", "message" => "The request body is larger than 100 bytes." },
      )
    end
  end

  it "checks the size itself when the client declares none, as chunked uploads do" do
    with_env("MAX_REQUEST_BYTES" => "100") do
      expect(call("a" * 101, declare_length: false).first).to eq(413)
      expect(call("a" * 100, declare_length: false).first).to eq(200)
    end
  end

  it "leaves the body readable for the app after checking it" do
    seen = nil
    reading = described_class.new(->(env) { seen = env["rack.input"].read; [ 200, {}, [ "" ] ] })
    env = Rack::MockRequest.env_for("/x", method: "POST", input: "hello")
    env.delete("CONTENT_LENGTH")

    reading.call(env)

    expect(seen).to eq("hello")
  end

  it "does not touch requests without a body" do
    response = middleware.call(Rack::MockRequest.env_for("/api/v1/employees", method: "GET"))

    expect(response.first).to eq(200)
  end

  it "defaults to 64 KB" do
    expect(call("a" * 65_536).first).to eq(200)
    expect(call("a" * 65_537).first).to eq(413)
  end
end

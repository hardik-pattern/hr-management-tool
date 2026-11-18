require "rails_helper"

RSpec.describe "API hardening", type: :request do
  let(:json_headers) { { "CONTENT_TYPE" => "application/json" } }

  # In test Rails shows its detailed debug pages for exceptions. Deployed apps do
  # not, and then JsonExceptionsApp answers, so test it that way.
  around do |example|
    config = Rails.application.env_config
    original = config["action_dispatch.show_detailed_exceptions"]
    config["action_dispatch.show_detailed_exceptions"] = false
    example.run
  ensure
    config["action_dispatch.show_detailed_exceptions"] = original
  end

  describe "request bodies" do
    it "answers malformed JSON in the API's error shape, not an empty HTML page" do
      post "/api/v1/employees", params: "{bad json", headers: json_headers

      expect(response).to have_http_status(:bad_request)
      expect(response.media_type).to eq("application/json")
      expect(response.parsed_body.dig("error", "code")).to eq("bad_request")
    end

    it "refuses an oversized body before parsing it" do
      post "/api/v1/employees", params: { employee: { full_name: "a" * 70_000 } }.to_json, headers: json_headers

      expect(response).to have_http_status(:payload_too_large)
      expect(response.parsed_body.dig("error", "code")).to eq("payload_too_large")
    end

    it "accepts an ordinary request" do
      post "/api/v1/employees", params: { employee: { full_name: "x" } }.to_json, headers: json_headers

      expect(response).to have_http_status(:unprocessable_content) # reaches validation, so the size check let it by
    end
  end

  describe "cross-origin access" do
    let(:preflight) do
      {
        "Origin" => "http://ui.test",
        "Access-Control-Request-Method" => "POST",
        "Access-Control-Request-Headers" => "content-type"
      }
    end

    it "is off by default: no origin is allowed" do
      with_env("CORS_ORIGINS" => nil) do
        get "/api/v1/reference/departments", headers: { "Origin" => "http://ui.test" }

        expect(response.headers).not_to have_key("Access-Control-Allow-Origin")
      end
    end

    it "allows an origin that is listed" do
      with_env("CORS_ORIGINS" => "http://ui.test, http://other.test") do
        get "/api/v1/reference/departments", headers: { "Origin" => "http://ui.test" }

        expect(response.headers["Access-Control-Allow-Origin"]).to eq("http://ui.test")
      end
    end

    it "does not allow an origin that is not listed" do
      with_env("CORS_ORIGINS" => "http://ui.test") do
        get "/api/v1/reference/departments", headers: { "Origin" => "http://evil.test" }

        expect(response.headers).not_to have_key("Access-Control-Allow-Origin")
      end
    end

    it "answers a browser's preflight check for a listed origin" do
      with_env("CORS_ORIGINS" => "http://ui.test") do
        options "/api/v1/employees", headers: preflight

        expect(response).to have_http_status(:ok)
        expect(response.headers["Access-Control-Allow-Origin"]).to eq("http://ui.test")
        expect(response.headers["Access-Control-Allow-Methods"]).to include("POST", "PATCH", "DELETE")
      end
    end

    it "gives no permission in a preflight from an origin that is not listed" do
      with_env("CORS_ORIGINS" => "http://ui.test") do
        options "/api/v1/employees", headers: preflight.merge("Origin" => "http://evil.test")

        expect(response.headers).not_to have_key("Access-Control-Allow-Origin")
      end
    end

    it "does not extend to paths outside the API" do
      with_env("CORS_ORIGINS" => "http://ui.test") do
        get "/up", headers: { "Origin" => "http://ui.test" }

        expect(response.headers).not_to have_key("Access-Control-Allow-Origin")
      end
    end

    it "carries CORS headers even on a refused oversized request, so the UI can read the error" do
      with_env("CORS_ORIGINS" => "http://ui.test") do
        post "/api/v1/employees", params: "a" * 70_000, headers: json_headers.merge("Origin" => "http://ui.test")

        expect(response).to have_http_status(:payload_too_large)
        expect(response.headers["Access-Control-Allow-Origin"]).to eq("http://ui.test")
      end
    end
  end
end

require "rails_helper"

RSpec.describe "Unknown routes", type: :request do
  it "answers with the JSON error envelope instead of an HTML page" do
    post "/api/v1/nope"

    expect(response).to have_http_status(:not_found)
    expect(response.parsed_body["error"]).to eq(
      "code" => "not_found",
      "message" => "No route matches POST /api/v1/nope"
    )
  end

  it "does not shadow the health check" do
    get "/up"

    expect(response).to have_http_status(:ok)
  end
end

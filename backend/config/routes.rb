Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  # Keep last: anything not matched above gets the JSON 404 envelope.
  match "*unmatched", to: "application#route_not_found", via: :all
end

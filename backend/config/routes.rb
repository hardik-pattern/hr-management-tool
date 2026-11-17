Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      scope :reference, controller: :reference, as: :reference do
        get :countries
        get :currencies
        get :departments
        get :job_titles
      end
    end
  end

  # Keep last: anything not matched above gets the JSON 404 envelope.
  match "*unmatched", to: "application#route_not_found", via: :all
end

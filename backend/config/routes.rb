Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      scope :analytics, controller: :analytics, as: :analytics do
        get :summary
      end

      scope :insights, controller: :insights, as: :insights do
        get :gender_pay_gap
      end

      resources :employees, only: %i[index create show update destroy] do
        member do
          post :terminate
          post :rehire
          post :restore
        end

        resources :salary_changes, only: :create
        resources :salary_records, only: :index
      end

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

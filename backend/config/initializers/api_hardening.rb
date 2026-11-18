require Rails.root.join("lib/middleware/request_size_limit")

# Cross-origin access is off unless CORS_ORIGINS lists origins (comma
# separated), for example when the UI is served from a different host than
# the API. The origins are read per request so the list can be changed
# without rebuilding anything. No cookies or credentials are involved.
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins ->(source, _env) { ENV.fetch("CORS_ORIGINS", "").split(",").map(&:strip).include?(source) }
    resource "/api/*",
             headers: :any,
             methods: %i[get post patch delete options],
             max_age: 600
  end
end

# Just inside CORS, so even a refused oversized request carries CORS headers.
Rails.application.config.middleware.insert_after Rack::Cors, RequestSizeLimit

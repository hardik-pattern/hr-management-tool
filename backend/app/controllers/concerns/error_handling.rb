# Turns exceptions into one JSON error shape so the UI has a single
# thing to parse:
#
#   { "error": { "code": "...", "message": "...", "details": {...} } }
#
# +details+ is only present when there is something field-level to report.
module ErrorHandling
  extend ActiveSupport::Concern

  included do
    rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
    rescue_from ActiveRecord::RecordInvalid, with: :render_validation_failed
    rescue_from ActionController::ParameterMissing, with: :render_bad_request
    rescue_from ActionController::UnpermittedParameters, with: :render_bad_request
  end

  # Catch-all for unmatched paths (see config/routes.rb); without it Rails
  # answers unknown API paths with an HTML page.
  def route_not_found
    render_error(:not_found, "not_found", "No route matches #{request.method} #{request.path}")
  end

  private

  def render_not_found(exception)
    render_error(:not_found, "not_found", "#{exception.model || 'Record'} not found")
  end

  def render_validation_failed(exception)
    render_error(:unprocessable_content, "validation_failed", "Validation failed",
                 details: exception.record.errors.to_hash)
  end

  def render_bad_request(exception)
    render_error(:bad_request, "bad_request", exception.message.lines.first.strip)
  end

  def render_error(status, code, message, details: nil)
    body = { code: code, message: message }
    body[:details] = details if details.present?
    render json: { error: body }, status: status
  end
end

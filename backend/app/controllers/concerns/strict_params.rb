# Whitelists request params but, unlike plain +permit+, refuses unknown keys
# with a 400 instead of silently dropping them. A client that tries to set a
# field it may not (for example a salary currency) learns about it.
module StrictParams
  extend ActiveSupport::Concern

  private

  # For endpoints that take a few top-level values (such as terminate) rather
  # than a nested object: refuses any body or query key not in +allowed+.
  def reject_unknown_params(*allowed)
    given = request.request_parameters.keys + request.query_parameters.keys
    unpermitted = given.map(&:to_sym) - allowed
    raise ActionController::UnpermittedParameters, unpermitted if unpermitted.any?
  end

  def strict_params(key, fields)
    attributes = params.require(key)
    unpermitted = attributes.keys.map(&:to_sym) - fields
    raise ActionController::UnpermittedParameters, unpermitted if unpermitted.any?

    attributes.permit(*fields).to_h
  end
end

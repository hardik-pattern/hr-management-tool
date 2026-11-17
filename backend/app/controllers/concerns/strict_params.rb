# Whitelists request params but, unlike plain +permit+, refuses unknown keys
# with a 400 instead of silently dropping them. A client that tries to set a
# field it may not (for example a salary currency) learns about it.
module StrictParams
  extend ActiveSupport::Concern

  private

  def strict_params(key, fields)
    attributes = params.require(key)
    unpermitted = attributes.keys.map(&:to_sym) - fields
    raise ActionController::UnpermittedParameters, unpermitted if unpermitted.any?

    attributes.permit(*fields).to_h
  end
end

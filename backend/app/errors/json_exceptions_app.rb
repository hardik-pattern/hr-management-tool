# Rails' last-resort responder for exceptions that no controller handled:
# unparseable request bodies, unexpected failures. It answers in the same
# JSON error shape as everything else, and never includes the exception's
# own message for a server error, which could leak internals.
class JsonExceptionsApp
  BAD_REQUEST = [ "bad_request", "The request could not be understood." ].freeze
  INTERNAL = [ "internal_error", "Something went wrong on our side." ].freeze

  KNOWN = {
    400 => BAD_REQUEST,
    404 => [ "not_found", "Not found." ],
    413 => [ "payload_too_large", "The request body is too large." ],
    422 => [ "unprocessable", "The request could not be processed." ]
  }.freeze

  def self.call(env)
    exception = env["action_dispatch.exception"]
    status = ActionDispatch::ExceptionWrapper.status_code_for_exception(exception.class.name)
    code, message = KNOWN.fetch(status, INTERNAL)
    status = 500 unless KNOWN.key?(status)

    body = { error: { code: code, message: message } }.to_json
    [ status, { "content-type" => "application/json; charset=utf-8", "content-length" => body.bytesize.to_s }, [ body ] ]
  end
end

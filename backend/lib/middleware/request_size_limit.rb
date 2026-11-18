# Refuses request bodies over a size limit with a 413 in the API's error
# shape, before Rails reads and parses them. Every legitimate request here is
# a small JSON document, so a generous cap still stops a huge body from
# being buffered and parsed.
#
# The limit comes from MAX_REQUEST_BYTES (default 64 KB). It lives in lib/
# and is required by an initializer, not autoloaded, because it sits in the
# middleware stack for the life of the process and must not be reloaded.
class RequestSizeLimit
  DEFAULT_LIMIT = 64 * 1024

  def initialize(app)
    @app = app
  end

  def call(env)
    return too_large(limit) if oversized?(env)

    @app.call(env)
  end

  private

  def limit
    Integer(ENV.fetch("MAX_REQUEST_BYTES", DEFAULT_LIMIT))
  end

  def oversized?(env)
    declared = env["CONTENT_LENGTH"]
    return declared.to_i > limit if declared

    # Chunked uploads declare no length, so read at most one byte past the limit.
    input = env["rack.input"]
    return false unless input

    over = input.read(limit + 1).to_s.bytesize > limit
    input.rewind
    over
  end

  def too_large(max)
    body = {
      error: { code: "payload_too_large", message: "The request body is larger than #{max} bytes." }
    }.to_json
    [ 413, { "content-type" => "application/json; charset=utf-8", "content-length" => body.bytesize.to_s }, [ body ] ]
  end
end

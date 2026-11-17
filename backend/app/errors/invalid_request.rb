# Raised when a request is well-formed but asks for something the API does
# not accept (an unknown filter, a bad cursor). Rendered as a 400.
class InvalidRequest < StandardError; end

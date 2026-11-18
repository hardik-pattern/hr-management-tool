module EnvHelpers
  # Sets environment variables for the block, then puts them back.
  def with_env(vars)
    originals = vars.keys.to_h { |key| [ key, ENV[key] ] }
    vars.each { |key, value| ENV[key] = value }
    yield
  ensure
    originals.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
  end
end

RSpec.configure { |config| config.include EnvHelpers }

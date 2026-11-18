require "rails_helper"

# Production and CI load every file up front (eager loading), which fails if a
# file does not define the constant its path promises. Day-to-day test runs load
# lazily and would not notice, so this loads everything on purpose.
RSpec.describe "Eager loading the application" do
  it "finds the constant every autoloaded file promises" do
    expect { Rails.autoloaders.main.eager_load(force: true) }.not_to raise_error
  end
end

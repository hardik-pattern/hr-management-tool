# Seeds the demo organisation. Idempotent: reference data is upserted, and
# employees are only generated when none exist yet.
#
#   bin/rails db:seed                      # 10,000 employees
#   SEED_EMPLOYEES=500 bin/rails db:seed   # smaller set for quick checks
started = Process.clock_gettime(Process::CLOCK_MONOTONIC)

Seeds::ReferenceData.call

if Employee.exists?
  puts "Employees already present (#{Employee.count}); skipping generation."
else
  count = Integer(ENV.fetch("SEED_EMPLOYEES", 10_000))
  Seeds::EmployeeGenerator.call(count: count)
  puts "Created #{count} employees and #{SalaryRecord.count} salary records."
end

puts format("Seeding took %.1fs", Process.clock_gettime(Process::CLOCK_MONOTONIC) - started)

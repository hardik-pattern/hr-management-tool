import type { Gender, SalaryReason } from '../api/types'

export const GENDER_LABELS: Record<Gender, string> = {
  female: 'Female',
  male: 'Male',
  non_binary: 'Non-binary',
  undisclosed: 'Not disclosed',
}

export const REASON_LABELS: Record<SalaryReason, string> = {
  hire: 'Hire',
  merit: 'Merit increase',
  promotion: 'Promotion',
  adjustment: 'Adjustment',
  correction: 'Correction',
  rehire: 'Rehire',
}

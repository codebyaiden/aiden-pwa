export type MovementType = 'deposit' | 'withdrawal';

export interface Movement {
  id: string;
  type: MovementType;
  amountCOP: number;
  localDate: string;
  createdAt: string;
  updatedAt: string;
  note?: string;
}

// v1 is kept only to validate and migrate existing devices and backup files.
export interface SettingsV1 {
  monthlyPlanCOP: number | null;
  targetEndMonth: '2029-07';
  schemaVersion: 1;
}

export interface Settings {
  monthlyPlanCOP: number | null;
  finalGoalCOP: number | null;
  targetEndMonth: '2029-07';
  schemaVersion: 2;
}

export interface Snapshot {
  movements: Movement[];
  settings: Settings;
}

export interface BackupV1 {
  format: 'aiden.savings.backup';
  version: 1;
  exportedAt: string;
  settings: SettingsV1;
  movements: Movement[];
}

export interface BackupV2 extends Snapshot {
  format: 'aiden.savings.backup';
  version: 2;
  exportedAt: string;
}

export const DEFAULT_SETTINGS: Settings = {
  monthlyPlanCOP: null,
  finalGoalCOP: null,
  targetEndMonth: '2029-07',
  schemaVersion: 2
};

export const MAX_AMOUNT_COP = 999_999_999;
export const MAX_GOAL_COP = 99_999_999_999;

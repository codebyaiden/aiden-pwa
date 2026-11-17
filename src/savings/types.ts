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

export interface Settings {
  monthlyPlanCOP: number | null;
  targetEndMonth: '2029-07';
  schemaVersion: 1;
}

export interface Snapshot {
  movements: Movement[];
  settings: Settings;
}

export interface BackupV1 extends Snapshot {
  format: 'aiden.savings.backup';
  version: 1;
  exportedAt: string;
}

export const DEFAULT_SETTINGS: Settings = {
  monthlyPlanCOP: null,
  targetEndMonth: '2029-07',
  schemaVersion: 1
};

export const MAX_AMOUNT_COP = 999_999_999;

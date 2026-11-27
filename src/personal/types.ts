import type { Snapshot } from '../savings/types';

export type EventCategory = 'personal' | 'expense' | 'income';
export type Recurrence = 'none' | 'weekly' | 'monthly' | 'yearly';
export interface CalendarEvent {
  id: string; title: string; category: EventCategory;
  startDate: string; endDate: string;
  startTime?: string; endTime?: string; amountCOP?: number; notes?: string;
  important: boolean; recurrence: Recurrence; recurrenceUntil?: string;
  createdAt: string; updatedAt: string;
}
export interface EventOccurrenceState {
  occurrenceKey: string; eventId: string; occurrenceStartDate: string;
  status: 'paid' | 'received' | 'skipped'; changedAt: string;
}
export interface Task {
  id: string; title: string; dueDate?: string; note?: string;
  completedAt?: string; createdAt: string; updatedAt: string;
}
export interface Countdown {
  id: string; title: string; targetDate?: string; targetTime?: string;
  sourceEventId?: string; pinned: boolean; createdAt: string; updatedAt: string;
}
export type FinanceKind = 'expense' | 'income';
export interface FinanceEntry {
  id: string; kind: FinanceKind; title: string; amountCOP: number;
  localDate: string; category: 'general' | 'servicios' | 'alimentacion' | 'transporte' | 'personal' | 'otros';
  note?: string; occurrenceKey?: string;
  createdAt: string; updatedAt: string;
}
export interface PersonalSnapshot extends Snapshot {
  events: CalendarEvent[];
  eventOccurrenceStates: EventOccurrenceState[];
  tasks: Task[];
  countdowns: Countdown[];
  financeEntries: FinanceEntry[];
}
export interface BackupV3 extends Omit<PersonalSnapshot, 'financeEntries'> {
  format: 'aiden.personal.backup'; version: 3; exportedAt: string;
}
export interface BackupV4 extends PersonalSnapshot {
  format: 'aiden.personal.backup'; version: 4; exportedAt: string;
}
export type Occurrence = { event: CalendarEvent; startDate: string; endDate: string; key: string };

export interface BackupV5 extends Omit<BackupV4,'version'> {
  version:5;routine:import('../routine/engine').State;
}

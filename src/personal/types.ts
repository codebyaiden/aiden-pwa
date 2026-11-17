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
export interface PersonalSnapshot extends Snapshot {
  events: CalendarEvent[];
  eventOccurrenceStates: EventOccurrenceState[];
  tasks: Task[];
  countdowns: Countdown[];
}
export interface BackupV3 extends PersonalSnapshot {
  format: 'aiden.personal.backup'; version: 3; exportedAt: string;
}
export type Occurrence = { event: CalendarEvent; startDate: string; endDate: string; key: string };

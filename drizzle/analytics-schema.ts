import { pgTable, serial, varchar, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';

// Analytics Events Table
export const analyticsEvents = pgTable('analytics_events', {
  id: serial('id').primaryKey(),
  eventName: varchar('event_name', { length: 100 }).notNull(),
  userId: varchar('user_id', { length: 100 }),
  sessionId: varchar('session_id', { length: 100 }).notNull(),
  properties: jsonb('properties'),
  pageUrl: text('page_url'),
  pageTitle: varchar('page_title', { length: 255 }),
  referrer: text('referrer'),
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  eventNameIdx: index('idx_event_name').on(table.eventName),
  userIdIdx: index('idx_user_id').on(table.userId),
  sessionIdIdx: index('idx_session_id').on(table.sessionId),
  createdAtIdx: index('idx_created_at').on(table.createdAt),
}));

// Analytics Sessions Table
export const analyticsSessions = pgTable('analytics_sessions', {
  id: serial('id').primaryKey(),
  sessionId: varchar('session_id', { length: 100 }).unique().notNull(),
  userId: varchar('user_id', { length: 100 }),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
  pageViews: integer('page_views').default(0).notNull(),
  eventsCount: integer('events_count').default(0).notNull(),
  deviceType: varchar('device_type', { length: 50 }),
  browser: varchar('browser', { length: 50 }),
  os: varchar('os', { length: 50 }),
  country: varchar('country', { length: 100 }),
}, (table) => ({
  sessionIdIdx: index('idx_analytics_session_id').on(table.sessionId),
  userIdIdx: index('idx_analytics_user_id').on(table.userId),
  startedAtIdx: index('idx_started_at').on(table.startedAt),
}));

// Types
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;
export type AnalyticsSession = typeof analyticsSessions.$inferSelect;
export type NewAnalyticsSession = typeof analyticsSessions.$inferInsert;

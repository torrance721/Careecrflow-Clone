import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { db } from "../db";
import { analyticsEvents, analyticsSessions } from "../../drizzle/schema";
import { eq, sql, desc, and, gte, lte } from "drizzle-orm";

// Event tracking schema
const trackEventSchema = z.object({
  sessionId: z.string(),
  userId: z.string().optional(),
  events: z.array(z.object({
    event_name: z.string(),
    properties: z.record(z.any()).optional(),
  })),
  pageUrl: z.string().optional(),
  pageTitle: z.string().optional(),
  referrer: z.string().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
});

export const analyticsRouter = router({
  // Track events (public - no auth required)
  track: publicProcedure
    .input(trackEventSchema)
    .mutation(async ({ input, ctx }) => {
      const { sessionId, userId, events, pageUrl, pageTitle, referrer, userAgent, ipAddress } = input;

      // Insert events
      const insertedEvents = await db.insert(analyticsEvents).values(
        events.map(event => ({
          eventName: event.event_name,
          userId: userId || null,
          sessionId,
          properties: event.properties || null,
          pageUrl: pageUrl || null,
          pageTitle: pageTitle || null,
          referrer: referrer || null,
          userAgent: userAgent || null,
          ipAddress: ipAddress || null,
        }))
      ).returning();

      // Update or create session
      const existingSession = await db.query.analyticsSessions.findFirst({
        where: eq(analyticsSessions.sessionId, sessionId),
      });

      if (existingSession) {
        // Update existing session
        await db.update(analyticsSessions)
          .set({
            lastActivityAt: new Date(),
            eventsCount: sql`${analyticsSessions.eventsCount} + ${events.length}`,
            userId: userId || existingSession.userId,
          })
          .where(eq(analyticsSessions.sessionId, sessionId));
      } else {
        // Create new session
        await db.insert(analyticsSessions).values({
          sessionId,
          userId: userId || null,
          eventsCount: events.length,
          pageViews: 0,
          deviceType: null,
          browser: null,
          os: null,
          country: null,
        });
      }

      return { success: true, eventsTracked: insertedEvents.length };
    }),

  // Get analytics stats (protected - admin only)
  getStats: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      eventName: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { startDate, endDate, eventName } = input;

      // Build where conditions
      const conditions = [];
      if (startDate) {
        conditions.push(gte(analyticsEvents.createdAt, new Date(startDate)));
      }
      if (endDate) {
        conditions.push(lte(analyticsEvents.createdAt, new Date(endDate)));
      }
      if (eventName) {
        conditions.push(eq(analyticsEvents.eventName, eventName));
      }

      // Get total events count
      const totalEventsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(analyticsEvents)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const totalEvents = Number(totalEventsResult[0]?.count || 0);

      // Get events by name
      const eventsByNameResult = await db
        .select({
          eventName: analyticsEvents.eventName,
          count: sql<number>`count(*)`,
        })
        .from(analyticsEvents)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(analyticsEvents.eventName)
        .orderBy(desc(sql`count(*)`));

      const eventsByName = eventsByNameResult.map(row => ({
        eventName: row.eventName,
        count: Number(row.count),
      }));

      // Get unique users count
      const uniqueUsersResult = await db
        .select({ count: sql<number>`count(distinct ${analyticsEvents.userId})` })
        .from(analyticsEvents)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const uniqueUsers = Number(uniqueUsersResult[0]?.count || 0);

      // Get unique sessions count
      const uniqueSessionsResult = await db
        .select({ count: sql<number>`count(distinct ${analyticsEvents.sessionId})` })
        .from(analyticsEvents)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const uniqueSessions = Number(uniqueSessionsResult[0]?.count || 0);

      return {
        totalEvents,
        uniqueUsers,
        uniqueSessions,
        eventsByName,
      };
    }),

  // Get recent events (protected - admin only)
  getRecentEvents: protectedProcedure
    .input(z.object({
      limit: z.number().default(100),
      eventName: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { limit, eventName } = input;

      const events = await db.query.analyticsEvents.findMany({
        where: eventName ? eq(analyticsEvents.eventName, eventName) : undefined,
        orderBy: [desc(analyticsEvents.createdAt)],
        limit,
      });

      return events;
    }),

  // Get event details by name (protected - admin only)
  getEventDetails: protectedProcedure
    .input(z.object({
      eventName: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { eventName, startDate, endDate } = input;

      const conditions = [eq(analyticsEvents.eventName, eventName)];
      if (startDate) {
        conditions.push(gte(analyticsEvents.createdAt, new Date(startDate)));
      }
      if (endDate) {
        conditions.push(lte(analyticsEvents.createdAt, new Date(endDate)));
      }

      const events = await db.query.analyticsEvents.findMany({
        where: and(...conditions),
        orderBy: [desc(analyticsEvents.createdAt)],
        limit: 1000,
      });

      // Extract unique property keys
      const propertyKeys = new Set<string>();
      events.forEach(event => {
        if (event.properties && typeof event.properties === 'object') {
          Object.keys(event.properties).forEach(key => propertyKeys.add(key));
        }
      });

      // Aggregate property values
      const propertyStats: Record<string, Record<string, number>> = {};
      Array.from(propertyKeys).forEach(key => {
        propertyStats[key] = {};
      });

      events.forEach(event => {
        if (event.properties && typeof event.properties === 'object') {
          Object.entries(event.properties).forEach(([key, value]) => {
            const valueStr = String(value);
            if (!propertyStats[key][valueStr]) {
              propertyStats[key][valueStr] = 0;
            }
            propertyStats[key][valueStr]++;
          });
        }
      });

      return {
        eventName,
        totalCount: events.length,
        propertyStats,
        recentEvents: events.slice(0, 10),
      };
    }),
});

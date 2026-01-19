/**
 * Analytics SDK for tracking user behavior
 */

// Get API URL for analytics requests
const getAnalyticsApiUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || '';
  return `${apiUrl}/api/trpc/analytics.track`;
};

export interface AnalyticsEvent {
  event_name: string;
  properties?: Record<string, any>;
}

export interface AnalyticsConfig {
  enabled?: boolean;
  debug?: boolean;
  flushInterval?: number;
  maxQueueSize?: number;
}

class AnalyticsSDK {
  private sessionId: string;
  private userId?: string;
  private queue: AnalyticsEvent[] = [];
  private config: Required<AnalyticsConfig>;
  private flushTimer?: NodeJS.Timeout;
  private initialized = false;

  constructor(config: AnalyticsConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      debug: config.debug ?? false,
      flushInterval: config.flushInterval ?? 5000, // 5 seconds
      maxQueueSize: config.maxQueueSize ?? 50,
    };

    this.sessionId = this.getOrCreateSessionId();
    
    if (this.config.enabled) {
      this.initialize();
    }
  }

  private initialize() {
    if (this.initialized) return;
    
    // Start flush timer
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);

    // Flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flush(true);
      });
    }

    this.initialized = true;
    this.log('Analytics SDK initialized', { sessionId: this.sessionId });
  }

  private getOrCreateSessionId(): string {
    if (typeof window === 'undefined') return 'server-session';
    
    const key = 'analytics_session_id';
    let sessionId = sessionStorage.getItem(key);
    
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem(key, sessionId);
    }
    
    return sessionId;
  }

  /**
   * Identify the current user
   */
  identify(userId: string) {
    this.userId = userId;
    this.log('User identified', { userId });
  }

  /**
   * Track an event
   */
  track(eventName: string, properties?: Record<string, any>) {
    if (!this.config.enabled) return;

    const event: AnalyticsEvent = {
      event_name: eventName,
      properties: {
        ...properties,
        timestamp: new Date().toISOString(),
      },
    };

    this.queue.push(event);
    this.log('Event tracked', event);

    // Flush if queue is full
    if (this.queue.length >= this.config.maxQueueSize) {
      this.flush();
    }
  }

  /**
   * Track page view
   */
  trackPageView(pagePath?: string) {
    if (typeof window === 'undefined') return;
    
    this.track('page_view', {
      page_path: pagePath || window.location.pathname,
      page_url: window.location.href,
      page_title: document.title,
      referrer: document.referrer,
    });
  }

  /**
   * Flush events to server
   */
  private async flush(sync = false) {
    if (this.queue.length === 0) return;

    const events = [...this.queue];
    this.queue = [];

    const payload = {
      sessionId: this.sessionId,
      userId: this.userId,
      events,
      pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      pageTitle: typeof document !== 'undefined' ? document.title : undefined,
      referrer: typeof document !== 'undefined' ? document.referrer : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };

    try {
      const analyticsUrl = getAnalyticsApiUrl();
      if (sync && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
        // Use sendBeacon for synchronous flush (on page unload)
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(analyticsUrl, blob);
        this.log('Events flushed (sendBeacon)', { count: events.length });
      } else {
        // Use fetch for async flush
        const response = await fetch(analyticsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        this.log('Events flushed', { count: events.length });
      }
    } catch (error) {
      // Put events back in queue on error
      this.queue.unshift(...events);
      console.error('[Analytics] Failed to flush events:', error);
    }
  }

  /**
   * Manually flush all pending events
   */
  async flushNow() {
    await this.flush();
  }

  /**
   * Destroy the SDK and clean up
   */
  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush(true);
    this.initialized = false;
  }

  private log(message: string, data?: any) {
    if (this.config.debug) {
      console.log(`[Analytics] ${message}`, data);
    }
  }
}

// Singleton instance
let analyticsInstance: AnalyticsSDK | null = null;

export function getAnalytics(config?: AnalyticsConfig): AnalyticsSDK {
  if (!analyticsInstance) {
    analyticsInstance = new AnalyticsSDK(config);
  }
  return analyticsInstance;
}

export default AnalyticsSDK;

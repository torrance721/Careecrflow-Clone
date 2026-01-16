import { useEffect, useRef, useCallback } from 'react';
import { getAnalytics } from '@/lib/analytics';
import { useAuth } from '@/_core/hooks/useAuth';

/**
 * React hook for analytics tracking
 */
export function useAnalytics() {
  const analytics = useRef(getAnalytics({ debug: import.meta.env.DEV }));
  const { user } = useAuth();

  // Identify user when logged in
  useEffect(() => {
    if (user?.id) {
      analytics.current.identify(String(user.id));
    }
  }, [user]);

  const track = useCallback((eventName: string, properties?: Record<string, any>) => {
    analytics.current.track(eventName, properties);
  }, []);

  const trackPageView = useCallback((pagePath?: string) => {
    analytics.current.trackPageView(pagePath);
  }, []);

  return {
    track,
    trackPageView,
  };
}

/**
 * Predefined event tracking functions
 */

export function useTabTracking() {
  const { track } = useAnalytics();

  const trackTabClick = useCallback((tabName: string, tabId: string, tabIndex: number, previousTab?: string, pageSection?: string) => {
    track('tab_click', {
      tab_name: tabName,
      tab_id: tabId,
      tab_index: tabIndex,
      previous_tab: previousTab,
      page_section: pageSection,
    });
  }, [track]);

  return { trackTabClick };
}

export function useInterviewTracking() {
  const { track } = useAnalytics();

  const trackInterviewStart = useCallback((interviewType: string, jobTitle?: string, company?: string, difficulty?: string) => {
    track('interview_start', {
      interview_type: interviewType,
      job_title: jobTitle,
      company: company,
      difficulty: difficulty,
    });
  }, [track]);

  const trackInterviewComplete = useCallback((interviewType: string, duration: number, questionsCount: number) => {
    track('interview_complete', {
      interview_type: interviewType,
      duration_seconds: duration,
      questions_count: questionsCount,
    });
  }, [track]);

  return { trackInterviewStart, trackInterviewComplete };
}

export function useJobSearchTracking() {
  const { track } = useAnalytics();

  const trackJobSearch = useCallback((query: string, resultsCount: number, filters?: Record<string, any>, searchSource?: string) => {
    track('job_search', {
      query,
      results_count: resultsCount,
      filters,
      search_source: searchSource,
    });
  }, [track]);

  return { trackJobSearch };
}

export function usePaywallTracking() {
  const { track } = useAnalytics();

  const trackPaywallShown = useCallback((triggerLocation: string, triggerReason: string, featureName: string, usageCount?: number) => {
    track('paywall_shown', {
      trigger_location: triggerLocation,
      trigger_reason: triggerReason,
      feature_name: featureName,
      usage_count: usageCount,
    });
  }, [track]);

  const trackPaywallClick = useCallback((buttonType: string, planName?: string, planPrice?: number, triggerLocation?: string) => {
    track('paywall_click', {
      button_type: buttonType,
      plan_name: planName,
      plan_price: planPrice,
      trigger_location: triggerLocation,
    });
  }, [track]);

  return { trackPaywallShown, trackPaywallClick };
}

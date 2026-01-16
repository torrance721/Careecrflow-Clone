import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Users, MousePointer, DollarSign, Search, Play } from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';

export default function AnalyticsDashboard() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'all'>('7d');

  // Calculate date range
  const getStartDate = () => {
    if (dateRange === 'all') return undefined;
    const days = dateRange === '7d' ? 7 : 30;
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  };

  // Fetch analytics stats
  const { data: stats, isLoading: statsLoading } = trpc.analytics.getStats.useQuery({
    startDate: getStartDate(),
    endDate: new Date().toISOString(),
  }, {
    enabled: isAuthenticated,
  });

  // Fetch event details for specific events
  const { data: tabClickDetails } = trpc.analytics.getEventDetails.useQuery({
    eventName: 'tab_click',
    startDate: getStartDate(),
    endDate: new Date().toISOString(),
  }, {
    enabled: isAuthenticated,
  });

  const { data: interviewDetails } = trpc.analytics.getEventDetails.useQuery({
    eventName: 'interview_start',
    startDate: getStartDate(),
    endDate: new Date().toISOString(),
  }, {
    enabled: isAuthenticated,
  });

  const { data: jobSearchDetails } = trpc.analytics.getEventDetails.useQuery({
    eventName: 'job_search',
    startDate: getStartDate(),
    endDate: new Date().toISOString(),
  }, {
    enabled: isAuthenticated,
  });

  const { data: paywallShownDetails } = trpc.analytics.getEventDetails.useQuery({
    eventName: 'paywall_shown',
    startDate: getStartDate(),
    endDate: new Date().toISOString(),
  }, {
    enabled: isAuthenticated,
  });

  const { data: paywallClickDetails } = trpc.analytics.getEventDetails.useQuery({
    eventName: 'paywall_click',
    startDate: getStartDate(),
    endDate: new Date().toISOString(),
  }, {
    enabled: isAuthenticated,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Analytics Dashboard</CardTitle>
            <CardDescription>Sign in to view analytics data</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = getLoginUrl()} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to view analytics</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const loading = statsLoading;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">User behavior tracking and insights</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={dateRange === '7d' ? 'default' : 'outline'}
              onClick={() => setDateRange('7d')}
            >
              Last 7 Days
            </Button>
            <Button
              variant={dateRange === '30d' ? 'default' : 'outline'}
              onClick={() => setDateRange('30d')}
            >
              Last 30 Days
            </Button>
            <Button
              variant={dateRange === 'all' ? 'default' : 'outline'}
              onClick={() => setDateRange('all')}
            >
              All Time
            </Button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.totalEvents || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.uniqueUsers || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sessions</CardTitle>
              <MousePointer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.uniqueSessions || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  `${paywallShownDetails && paywallClickDetails
                    ? ((paywallClickDetails.totalCount / paywallShownDetails.totalCount) * 100).toFixed(1)
                    : 0}%`
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Analytics */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tabs">Tab Clicks</TabsTrigger>
            <TabsTrigger value="interviews">Interviews</TabsTrigger>
            <TabsTrigger value="jobs">Job Search</TabsTrigger>
            <TabsTrigger value="paywall">Paywall</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Events by Type</CardTitle>
                <CardDescription>Distribution of all tracked events</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stats?.eventsByName.map((event) => (
                      <div key={event.eventName} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {event.eventName === 'tab_click' && <MousePointer className="h-5 w-5 text-blue-500" />}
                          {event.eventName === 'interview_start' && <Play className="h-5 w-5 text-green-500" />}
                          {event.eventName === 'job_search' && <Search className="h-5 w-5 text-purple-500" />}
                          {event.eventName === 'paywall_shown' && <DollarSign className="h-5 w-5 text-orange-500" />}
                          {event.eventName === 'paywall_click' && <DollarSign className="h-5 w-5 text-red-500" />}
                          <span className="font-medium">{event.eventName}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-2xl font-bold">{event.count}</span>
                          <div className="w-32 bg-secondary rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{
                                width: `${(event.count / (stats?.totalEvents || 1)) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tabs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tab Click Analytics</CardTitle>
                <CardDescription>User engagement with different tabs</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Total Tab Clicks: <span className="font-bold">{tabClickDetails?.totalCount || 0}</span>
                    </div>
                    {tabClickDetails?.propertyStats.tab_name && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Most Clicked Tabs</h4>
                        {Object.entries(tabClickDetails.propertyStats.tab_name)
                          .sort(([, a], [, b]) => (b as number) - (a as number))
                          .map(([tabName, count]) => (
                            <div key={tabName} className="flex items-center justify-between">
                              <span>{tabName}</span>
                              <span className="font-bold">{count as number}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="interviews" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Interview Analytics</CardTitle>
                <CardDescription>Mock interview usage statistics</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Total Interviews Started: <span className="font-bold">{interviewDetails?.totalCount || 0}</span>
                    </div>
                    {interviewDetails?.propertyStats.interview_type && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Interview Types</h4>
                        {Object.entries(interviewDetails.propertyStats.interview_type)
                          .sort(([, a], [, b]) => (b as number) - (a as number))
                          .map(([type, count]) => (
                            <div key={type} className="flex items-center justify-between">
                              <span>{type}</span>
                              <span className="font-bold">{count as number}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Job Search Analytics</CardTitle>
                <CardDescription>User job search behavior</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Total Searches: <span className="font-bold">{jobSearchDetails?.totalCount || 0}</span>
                    </div>
                    {jobSearchDetails?.propertyStats.query && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Top Search Keywords</h4>
                        {Object.entries(jobSearchDetails.propertyStats.query)
                          .sort(([, a], [, b]) => (b as number) - (a as number))
                          .slice(0, 10)
                          .map(([query, count]) => (
                            <div key={query} className="flex items-center justify-between">
                              <span>{query}</span>
                              <span className="font-bold">{count as number}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="paywall" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Paywall Impressions</CardTitle>
                  <CardDescription>How often users see the paywall</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-3xl font-bold">{paywallShownDetails?.totalCount || 0}</div>
                      {paywallShownDetails?.propertyStats.trigger_location && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Trigger Locations</h4>
                          {Object.entries(paywallShownDetails.propertyStats.trigger_location)
                            .sort(([, a], [, b]) => (b as number) - (a as number))
                            .map(([location, count]) => (
                              <div key={location} className="flex items-center justify-between text-sm">
                                <span>{location}</span>
                                <span className="font-bold">{count as number}</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Paywall Clicks</CardTitle>
                  <CardDescription>User interaction with paywall</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-3xl font-bold">{paywallClickDetails?.totalCount || 0}</div>
                      {paywallClickDetails?.propertyStats.button_type && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Button Types</h4>
                          {Object.entries(paywallClickDetails.propertyStats.button_type)
                            .sort(([, a], [, b]) => (b as number) - (a as number))
                            .map(([type, count]) => (
                              <div key={type} className="flex items-center justify-between text-sm">
                                <span>{type}</span>
                                <span className="font-bold">{count as number}</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

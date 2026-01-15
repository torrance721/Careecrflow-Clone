import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  MapPin, 
  Clock, 
  DollarSign,
  Briefcase,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Plus,
  Sparkles,
  Loader2,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import PaywallModal from "@/components/PaywallModal";

// Job type from API
interface Job {
  id: number;
  company: string;
  companyLogo?: string | null;
  position: string;
  location: string | null;
  description?: string | null;
  salaryMin?: string | null;
  salaryMax?: string | null;
  jobType?: string | null;
  workType?: string | null;
  experienceLevel?: string | null;
  linkedinUrl?: string | null;
  applyUrl?: string | null;
  matchPercentage?: number | null;
  postedAt?: Date | null;
}

export default function JobsBoard() {
  const [searchQuery, setSearchQuery] = useState("Software Engineer");
  const [locationFilter, setLocationFilter] = useState("United States");
  const [workTypeFilter, setWorkTypeFilter] = useState<string>("all");
  const [experienceFilter, setExperienceFilter] = useState<string>("all");
  const [savedJobs, setSavedJobs] = useState<number[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  
  // 付费墙逻辑：搜索次数限制
  const [showPaywall, setShowPaywall] = useState(false);
  const [searchCount, setSearchCount] = useState(() => {
    const today = new Date().toDateString();
    const stored = localStorage.getItem('jobSearchData');
    if (stored) {
      const data = JSON.parse(stored);
      if (data.date === today) {
        return data.count;
      }
    }
    return 0;
  });
  
  // 更新搜索次数
  const updateSearchCount = () => {
    const today = new Date().toDateString();
    const newCount = searchCount + 1;
    setSearchCount(newCount);
    localStorage.setItem('jobSearchData', JSON.stringify({
      date: today,
      count: newCount
    }));
  };

  // Fetch jobs from database
  const { data: jobs, isLoading: isLoadingJobs, refetch: refetchJobs } = trpc.jobs.list.useQuery(undefined, {
    enabled: hasSearched,
  });

  // Check Apify status
  const { data: apifyStatus } = trpc.jobs.apifyStatus.useQuery();

  // Scrape LinkedIn jobs mutation
  const scrapeJobsMutation = trpc.jobs.scrapeLinkedIn.useMutation({
    onSuccess: (data) => {
      toast.success(`Found ${data.count} jobs from LinkedIn!`);
      refetchJobs();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to search jobs");
    },
  });

  // Generate recommendations mutation (fallback)
  const generateRecommendationsMutation = trpc.jobs.generateRecommendations.useMutation({
    onSuccess: (data) => {
      const sourceLabel = data.source === 'apify' ? 'LinkedIn' : data.source === 'cache' ? 'cache' : 'sample data';
      toast.success(`Found ${data.count} jobs from ${sourceLabel}!`);
      refetchJobs();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate recommendations");
    },
  });

  // Add job to tracker mutation
  const addJobMutation = trpc.jobTracker.create.useMutation({
    onSuccess: () => {
      toast.success("Job added to tracker!");
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Failed to add job");
    },
  });

  // Handle search
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a job title to search");
      return;
    }
    
    // 检查搜索次数限制（每天3次免费）
    if (searchCount >= 3) {
      setShowPaywall(true);
      return;
    }
    
    // 更新搜索次数
    updateSearchCount();

    setHasSearched(true);

    // Use scrapeLinkedIn if Apify is configured
    if (apifyStatus?.configured) {
      scrapeJobsMutation.mutate({
        title: searchQuery,
        location: locationFilter || undefined,
        rows: 30,
        workType: workTypeFilter !== 'all' ? workTypeFilter as 'onsite' | 'remote' | 'hybrid' : undefined,
        experienceLevel: experienceFilter !== 'all' ? experienceFilter as 'entry' | 'associate' | 'mid' | 'senior' | 'director' : undefined,
      });
    } else {
      // Fallback to generateRecommendations which has caching
      generateRecommendationsMutation.mutate();
    }
  };

  // Filter jobs locally
  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    
    return jobs.filter((job) => {
      const matchesWorkType = workTypeFilter === "all" || 
        job.workType?.toLowerCase().includes(workTypeFilter.toLowerCase());
      
      const matchesExperience = experienceFilter === "all" ||
        job.experienceLevel?.toLowerCase().includes(experienceFilter.toLowerCase());
      
      return matchesWorkType && matchesExperience;
    });
  }, [jobs, workTypeFilter, experienceFilter]);

  const toggleSave = (jobId: number) => {
    if (savedJobs.includes(jobId)) {
      setSavedJobs(savedJobs.filter(id => id !== jobId));
      toast.success("Job removed from saved");
    } else {
      setSavedJobs([...savedJobs, jobId]);
      toast.success("Job saved!");
    }
  };

  const addToTracker = (job: Job) => {
    addJobMutation.mutate({
      jobTitle: job.position,
      companyName: job.company,
      location: job.location || undefined,
      salary: job.salaryMin && job.salaryMax ? `$${job.salaryMin} - $${job.salaryMax}` : undefined,
      jobUrl: job.linkedinUrl || job.applyUrl || undefined,
      status: "saved",
    });
  };

  const formatSalary = (job: Job) => {
    if (job.salaryMin && job.salaryMax) {
      return `$${Number(job.salaryMin).toLocaleString()} - $${Number(job.salaryMax).toLocaleString()}`;
    }
    if (job.salaryMin) {
      return `From $${Number(job.salaryMin).toLocaleString()}`;
    }
    return null;
  };

  const formatPostedDate = (date: Date | null | undefined) => {
    if (!date) return null;
    const now = new Date();
    const posted = new Date(date);
    const diffDays = Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const isLoading = scrapeJobsMutation.isPending || generateRecommendationsMutation.isPending || isLoadingJobs;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
              <Briefcase className="w-6 h-6 text-primary" />
              Jobs Board
              <Badge variant="secondary" className="ml-2 bg-primary/20 text-primary">Beta</Badge>
            </h1>
            <p className="text-muted-foreground">
              Search real jobs from LinkedIn powered by Apify
            </p>
          </div>
          <div className="flex items-center gap-2">
            {apifyStatus?.configured ? (
              <Badge variant="outline" className="text-success border-success/30 bg-success/10">
                <span className="w-2 h-2 rounded-full bg-success mr-2"></span>
                LinkedIn Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 bg-yellow-500/10">
                <AlertCircle className="w-3 h-3 mr-1" />
                Using Cached Data
              </Badge>
            )}
            {hasSearched && jobs && (
              <Badge variant="outline" className="text-sm">
                {filteredJobs.length} jobs found
              </Badge>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            {/* Search count indicator */}
            {searchCount > 0 && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {searchCount}/3
                  </span>
                  {' '}free searches used
                  {searchCount >= 3 && (
                    <span className="text-blue-600 dark:text-blue-400 ml-2">
                      • Subscribe for unlimited searches
                    </span>
                  )}
                </p>
              </div>
            )}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Job title (e.g., Software Engineer, Product Manager)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10 bg-secondary border-border"
                  />
                </div>
                <div className="relative w-full md:w-64">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                  <Input
                    placeholder="Location (e.g., San Francisco)"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10 bg-secondary border-border"
                  />
                </div>
                <Button 
                  onClick={handleSearch} 
                  disabled={isLoading}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Search Jobs
                    </>
                  )}
                </Button>
              </div>
              
              {/* Additional Filters */}
              <div className="flex flex-wrap gap-4">
                <Select value={workTypeFilter} onValueChange={setWorkTypeFilter}>
                  <SelectTrigger className="w-full md:w-40 bg-secondary border-border">
                    <SelectValue placeholder="Work Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="onsite">On-site</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={experienceFilter} onValueChange={setExperienceFilter}>
                  <SelectTrigger className="w-full md:w-48 bg-secondary border-border">
                    <SelectValue placeholder="Experience Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="entry">Entry Level</SelectItem>
                    <SelectItem value="associate">Associate</SelectItem>
                    <SelectItem value="mid">Mid-Senior</SelectItem>
                    <SelectItem value="senior">Senior</SelectItem>
                    <SelectItem value="director">Director</SelectItem>
                  </SelectContent>
                </Select>

                {hasSearched && (
                  <Button 
                    variant="outline" 
                    onClick={handleSearch}
                    disabled={isLoading}
                    className="border-primary/30 text-foreground hover:bg-primary/10"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Initial State - Before Search */}
        {!hasSearched && (
          <Card className="border-border bg-card">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-foreground">Search for Jobs</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                Enter a job title and location to search real job listings from LinkedIn. 
                Results are fetched in real-time using Apify.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Badge 
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary/10 border-primary/30"
                  onClick={() => { setSearchQuery("Software Engineer"); handleSearch(); }}
                >
                  Software Engineer
                </Badge>
                <Badge 
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary/10 border-primary/30"
                  onClick={() => { setSearchQuery("Product Manager"); handleSearch(); }}
                >
                  Product Manager
                </Badge>
                <Badge 
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary/10 border-primary/30"
                  onClick={() => { setSearchQuery("Data Scientist"); handleSearch(); }}
                >
                  Data Scientist
                </Badge>
                <Badge 
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary/10 border-primary/30"
                  onClick={() => { setSearchQuery("UX Designer"); handleSearch(); }}
                >
                  UX Designer
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && hasSearched && (
          <Card className="border-border bg-card">
            <CardContent className="py-16 text-center">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
              <h3 className="font-semibold mb-2 text-foreground">Searching LinkedIn Jobs...</h3>
              <p className="text-muted-foreground">
                This may take 30-60 seconds as we fetch real job listings
              </p>
            </CardContent>
          </Card>
        )}

        {/* Job Listings */}
        {!isLoading && hasSearched && filteredJobs.length > 0 && (
          <div className="grid gap-4">
            {filteredJobs.map((job) => (
              <Card key={job.id} className="border-border bg-card hover:border-primary/30 transition-all">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    {/* Company Logo */}
                    <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                      {job.companyLogo ? (
                        <img 
                          src={job.companyLogo} 
                          alt={job.company} 
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company)}&background=random`;
                          }}
                        />
                      ) : (
                        <span className="text-lg font-bold text-muted-foreground">
                          {job.company.charAt(0)}
                        </span>
                      )}
                    </div>

                    {/* Job Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-lg text-foreground">{job.position}</h3>
                          <p className="text-muted-foreground">{job.company}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleSave(job.id)}
                            className="hover:bg-primary/10"
                          >
                            {savedJobs.includes(job.id) ? (
                              <BookmarkCheck className="w-5 h-5 text-primary" />
                            ) : (
                              <Bookmark className="w-5 h-5 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addToTracker(job)}
                            className="border-primary/30 hover:bg-primary/10"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Track
                          </Button>
                          {(job.linkedinUrl || job.applyUrl) && (
                            <Button
                              size="sm"
                              asChild
                              className="bg-primary hover:bg-primary/90 text-primary-foreground"
                            >
                              <a href={job.applyUrl || job.linkedinUrl || '#'} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4 mr-1" />
                                Apply
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Job Meta */}
                      <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {job.location}
                        </span>
                        {formatSalary(job) && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            {formatSalary(job)}
                          </span>
                        )}
                        {job.postedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatPostedDate(job.postedAt)}
                          </span>
                        )}
                        {job.workType && (
                          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                            {job.workType}
                          </Badge>
                        )}
                        {job.experienceLevel && (
                          <Badge variant="secondary" className="text-xs bg-secondary">
                            {job.experienceLevel}
                          </Badge>
                        )}
                        {job.matchPercentage && (
                          <Badge variant="secondary" className="text-xs bg-success/10 text-success">
                            {job.matchPercentage}% Match
                          </Badge>
                        )}
                      </div>

                      {/* Description */}
                      {job.description && (
                        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                          {job.description}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && hasSearched && filteredJobs.length === 0 && (
          <Card className="border-border bg-card">
            <CardContent className="py-12 text-center">
              <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold mb-2 text-foreground">No jobs found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search terms or filters
              </p>
              <Button onClick={handleSearch} variant="outline" className="border-primary/30">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* AI Recommendation Banner */}
        <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Get AI-Powered Job Recommendations</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your resume to get personalized job matches based on your skills and experience
                </p>
              </div>
              <Button 
                onClick={() => generateRecommendationsMutation.mutate()}
                disabled={generateRecommendationsMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {generateRecommendationsMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Get Recommendations
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* 付费墙弹窗 */}
      <PaywallModal 
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
      />
    </DashboardLayout>
  );
}

import { Building2, MapPin, Clock, Users, Globe, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { JobRecommendation } from "../../../drizzle/schema";
import { useLanguage } from "@/contexts/LanguageContext";

interface JobCardProps {
  job: JobRecommendation;
}

export function JobCard({ job }: JobCardProps) {
  const { language } = useLanguage();
  
  const formatSalary = (min: string | null, max: string | null) => {
    if (!min && !max) return null;
    const formatNum = (n: string) => {
      const num = parseFloat(n);
      if (num >= 1000) return `$${(num / 1000).toFixed(0)}k`;
      return `$${num}`;
    };
    if (min && max) {
      return `${formatNum(min)}/yr - ${formatNum(max)}/yr`;
    }
    return min ? `${formatNum(min)}/yr+` : `Up to ${formatNum(max!)}/yr`;
  };

  const formatTimeAgo = (date: Date | null) => {
    if (!date) return "";
    const now = new Date();
    const posted = new Date(date);
    const diffMs = now.getTime() - posted.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (language === 'zh') {
      if (diffDays === 0) return "今天";
      if (diffDays === 1) return "1 天前";
      if (diffDays < 7) return `${diffDays} 天前`;
      if (diffDays < 14) return "1 周前";
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`;
      return `${Math.floor(diffDays / 30)} 个月前`;
    }
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "1 day ago";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 14) return "1 week ago";
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
  };

  const getMatchColor = (percentage: number | null) => {
    if (!percentage) return "text-muted-foreground";
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 70) return "text-primary";
    return "text-amber-600";
  };

  const formatWorkType = (workType: string | null) => {
    if (!workType) return null;
    const workTypeMap: Record<string, { en: string; zh: string }> = {
      'onsite': { en: 'On-site', zh: '现场办公' },
      'remote': { en: 'Remote', zh: '远程' },
      'hybrid': { en: 'Hybrid', zh: '混合' },
    };
    const mapped = workTypeMap[workType.toLowerCase()];
    return mapped ? (language === 'zh' ? mapped.zh : mapped.en) : workType;
  };

  const formatExperienceLevel = (level: string | null) => {
    if (!level) return null;
    const levelMap: Record<string, { en: string; zh: string }> = {
      'entry': { en: 'Entry Level', zh: '入门级' },
      'associate': { en: 'Associate', zh: '初级' },
      'mid': { en: 'Mid-Senior', zh: '中级' },
      'senior': { en: 'Senior', zh: '高级' },
      'director': { en: 'Director', zh: '总监' },
    };
    const mapped = levelMap[level.toLowerCase()];
    return mapped ? (language === 'zh' ? mapped.zh : mapped.en) : level;
  };

  const salary = formatSalary(job.salaryMin, job.salaryMax);

  return (
    <Card className="bg-card rounded-2xl border-0 shadow-sm overflow-hidden">
      <CardContent className="p-5 space-y-4">
        {/* Company Header */}
        <div className="flex items-start gap-3">
          {job.companyLogo ? (
            <img 
              src={job.companyLogo} 
              alt={job.company}
              className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 ${job.companyLogo ? 'hidden' : ''}`}>
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-muted-foreground text-sm">{job.company}</h3>
            <h2 className="font-semibold text-lg text-foreground leading-tight">{job.position}</h2>
          </div>
          {job.matchPercentage && (
            <div className={`font-bold text-lg ${getMatchColor(job.matchPercentage)}`}>
              {job.matchPercentage}%
            </div>
          )}
        </div>

        {/* Location & Time */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {job.location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span>{job.location}</span>
            </div>
          )}
          {job.postedAt && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{formatTimeAgo(job.postedAt)}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {salary && (
            <Badge variant="secondary" className="rounded-full px-3 py-1 bg-green-100 text-green-700 font-medium">
              {salary}
            </Badge>
          )}
          {job.jobType && (
            <Badge variant="secondary" className="rounded-full px-3 py-1 bg-blue-100 text-blue-700 font-medium">
              <Briefcase className="h-3 w-3 mr-1" />
              {job.jobType}
            </Badge>
          )}
          {job.workType && (
            <Badge variant="secondary" className="rounded-full px-3 py-1 bg-purple-100 text-purple-700 font-medium">
              <Globe className="h-3 w-3 mr-1" />
              {formatWorkType(job.workType)}
            </Badge>
          )}
          {job.experienceLevel && (
            <Badge variant="secondary" className="rounded-full px-3 py-1 bg-amber-100 text-amber-700 font-medium">
              <Users className="h-3 w-3 mr-1" />
              {formatExperienceLevel(job.experienceLevel)}
            </Badge>
          )}
          {job.industry && (
            <Badge variant="secondary" className="rounded-full px-3 py-1 bg-muted text-muted-foreground font-normal">
              {job.industry}
            </Badge>
          )}
        </div>

        {/* Description */}
        {job.description && (
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">
              {language === 'zh' ? '职位描述' : 'About the job'}
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-6">
              {job.description}
            </p>
          </div>
        )}

        {/* LinkedIn Source Indicator */}
        {job.linkedinJobId && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-4 h-4 bg-[#0A66C2] rounded flex items-center justify-center">
                <span className="text-white font-bold text-[8px]">in</span>
              </div>
              <span>{language === 'zh' ? '来自 LinkedIn' : 'From LinkedIn'}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

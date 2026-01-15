import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Search, Linkedin } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

interface LinkedInJobSearchProps {
  onSuccess?: () => void;
}

export function LinkedInJobSearch({ onSuccess }: LinkedInJobSearchProps) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [workType, setWorkType] = useState<string>("");
  const [contractType, setContractType] = useState<string>("");
  const [experienceLevel, setExperienceLevel] = useState<string>("");
  const [rows, setRows] = useState("20");

  const { data: apifyStatus } = trpc.jobs.apifyStatus.useQuery();
  
  const scrapeLinkedInMutation = trpc.jobs.scrapeLinkedIn.useMutation({
    onSuccess: (data) => {
      toast.success(
        language === 'zh' 
          ? `成功抓取 ${data.count} 个职位` 
          : `Successfully scraped ${data.count} jobs`
      );
      setOpen(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(
        language === 'zh'
          ? `抓取失败: ${error.message}`
          : `Scraping failed: ${error.message}`
      );
    },
  });

  const handleSearch = () => {
    if (!title.trim()) {
      toast.error(
        language === 'zh' 
          ? '请输入职位名称' 
          : 'Please enter a job title'
      );
      return;
    }

    scrapeLinkedInMutation.mutate({
      title: title.trim(),
      location: location.trim() || undefined,
      rows: parseInt(rows) || 20,
      workType: workType as 'onsite' | 'remote' | 'hybrid' | undefined,
      contractType: contractType as 'fulltime' | 'parttime' | 'contract' | 'temporary' | 'internship' | 'volunteer' | undefined,
      experienceLevel: experienceLevel as 'entry' | 'associate' | 'mid' | 'senior' | 'director' | undefined,
    });
  };

  const isConfigured = apifyStatus?.configured;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 rounded-full"
          disabled={!isConfigured}
        >
          <Linkedin className="h-4 w-4" />
          {language === 'zh' ? '搜索 LinkedIn 职位' : 'Search LinkedIn Jobs'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Linkedin className="h-5 w-5 text-[#0A66C2]" />
            {language === 'zh' ? 'LinkedIn 职位搜索' : 'LinkedIn Job Search'}
          </DialogTitle>
          <DialogDescription>
            {language === 'zh'
              ? '从 LinkedIn 抓取真实职位数据'
              : 'Scrape real job data from LinkedIn'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">
              {language === 'zh' ? '职位名称 *' : 'Job Title *'}
            </Label>
            <Input
              id="title"
              placeholder={language === 'zh' ? '例如: Software Engineer' : 'e.g., Software Engineer'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="location">
              {language === 'zh' ? '地点' : 'Location'}
            </Label>
            <Input
              id="location"
              placeholder={language === 'zh' ? '例如: New York, NY' : 'e.g., New York, NY'}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{language === 'zh' ? '工作方式' : 'Work Type'}</Label>
              <Select value={workType} onValueChange={setWorkType}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'zh' ? '全部' : 'All'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'zh' ? '全部' : 'All'}</SelectItem>
                  <SelectItem value="onsite">{language === 'zh' ? '现场办公' : 'On-site'}</SelectItem>
                  <SelectItem value="remote">{language === 'zh' ? '远程' : 'Remote'}</SelectItem>
                  <SelectItem value="hybrid">{language === 'zh' ? '混合' : 'Hybrid'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>{language === 'zh' ? '工作类型' : 'Job Type'}</Label>
              <Select value={contractType} onValueChange={setContractType}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'zh' ? '全部' : 'All'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'zh' ? '全部' : 'All'}</SelectItem>
                  <SelectItem value="fulltime">{language === 'zh' ? '全职' : 'Full-time'}</SelectItem>
                  <SelectItem value="parttime">{language === 'zh' ? '兼职' : 'Part-time'}</SelectItem>
                  <SelectItem value="contract">{language === 'zh' ? '合同' : 'Contract'}</SelectItem>
                  <SelectItem value="internship">{language === 'zh' ? '实习' : 'Internship'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{language === 'zh' ? '经验级别' : 'Experience'}</Label>
              <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'zh' ? '全部' : 'All'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'zh' ? '全部' : 'All'}</SelectItem>
                  <SelectItem value="entry">{language === 'zh' ? '入门级' : 'Entry Level'}</SelectItem>
                  <SelectItem value="associate">{language === 'zh' ? '初级' : 'Associate'}</SelectItem>
                  <SelectItem value="mid">{language === 'zh' ? '中级' : 'Mid-Senior'}</SelectItem>
                  <SelectItem value="senior">{language === 'zh' ? '高级' : 'Senior'}</SelectItem>
                  <SelectItem value="director">{language === 'zh' ? '总监' : 'Director'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>{language === 'zh' ? '结果数量' : 'Results'}</Label>
              <Select value={rows} onValueChange={setRows}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Button
          onClick={handleSearch}
          disabled={scrapeLinkedInMutation.isPending || !title.trim()}
          className="w-full"
        >
          {scrapeLinkedInMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {language === 'zh' ? '正在搜索...' : 'Searching...'}
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              {language === 'zh' ? '搜索职位' : 'Search Jobs'}
            </>
          )}
        </Button>

        {scrapeLinkedInMutation.isPending && (
          <p className="text-sm text-muted-foreground text-center">
            {language === 'zh'
              ? '正在从 LinkedIn 抓取数据，这可能需要 30-60 秒...'
              : 'Scraping data from LinkedIn, this may take 30-60 seconds...'}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

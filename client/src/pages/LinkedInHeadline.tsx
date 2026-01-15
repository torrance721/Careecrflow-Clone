import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { 
  Linkedin, 
  Sparkles, 
  Copy, 
  RefreshCw,
  CheckCircle,
  Lightbulb,
  Target,
  Zap,
  X,
  Upload,
  History,
  FileText,
  Globe
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function LinkedInHeadline() {
  const [targetJobTitle, setTargetJobTitle] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [profileSource, setProfileSource] = useState<"resume" | "linkedin">("resume");
  const [generatedHeadlines, setGeneratedHeadlines] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [language, setLanguage] = useState("english");

  const languages = [
    { value: "english", label: "English" },
    { value: "spanish", label: "Spanish" },
    { value: "french", label: "French" },
    { value: "german", label: "German" },
    { value: "chinese", label: "Chinese" },
    { value: "japanese", label: "Japanese" },
    { value: "korean", label: "Korean" },
    { value: "portuguese", label: "Portuguese" },
    { value: "italian", label: "Italian" },
    { value: "dutch", label: "Dutch" },
  ];

  const generateHeadlinesMutation = trpc.linkedin.generateHeadline.useMutation({
    onSuccess: (data) => {
      setGeneratedHeadlines(data.headlines);
      setIsGenerating(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsGenerating(false);
    },
  });

  const handleGenerate = () => {
    if (!targetJobTitle) {
      toast.error("Please enter your target job title");
      return;
    }
    setIsGenerating(true);
    // Combine target job title with keywords for better results
    const allKeywords = [targetJobTitle, ...keywords].filter(Boolean);
    generateHeadlinesMutation.mutate({
      keywords: allKeywords,
      profile: profileSource === 'resume' ? 'job_seeker' : 'professional',
      language: languages.find(l => l.value === language)?.label || 'English',
    });
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && keywordInput.trim()) {
      e.preventDefault();
      if (!keywords.includes(keywordInput.trim())) {
        setKeywords([...keywords, keywordInput.trim()]);
      }
      setKeywordInput("");
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  const handleCopy = (headline: string, index: number) => {
    navigator.clipboard.writeText(headline);
    setCopiedIndex(index);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleViewHistory = () => {
    toast.info("History feature coming soon");
  };

  const exampleHeadlines = [
    "Senior Software Engineer | Building Scalable Systems | Ex-Google",
    "Product Manager | Driving Growth at Startups | MBA",
    "Data Scientist | Machine Learning Expert | Python & SQL",
    "UX Designer | Creating Human-Centered Experiences | Design Systems",
  ];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Linkedin className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">LinkedIn Headline Generator</h1>
              <p className="text-muted-foreground">
                Create a compelling headline that attracts recruiters
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Information</CardTitle>
                <CardDescription>
                  Tell us about yourself to generate personalized headlines
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Target Job Title */}
                <div>
                  <Label>Target Job Title <span className="text-red-500">*</span></Label>
                  <Input
                    value={targetJobTitle}
                    onChange={(e) => setTargetJobTitle(e.target.value)}
                    placeholder="e.g., Senior Software Engineer"
                  />
                </div>

                {/* Keywords to Include */}
                <div>
                  <Label>Keywords to Include</Label>
                  <Input
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={handleKeywordKeyDown}
                    placeholder="Type a keyword and press Enter"
                  />
                  {keywords.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {keywords.map((keyword) => (
                        <Badge
                          key={keyword}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {keyword}
                          <X
                            className="w-3 h-3 cursor-pointer hover:text-destructive"
                            onClick={() => removeKeyword(keyword)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Your Profile Source */}
                <div>
                  <Label className="mb-3 block">Your Profile <span className="text-red-500">*</span></Label>
                  <RadioGroup
                    value={profileSource}
                    onValueChange={(value) => setProfileSource(value as "resume" | "linkedin")}
                    className="space-y-3"
                  >
                    <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                      <RadioGroupItem value="resume" id="resume" />
                      <Label htmlFor="resume" className="flex items-center gap-2 cursor-pointer flex-1">
                        <Upload className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Resume Upload</p>
                          <p className="text-xs text-muted-foreground">Upload your resume to extract information</p>
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                      <RadioGroupItem value="linkedin" id="linkedin" />
                      <Label htmlFor="linkedin" className="flex items-center gap-2 cursor-pointer flex-1">
                        <Linkedin className="w-4 h-4 text-blue-600" />
                        <div>
                          <p className="font-medium">Use LinkedIn Profile</p>
                          <p className="text-xs text-muted-foreground">Connect your LinkedIn to import data</p>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Language Selection */}
                <div>
                  <Label className="mb-2 block">Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <Globe className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Select Language" />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button 
                    className="flex-1" 
                    onClick={handleGenerate}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleViewHistory}
                  >
                    <History className="w-4 h-4 mr-2" />
                    View History
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-500" />
                  Tips for a Great Headline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Target className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span>Include your target job title for better search visibility</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span>Highlight your unique value proposition</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span>Use keywords that recruiters search for</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span>Keep it under 120 characters for full visibility</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Generated Headlines */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Generated Headlines</CardTitle>
                <CardDescription>
                  Click to copy any headline to your clipboard
                </CardDescription>
              </CardHeader>
              <CardContent>
                {generatedHeadlines.length > 0 ? (
                  <div className="space-y-3 stagger-fade-in">
                    {generatedHeadlines.map((headline, index) => (
                      <div
                        key={index}
                        className={`p-4 border rounded-lg hover:bg-muted/50 transition-all cursor-pointer group card-interactive ${
                          copiedIndex === index ? "ring-2 ring-green-500 bg-green-50" : ""
                        }`}
                        onClick={() => handleCopy(headline, index)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm">{headline}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 shrink-0 transition-all ${
                              copiedIndex === index 
                                ? "opacity-100 scale-110" 
                                : "opacity-0 group-hover:opacity-100"
                            }`}
                          >
                            {copiedIndex === index ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {headline.length} characters
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground mb-2">
                      No headlines generated yet
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Fill in your information and click generate
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Example Headlines */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Example Headlines</CardTitle>
                <CardDescription>
                  Get inspired by these effective headlines
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {exampleHeadlines.map((headline, index) => (
                    <div
                      key={index}
                      className="p-3 bg-muted/50 rounded-lg text-sm"
                    >
                      {headline}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

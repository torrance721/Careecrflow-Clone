import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Linkedin, 
  Sparkles, 
  Copy, 
  RefreshCw,
  CheckCircle,
  Lightbulb,
  User,
  Briefcase,
  Target,
  X,
  Upload,
  History,
  ChevronDown,
  Settings,
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

export default function LinkedInAbout() {
  const [targetJobTitle, setTargetJobTitle] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [profileSource, setProfileSource] = useState<"resume" | "linkedin">("resume");
  const [experience, setExperience] = useState("");
  const [skills, setSkills] = useState("");
  const [achievements, setAchievements] = useState("");
  const [goals, setGoals] = useState("");
  const [tone, setTone] = useState<"professional" | "friendly" | "creative">("professional");
  const [generatedAbout, setGeneratedAbout] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
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

  const generateAboutMutation = trpc.linkedin.generateAbout.useMutation({
    onSuccess: (data) => {
      setGeneratedAbout(data.about);
      setIsGenerating(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsGenerating(false);
    },
  });

  const handleGenerate = () => {
    setIsGenerating(true);
    // Combine all inputs into keywords for the API
    const allKeywords = [
      targetJobTitle,
      ...keywords,
      skills,
      experience,
      achievements,
      goals
    ].filter(Boolean);
    generateAboutMutation.mutate({
      keywords: allKeywords,
      tone,
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

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedAbout);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleViewHistory = () => {
    toast.info("History feature coming soon");
  };

  const toneOptions = [
    { value: "professional", label: "Professional", description: "Formal and business-focused" },
    { value: "friendly", label: "Friendly", description: "Warm and approachable" },
    { value: "creative", label: "Creative", description: "Unique and memorable" },
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
              <h1 className="text-2xl font-semibold">LinkedIn About Generator</h1>
              <p className="text-muted-foreground">
                Create a compelling About section that tells your story
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Your Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Target Job Title */}
                <div>
                  <Label>Target Job Title</Label>
                  <Input
                    value={targetJobTitle}
                    onChange={(e) => setTargetJobTitle(e.target.value)}
                    placeholder="e.g., Senior Software Engineer"
                  />
                </div>

                {/* Keywords to Include */}
                <div>
                  <Label>Keywords To Include</Label>
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
                      <RadioGroupItem value="resume" id="resume-about" />
                      <Label htmlFor="resume-about" className="flex items-center gap-2 cursor-pointer flex-1">
                        <Upload className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Resume Upload</p>
                          <p className="text-xs text-muted-foreground">Upload your resume to extract information</p>
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                      <RadioGroupItem value="linkedin" id="linkedin-about" />
                      <Label htmlFor="linkedin-about" className="flex items-center gap-2 cursor-pointer flex-1">
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

                {/* Advanced Settings */}
                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Advanced Settings
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-4">
                    <div>
                      <Label>Years of Experience</Label>
                      <Input
                        value={experience}
                        onChange={(e) => setExperience(e.target.value)}
                        placeholder="e.g., 8 years in software development"
                      />
                    </div>
                    <div>
                      <Label>Key Skills & Expertise</Label>
                      <Textarea
                        value={skills}
                        onChange={(e) => setSkills(e.target.value)}
                        placeholder="e.g., Full-stack development, cloud architecture, team leadership"
                        rows={2}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary" />
                  Achievements & Goals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Key Achievements</Label>
                  <Textarea
                    value={achievements}
                    onChange={(e) => setAchievements(e.target.value)}
                    placeholder="e.g., Led a team of 10 engineers, increased system performance by 40%"
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Career Goals</Label>
                  <Textarea
                    value={goals}
                    onChange={(e) => setGoals(e.target.value)}
                    placeholder="e.g., Looking to lead engineering teams at innovative startups"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Writing Tone
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {toneOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTone(option.value as any)}
                      className={`p-3 border rounded-lg text-left transition-colors ${
                        tone === option.value
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <p className="font-medium text-sm">{option.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {option.description}
                      </p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button 
                className="flex-1" 
                size="lg"
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
                    Generate About Section
                  </>
                )}
              </Button>
              <Button 
                variant="outline"
                size="lg"
                onClick={handleViewHistory}
              >
                <History className="w-4 h-4 mr-2" />
                History
              </Button>
            </div>
          </div>

          {/* Generated About */}
          <div className="space-y-6">
            <Card className="h-fit">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Generated About</CardTitle>
                  {generatedAbout && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                    >
                      {copied ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {generatedAbout ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {generatedAbout}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{generatedAbout.length} characters</span>
                      <span>
                        {generatedAbout.length <= 2600 ? (
                          <span className="text-green-500">✓ Within limit</span>
                        ) : (
                          <span className="text-red-500">Over 2,600 character limit</span>
                        )}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleGenerate}
                      disabled={isGenerating}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Regenerate
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground mb-2">
                      No About section generated yet
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Fill in your information and click generate
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tips */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-500" />
                  Tips for Your About Section
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
                    <span>Start with a hook that captures attention</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
                    <span>Include specific achievements with numbers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
                    <span>Show your personality while staying professional</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
                    <span>End with a call to action or what you're looking for</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
                    <span>Keep it under 2,600 characters for full visibility</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Mic, 
  Sparkles, 
  Copy, 
  RefreshCw,
  CheckCircle,
  Loader2,
  Clock,
  Target,
  Zap,
  X
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Duration = "30" | "60" | "90";

export default function ElevatorPitch() {
  const [targetRole, setTargetRole] = useState("");
  const [experience, setExperience] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [uniqueValue, setUniqueValue] = useState("");
  const [duration, setDuration] = useState<Duration>("60");
  const [generatedPitch, setGeneratedPitch] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generatePitchMutation = trpc.aiToolbox.generateElevatorPitch.useMutation({
    onSuccess: (data: { pitch: string }) => {
      setGeneratedPitch(data.pitch);
      setIsGenerating(false);
      toast.success("Elevator pitch generated!");
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Failed to generate pitch");
      setIsGenerating(false);
    },
  });

  const handleGenerate = () => {
    if (!targetRole) {
      toast.error("Please enter your target role");
      return;
    }
    
    setIsGenerating(true);
    generatePitchMutation.mutate({
      targetRole,
      experience: experience || undefined,
      skills: skills.length > 0 ? skills : undefined,
      uniqueValue: uniqueValue || undefined,
      duration,
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedPitch);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && skillInput.trim()) {
      e.preventDefault();
      if (!skills.includes(skillInput.trim())) {
        setSkills([...skills, skillInput.trim()]);
      }
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const durations = [
    { value: "30", label: "30 seconds", description: "Quick intro" },
    { value: "60", label: "60 seconds", description: "Standard pitch" },
    { value: "90", label: "90 seconds", description: "Detailed pitch" },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Mic className="w-5 h-5 text-orange-600" />
            </div>
            <h1 className="text-2xl font-bold">Elevator Pitch Generator</h1>
          </div>
          <p className="text-muted-foreground">
            Create a compelling pitch to introduce yourself in any situation
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Information</CardTitle>
              <CardDescription>
                Tell us about yourself to generate a personalized pitch
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Target Role */}
              <div className="space-y-2">
                <Label htmlFor="targetRole" className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Target Role *
                </Label>
                <Input
                  id="targetRole"
                  placeholder="e.g., Senior Software Engineer"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                />
              </div>

              {/* Experience */}
              <div className="space-y-2">
                <Label htmlFor="experience">
                  Brief Experience Summary (optional)
                </Label>
                <Textarea
                  id="experience"
                  placeholder="e.g., 5 years of experience in full-stack development, led teams at startups..."
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Skills */}
              <div className="space-y-2">
                <Label htmlFor="skills" className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Key Skills (optional)
                </Label>
                <Input
                  id="skills"
                  placeholder="Type a skill and press Enter"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={handleSkillKeyDown}
                />
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {skills.map((skill) => (
                      <Badge key={skill} variant="secondary" className="gap-1">
                        {skill}
                        <X
                          className="w-3 h-3 cursor-pointer"
                          onClick={() => removeSkill(skill)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Unique Value */}
              <div className="space-y-2">
                <Label htmlFor="uniqueValue">
                  What Makes You Unique? (optional)
                </Label>
                <Textarea
                  id="uniqueValue"
                  placeholder="e.g., I combine technical expertise with strong communication skills to bridge the gap between engineering and business..."
                  value={uniqueValue}
                  onChange={(e) => setUniqueValue(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Duration Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Pitch Duration
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {durations.map((d) => (
                    <div
                      key={d.value}
                      className={`p-3 border rounded-lg cursor-pointer text-center transition-colors ${
                        duration === d.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => setDuration(d.value as Duration)}
                    >
                      <p className="font-medium">{d.label}</p>
                      <p className="text-xs text-muted-foreground">{d.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <Button 
                onClick={handleGenerate} 
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Elevator Pitch
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Output Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                Your Elevator Pitch
                {generatedPitch && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                      {copied ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating}>
                      <RefreshCw className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {generatedPitch ? (
                <div className="space-y-4">
                  <div className="whitespace-pre-wrap text-base leading-relaxed bg-muted/50 p-4 rounded-lg">
                    {generatedPitch}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>Approximately {duration} seconds to deliver</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
                  <Mic className="w-12 h-12 mb-4 opacity-50" />
                  <p>Your elevator pitch will appear here</p>
                  <p className="text-sm">Fill in your information and click generate</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tips Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Tips for Delivering Your Pitch</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-blue-600 font-medium">1</span>
                </div>
                <div>
                  <p className="font-medium">Practice Out Loud</p>
                  <p className="text-sm text-muted-foreground">
                    Rehearse until it feels natural, not memorized
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <span className="text-green-600 font-medium">2</span>
                </div>
                <div>
                  <p className="font-medium">Make Eye Contact</p>
                  <p className="text-sm text-muted-foreground">
                    Connect with your audience for better engagement
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                  <span className="text-purple-600 font-medium">3</span>
                </div>
                <div>
                  <p className="font-medium">End with a Question</p>
                  <p className="text-sm text-muted-foreground">
                    Invite conversation to keep the dialogue going
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

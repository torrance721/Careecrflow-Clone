import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { 
  Mail, 
  Sparkles, 
  Copy, 
  RefreshCw,
  CheckCircle,
  Loader2,
  User,
  Building2,
  MessageSquare,
  History,
  Import,
  Star,
  Trash2,
  X,
  Briefcase
} from "lucide-react";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

type EmailType = "follow_up" | "thank_you" | "networking" | "application" | "inquiry";

export default function EmailWriter() {
  const [emailType, setEmailType] = useState<EmailType>("follow_up");
  const [recipientName, setRecipientName] = useState("");
  const [recipientTitle, setRecipientTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [context, setContext] = useState("");
  const [tone, setTone] = useState("professional");
  const [generatedEmail, setGeneratedEmail] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // View History state
  const [showHistory, setShowHistory] = useState(false);
  
  // Import from Board state
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Fetch history
  const { data: historyData, refetch: refetchHistory } = trpc.aiToolbox.getHistory.useQuery(
    { type: "email", limit: 50 },
    { enabled: showHistory }
  );

  // Fetch tracked jobs for import
  const { data: trackedJobs } = trpc.aiToolbox.getTrackedJobsForImport.useQuery(
    undefined,
    { enabled: showImportDialog }
  );

  // Toggle favorite mutation
  const toggleFavoriteMutation = trpc.aiToolbox.toggleFavorite.useMutation({
    onSuccess: () => {
      refetchHistory();
      toast.success("Updated!");
    },
  });

  // Delete history mutation
  const deleteHistoryMutation = trpc.aiToolbox.deleteHistory.useMutation({
    onSuccess: () => {
      refetchHistory();
      toast.success("Deleted!");
    },
  });

  const generateEmailMutation = trpc.aiToolbox.generateEmail.useMutation({
    onSuccess: (data: { email: string }) => {
      setGeneratedEmail(data.email);
      setIsGenerating(false);
      toast.success("Email generated!");
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Failed to generate email");
      setIsGenerating(false);
    },
  });

  const handleGenerate = () => {
    setIsGenerating(true);
    generateEmailMutation.mutate({
      emailType,
      recipientName: recipientName || undefined,
      recipientTitle: recipientTitle || undefined,
      companyName: companyName || undefined,
      context: context || undefined,
      tone,
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedEmail);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImportJob = (job: { id: number; jobTitle: string; companyName: string; description?: string | null }) => {
    setCompanyName(job.companyName);
    setContext(`Position: ${job.jobTitle}\n${job.description ? `Job Description: ${job.description.substring(0, 500)}...` : ''}`);
    setShowImportDialog(false);
    toast.success(`Imported job: ${job.jobTitle} at ${job.companyName}`);
  };

  const handleLoadFromHistory = (item: { generatedContent: string; inputParams?: { recipientName?: string; recipientTitle?: string; companyName?: string; context?: string; tone?: string; emailType?: string } | null }) => {
    setGeneratedEmail(item.generatedContent);
    if (item.inputParams) {
      if (item.inputParams.recipientName) setRecipientName(item.inputParams.recipientName);
      if (item.inputParams.recipientTitle) setRecipientTitle(item.inputParams.recipientTitle);
      if (item.inputParams.companyName) setCompanyName(item.inputParams.companyName);
      if (item.inputParams.context) setContext(item.inputParams.context);
      if (item.inputParams.tone) setTone(item.inputParams.tone);
      if (item.inputParams.emailType) setEmailType(item.inputParams.emailType as EmailType);
    }
    setShowHistory(false);
    toast.success("Loaded from history");
  };

  const emailTypes = [
    { value: "follow_up", label: "Follow-up Email", description: "After an interview or meeting" },
    { value: "thank_you", label: "Thank You Email", description: "Express gratitude after an interview" },
    { value: "networking", label: "Networking Email", description: "Connect with professionals" },
    { value: "application", label: "Application Email", description: "Submit a job application" },
    { value: "inquiry", label: "Inquiry Email", description: "Ask about job opportunities" },
  ];

  const tones = [
    { value: "professional", label: "Professional" },
    { value: "friendly", label: "Friendly" },
    { value: "formal", label: "Formal" },
    { value: "enthusiastic", label: "Enthusiastic" },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold">Email Writer</h1>
            </div>
            {/* View History and Import from Board buttons */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowHistory(true)}>
                <History className="w-4 h-4 mr-2" />
                View History
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
                <Import className="w-4 h-4 mr-2" />
                Import from Board
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground">
            Generate professional emails for your job search
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Email Details</CardTitle>
              <CardDescription>
                Select the type of email and provide context
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Email Type */}
              <div className="space-y-2">
                <Label>Email Type</Label>
                <div className="grid grid-cols-1 gap-2">
                  {emailTypes.map((type) => (
                    <div
                      key={type.value}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        emailType === type.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => setEmailType(type.value as EmailType)}
                    >
                      <p className="font-medium">{type.label}</p>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recipient Name */}
              <div className="space-y-2">
                <Label htmlFor="recipientName" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Recipient Name (optional)
                </Label>
                <Input
                  id="recipientName"
                  placeholder="e.g., John Smith"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>

              {/* Recipient Title */}
              <div className="space-y-2">
                <Label htmlFor="recipientTitle">
                  Recipient Title (optional)
                </Label>
                <Input
                  id="recipientTitle"
                  placeholder="e.g., Hiring Manager"
                  value={recipientTitle}
                  onChange={(e) => setRecipientTitle(e.target.value)}
                />
              </div>

              {/* Company Name */}
              <div className="space-y-2">
                <Label htmlFor="companyName" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Company Name (optional)
                </Label>
                <Input
                  id="companyName"
                  placeholder="e.g., Google"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>

              {/* Context */}
              <div className="space-y-2">
                <Label htmlFor="context" className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Additional Context (optional)
                </Label>
                <Textarea
                  id="context"
                  placeholder="e.g., I interviewed for the Senior Engineer position last Tuesday..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Tone Selection */}
              <div className="space-y-2">
                <Label htmlFor="tone">Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tones.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    Generate Email
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Output Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                Generated Email
                {generatedEmail && (
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
              {generatedEmail ? (
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/50 p-4 rounded-lg font-mono">
                    {generatedEmail}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
                  <Mail className="w-12 h-12 mb-4 opacity-50" />
                  <p>Your email will appear here</p>
                  <p className="text-sm">Select an email type and click generate</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* View History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Email History
            </DialogTitle>
            <DialogDescription>
              View and reuse your previously generated emails
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            {historyData && historyData.length > 0 ? (
              <div className="space-y-3">
                {historyData.map((item) => (
                  <Card key={item.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0" onClick={() => handleLoadFromHistory(item)}>
                          <p className="text-sm font-medium mb-1">
                            {(item.inputParams as { emailType?: string })?.emailType?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Email'}
                          </p>
                          <p className="text-xs text-muted-foreground mb-2">
                            {new Date(item.createdAt).toLocaleDateString()} - {(item.inputParams as { companyName?: string })?.companyName || 'No company'}
                          </p>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {item.generatedContent.substring(0, 150)}...
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavoriteMutation.mutate({ id: item.id, isFavorite: !item.isFavorite });
                            }}
                          >
                            <Star className={`w-4 h-4 ${item.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteHistoryMutation.mutate({ id: item.id });
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <History className="w-12 h-12 mb-4 opacity-50" />
                <p>No history yet</p>
                <p className="text-sm">Generated emails will appear here</p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Import from Board Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Import className="w-5 h-5" />
              Import from Job Board
            </DialogTitle>
            <DialogDescription>
              Select a job from your tracker to auto-fill email details
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[50vh] pr-4">
            {trackedJobs && trackedJobs.length > 0 ? (
              <div className="space-y-2">
                {trackedJobs.map((job) => (
                  <Card 
                    key={job.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleImportJob(job)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Briefcase className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{job.jobTitle}</p>
                          <p className="text-sm text-muted-foreground truncate">{job.companyName}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          job.status === 'saved' ? 'bg-gray-100 text-gray-700' :
                          job.status === 'applied' ? 'bg-blue-100 text-blue-700' :
                          job.status === 'interviewing' ? 'bg-yellow-100 text-yellow-700' :
                          job.status === 'offer' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {job.status}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <Briefcase className="w-12 h-12 mb-4 opacity-50" />
                <p>No tracked jobs</p>
                <p className="text-sm">Add jobs to your tracker first</p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  ArrowRight,
  Linkedin,
  Download,
  HelpCircle
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ImportStep = "upload" | "processing" | "review" | "complete";

interface ParsedLinkedInData {
  fullName?: string;
  headline?: string;
  location?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  summary?: string;
  experience?: Array<{
    title: string;
    company: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  education?: Array<{
    school: string;
    degree?: string;
    field?: string;
    startDate?: string;
    endDate?: string;
  }>;
  skills?: string[];
  certifications?: Array<{
    name: string;
    issuer?: string;
    date?: string;
  }>;
}

export default function LinkedInImport() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedLinkedInData | null>(null);
  const [progress, setProgress] = useState(0);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);

  const parseLinkedInMutation = trpc.linkedin.parseProfile.useMutation({
    onSuccess: (data: ParsedLinkedInData) => {
      setParsedData(data);
      setStep("review");
      toast.success("LinkedIn profile parsed successfully!");
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Failed to parse LinkedIn profile");
      setStep("upload");
    },
  });

  const createResumeFromLinkedInMutation = trpc.resume.createFromLinkedIn.useMutation({
    onSuccess: (data: { id: number }) => {
      setStep("complete");
      toast.success("Resume created from LinkedIn profile!");
      // Navigate to resume editor after a short delay
      setTimeout(() => {
        navigate(`/resume-editor/${data.id}`);
      }, 2000);
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Failed to create resume");
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === "application/pdf") {
      setFile(droppedFile);
    } else {
      toast.error("Please upload a PDF file");
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === "application/pdf") {
        setFile(selectedFile);
      } else {
        toast.error("Please upload a PDF file");
      }
    }
  }, []);

  const handleUpload = async () => {
    if (!file) return;

    setStep("processing");
    setProgress(0);

    // Simulate progress while processing
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 500);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        
        parseLinkedInMutation.mutate({
          pdfBase64: base64,
          fileName: file.name,
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      clearInterval(progressInterval);
      toast.error("Failed to read file");
      setStep("upload");
    }
  };

  const handleCreateResume = () => {
    if (!parsedData) return;
    createResumeFromLinkedInMutation.mutate(parsedData);
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Linkedin className="w-5 h-5 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold">Import from LinkedIn</h1>
          </div>
          <p className="text-muted-foreground">
            Upload your LinkedIn PDF to automatically create a professional resume
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {["Upload", "Processing", "Review", "Complete"].map((label, index) => {
            const stepIndex = ["upload", "processing", "review", "complete"].indexOf(step);
            const isActive = index === stepIndex;
            const isComplete = index < stepIndex;
            
            return (
              <div key={label} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                  isComplete ? "bg-green-500 text-white" :
                  isActive ? "bg-primary text-primary-foreground" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {isComplete ? <CheckCircle2 className="w-5 h-5" /> : index + 1}
                </div>
                <span className={`ml-2 text-sm ${isActive ? "font-medium" : "text-muted-foreground"}`}>
                  {label}
                </span>
                {index < 3 && (
                  <div className={`w-12 h-0.5 mx-4 ${
                    isComplete ? "bg-green-500" : "bg-muted"
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        {step === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Upload LinkedIn PDF
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setHelpDialogOpen(true)}>
                      <HelpCircle className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>How to download your LinkedIn PDF</TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription>
                Export your LinkedIn profile as PDF and upload it here
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                } ${file ? "bg-green-50 border-green-300" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {file ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                      <FileText className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setFile(null)}>
                        Remove
                      </Button>
                      <Button onClick={handleUpload}>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload & Parse
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Drag and drop your LinkedIn PDF here</p>
                      <p className="text-sm text-muted-foreground">or click to browse</p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button variant="outline" asChild>
                      <label htmlFor="file-upload" className="cursor-pointer">
                        Browse Files
                      </label>
                    </Button>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">How to export your LinkedIn profile:</h4>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Go to your LinkedIn profile page</li>
                  <li>Click "More" button below your profile photo</li>
                  <li>Select "Save to PDF"</li>
                  <li>Upload the downloaded PDF here</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "processing" && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-6">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <div className="text-center">
                  <h3 className="font-medium text-lg mb-2">Processing your LinkedIn profile...</h3>
                  <p className="text-muted-foreground">
                    Our AI is extracting your professional information
                  </p>
                </div>
                <div className="w-full max-w-xs">
                  <Progress value={progress} className="h-2" />
                  <p className="text-sm text-center text-muted-foreground mt-2">{progress}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "review" && parsedData && (
          <Card>
            <CardHeader>
              <CardTitle>Review Extracted Information</CardTitle>
              <CardDescription>
                We've extracted the following information from your LinkedIn profile
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Personal Info */}
              <div>
                <h4 className="font-medium mb-2">Personal Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <p className="font-medium">{parsedData.fullName || "Not found"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Headline:</span>
                    <p className="font-medium">{parsedData.headline || "Not found"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Location:</span>
                    <p className="font-medium">{parsedData.location || "Not found"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-medium">{parsedData.email || "Not found"}</p>
                  </div>
                </div>
              </div>

              {/* Summary */}
              {parsedData.summary && (
                <div>
                  <h4 className="font-medium mb-2">Summary</h4>
                  <p className="text-sm text-muted-foreground">{parsedData.summary}</p>
                </div>
              )}

              {/* Experience */}
              {parsedData.experience && parsedData.experience.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Experience ({parsedData.experience.length})</h4>
                  <div className="space-y-2">
                    {parsedData.experience.slice(0, 3).map((exp, index) => (
                      <div key={index} className="text-sm p-2 bg-muted rounded">
                        <p className="font-medium">{exp.title}</p>
                        <p className="text-muted-foreground">{exp.company}</p>
                      </div>
                    ))}
                    {parsedData.experience.length > 3 && (
                      <p className="text-sm text-muted-foreground">
                        +{parsedData.experience.length - 3} more positions
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Education */}
              {parsedData.education && parsedData.education.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Education ({parsedData.education.length})</h4>
                  <div className="space-y-2">
                    {parsedData.education.map((edu, index) => (
                      <div key={index} className="text-sm p-2 bg-muted rounded">
                        <p className="font-medium">{edu.school}</p>
                        <p className="text-muted-foreground">{edu.degree} {edu.field && `in ${edu.field}`}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills */}
              {parsedData.skills && parsedData.skills.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Skills ({parsedData.skills.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {parsedData.skills.slice(0, 10).map((skill, index) => (
                      <span key={index} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                        {skill}
                      </span>
                    ))}
                    {parsedData.skills.length > 10 && (
                      <span className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded-full">
                        +{parsedData.skills.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => {
                  setStep("upload");
                  setFile(null);
                  setParsedData(null);
                }}>
                  Upload Different File
                </Button>
                <Button onClick={handleCreateResume} disabled={createResumeFromLinkedInMutation.isPending}>
                  {createResumeFromLinkedInMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Resume...
                    </>
                  ) : (
                    <>
                      Create Resume
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "complete" && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-6">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-center">
                  <h3 className="font-medium text-lg mb-2">Resume Created Successfully!</h3>
                  <p className="text-muted-foreground">
                    Redirecting you to the resume editor...
                  </p>
                </div>
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help Dialog */}
        <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>How to Download Your LinkedIn Profile as PDF</DialogTitle>
              <DialogDescription>
                Follow these steps to export your LinkedIn profile
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium shrink-0">
                  1
                </div>
                <div>
                  <p className="font-medium">Go to your LinkedIn profile</p>
                  <p className="text-sm text-muted-foreground">
                    Click on "Me" in the top navigation and select "View Profile"
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium shrink-0">
                  2
                </div>
                <div>
                  <p className="font-medium">Click the "More" button</p>
                  <p className="text-sm text-muted-foreground">
                    Located below your profile photo, next to "Open to" button
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium shrink-0">
                  3
                </div>
                <div>
                  <p className="font-medium">Select "Save to PDF"</p>
                  <p className="text-sm text-muted-foreground">
                    This will download your profile as a PDF file
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium shrink-0">
                  4
                </div>
                <div>
                  <p className="font-medium">Upload the PDF here</p>
                  <p className="text-sm text-muted-foreground">
                    Drag and drop or click to browse for the downloaded file
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

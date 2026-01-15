import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  Plus, 
  FileText, 
  Linkedin, 
  Upload, 
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Download,
  Star,
  ChevronRight,
  Search,
  Filter
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export default function ResumeBuilder() {
  const [, setLocation] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createTypeDialogOpen, setCreateTypeDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<"base" | "tailored">("base");
  const [activeTab, setActiveTab] = useState<"base" | "tailored">("base");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: resumes, isLoading, refetch } = trpc.resume.list.useQuery();

  const createResumeMutation = trpc.resume.create.useMutation({
    onSuccess: (data) => {
      setCreateDialogOpen(false);
      setCreateTypeDialogOpen(false);
      if (data) {
        setLocation(`/resume-editor/${data.id}`);
      }
      toast.success("Resume created successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteResumeMutation = trpc.resume.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Resume deleted successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const duplicateResumeMutation = trpc.resume.duplicate.useMutation({
    onSuccess: (data) => {
      refetch();
      toast.success("Resume duplicated successfully");
      if (data) {
        setLocation(`/resume-editor/${data.id}`);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const generatePdfMutation = trpc.resume.generatePdf.useMutation({
    onSuccess: (data) => {
      if (data.html) {
        // Open HTML in new window for printing to PDF
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(data.html);
          printWindow.document.close();
          // Wait for content to load then trigger print
          printWindow.onload = () => {
            printWindow.print();
          };
        }
        toast.success("PDF ready for download");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCreateResume = (method: "blank" | "linkedin" | "upload") => {
    if (method === "blank") {
      createResumeMutation.mutate({
        title: selectedType === "base" ? "My Resume" : "Tailored Resume",
        type: selectedType,
      });
    } else if (method === "linkedin") {
      toast.info("LinkedIn import coming soon");
    } else if (method === "upload") {
      toast.info("Resume upload coming soon");
    }
  };

  const openCreateDialog = (type: "base" | "tailored") => {
    setSelectedType(type);
    setCreateDialogOpen(false);
    setCreateTypeDialogOpen(true);
  };

  const filteredResumes = resumes?.filter((resume) => {
    const matchesTab = resume.type === activeTab;
    const matchesSearch = searchQuery === "" || 
      resume.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const baseResumes = resumes?.filter(r => r.type === "base") || [];
  const tailoredResumes = resumes?.filter(r => r.type === "tailored") || [];

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Resume Builder</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage your resumes
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create New Resume
          </Button>
        </div>

        {/* Resume Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{baseResumes.length}</p>
                  <p className="text-muted-foreground text-sm">Base Resumes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <Star className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{tailoredResumes.length}</p>
                  <p className="text-muted-foreground text-sm">Tailored Resumes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                  <Download className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-muted-foreground text-sm">Downloads</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs and Search */}
        <div className="mb-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "base" | "tailored")}>
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="base" className="gap-2">
                  <FileText className="w-4 h-4" />
                  Base Resumes
                  <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded">
                    {baseResumes.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="tailored" className="gap-2">
                  <Star className="w-4 h-4" />
                  Job Tailored
                  <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded">
                    {tailoredResumes.length}
                  </span>
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search resumes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
                <Button variant="outline" size="icon">
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <TabsContent value="base" className="mt-0">
              <ResumeList 
                resumes={filteredResumes || []}
                isLoading={isLoading}
                onCreateClick={() => openCreateDialog("base")}
                onDelete={(id) => deleteResumeMutation.mutate({ id })}
                onDuplicate={(id) => duplicateResumeMutation.mutate({ id })}
                onDownload={(id) => generatePdfMutation.mutate({ id })}
                setLocation={setLocation}
                emptyMessage="No base resumes yet"
                emptyDescription="Create a base resume with all your experience"
              />
            </TabsContent>

            <TabsContent value="tailored" className="mt-0">
              <ResumeList 
                resumes={filteredResumes || []}
                isLoading={isLoading}
                onCreateClick={() => openCreateDialog("tailored")}
                onDelete={(id) => deleteResumeMutation.mutate({ id })}
                onDuplicate={(id) => duplicateResumeMutation.mutate({ id })}
                onDownload={(id) => generatePdfMutation.mutate({ id })}
                setLocation={setLocation}
                emptyMessage="No tailored resumes yet"
                emptyDescription="Create a resume customized for a specific job"
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Create Resume Type Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Resume</DialogTitle>
              <DialogDescription>
                Choose the type of resume you want to create
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <button
                onClick={() => openCreateDialog("base")}
                className="w-full p-4 border rounded-lg text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">Base Resume</h4>
                    <p className="text-sm text-muted-foreground">
                      Create a master resume with all your experience
                    </p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => openCreateDialog("tailored")}
                className="w-full p-4 border rounded-lg text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <Star className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">Job-Tailored Resume</h4>
                    <p className="text-sm text-muted-foreground">
                      Customize your resume for a specific job
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Method Dialog */}
        <Dialog open={createTypeDialogOpen} onOpenChange={setCreateTypeDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Create {selectedType === "base" ? "Base" : "Tailored"} Resume
              </DialogTitle>
              <DialogDescription>
                How would you like to create your resume?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <button
                onClick={() => handleCreateResume("linkedin")}
                className="w-full p-4 border rounded-lg text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Linkedin className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">Build Using LinkedIn</h4>
                    <p className="text-sm text-muted-foreground">
                      Import your profile from LinkedIn
                    </p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => handleCreateResume("upload")}
                className="w-full p-4 border rounded-lg text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">Upload Existing Resume</h4>
                    <p className="text-sm text-muted-foreground">
                      Upload a PDF or Word document
                    </p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => handleCreateResume("blank")}
                className="w-full p-4 border rounded-lg text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">Choose A Blank Template</h4>
                    <p className="text-sm text-muted-foreground">
                      Start from scratch with a template
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function ResumeList({
  resumes,
  isLoading,
  onCreateClick,
  onDelete,
  onDuplicate,
  onDownload,
  setLocation,
  emptyMessage,
  emptyDescription,
}: {
  resumes: any[];
  isLoading: boolean;
  onCreateClick: () => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
  onDownload: (id: number) => void;
  setLocation: (path: string) => void;
  emptyMessage: string;
  emptyDescription: string;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (resumes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-2">{emptyMessage}</h3>
          <p className="text-muted-foreground mb-4">{emptyDescription}</p>
          <Button onClick={onCreateClick}>
            <Plus className="w-4 h-4 mr-2" />
            Create Resume
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {resumes.map((resume) => (
        <Card key={resume.id} className="card-interactive">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{resume.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {resume.type === "base" ? "Base Resume" : "Tailored Resume"}
                  </p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLocation(`/resume-editor/${resume.id}`)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDuplicate(resume.id)}>
                    <Copy className="w-4 h-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDownload(resume.id)}>
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-destructive"
                    onClick={() => onDelete(resume.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Resume Score */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">Resume Score</span>
                <span className="font-medium">{resume.score || 0}/100</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${resume.score || 0}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Updated {new Date(resume.updatedAt).toLocaleDateString()}</span>
              <Link href={`/resume-editor/${resume.id}`}>
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  Edit
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

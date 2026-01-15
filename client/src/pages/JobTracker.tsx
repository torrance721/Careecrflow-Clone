import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical,
  Building2,
  MapPin,
  DollarSign,
  Calendar,
  ExternalLink,
  Trash2,
  Edit,
  GripVertical,
  Chrome,
  X
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

type JobStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected";

const columns: { id: JobStatus; title: string; color: string }[] = [
  { id: "saved", title: "Saved", color: "bg-gray-100" },
  { id: "applied", title: "Applied", color: "bg-blue-100" },
  { id: "interviewing", title: "Interviewing", color: "bg-yellow-100" },
  { id: "offer", title: "Offer", color: "bg-green-100" },
  { id: "rejected", title: "Rejected", color: "bg-red-100" },
];

export default function JobTracker() {
  const [addJobOpen, setAddJobOpen] = useState(false);
  const [editJobOpen, setEditJobOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<JobStatus | "all">("all");
  const [draggedJobId, setDraggedJobId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<JobStatus | null>(null);
  const [newJob, setNewJob] = useState({
    jobTitle: "",
    companyName: "",
    jobUrl: "",
    location: "",
    salary: "",
    description: "",
    notes: "",
    tags: [] as string[],
    status: "saved" as JobStatus,
  });
  const [tagInput, setTagInput] = useState("");
  const [editTagInput, setEditTagInput] = useState("");
  const [boardTitle, setBoardTitle] = useState("My 2026 Job Search");
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  const { data: jobs, isLoading, refetch } = trpc.jobTracker.list.useQuery();

  const createJobMutation = trpc.jobTracker.create.useMutation({
    onSuccess: () => {
      setAddJobOpen(false);
      setNewJob({
        jobTitle: "",
        companyName: "",
        jobUrl: "",
        location: "",
        salary: "",
        description: "",
        notes: "",
        tags: [],
        status: "saved",
      });
      refetch();
      toast.success("Job added successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateJobMutation = trpc.jobTracker.update.useMutation({
    onSuccess: () => {
      setEditJobOpen(false);
      setEditingJob(null);
      refetch();
      toast.success("Job updated successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateStatusMutation = trpc.jobTracker.updateStatus.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Job moved successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteJobMutation = trpc.jobTracker.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Job deleted");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleAddJob = () => {
    if (!newJob.jobTitle || !newJob.companyName) {
      toast.error("Please fill in job title and company name");
      return;
    }
    createJobMutation.mutate({
      jobTitle: newJob.jobTitle,
      companyName: newJob.companyName,
      location: newJob.location || undefined,
      jobUrl: newJob.jobUrl || undefined,
      salary: newJob.salary || undefined,
      description: newJob.description || undefined,
      status: newJob.status as 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected' | 'archived',
      notes: newJob.notes || undefined,
      tags: newJob.tags.length > 0 ? newJob.tags : undefined,
    });
  };

  const handleEditJob = () => {
    if (!editingJob) return;
    if (!editingJob.jobTitle || !editingJob.companyName) {
      toast.error("Please fill in job title and company name");
      return;
    }
    updateJobMutation.mutate({
      id: editingJob.id,
      jobTitle: editingJob.jobTitle,
      companyName: editingJob.companyName,
      location: editingJob.location || undefined,
      jobUrl: editingJob.jobUrl || undefined,
      salary: editingJob.salary || undefined,
      description: editingJob.description || undefined,
      status: editingJob.status,
      notes: editingJob.notes || undefined,
      tags: editingJob.tags || undefined,
    });
  };

  const openEditDialog = (job: any) => {
    setEditingJob({
      ...job,
      tags: job.tags || [],
    });
    setEditTagInput("");
    setEditJobOpen(true);
  };

  const handleDragStart = (e: React.DragEvent, jobId: number) => {
    setDraggedJobId(jobId);
    e.dataTransfer.setData("jobId", jobId.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedJobId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: JobStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, status: JobStatus) => {
    e.preventDefault();
    const jobId = parseInt(e.dataTransfer.getData("jobId"));
    const job = jobs?.find(j => j.id === jobId);
    
    if (job && job.status !== status) {
      updateStatusMutation.mutate({ id: jobId, status });
    }
    setDragOverColumn(null);
  };

  // Filter jobs based on search and status filter
  const filteredJobs = jobs?.filter(job => {
    const matchesSearch = searchQuery === "" || 
      job.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.location && job.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (job.tags && job.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase())));
    
    const matchesFilter = filterStatus === "all" || job.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  const getJobsByStatus = (status: JobStatus) => {
    return filteredJobs?.filter(job => job.status === status) || [];
  };

  // Calculate stats
  const totalJobs = jobs?.length || 0;
  const appliedJobs = jobs?.filter(j => j.status === "applied").length || 0;
  const interviewingJobs = jobs?.filter(j => j.status === "interviewing").length || 0;
  const offerJobs = jobs?.filter(j => j.status === "offer").length || 0;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {isEditingTitle ? (
              <Input
                value={boardTitle}
                onChange={(e) => setBoardTitle(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => e.key === "Enter" && setIsEditingTitle(false)}
                className="text-2xl font-bold h-auto py-1"
                autoFocus
              />
            ) : (
              <h1 
                className="text-2xl font-bold cursor-pointer hover:text-primary transition-colors"
                onClick={() => setIsEditingTitle(true)}
              >
                {boardTitle}
              </h1>
            )}
            <p className="text-muted-foreground">
              Track your job applications in one place
            </p>
          </div>
          <Button onClick={() => setAddJobOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Job
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{totalJobs}</div>
              <div className="text-sm text-muted-foreground">Total Jobs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{appliedJobs}</div>
              <div className="text-sm text-muted-foreground">Applied</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">{interviewingJobs}</div>
              <div className="text-sm text-muted-foreground">Interviewing</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{offerJobs}</div>
              <div className="text-sm text-muted-foreground">Offers</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs by title, company, location, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery("")}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as JobStatus | "all")}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {columns.map((col) => (
                <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Kanban Board */}
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {columns.map((column) => (
              <div
                key={column.id}
                className={`w-72 rounded-lg ${column.color} transition-all duration-200 ${
                  dragOverColumn === column.id ? "ring-2 ring-primary ring-offset-2" : ""
                }`}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                <div className="p-3 font-medium flex items-center justify-between">
                  <span>{column.title}</span>
                  <span className="text-sm text-muted-foreground bg-background/50 px-2 py-0.5 rounded">
                    {getJobsByStatus(column.id).length}
                  </span>
                </div>
                <div className="p-2 space-y-2 min-h-[200px]">
                  {getJobsByStatus(column.id).length > 0 ? (
                    getJobsByStatus(column.id).map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        isDragging={draggedJobId === job.id}
                        onDragStart={(e) => handleDragStart(e, job.id)}
                        onDragEnd={handleDragEnd}
                        onEdit={() => openEditDialog(job)}
                        onDelete={() => deleteJobMutation.mutate({ id: job.id })}
                      />
                    ))
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      {searchQuery || filterStatus !== "all" ? (
                        "No matching jobs"
                      ) : (
                        "No jobs in this stage"
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add Job Dialog */}
        <Dialog open={addJobOpen} onOpenChange={setAddJobOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Job</DialogTitle>
              <DialogDescription>
                Add a job to track in your pipeline
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Job Title *</Label>
                  <Input
                    value={newJob.jobTitle}
                    onChange={(e) => setNewJob({ ...newJob, jobTitle: e.target.value })}
                    placeholder="Software Engineer"
                  />
                </div>
                <div>
                  <Label>Company Name *</Label>
                  <Input
                    value={newJob.companyName}
                    onChange={(e) => setNewJob({ ...newJob, companyName: e.target.value })}
                    placeholder="Google"
                  />
                </div>
              </div>
              <div>
                <Label>Job URL</Label>
                <Input
                  value={newJob.jobUrl}
                  onChange={(e) => setNewJob({ ...newJob, jobUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              
              {/* Section Selection */}
              <div>
                <Label>Section *</Label>
                <Select
                  value={newJob.status}
                  onValueChange={(value) => setNewJob({ ...newJob, status: value as JobStatus })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a section" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((column) => (
                      <SelectItem key={column.id} value={column.id}>
                        {column.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Location</Label>
                  <Input
                    value={newJob.location}
                    onChange={(e) => setNewJob({ ...newJob, location: e.target.value })}
                    placeholder="San Francisco, CA"
                  />
                </div>
                <div>
                  <Label>Salary</Label>
                  <Input
                    value={newJob.salary}
                    onChange={(e) => setNewJob({ ...newJob, salary: e.target.value })}
                    placeholder="$150,000 - $200,000"
                  />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={newJob.description}
                  onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                  placeholder="Job description..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={newJob.notes}
                  onChange={(e) => setNewJob({ ...newJob, notes: e.target.value })}
                  placeholder="Your notes about this job..."
                  rows={2}
                />
              </div>

              {/* Tags */}
              <div>
                <Label>Tags</Label>
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tagInput.trim()) {
                      e.preventDefault();
                      if (!newJob.tags.includes(tagInput.trim())) {
                        setNewJob({ ...newJob, tags: [...newJob.tags, tagInput.trim()] });
                      }
                      setTagInput("");
                    }
                  }}
                  placeholder="Type a tag and press Enter"
                />
                {newJob.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newJob.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => setNewJob({ ...newJob, tags: newJob.tags.filter(t => t !== tag) })}
                          className="hover:text-destructive"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Chrome Extension Tip */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
                <Chrome className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Save jobs faster with our Chrome Extension
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    One-click save from LinkedIn, Indeed, and more
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddJobOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleAddJob} disabled={createJobMutation.isPending}>
                {createJobMutation.isPending ? "Adding..." : "Add Job"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Job Dialog */}
        <Dialog open={editJobOpen} onOpenChange={setEditJobOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Job</DialogTitle>
              <DialogDescription>
                Update job details
              </DialogDescription>
            </DialogHeader>
            {editingJob && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Job Title *</Label>
                    <Input
                      value={editingJob.jobTitle}
                      onChange={(e) => setEditingJob({ ...editingJob, jobTitle: e.target.value })}
                      placeholder="Software Engineer"
                    />
                  </div>
                  <div>
                    <Label>Company Name *</Label>
                    <Input
                      value={editingJob.companyName}
                      onChange={(e) => setEditingJob({ ...editingJob, companyName: e.target.value })}
                      placeholder="Google"
                    />
                  </div>
                </div>
                <div>
                  <Label>Job URL</Label>
                  <Input
                    value={editingJob.jobUrl || ""}
                    onChange={(e) => setEditingJob({ ...editingJob, jobUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                
                {/* Status Selection */}
                <div>
                  <Label>Status</Label>
                  <Select
                    value={editingJob.status}
                    onValueChange={(value) => setEditingJob({ ...editingJob, status: value as JobStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((column) => (
                        <SelectItem key={column.id} value={column.id}>
                          {column.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Location</Label>
                    <Input
                      value={editingJob.location || ""}
                      onChange={(e) => setEditingJob({ ...editingJob, location: e.target.value })}
                      placeholder="San Francisco, CA"
                    />
                  </div>
                  <div>
                    <Label>Salary</Label>
                    <Input
                      value={editingJob.salary || ""}
                      onChange={(e) => setEditingJob({ ...editingJob, salary: e.target.value })}
                      placeholder="$150,000 - $200,000"
                    />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={editingJob.description || ""}
                    onChange={(e) => setEditingJob({ ...editingJob, description: e.target.value })}
                    placeholder="Job description..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={editingJob.notes || ""}
                    onChange={(e) => setEditingJob({ ...editingJob, notes: e.target.value })}
                    placeholder="Your notes about this job..."
                    rows={2}
                  />
                </div>

                {/* Tags */}
                <div>
                  <Label>Tags</Label>
                  <Input
                    value={editTagInput}
                    onChange={(e) => setEditTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && editTagInput.trim()) {
                        e.preventDefault();
                        if (!editingJob.tags.includes(editTagInput.trim())) {
                          setEditingJob({ ...editingJob, tags: [...editingJob.tags, editTagInput.trim()] });
                        }
                        setEditTagInput("");
                      }
                    }}
                    placeholder="Type a tag and press Enter"
                  />
                  {editingJob.tags && editingJob.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {editingJob.tags.map((tag: string) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => setEditingJob({ ...editingJob, tags: editingJob.tags.filter((t: string) => t !== tag) })}
                            className="hover:text-destructive"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditJobOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleEditJob} disabled={updateJobMutation.isPending}>
                {updateJobMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function JobCard({
  job,
  isDragging,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
}: {
  job: any;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`cursor-grab active:cursor-grabbing transition-all duration-200 ${
        isDragging 
          ? "opacity-60 scale-105 shadow-xl ring-2 ring-primary rotate-2 z-50" 
          : "hover:shadow-md hover:-translate-y-0.5 card-interactive"
      }`}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              {job.jobUrl && (
                <DropdownMenuItem onClick={() => window.open(job.jobUrl, "_blank")}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Job
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <h4 className="font-medium text-sm mb-1 line-clamp-1">{job.jobTitle}</h4>
        <p className="text-xs text-muted-foreground mb-2">{job.companyName}</p>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {job.location}
            </span>
          )}
          {job.salary && (
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              {job.salary}
            </span>
          )}
        </div>

        {/* Tags */}
        {job.tags && job.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {job.tags.slice(0, 3).map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                {tag}
              </Badge>
            ))}
            {job.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                +{job.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {job.appliedAt && (
          <div className="mt-2 pt-2 border-t text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Applied {new Date(job.appliedAt).toLocaleDateString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  Download, 
  Share2, 
  Sparkles, 
  Palette, 
  FileText,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle,
  Target,
  Send,
  MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type PersonalInfo = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
};

type Experience = {
  id: string;
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
  highlights: string[];
};

type Education = {
  id: string;
  school: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  gpa?: string;
  highlights: string[];
};

type Skill = {
  category: string;
  items: string[];
};

type Project = {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  url?: string;
  startDate?: string;
  endDate?: string;
};

type Certification = {
  id: string;
  name: string;
  issuer: string;
  date: string;
  expiryDate?: string;
  credentialId?: string;
  url?: string;
};

type Award = {
  id: string;
  title: string;
  issuer: string;
  date: string;
  description?: string;
};

type Publication = {
  id: string;
  title: string;
  publisher: string;
  date: string;
  url?: string;
  description?: string;
};

type Volunteering = {
  id: string;
  organization: string;
  role: string;
  startDate: string;
  endDate?: string;
  description?: string;
};

export default function ResumeEditor() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("content");
  const [expandedSections, setExpandedSections] = useState<string[]>(["personal", "websites", "summary", "experience", "skills", "projects", "awards", "education", "certifications", "publications", "volunteering"]);
  const [tailorDialogOpen, setTailorDialogOpen] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatMessages, setAiChatMessages] = useState<{role: "user" | "assistant"; content: string}[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const { data: resume, isLoading, refetch } = trpc.resume.get.useQuery(
    { id: parseInt(id!) },
    { enabled: !!id }
  );

  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    fullName: "",
    email: "",
    phone: "",
    location: "",
    linkedinUrl: "",
    portfolioUrl: "",
  });
  const [summary, setSummary] = useState("");
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [education, setEducation] = useState<Education[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [volunteering, setVolunteering] = useState<Volunteering[]>([]);
  const [websiteLinks, setWebsiteLinks] = useState<{linkedin?: string; github?: string; portfolio?: string; twitter?: string}>({});

  useEffect(() => {
    if (resume) {
      if (resume.personalInfo) {
        setPersonalInfo(resume.personalInfo as PersonalInfo);
      }
      if (resume.summary) {
        setSummary(resume.summary);
      }
      // Handle experience data - backend uses 'experience' not 'experiences'
      const expData = (resume as any).experience || (resume as any).experiences;
      if (expData) {
        setExperiences(expData as Experience[]);
      }
      // Handle education data - may come with 'institution' instead of 'school'
      if (resume.education) {
        const eduData = (resume.education as any[]).map((edu: any) => ({
          id: edu.id || String(Math.random()),
          school: edu.school || edu.institution || '',
          degree: edu.degree || '',
          field: edu.field || '',
          startDate: edu.startDate || '',
          endDate: edu.endDate || '',
          gpa: edu.gpa,
          highlights: edu.highlights || [],
        }));
        setEducation(eduData);
      }
      // Handle skills data - may come as object[] with 'name' field
      if (resume.skills) {
        const skillsData = resume.skills as any[];
        if (skillsData.length > 0 && typeof skillsData[0] === 'object' && 'name' in skillsData[0]) {
          // Convert from {name, category} format to {category, items} format
          const categoryMap: Record<string, string[]> = {};
          skillsData.forEach((s: any) => {
            const cat = s.category || 'General';
            if (!categoryMap[cat]) categoryMap[cat] = [];
            categoryMap[cat].push(s.name);
          });
          const converted = Object.entries(categoryMap).map(([category, items]) => ({ category, items }));
          setSkills(converted);
        } else {
          setSkills(skillsData as Skill[]);
        }
      }
    }
  }, [resume]);

  const updateResumeMutation = trpc.resume.update.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Resume saved");
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

  const handleSave = () => {
    if (!id) return;
    updateResumeMutation.mutate({
      id: parseInt(id),
      personalInfo,
      summary,
      experience: experiences, // Backend uses 'experience' not 'experiences'
      education,
      skills,
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const addExperience = () => {
    setExperiences([
      ...experiences,
      {
        id: Date.now().toString(),
        company: "",
        title: "",
        location: "",
        startDate: "",
        endDate: "",
        current: false,
        description: "",
        highlights: [],
      },
    ]);
  };

  const removeExperience = (id: string) => {
    setExperiences(experiences.filter(e => e.id !== id));
  };

  const updateExperience = (id: string, field: keyof Experience, value: any) => {
    setExperiences(experiences.map(e => 
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  const addEducation = () => {
    setEducation([
      ...education,
      {
        id: Date.now().toString(),
        school: "",
        degree: "",
        field: "",
        startDate: "",
        endDate: "",
        gpa: "",
        highlights: [],
      },
    ]);
  };

  const removeEducation = (id: string) => {
    setEducation(education.filter(e => e.id !== id));
  };

  const updateEducationItem = (id: string, field: keyof Education, value: any) => {
    setEducation(education.map(e => 
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/resume-builder")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold">{resume?.title || "Resume"}</h1>
              <p className="text-xs text-muted-foreground">
                {resume?.type === "base" ? "Base Resume" : "Tailored Resume"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setTailorDialogOpen(true)}>
              <Target className="w-4 h-4 mr-2" />
              Tailor for Job
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast.info("Share feature coming soon")}>
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => id && generatePdfMutation.mutate({ id: parseInt(id) })}
              disabled={generatePdfMutation.isPending}
            >
              <Download className="w-4 h-4 mr-2" />
              {generatePdfMutation.isPending ? "Generating..." : "Download"}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={updateResumeMutation.isPending}>
              {updateResumeMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-56px)]">
        {/* Left Panel - Editor */}
        <div className="w-1/2 border-r overflow-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <div className="sticky top-0 bg-background border-b px-4">
              <TabsList className="h-12">
                <TabsTrigger value="content" className="gap-2">
                  <FileText className="w-4 h-4" />
                  Resume Content
                </TabsTrigger>
                <TabsTrigger value="ai" className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  AI Assistant
                </TabsTrigger>
                <TabsTrigger value="design" className="gap-2">
                  <Palette className="w-4 h-4" />
                  Design
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="content" className="p-4 space-y-4 m-0">
              {/* Personal Information */}
              <SectionCard
                title="Personal Information"
                expanded={expandedSections.includes("personal")}
                onToggle={() => toggleSection("personal")}
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Full Name</Label>
                    <Input
                      value={personalInfo.fullName}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, fullName: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={personalInfo.email}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={personalInfo.phone}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                  <div>
                    <Label>Location</Label>
                    <Input
                      value={personalInfo.location}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, location: e.target.value })}
                      placeholder="San Francisco, CA"
                    />
                  </div>
                  <div>
                    <Label>LinkedIn URL</Label>
                    <Input
                      value={personalInfo.linkedinUrl || ""}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, linkedinUrl: e.target.value })}
                      placeholder="linkedin.com/in/johndoe"
                    />
                  </div>
                </div>
              </SectionCard>

              {/* Professional Summary */}
              <SectionCard
                title="Professional Summary"
                expanded={expandedSections.includes("summary")}
                onToggle={() => toggleSection("summary")}
              >
                <div>
                  <Textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Write a brief summary of your professional background and career goals..."
                    rows={4}
                  />
                  <Button variant="ghost" size="sm" className="mt-2 text-primary">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate with AI
                  </Button>
                </div>
              </SectionCard>

              {/* Work Experience */}
              <SectionCard
                title="Work Experience"
                expanded={expandedSections.includes("experience")}
                onToggle={() => toggleSection("experience")}
                action={
                  <Button variant="ghost" size="sm" onClick={addExperience}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                }
              >
                <div className="space-y-4">
                  {experiences.map((exp, index) => (
                    <div key={exp.id} className="border rounded-lg p-4 relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeExperience(exp.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Job Title</Label>
                          <Input
                            value={exp.title}
                            onChange={(e) => updateExperience(exp.id, "title", e.target.value)}
                            placeholder="Software Engineer"
                          />
                        </div>
                        <div>
                          <Label>Company</Label>
                          <Input
                            value={exp.company}
                            onChange={(e) => updateExperience(exp.id, "company", e.target.value)}
                            placeholder="Google"
                          />
                        </div>
                        <div>
                          <Label>Start Date</Label>
                          <Input
                            type="month"
                            value={exp.startDate}
                            onChange={(e) => updateExperience(exp.id, "startDate", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>End Date</Label>
                          <Input
                            type="month"
                            value={exp.endDate}
                            onChange={(e) => updateExperience(exp.id, "endDate", e.target.value)}
                            disabled={exp.current}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>Description</Label>
                          <Textarea
                            value={exp.description}
                            onChange={(e) => updateExperience(exp.id, "description", e.target.value)}
                            placeholder="Describe your responsibilities and achievements..."
                            rows={3}
                          />
                          <Button variant="ghost" size="sm" className="mt-2 text-primary">
                            <Sparkles className="w-4 h-4 mr-2" />
                            Enhance with AI
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {experiences.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No work experience added yet</p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={addExperience}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add Experience
                      </Button>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Education */}
              <SectionCard
                title="Education"
                expanded={expandedSections.includes("education")}
                onToggle={() => toggleSection("education")}
                action={
                  <Button variant="ghost" size="sm" onClick={addEducation}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                }
              >
                <div className="space-y-4">
                  {education.map((edu) => (
                    <div key={edu.id} className="border rounded-lg p-4 relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeEducation(edu.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <Label>School</Label>
                          <Input
                            value={edu.school}
                            onChange={(e) => updateEducationItem(edu.id, "school", e.target.value)}
                            placeholder="Stanford University"
                          />
                        </div>
                        <div>
                          <Label>Degree</Label>
                          <Input
                            value={edu.degree}
                            onChange={(e) => updateEducationItem(edu.id, "degree", e.target.value)}
                            placeholder="Bachelor of Science"
                          />
                        </div>
                        <div>
                          <Label>Field of Study</Label>
                          <Input
                            value={edu.field}
                            onChange={(e) => updateEducationItem(edu.id, "field", e.target.value)}
                            placeholder="Computer Science"
                          />
                        </div>
                        <div>
                          <Label>Start Date</Label>
                          <Input
                            type="month"
                            value={edu.startDate}
                            onChange={(e) => updateEducationItem(edu.id, "startDate", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>End Date</Label>
                          <Input
                            type="month"
                            value={edu.endDate}
                            onChange={(e) => updateEducationItem(edu.id, "endDate", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {education.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No education added yet</p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={addEducation}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add Education
                      </Button>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Skills */}
              <SectionCard
                title="Skills & Interests"
                expanded={expandedSections.includes("skills")}
                onToggle={() => toggleSection("skills")}
              >
                <div>
                  <Textarea
                    placeholder="Enter your skills separated by commas (e.g., JavaScript, React, Node.js, Python)"
                    rows={3}
                  />
                  <Button variant="ghost" size="sm" className="mt-2 text-primary">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Suggest Skills
                  </Button>
                </div>
              </SectionCard>

              {/* Projects */}
              <SectionCard
                title="Projects"
                expanded={expandedSections.includes("projects")}
                onToggle={() => toggleSection("projects")}
                action={
                  <Button variant="ghost" size="sm" onClick={() => setProjects([...projects, { id: Date.now().toString(), name: "", description: "", technologies: [] }])}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                }
              >
                <div className="space-y-4">
                  {projects.map((project) => (
                    <div key={project.id} className="border rounded-lg p-4 relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setProjects(projects.filter(p => p.id !== project.id))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <Label>Project Name</Label>
                          <Input
                            value={project.name}
                            onChange={(e) => setProjects(projects.map(p => p.id === project.id ? { ...p, name: e.target.value } : p))}
                            placeholder="My Awesome Project"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>Description</Label>
                          <Textarea
                            value={project.description}
                            onChange={(e) => setProjects(projects.map(p => p.id === project.id ? { ...p, description: e.target.value } : p))}
                            placeholder="Describe your project..."
                            rows={2}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>Technologies</Label>
                          <Input
                            value={project.technologies.join(", ")}
                            onChange={(e) => setProjects(projects.map(p => p.id === project.id ? { ...p, technologies: e.target.value.split(", ") } : p))}
                            placeholder="React, Node.js, PostgreSQL"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>Project URL</Label>
                          <Input
                            value={project.url || ""}
                            onChange={(e) => setProjects(projects.map(p => p.id === project.id ? { ...p, url: e.target.value } : p))}
                            placeholder="https://github.com/..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {projects.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No projects added yet</p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => setProjects([{ id: Date.now().toString(), name: "", description: "", technologies: [] }])}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add Project
                      </Button>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Awards & Achievements */}
              <SectionCard
                title="Awards & Achievements"
                expanded={expandedSections.includes("awards")}
                onToggle={() => toggleSection("awards")}
                action={
                  <Button variant="ghost" size="sm" onClick={() => setAwards([...awards, { id: Date.now().toString(), title: "", issuer: "", date: "" }])}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                }
              >
                <div className="space-y-4">
                  {awards.map((award) => (
                    <div key={award.id} className="border rounded-lg p-4 relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setAwards(awards.filter(a => a.id !== award.id))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <Label>Award Title</Label>
                          <Input
                            value={award.title}
                            onChange={(e) => setAwards(awards.map(a => a.id === award.id ? { ...a, title: e.target.value } : a))}
                            placeholder="Best Innovation Award"
                          />
                        </div>
                        <div>
                          <Label>Issuer</Label>
                          <Input
                            value={award.issuer}
                            onChange={(e) => setAwards(awards.map(a => a.id === award.id ? { ...a, issuer: e.target.value } : a))}
                            placeholder="Company or Organization"
                          />
                        </div>
                        <div>
                          <Label>Date</Label>
                          <Input
                            type="month"
                            value={award.date}
                            onChange={(e) => setAwards(awards.map(a => a.id === award.id ? { ...a, date: e.target.value } : a))}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {awards.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No awards added yet</p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => setAwards([{ id: Date.now().toString(), title: "", issuer: "", date: "" }])}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add Award
                      </Button>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Certifications */}
              <SectionCard
                title="Certifications"
                expanded={expandedSections.includes("certifications")}
                onToggle={() => toggleSection("certifications")}
                action={
                  <Button variant="ghost" size="sm" onClick={() => setCertifications([...certifications, { id: Date.now().toString(), name: "", issuer: "", date: "" }])}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                }
              >
                <div className="space-y-4">
                  {certifications.map((cert) => (
                    <div key={cert.id} className="border rounded-lg p-4 relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setCertifications(certifications.filter(c => c.id !== cert.id))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <Label>Certification Name</Label>
                          <Input
                            value={cert.name}
                            onChange={(e) => setCertifications(certifications.map(c => c.id === cert.id ? { ...c, name: e.target.value } : c))}
                            placeholder="AWS Solutions Architect"
                          />
                        </div>
                        <div>
                          <Label>Issuer</Label>
                          <Input
                            value={cert.issuer}
                            onChange={(e) => setCertifications(certifications.map(c => c.id === cert.id ? { ...c, issuer: e.target.value } : c))}
                            placeholder="Amazon Web Services"
                          />
                        </div>
                        <div>
                          <Label>Date</Label>
                          <Input
                            type="month"
                            value={cert.date}
                            onChange={(e) => setCertifications(certifications.map(c => c.id === cert.id ? { ...c, date: e.target.value } : c))}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>Credential ID</Label>
                          <Input
                            value={cert.credentialId || ""}
                            onChange={(e) => setCertifications(certifications.map(c => c.id === cert.id ? { ...c, credentialId: e.target.value } : c))}
                            placeholder="ABC123XYZ"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {certifications.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No certifications added yet</p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => setCertifications([{ id: Date.now().toString(), name: "", issuer: "", date: "" }])}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add Certification
                      </Button>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Publications */}
              <SectionCard
                title="Publications"
                expanded={expandedSections.includes("publications")}
                onToggle={() => toggleSection("publications")}
                action={
                  <Button variant="ghost" size="sm" onClick={() => setPublications([...publications, { id: Date.now().toString(), title: "", publisher: "", date: "" }])}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                }
              >
                <div className="space-y-4">
                  {publications.map((pub) => (
                    <div key={pub.id} className="border rounded-lg p-4 relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setPublications(publications.filter(p => p.id !== pub.id))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <Label>Title</Label>
                          <Input
                            value={pub.title}
                            onChange={(e) => setPublications(publications.map(p => p.id === pub.id ? { ...p, title: e.target.value } : p))}
                            placeholder="Research Paper Title"
                          />
                        </div>
                        <div>
                          <Label>Publisher</Label>
                          <Input
                            value={pub.publisher}
                            onChange={(e) => setPublications(publications.map(p => p.id === pub.id ? { ...p, publisher: e.target.value } : p))}
                            placeholder="Journal or Conference"
                          />
                        </div>
                        <div>
                          <Label>Date</Label>
                          <Input
                            type="month"
                            value={pub.date}
                            onChange={(e) => setPublications(publications.map(p => p.id === pub.id ? { ...p, date: e.target.value } : p))}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>URL</Label>
                          <Input
                            value={pub.url || ""}
                            onChange={(e) => setPublications(publications.map(p => p.id === pub.id ? { ...p, url: e.target.value } : p))}
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {publications.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No publications added yet</p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => setPublications([{ id: Date.now().toString(), title: "", publisher: "", date: "" }])}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add Publication
                      </Button>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Volunteering */}
              <SectionCard
                title="Volunteering"
                expanded={expandedSections.includes("volunteering")}
                onToggle={() => toggleSection("volunteering")}
                action={
                  <Button variant="ghost" size="sm" onClick={() => setVolunteering([...volunteering, { id: Date.now().toString(), organization: "", role: "", startDate: "" }])}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                }
              >
                <div className="space-y-4">
                  {volunteering.map((vol) => (
                    <div key={vol.id} className="border rounded-lg p-4 relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setVolunteering(volunteering.filter(v => v.id !== vol.id))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <Label>Organization</Label>
                          <Input
                            value={vol.organization}
                            onChange={(e) => setVolunteering(volunteering.map(v => v.id === vol.id ? { ...v, organization: e.target.value } : v))}
                            placeholder="Non-profit Organization"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>Role</Label>
                          <Input
                            value={vol.role}
                            onChange={(e) => setVolunteering(volunteering.map(v => v.id === vol.id ? { ...v, role: e.target.value } : v))}
                            placeholder="Volunteer Coordinator"
                          />
                        </div>
                        <div>
                          <Label>Start Date</Label>
                          <Input
                            type="month"
                            value={vol.startDate}
                            onChange={(e) => setVolunteering(volunteering.map(v => v.id === vol.id ? { ...v, startDate: e.target.value } : v))}
                          />
                        </div>
                        <div>
                          <Label>End Date</Label>
                          <Input
                            type="month"
                            value={vol.endDate || ""}
                            onChange={(e) => setVolunteering(volunteering.map(v => v.id === vol.id ? { ...v, endDate: e.target.value } : v))}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>Description</Label>
                          <Textarea
                            value={vol.description || ""}
                            onChange={(e) => setVolunteering(volunteering.map(v => v.id === vol.id ? { ...v, description: e.target.value } : v))}
                            placeholder="Describe your volunteer work..."
                            rows={2}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {volunteering.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No volunteering experience added yet</p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => setVolunteering([{ id: Date.now().toString(), organization: "", role: "", startDate: "" }])}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add Volunteering
                      </Button>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Add New Section Button */}
              <Button variant="outline" className="w-full mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Add New Section
              </Button>
            </TabsContent>

            <TabsContent value="ai" className="p-4 m-0 h-[calc(100vh-120px)] flex flex-col">
              {/* Quick Actions */}
              <Card className="mb-4">
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="justify-start">
                      <Sparkles className="w-3 h-3 mr-2" />
                      Generate Summary
                    </Button>
                    <Button variant="outline" size="sm" className="justify-start">
                      <Sparkles className="w-3 h-3 mr-2" />
                      Enhance Experience
                    </Button>
                    <Button variant="outline" size="sm" className="justify-start">
                      <Sparkles className="w-3 h-3 mr-2" />
                      Suggest Skills
                    </Button>
                    <Button variant="outline" size="sm" className="justify-start" onClick={() => setTailorDialogOpen(true)}>
                      <Target className="w-3 h-3 mr-2" />
                      Tailor for Job
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* AI Chat */}
              <Card className="flex-1 flex flex-col">
                <CardHeader className="py-3 border-b">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    Ask AI Assistant
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0">
                  {/* Chat Messages */}
                  <div className="flex-1 overflow-auto p-4 space-y-4">
                    {aiChatMessages.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">Ask me anything about your resume!</p>
                        <p className="text-xs mt-1">e.g., "How can I improve my summary?"</p>
                      </div>
                    ) : (
                      aiChatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg px-4 py-2 ${
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                    {isAiLoading && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-lg px-4 py-2">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-100" />
                            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-200" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Chat Input */}
                  <div className="border-t p-4">
                    <div className="flex gap-2">
                      <Input
                        value={aiChatInput}
                        onChange={(e) => setAiChatInput(e.target.value)}
                        placeholder="Ask about your resume..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && aiChatInput.trim()) {
                            e.preventDefault();
                            setAiChatMessages([...aiChatMessages, { role: "user", content: aiChatInput }]);
                            setAiChatInput("");
                            setIsAiLoading(true);
                            // Simulate AI response
                            setTimeout(() => {
                              setAiChatMessages(prev => [...prev, {
                                role: "assistant",
                                content: "I can help you improve your resume! Based on your current content, here are some suggestions:\n\n1. Add more quantifiable achievements\n2. Use stronger action verbs\n3. Tailor your skills section to match job requirements"
                              }]);
                              setIsAiLoading(false);
                            }, 1500);
                          }
                        }}
                      />
                      <Button
                        size="icon"
                        disabled={!aiChatInput.trim() || isAiLoading}
                        onClick={() => {
                          if (aiChatInput.trim()) {
                            setAiChatMessages([...aiChatMessages, { role: "user", content: aiChatInput }]);
                            setAiChatInput("");
                            setIsAiLoading(true);
                            setTimeout(() => {
                              setAiChatMessages(prev => [...prev, {
                                role: "assistant",
                                content: "I can help you improve your resume! Based on your current content, here are some suggestions:\n\n1. Add more quantifiable achievements\n2. Use stronger action verbs\n3. Tailor your skills section to match job requirements"
                              }]);
                              setIsAiLoading(false);
                            }, 1500);
                          }
                        }}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="design" className="p-4 m-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Palette className="w-5 h-5 text-primary" />
                    Design Options
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Template</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {["Classic", "Modern", "Minimal"].map((template) => (
                        <button
                          key={template}
                          className="border rounded-lg p-4 text-center hover:border-primary transition-colors"
                        >
                          <div className="w-full h-16 bg-muted rounded mb-2" />
                          <span className="text-sm">{template}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Primary Color</Label>
                    <div className="flex gap-2 mt-2">
                      {["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444"].map((color) => (
                        <button
                          key={color}
                          className="w-8 h-8 rounded-full border-2 border-transparent hover:border-foreground transition-colors"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Font</Label>
                    <select className="w-full mt-2 border rounded-lg p-2">
                      <option>Inter</option>
                      <option>Roboto</option>
                      <option>Open Sans</option>
                      <option>Lato</option>
                    </select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Panel - Preview & Score */}
        <div className="w-1/2 flex flex-col">
          {/* Resume Score */}
          <div className="border-b p-4 bg-background">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Resume Analysis Score</h3>
              <span className="text-2xl font-bold text-primary">{resume?.score || 0}/100</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden mb-4">
              <div 
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${resume?.score || 0}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <ScoreItem label="Summary" score={80} />
              <ScoreItem label="Experience" score={75} />
              <ScoreItem label="Skills" score={60} />
              <ScoreItem label="Formatting" score={90} />
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 overflow-auto p-4 bg-muted/50">
            <div className="bg-white shadow-lg rounded-lg p-8 max-w-[600px] mx-auto min-h-[800px]">
              {/* Resume Preview */}
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold">{personalInfo.fullName || "Your Name"}</h1>
                <p className="text-muted-foreground">
                  {[personalInfo.email, personalInfo.phone, personalInfo.location]
                    .filter(Boolean)
                    .join(" • ") || "Contact Information"}
                </p>
              </div>

              {summary && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold border-b pb-1 mb-2">Professional Summary</h2>
                  <p className="text-sm text-muted-foreground">{summary}</p>
                </div>
              )}

              {experiences.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold border-b pb-1 mb-2">Work Experience</h2>
                  {experiences.map((exp) => (
                    <div key={exp.id} className="mb-4">
                      <div className="flex justify-between">
                        <h3 className="font-medium">{exp.title || "Job Title"}</h3>
                        <span className="text-sm text-muted-foreground">
                          {exp.startDate} - {exp.current ? "Present" : exp.endDate}
                        </span>
                      </div>
                      <p className="text-sm text-primary">{exp.company || "Company"}</p>
                      <p className="text-sm text-muted-foreground mt-1">{exp.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {education.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold border-b pb-1 mb-2">Education</h2>
                  {education.map((edu) => (
                    <div key={edu.id} className="mb-4">
                      <div className="flex justify-between">
                        <h3 className="font-medium">{edu.school || "School"}</h3>
                        <span className="text-sm text-muted-foreground">
                          {edu.startDate} - {edu.endDate}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {edu.degree} in {edu.field}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tailor for Job Dialog */}
      <Dialog open={tailorDialogOpen} onOpenChange={setTailorDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Tailor Resume for Job
            </DialogTitle>
            <DialogDescription>
              Paste the job description to optimize your resume for this specific role
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Job Description</Label>
              <Textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the full job description here..."
                rows={8}
                className="mt-2"
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>AI will analyze the job description and:</strong>
              </p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1">
                <li>• Identify key skills and requirements</li>
                <li>• Suggest relevant keywords to include</li>
                <li>• Recommend experience highlights to emphasize</li>
                <li>• Optimize your summary for the role</li>
              </ul>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTailorDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!jobDescription.trim()) {
                  toast.error("Please paste a job description");
                  return;
                }
                toast.success("Analyzing job description...");
                setTailorDialogOpen(false);
                // TODO: Implement AI tailoring
              }}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Tailor Resume
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionCard({
  title,
  expanded,
  onToggle,
  action,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <Collapsible open={expanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {title}
              </CardTitle>
              {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function ScoreItem({ label, score }: { label: string; score: number }) {
  const isGood = score >= 70;
  return (
    <div className="flex items-center gap-2">
      {isGood ? (
        <CheckCircle className="w-4 h-4 text-green-500" />
      ) : (
        <AlertCircle className="w-4 h-4 text-yellow-500" />
      )}
      <span>{label}</span>
      <span className="ml-auto font-medium">{score}%</span>
    </div>
  );
}

import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Construction, ArrowLeft, Bell } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

const pageInfo: Record<string, { title: string; description: string; icon?: string }> = {
  "/jobs": {
    title: "Jobs Board",
    description: "Browse and search for job opportunities from top companies. Get personalized job recommendations based on your profile.",
  },
  "/documents": {
    title: "My Documents",
    description: "Store and manage all your job search documents in one place - resumes, cover letters, and more.",
  },
  "/linkedin": {
    title: "LinkedIn Tools",
    description: "Optimize your LinkedIn profile with AI-powered suggestions for headlines, about sections, and posts.",
  },
  "/cover-letters": {
    title: "Cover Letters",
    description: "Generate personalized cover letters tailored to each job application using AI.",
  },
  "/personal-brand": {
    title: "Personal Brand Statement",
    description: "Create a compelling personal brand statement that showcases your unique value proposition.",
  },
  "/email-writer": {
    title: "Email Writer",
    description: "Craft professional emails for networking, follow-ups, and job applications with AI assistance.",
  },
  "/elevator-pitch": {
    title: "Elevator Pitch",
    description: "Develop a concise and impactful elevator pitch for networking events and interviews.",
  },
  "/linkedin-post": {
    title: "LinkedIn Post Generator",
    description: "Create engaging LinkedIn posts to build your professional presence and attract recruiters.",
  },
  "/suggest-feature": {
    title: "Suggest a Feature",
    description: "Have an idea to improve JobH? We'd love to hear your suggestions!",
  },
  "/report-bug": {
    title: "Report a Bug",
    description: "Found something not working correctly? Help us improve by reporting the issue.",
  },
};

export default function ComingSoon() {
  const [location] = useLocation();
  const info = pageInfo[location] || {
    title: "Coming Soon",
    description: "This feature is currently under development.",
  };

  const handleNotifyMe = () => {
    toast.success("We'll notify you when this feature is ready!");
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="border-dashed border-2">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Construction className="w-10 h-10 text-primary" />
            </div>
            
            <h1 className="text-2xl font-semibold mb-2">{info.title}</h1>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              {info.description}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/dashboard">
                <Button variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <Button onClick={handleNotifyMe}>
                <Bell className="w-4 h-4 mr-2" />
                Notify Me When Ready
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-8">
              We're working hard to bring you this feature. Stay tuned!
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

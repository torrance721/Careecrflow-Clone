import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// JobH Pages (Main Entry)
import Dashboard from "./pages/Dashboard";
import JobTracker from "./pages/JobTracker";
import LinkedInHeadline from "./pages/LinkedInHeadline";
import LinkedInAbout from "./pages/LinkedInAbout";
import LinkedInImport from "./pages/LinkedInImport";
import CoverLetterGenerator from "./pages/CoverLetterGenerator";
import EmailWriter from "./pages/EmailWriter";
import ElevatorPitch from "./pages/ElevatorPitch";
import JobsBoard from "./pages/JobsBoard";
import ResumeBuilder from "./pages/ResumeBuilder";
import ResumeEditor from "./pages/ResumeEditor";
import ComingSoon from "./pages/ComingSoon";

// UHired Pages (Legacy - accessible via /uhired prefix)
import Home from "./pages/Home";
import Onboarding from "./pages/Onboarding";
import MatchRoles from "./pages/MatchRoles";
import MockHistory from "./pages/MockHistory";
import Assessment from "./pages/Assessment";
import InterviewModeSelect from "./pages/InterviewModeSelect";
import TopicPractice from "./pages/TopicPractice";
import FullInterview from "./pages/FullInterview";
import ReActDemo from "./pages/ReActDemo";
import Bookmarks from "./pages/Bookmarks";
import TestLogin from "./pages/TestLogin";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";

function Router() {
  return (
    <Switch>
      {/* Test Login Route (Development Only) */}
      <Route path={"/test-login"} component={TestLogin} />
      
      {/* Analytics Dashboard (Admin Only) */}
      <Route path={"/analytics"} component={AnalyticsDashboard} />
      
      {/* JobH Routes (Main Entry) */}
      <Route path={"/"} component={Dashboard} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/job-tracker"} component={JobTracker} />
      <Route path={"/linkedin-headline"} component={LinkedInHeadline} />
      <Route path={"/linkedin-about"} component={LinkedInAbout} />
      <Route path={"/linkedin-import"} component={LinkedInImport} />
      <Route path={"/resume-builder"} component={ResumeBuilder} />
      <Route path={"/resume-editor/:id"} component={ResumeEditor} />
      
      {/* AI Toolbox Routes */}
      <Route path={"/cover-letters"} component={CoverLetterGenerator} />
      <Route path={"/email-writer"} component={EmailWriter} />
      <Route path={"/elevator-pitch"} component={ElevatorPitch} />
      
      {/* Jobs Board */}
      <Route path={"/jobs"} component={JobsBoard} />
      <Route path={"/documents"} component={ComingSoon} />
      <Route path={"/linkedin"} component={ComingSoon} />
      
      <Route path={"/personal-brand"} component={ComingSoon} />
      <Route path={"/linkedin-post"} component={ComingSoon} />
      <Route path={"/suggest-feature"} component={ComingSoon} />
      <Route path={"/report-bug"} component={ComingSoon} />
      
      {/* UHired Routes (Legacy - accessible via /uhired prefix) */}
      <Route path={"/uhired"} component={Onboarding} />
      <Route path={"/uhired/home"} component={Home} />
      <Route path={"/uhired/match-roles"} component={MatchRoles} />
      <Route path={"/uhired/mock-history/:id"} component={MockHistory} />
      <Route path={"/uhired/assessment/:reportId"} component={Assessment} />
      <Route path={"/uhired/interview-mode"} component={InterviewModeSelect} />
      <Route path={"/uhired/topic-practice"} component={TopicPractice} />
      <Route path={"/uhired/full-interview"} component={FullInterview} />
      <Route path={"/uhired/react-demo"} component={ReActDemo} />
      <Route path={"/uhired/bookmarks"} component={Bookmarks} />
      
      {/* Mock Interview Routes (accessible from both JobH and UHired) */}
      <Route path={"/mock-interviews"} component={InterviewModeSelect} />
      <Route path={"/topic-practice"} component={TopicPractice} />
      <Route path={"/full-interview"} component={FullInterview} />
      
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

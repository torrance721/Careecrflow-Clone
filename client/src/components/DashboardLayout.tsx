import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import PaywallModal from "@/components/PaywallModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl, isGoogleOAuthConfigured } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { 
  Home, 
  Briefcase, 
  FileText, 
  Kanban, 
  MessageSquare, 
  Folder, 
  Sparkles, 
  Lightbulb, 
  Bug,
  LogOut,
  ChevronDown,
  Crown
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type MenuItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  badge?: string;
  children?: Array<{ label: string; path: string }>;
};

const menuItems: MenuItem[] = [
  { icon: Home, label: "Home", path: "/dashboard" },
  { icon: Briefcase, label: "Jobs", path: "/jobs", badge: "Beta" },
  { icon: FileText, label: "Resume Builder", path: "/resume-builder" },
  { icon: Kanban, label: "Job Tracker", path: "/job-tracker" },
  { icon: MessageSquare, label: "Mock Interviews", path: "/mock-interviews" },
  // Hidden: Application Materials
  // {
  //   icon: Folder,
  //   label: "Application Materials",
  //   path: "#",
  //   children: [
  //     { label: "My Documents", path: "/documents" },
  //     { label: "LinkedIn Import", path: "/linkedin-import" },
  //     { label: "Cover Letters", path: "/cover-letters" },
  //   ]
  // },
  // Hidden: AI Toolbox
  // {
  //   icon: Sparkles,
  //   label: "AI Toolbox",
  //   path: "#",
  //   children: [
  //     { label: "Personal Brand Statement", path: "/personal-brand" },
  //     { label: "Email Writer", path: "/email-writer" },
  //     { label: "Elevator Pitch", path: "/elevator-pitch" },
  //     { label: "LinkedIn Headline", path: "/linkedin-headline" },
  //     { label: "LinkedIn About", path: "/linkedin-about" },
  //     { label: "LinkedIn Post", path: "/linkedin-post" },
  //   ]
  // },
];

const bottomMenuItems = [
  { icon: Lightbulb, label: "Suggest a Feature", path: "/suggest-feature" },
  { icon: Bug, label: "Report a bug", path: "/report-bug" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
            <span className="text-3xl font-bold text-primary">C</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Welcome to Careerflow
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Sign in to access your personalized job search dashboard
            </p>
          </div>
          {isGoogleOAuthConfigured() ? (
            <Button
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
              size="lg"
              className="w-full shadow-lg hover:shadow-xl transition-all h-12"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>
          ) : (
            <Button
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
              size="lg"
              className="w-full shadow-lg hover:shadow-xl transition-all"
            >
              Sign in
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const toggleMenu = (label: string) => {
    setOpenMenus(prev => 
      prev.includes(label) 
        ? prev.filter(l => l !== label)
        : [...prev, label]
    );
  };

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b">
            <div className="flex items-center justify-between px-4 w-full">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">JH</span>
                </div>
                {!isCollapsed && (
                  <span className="font-semibold text-lg">JobH</span>
                )}
              </div>
              {!isCollapsed && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-yellow-500 hover:bg-yellow-600 text-white border-0 text-xs"
                  onClick={() => setIsPaywallOpen(true)}
                >
                  <Crown className="w-3 h-3 mr-1" />
                  Upgrade
                </Button>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 px-2 py-2">
            <SidebarMenu>
              {menuItems.map(item => {
                const isActive = location === item.path;
                const hasChildren = item.children && item.children.length > 0;
                const isOpen = openMenus.includes(item.label);

                if (hasChildren) {
                  return (
                    <Collapsible
                      key={item.label}
                      open={isOpen}
                      onOpenChange={() => toggleMenu(item.label)}
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            tooltip={item.label}
                            className="h-10"
                          >
                            <item.icon className="h-4 w-4" />
                            <span className="flex-1">{item.label}</span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.children?.map(child => (
                              <SidebarMenuSubItem key={child.path}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={location === child.path}
                                >
                                  <Link href={child.path}>
                                    {child.label}
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className="h-10"
                    >
                      <Link href={item.path}>
                        <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            <div className="mt-auto pt-4 border-t">
              <SidebarMenu>
                {bottomMenuItems.map(item => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.label}
                      className="h-9 text-muted-foreground"
                    >
                      <Link href={item.path}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </div>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-8 w-8 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary text-primary-foreground">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <span className="font-semibold">JobH</span>
            </div>
          </div>
        )}
        <main className="flex-1 overflow-auto">{children}</main>
      </SidebarInset>
      
      {/* Paywall Modal */}
      <PaywallModal 
        isOpen={isPaywallOpen} 
        onClose={() => setIsPaywallOpen(false)} 
      />
    </>
  );
}

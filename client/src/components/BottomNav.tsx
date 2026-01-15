import { MessageSquare, FileText, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface BottomNavProps {
  activeTab: "mock-interview" | "mock-questions" | "ai-interview";
  onTabChange: (tab: "mock-interview" | "mock-questions" | "ai-interview") => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const { t } = useLanguage();

  const tabs = [
    { id: "mock-interview" as const, labelKey: "nav.mockInterview", icon: MessageSquare },
    { id: "mock-questions" as const, labelKey: "nav.mockQuestions", icon: FileText },
    { id: "ai-interview" as const, labelKey: "nav.aiInterview", icon: Bot },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border safe-area-bottom md:relative md:border-t-0 md:bg-transparent">
      <div className="flex justify-around items-center py-2 px-4 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors min-w-[80px]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
              <span className={cn(
                "text-xs font-medium",
                isActive && "font-semibold"
              )}>
                {t(tab.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

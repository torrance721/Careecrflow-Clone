import { ChevronUp, ChevronDown, MessageCircle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { InterviewHistory } from "../../../drizzle/schema";

interface InterviewHistoryCardProps {
  interview: InterviewHistory;
  onClick?: () => void;
}

export function InterviewHistoryCard({ interview, onClick }: InterviewHistoryCardProps) {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

  const truncateQuestion = (question: string, maxLength: number = 50) => {
    if (question.length <= maxLength) return question;
    return question.substring(0, maxLength) + "...";
  };

  return (
    <div
      className={cn(
        "bg-card rounded-2xl border-l-4 border-l-primary/30 shadow-sm transition-all cursor-pointer hover:shadow-md",
        expanded && "border-l-primary"
      )}
      onClick={onClick}
    >
      <div
        className="p-4 flex items-center justify-between"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-primary font-medium text-sm">
              {formatDate(interview.date)}
            </span>
            <div className="flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-full">
              <MessageCircle className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-medium text-primary">
                Score {interview.score}/10
              </span>
            </div>
          </div>
          <p className="text-foreground text-sm truncate">
            {truncateQuestion(interview.question)}
          </p>
        </div>
        <button className="p-1 hover:bg-accent rounded-full transition-colors ml-2">
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      </div>

      {expanded && interview.aiFeedback && (
        <div className="px-4 pb-4 pt-0 border-t border-border/50">
          <div className="mt-3 space-y-2 text-sm">
            {interview.aiFeedback.scoreReason && (
              <div>
                <span className="font-medium text-muted-foreground">Score reason: </span>
                <span className="text-foreground">{interview.aiFeedback.scoreReason}</span>
              </div>
            )}
            {interview.aiFeedback.capabilityAssessed && (
              <div>
                <span className="font-medium text-muted-foreground">Capability: </span>
                <span className="text-foreground">{interview.aiFeedback.capabilityAssessed}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

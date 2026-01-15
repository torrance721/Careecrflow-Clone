import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";

interface TypingPlaceholderProps {
  prefix?: string;
  phrases: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  className?: string;
  onPhraseChange?: (phrase: string) => void;
}

export interface TypingPlaceholderRef {
  getCurrentPhrase: () => string;
  stop: () => void;
}

export const TypingPlaceholder = forwardRef<TypingPlaceholderRef, TypingPlaceholderProps>(({
  prefix = "",
  phrases,
  typingSpeed = 80,
  deletingSpeed = 40,
  pauseDuration = 2000,
  className = "",
  onPhraseChange,
}, ref) => {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isStopped, setIsStopped] = useState(false);

  const currentPhrase = phrases[currentPhraseIndex];

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    getCurrentPhrase: () => currentPhrase,
    stop: () => setIsStopped(true),
  }));

  // Notify parent when phrase changes
  useEffect(() => {
    if (onPhraseChange && displayedText === currentPhrase) {
      onPhraseChange(currentPhrase);
    }
  }, [displayedText, currentPhrase, onPhraseChange]);

  const tick = useCallback(() => {
    if (isPaused || isStopped) return;

    if (isDeleting) {
      // Deleting characters
      if (displayedText.length > 0) {
        setDisplayedText(displayedText.slice(0, -1));
      } else {
        // Move to next phrase
        setIsDeleting(false);
        setCurrentPhraseIndex((prev) => (prev + 1) % phrases.length);
      }
    } else {
      // Typing characters
      if (displayedText.length < currentPhrase.length) {
        setDisplayedText(currentPhrase.slice(0, displayedText.length + 1));
      } else {
        // Finished typing, pause then start deleting
        setIsPaused(true);
        setTimeout(() => {
          setIsPaused(false);
          setIsDeleting(true);
        }, pauseDuration);
      }
    }
  }, [displayedText, isDeleting, isPaused, isStopped, currentPhrase, phrases.length, pauseDuration]);

  useEffect(() => {
    if (isStopped) return;
    const speed = isDeleting ? deletingSpeed : typingSpeed;
    const timer = setTimeout(tick, speed);
    return () => clearTimeout(timer);
  }, [tick, isDeleting, typingSpeed, deletingSpeed, isStopped]);

  return (
    <span className={className}>
      {prefix}
      <span>{displayedText}</span>
      <span className="animate-pulse text-primary">|</span>
    </span>
  );
});

TypingPlaceholder.displayName = "TypingPlaceholder";

// Career examples for UHired - dream jobs at top companies
export const CAREER_EXAMPLES = [
  "Product Manager at Meta",
  "Data Analyst at Google",
  "Software Engineer at Amazon",
  "UX Designer at Apple",
  "Cloud Architect at Microsoft",
  "Full-Stack Engineer at Stripe",
  "Growth Manager at Airbnb",
  "ML Engineer at Tesla",
  "Backend Developer at ByteDance",
  "Frontend Engineer at Shopify",
];

export const CAREER_EXAMPLES_ZH = [
  "Meta 产品经理",
  "Google 数据分析师",
  "Amazon 软件工程师",
  "Apple UX 设计师",
  "Microsoft 云架构师",
  "Stripe 全栈工程师",
  "Airbnb 增长经理",
  "Tesla 机器学习工程师",
  "字节跳动后端开发",
  "Shopify 前端工程师",
  "阿里巴巴产品经理",
  "腾讯游戏策划",
];

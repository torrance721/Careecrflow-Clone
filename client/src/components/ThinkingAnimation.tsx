/**
 * ThinkingAnimation Component
 * 
 * Displays a "Thinking..." style animation with letters appearing one by one.
 */

import { useEffect, useState } from 'react';

interface ThinkingAnimationProps {
  text?: string;
  className?: string;
}

export function ThinkingAnimation({ 
  text = "Thinking", 
  className = "" 
}: ThinkingAnimationProps) {
  const [visibleChars, setVisibleChars] = useState(0);
  const [dots, setDots] = useState(0);
  const fullText = text;
  
  // Animate letters appearing one by one
  useEffect(() => {
    if (visibleChars < fullText.length) {
      const timer = setTimeout(() => {
        setVisibleChars(prev => prev + 1);
      }, 80); // 80ms per character
      return () => clearTimeout(timer);
    }
  }, [visibleChars, fullText.length]);

  // Animate dots after text is complete
  useEffect(() => {
    if (visibleChars >= fullText.length) {
      const timer = setInterval(() => {
        setDots(prev => (prev + 1) % 4);
      }, 400); // 400ms per dot cycle
      return () => clearInterval(timer);
    }
  }, [visibleChars, fullText.length]);

  return (
    <span className={`inline-flex items-baseline ${className}`}>
      {fullText.split('').map((char, index) => (
        <span
          key={index}
          className={`transition-all duration-200 ${
            index < visibleChars 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-2'
          }`}
          style={{
            transitionDelay: `${index * 30}ms`
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
      <span className="inline-flex w-6">
        {visibleChars >= fullText.length && (
          <>
            <span className={`transition-opacity duration-150 ${dots >= 1 ? 'opacity-100' : 'opacity-0'}`}>.</span>
            <span className={`transition-opacity duration-150 ${dots >= 2 ? 'opacity-100' : 'opacity-0'}`}>.</span>
            <span className={`transition-opacity duration-150 ${dots >= 3 ? 'opacity-100' : 'opacity-0'}`}>.</span>
          </>
        )}
      </span>
    </span>
  );
}

/**
 * BouncingDots Component
 * 
 * Simple bouncing dots animation for loading states.
 */
export function BouncingDots({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex gap-1 ${className}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"
          style={{
            animationDelay: `${i * 150}ms`,
            animationDuration: '600ms'
          }}
        />
      ))}
    </span>
  );
}

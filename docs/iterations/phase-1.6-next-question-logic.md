# Phase 1.6: Next Question Logic with Context and Knowledge Base

**Date**: 2026-01-05
**Version**: 0a5d458a

## Summary

This iteration implements intelligent next question generation that considers user response quality, conversation history, and knowledge base data to create a more natural and adaptive interview experience.

---

## What Was Implemented

### 1. Next Question Generator Agent (`server/agents/nextQuestionGenerator.ts`)

A sophisticated agent that decides what question to ask next based on multiple factors:

#### Response Quality Analysis
- **brief**: Less than 50 words or lacks specific details → triggers follow-up
- **adequate**: Has some details but could go deeper → may continue or probe
- **comprehensive**: Detailed with specific examples → move to new topic

#### Question Types
| Type | When Used | Example |
|------|-----------|---------|
| `follow_up` | User's answer was brief or unclear | "Could you elaborate on that?" |
| `new_topic` | Current topic well covered | "Let's talk about your technical skills" |
| `deep_dive` | User mentioned something interesting | "You mentioned X, tell me more" |
| `closing` | Final question of interview | "Any questions for us?" |

#### Knowledge Base Integration
- Retrieves relevant questions from KB that haven't been covered
- Filters out topics already discussed
- Uses KB interview tips to guide questioning style

### 2. Topic Tracking
Automatically detects and tracks topics covered in conversation:
- Technical skills
- Project experience
- Teamwork/collaboration
- Leadership
- Problem-solving
- Communication

### 3. Enhanced sendMessage Endpoint
Updated to use the new intelligent question generator with fallback to basic LLM if needed.

---

## Files Created

| File | Purpose |
|------|---------|
| `server/agents/nextQuestionGenerator.ts` | Intelligent next question generation |

## Files Modified

| File | Change |
|------|--------|
| `server/agents/index.ts` | Export nextQuestionGenerator functions |
| `server/routers.ts` | Update sendMessage to use generateInterviewResponse |

---

## API Signatures

### NextQuestionContext
```typescript
interface NextQuestionContext {
  job: {
    company: string;
    position: string;
    description: string;
  };
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  currentQuestion: number;
  totalQuestions: number;
  knowledgeBaseId?: number;
  language: 'en' | 'zh';
  userResponse: string;
}
```

### NextQuestionDecision
```typescript
interface NextQuestionDecision {
  questionType: 'follow_up' | 'new_topic' | 'deep_dive' | 'closing';
  question: string;
  reasoning: string;
  topicsCovered: string[];
  suggestedNextTopics: string[];
}
```

---

## Flow Diagram

```
User sends response
        │
        ▼
┌─────────────────────────────────┐
│  Analyze Response Quality       │
│  - Length check                 │
│  - Specific examples?           │
│  - Needs follow-up?             │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│  Get Knowledge Base Context     │
│  - Relevant questions           │
│  - Interview tips               │
│  - Filter covered topics        │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│  Decide Question Type           │
│  - follow_up if brief           │
│  - new_topic if covered         │
│  - deep_dive if interesting     │
│  - closing if final             │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│  Generate Natural Response      │
│  - Acknowledge user's answer    │
│  - Transition to next question  │
│  - Maintain friendly tone       │
└─────────────────────────────────┘
        │
        ▼
Return AI message to user
```

---

## Example Behavior

### Scenario 1: Brief Response
**User**: "I worked on a web app"
**Analysis**: quality=brief, needsFollowUp=true
**Decision**: follow_up
**AI**: "That sounds interesting! Could you tell me more about what technologies you used and what your specific role was on that project?"

### Scenario 2: Comprehensive Response
**User**: "I led a team of 5 engineers to build a real-time analytics dashboard using React, Node.js, and PostgreSQL. We reduced page load time by 60% and increased user engagement by 40%..."
**Analysis**: quality=comprehensive, hasSpecificExamples=true
**Decision**: new_topic
**AI**: "Impressive results! The impact you achieved shows strong technical and leadership skills. Let's shift gears - can you tell me about a time when you had to deal with a challenging stakeholder or difficult feedback?"

### Scenario 3: With Knowledge Base
**KB Question**: "How do you handle ambiguity in product requirements?"
**Decision**: Uses KB question as inspiration for next topic
**AI**: "Great, thanks for sharing that. At [Company], product managers often deal with ambiguous requirements. How do you typically approach situations where the requirements aren't fully defined?"

---

## Testing Notes

- TypeScript compilation: ✅ No errors
- All existing tests: ✅ Passing
- Manual testing needed:
  - [ ] Test with brief responses
  - [ ] Test with comprehensive responses
  - [ ] Test topic tracking across conversation
  - [ ] Test knowledge base integration

---

## Next Steps

1. **Phase 2**: Implement Agent Loop auto-iteration system
   - Persona Generator
   - Interview Simulator
   - Feedback Generator
   - Prompt Optimizer

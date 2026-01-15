# Phase 1.4-1.5: Knowledge Base Integration & Hint System

**Date**: 2026-01-05
**Version**: ad66a0f2

## Summary

This iteration implements two major features:
1. **Knowledge Base Integration** - Connects the interview knowledge base to the Onboarding flow
2. **Hint System** - Allows users to get contextual hints during mock interviews

---

## Phase 1.4: Knowledge Base Integration

### What Was Implemented

1. **New tRPC Endpoint**: `onboarding.startInterviewWithKnowledge`
   - Accepts parsed company/position from Job Input Parser
   - Queries knowledge base for company-specific interview data
   - Generates enhanced System Prompt with real interview insights
   - Falls back to basic prompt if knowledge base unavailable

2. **Enhanced System Prompt Generation**
   - Uses `generateInterviewSystemPrompt()` from interviewGenerator
   - Includes interview tips from knowledge base
   - Adds user context (resume, situation)

### Files Modified

| File | Change |
|------|--------|
| `server/routers.ts` | Added `startInterviewWithKnowledge` mutation |

### API Signature

```typescript
startInterviewWithKnowledge: protectedProcedure
  .input(z.object({
    dreamJob: z.string(),
    resumeText: z.string().optional(),
    situation: z.string(),
    language: z.string().default("en"),
    knowledgeBaseId: z.number().optional(),
    parsedCompany: z.string().optional(),
    parsedPosition: z.string().optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    // Returns: { sessionId, knowledgeBaseId, interviewTips }
  })
```

---

## Phase 1.5: Hint System

### What Was Implemented

1. **Hint Generator Agent** (`server/agents/hintGenerator.ts`)
   - Generates contextual hints based on current question
   - Uses conversation history for context
   - Integrates with knowledge base for related questions
   - Supports 5 hint types: clarification, structure, example, keyword, approach

2. **Hint tRPC Endpoint** (`mockInterview.getHint`)
   - Accepts session ID, current question, user response
   - Returns hint with reasoning and type

3. **HintButton Component** (`client/src/components/HintButton.tsx`)
   - Sheet-based UI that opens from the right
   - Shows hint type badge with icon
   - Displays hint, reasoning, and related questions
   - Supports both English and Chinese

4. **MockInterview Integration**
   - Added HintButton to the input area
   - Shows "Stuck? Click for a hint" prompt

### Files Created

| File | Purpose |
|------|---------|
| `server/agents/hintGenerator.ts` | Hint generation logic |
| `client/src/components/HintButton.tsx` | Hint UI component |

### Files Modified

| File | Change |
|------|--------|
| `server/agents/index.ts` | Export hintGenerator |
| `server/routers.ts` | Add getHint endpoint, import generateHint |
| `client/src/pages/MockInterview.tsx` | Add HintButton to UI |

### Hint Types

| Type | Description | Icon |
|------|-------------|------|
| `clarification` | Help understand the question | Info |
| `structure` | Suggest answer structure (STAR) | List |
| `example` | Suggest giving examples | Target |
| `keyword` | Provide keywords/concepts | Tag |
| `approach` | Suggest thinking direction | Compass |

### API Signature

```typescript
getHint: protectedProcedure
  .input(z.object({
    sessionId: z.number(),
    currentQuestion: z.string(),
    userResponse: z.string().optional(),
    language: z.enum(['en', 'zh']).optional().default('en'),
  }))
  .mutation(async ({ ctx, input }) => {
    // Returns: { hint, reasoning, hintType, relatedQuestion? }
  })
```

---

## User Experience Flow

```
User in Mock Interview
        │
        ▼
Sees "Get Hint" button
        │
        ▼
Clicks button → Sheet opens
        │
        ▼
System generates hint based on:
- Current question
- User's partial response
- Conversation history
- Knowledge base (if available)
        │
        ▼
User sees:
- Hint type badge
- Main hint content
- Reasoning explanation
- Related interview question (if from KB)
        │
        ▼
User can request another hint
```

---

## Testing Notes

- TypeScript compilation: ✅ No errors
- All existing tests: ✅ Passing
- Manual testing needed:
  - [ ] Test hint generation with various question types
  - [ ] Test knowledge base integration in hints
  - [ ] Test bilingual support

---

## Next Steps

1. **Phase 1.6**: Implement Next Question logic with context + knowledge base
2. **Phase 2**: Agent Loop auto-iteration system

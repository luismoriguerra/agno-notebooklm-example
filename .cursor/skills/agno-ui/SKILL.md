---
name: agno-ui
description: Build and customize Agent UI applications for AgentOS. Use when creating chat interfaces, customizing components, connecting to AgentOS backends, handling streaming responses, or working with agent-ui repository patterns. Covers Next.js, TypeScript, Tailwind CSS, and Zustand state management.
---

# Agno UI Development

Build and customize Agent UI — the modern chat interface for AgentOS built with Next.js, Tailwind CSS, TypeScript, and Zustand.

Repo: https://github.com/agno-agi/agent-ui

## Quick Start

### Installation

```bash
# Automatic (recommended)
npx create-agent-ui@latest

# Manual
git clone https://github.com/agno-agi/agent-ui.git
cd agent-ui
pnpm install
pnpm dev
```

App runs at `http://localhost:3000`. Default AgentOS endpoint: `http://localhost:7777`.

### Prerequisites

A running AgentOS instance is required. See the [agno-development skill](../agno-development/SKILL.md) for creating agents with `AgentOS`.

## Project Structure

```
src/
├── api/
│   ├── os.ts              # API functions (getAgents, getSessions, etc.)
│   └── routes.ts           # APIRoutes URL builders
├── app/
│   ├── layout.tsx          # Root layout with ThemeProvider
│   ├── page.tsx            # Main page composing Sidebar + ChatArea
│   └── globals.css         # Tailwind base styles
├── components/
│   ├── chat/
│   │   ├── ChatArea/       # Chat interface (Messages, ChatInput, ScrollToBottom)
│   │   └── Sidebar/        # Sidebar (EntitySelector, Sessions, AuthToken, ModeSelector)
│   └── ui/                 # Reusable primitives (shadcn/ui: Button, Dialog, Select, etc.)
├── hooks/
│   ├── useAIStreamHandler.tsx   # Main streaming orchestrator
│   ├── useAIResponseStream.tsx  # Low-level stream reader
│   ├── useChatActions.ts        # Message add/focus helpers
│   └── useSessionLoader.tsx     # Session loading logic
├── lib/
│   ├── audio.ts                 # Audio playback utilities
│   ├── constructEndpointUrl.ts  # URL normalization
│   ├── modelProvider.ts         # Model provider icon mapping
│   └── utils.ts                 # cn(), getJsonMarkdown()
├── store.ts               # Zustand global state
└── types/
    └── os.ts              # All TypeScript interfaces
```

## Tech Stack

| Package | Version | Purpose |
|---------|---------|---------|
| next | 15.x | React framework (App Router) |
| zustand | 5.x | Global state management |
| nuqs | 2.x | URL query state (`?agent=`, `?session=`) |
| framer-motion | 12.x | Animations and transitions |
| react-markdown | 9.x | Markdown rendering in messages |
| sonner | 1.x | Toast notifications |
| lucide-react | 0.474+ | Icons |
| @radix-ui/* | Various | Accessible UI primitives |
| tailwindcss | 3.x | Utility-first CSS |
| use-stick-to-bottom | 1.x | Auto-scroll in chat |

## Core Types

All types are defined in `src/types/os.ts`.

### ChatMessage

```typescript
interface ChatMessage {
  role: 'user' | 'agent' | 'system' | 'tool'
  content: string
  streamingError?: boolean
  created_at: number
  tool_calls?: ToolCall[]
  extra_data?: {
    reasoning_steps?: ReasoningSteps[]
    reasoning_messages?: ReasoningMessage[]
    references?: ReferenceData[]
  }
  images?: ImageData[]
  videos?: VideoData[]
  audio?: AudioData[]
  response_audio?: ResponseAudio
}
```

### RunEvent (streaming events)

```typescript
enum RunEvent {
  // Agent events
  RunStarted = 'RunStarted',
  RunContent = 'RunContent',
  RunCompleted = 'RunCompleted',
  RunError = 'RunError',
  ToolCallStarted = 'ToolCallStarted',
  ToolCallCompleted = 'ToolCallCompleted',
  ReasoningStarted = 'ReasoningStarted',
  ReasoningStep = 'ReasoningStep',
  ReasoningCompleted = 'ReasoningCompleted',
  // Team events (prefixed with Team*)
  TeamRunStarted = 'TeamRunStarted',
  TeamRunContent = 'TeamRunContent',
  TeamRunCompleted = 'TeamRunCompleted',
  TeamRunError = 'TeamRunError',
  TeamToolCallStarted = 'TeamToolCallStarted',
  TeamToolCallCompleted = 'TeamToolCallCompleted',
  TeamReasoningStarted = 'TeamReasoningStarted',
  TeamReasoningStep = 'TeamReasoningStep',
  TeamReasoningCompleted = 'TeamReasoningCompleted',
}
```

### Key Interfaces

```typescript
interface AgentDetails {
  id: string
  name?: string
  db_id?: string
  model?: Model
}

interface TeamDetails {
  id: string
  name?: string
  db_id?: string
  model?: Model
}

interface SessionEntry {
  session_id: string
  session_name: string
  created_at: number
  updated_at?: number
}

interface ToolCall {
  role: 'user' | 'tool' | 'system' | 'assistant'
  content: string | null
  tool_call_id: string
  tool_name: string
  tool_args: Record<string, string>
  tool_call_error: boolean
  metrics: { time: number }
  created_at: number
}
```

## API Routes

All routes are defined in `src/api/routes.ts`. Always use `APIRoutes` helpers:

```typescript
import { APIRoutes } from '@/api/routes'

APIRoutes.Status(endpoint)                       // GET /health
APIRoutes.GetAgents(endpoint)                    // GET /agents
APIRoutes.AgentRun(endpoint)                     // POST /agents/{agent_id}/runs
APIRoutes.GetSessions(endpoint)                  // GET /sessions
APIRoutes.GetSession(endpoint, sessionId)        // GET /sessions/{id}/runs
APIRoutes.DeleteSession(endpoint, sessionId)     // DELETE /sessions/{id}
APIRoutes.GetTeams(endpoint)                     // GET /teams
APIRoutes.TeamRun(endpoint, teamId)              // POST /teams/{id}/runs
```

### API Functions

From `src/api/os.ts`:

```typescript
import { getAgentsAPI, getStatusAPI, getAllSessionsAPI, getSessionAPI } from '@/api/os'

// All accept optional authToken as last parameter
const agents = await getAgentsAPI(endpoint, authToken)
const status = await getStatusAPI(endpoint, authToken)
const sessions = await getAllSessionsAPI(endpoint, 'agent', agentId, dbId, authToken)
const session = await getSessionAPI(endpoint, 'agent', sessionId, dbId, authToken)
```

### Authentication Headers

Always use the shared pattern:

```typescript
const createHeaders = (authToken?: string): HeadersInit => {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }
  return headers
}
```

## State Management (Zustand)

Global state is in `src/store.ts` using Zustand with `persist` middleware.

### Key State Slices

```typescript
// Endpoint configuration
selectedEndpoint: string        // Default: 'http://localhost:7777'
authToken: string               // Bearer token

// Agent/Team data
agents: AgentDetails[]
teams: TeamDetails[]
mode: 'agent' | 'team'

// Chat state
messages: ChatMessage[]
isStreaming: boolean
streamingErrorMessage: string

// Session state
sessionsData: SessionEntry[] | null
isSessionsLoading: boolean

// Connection status
isEndpointActive: boolean
isEndpointLoading: boolean
```

### Usage Pattern

```typescript
import { useStore } from '@/store'

function MyComponent() {
  const selectedEndpoint = useStore((state) => state.selectedEndpoint)
  const setSelectedEndpoint = useStore((state) => state.setSelectedEndpoint)
  const messages = useStore((state) => state.messages)
  const setMessages = useStore((state) => state.setMessages)
}
```

### Persisted State

Only `selectedEndpoint` is persisted to localStorage under key `endpoint-storage`. Other state resets on page reload.

## Streaming Implementation

The streaming flow is handled by two hooks:

1. **`useAIStreamHandler`** - High-level orchestrator that processes events
2. **`useAIResponseStream`** - Low-level fetch + stream reader

### Sending a Message

```typescript
import useAIChatStreamHandler from '@/hooks/useAIStreamHandler'

const { handleStreamResponse } = useAIChatStreamHandler()

// Send text
await handleStreamResponse("Hello, agent!")

// Send with files (FormData)
const formData = new FormData()
formData.append('message', 'Analyze this image')
formData.append('file', file)
await handleStreamResponse(formData)
```

### Event Handling Flow

```
User sends message
  → Add user message to store
  → Add empty agent message placeholder
  → POST to /agents/{id}/runs with FormData (stream=true)
  → Process events:
      RunStarted        → Set session_id, create session entry
      RunContent         → Append content to agent message
      ToolCallStarted    → Add tool call to agent message
      ToolCallCompleted  → Update tool call result
      ReasoningStep      → Append reasoning steps
      RunCompleted       → Finalize message content
      RunError           → Set error state on message
```

### URL Query State

Agent, team, and session IDs are managed via URL query params using `nuqs`:

```typescript
import { useQueryState } from 'nuqs'

const [agentId] = useQueryState('agent')
const [teamId] = useQueryState('team')
const [sessionId, setSessionId] = useQueryState('session')
```

## Component Architecture

### Page Layout

```
page.tsx
├── Sidebar
│   ├── Endpoint URL (editable)
│   ├── ModeSelector (agent/team toggle)
│   ├── EntitySelector (agent/team dropdown)
│   ├── AuthToken (optional token input)
│   ├── NewChatButton
│   └── Sessions (session history list)
└── ChatArea
    ├── MessageArea
    │   └── Messages
    │       ├── ChatBlankState (empty state)
    │       └── MessageItem (per-message)
    │           ├── Markdown content
    │           ├── ToolCall cards
    │           ├── ReasoningSteps
    │           ├── References
    │           └── Multimedia (images, video, audio)
    ├── ScrollToBottom
    └── ChatInput
        └── Textarea + Send button
```

### Adding a New Component

1. Create component in appropriate directory under `src/components/`
2. Import types from `@/types/os`
3. Access state via `useStore` from `@/store`
4. Use `cn()` from `@/lib/utils` for conditional classes
5. Use shadcn/ui primitives from `@/components/ui/`

## Adding New Features

### Custom Tool Call Visualization

```typescript
// In your MessageItem or a new ToolCallCard component
import { ToolCall } from '@/types/os'

function CustomToolCallCard({ tool }: { tool: ToolCall }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="font-semibold">{tool.tool_name}</div>
      <pre className="text-sm">{JSON.stringify(tool.tool_args, null, 2)}</pre>
      {tool.content && <div className="mt-2">{tool.content}</div>}
      {tool.tool_call_error && (
        <div className="text-red-500">Error in tool call</div>
      )}
    </div>
  )
}
```

### New Message Type

To handle new content types in the message stream, extend the `onChunk` handler in `useAIStreamHandler.tsx`:

```typescript
// Inside handleStreamResponse → onChunk callback
else if (chunk.event === RunEvent.RunContent) {
  // Add custom content handling here
  if (chunk.content_type === 'your_custom_type') {
    // Handle custom content
  }
}
```

### Theme Customization

The app uses `next-themes` for dark/light mode. Customize in `globals.css`:

```css
@layer base {
  :root {
    /* Light theme variables */
  }
  .dark {
    /* Dark theme variables */
  }
}
```

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_OS_SECURITY_KEY=your_auth_token  # Auto-loaded as auth token
```

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|---|---|
| Hardcoding `http://localhost:7777` | Use `selectedEndpoint` from store |
| Direct `fetch()` to AgentOS | Use `APIRoutes` helpers + `createHeaders()` |
| Component-local global state | Use Zustand store (`useStore`) |
| Missing event types in stream handler | Handle all `RunEvent` variants |
| Forgetting auth token in requests | Pass `authToken` to all API functions |
| Not handling `streamingError` | Check `message.streamingError` for retry UI |

## Additional Resources

- For component details: [references/COMPONENTS.md](references/COMPONENTS.md)
- For streaming deep dive: [references/STREAMING-API.md](references/STREAMING-API.md)
- Agent UI repo: https://github.com/agno-agi/agent-ui
- AgentOS docs: https://docs.agno.com/agent-os/creating-your-first-os
- Agno development skill: [../agno-development/SKILL.md](../agno-development/SKILL.md)

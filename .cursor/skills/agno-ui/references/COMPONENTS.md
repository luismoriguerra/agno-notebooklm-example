# Agent UI Component Reference

Detailed reference for all Agent UI components, their props, and customization patterns.

## Component Hierarchy

```
page.tsx (src/app/page.tsx)
├── Sidebar (src/components/chat/Sidebar/Sidebar.tsx)
│   ├── Endpoint URL editor
│   ├── ModeSelector.tsx          # agent/team toggle
│   ├── EntitySelector.tsx        # agent/team dropdown
│   ├── AuthToken.tsx             # auth token input
│   ├── NewChatButton.tsx         # create new session
│   └── Sessions/                 # session history list
└── ChatArea (src/components/chat/ChatArea/ChatArea.tsx)
    ├── MessageArea.tsx           # scrollable message container
    │   └── Messages/Messages.tsx
    │       ├── ChatBlankState.tsx # empty state UI
    │       ├── MessageItem.tsx   # individual message
    │       │   └── Multimedia/   # images, video, audio
    │       └── AgentThinkingLoader.tsx
    ├── ScrollToBottom.tsx        # auto-scroll button
    └── ChatInput/               # message input area
```

## Sidebar Components

### Sidebar.tsx

Main sidebar container. Handles endpoint configuration, agent/team selection, and session management.

Key behaviors:
- Fetches agents/teams when endpoint changes
- Manages endpoint URL editing inline
- Toggles between agent and team modes
- Lists and manages chat sessions

### ModeSelector.tsx

Toggle between `agent` and `team` mode. Updates `store.mode`.

```typescript
// Store interaction
const mode = useStore((state) => state.mode)
const setMode = useStore((state) => state.setMode)
```

### EntitySelector.tsx

Dropdown to select an agent or team. Uses `@radix-ui/react-select`. Reads from `store.agents` or `store.teams` based on current mode.

URL state managed via `nuqs`:
```typescript
const [agentId, setAgentId] = useQueryState('agent')
const [teamId, setTeamId] = useQueryState('team')
```

### AuthToken.tsx

Optional input for Bearer authentication token. Stores in `store.authToken`. Supports loading from `NEXT_PUBLIC_OS_SECURITY_KEY` env var.

### NewChatButton.tsx

Clears current session and messages. Resets URL query params.

### Sessions/

Displays session history for the selected agent/team. Each session item shows:
- Session name (first message text)
- Created timestamp
- Delete action

## ChatArea Components

### ChatArea.tsx

Container that combines MessageArea + ChatInput. Wraps with `useStickToBottom` for auto-scrolling.

```typescript
// src/components/chat/ChatArea/ChatArea.tsx
export default function ChatArea() {
  return (
    <div className="flex h-full flex-col">
      <MessageArea />
      <ChatInput />
    </div>
  )
}
```

### MessageArea.tsx

Scrollable container for messages. Uses `use-stick-to-bottom` to auto-scroll as new content streams in. Contains `ScrollToBottom` button for manual scroll.

### Messages.tsx

Renders the message list. Handles:
- Empty state via `ChatBlankState`
- Iterating over `store.messages`
- Rendering each `MessageItem`
- Showing `AgentThinkingLoader` during streaming

### MessageItem.tsx

Renders a single message. Handles both `user` and `agent` roles with different styling.

Agent messages render:
1. **Markdown content** via `react-markdown` with `remark-gfm` and `rehype-raw`
2. **Tool calls** as expandable cards
3. **Reasoning steps** if `extra_data.reasoning_steps` exists
4. **References** if `extra_data.references` exists
5. **Multimedia** (images, videos, audio)
6. **Streaming error** indicator with retry

### ChatBlankState.tsx

Shown when no messages exist. Displays:
- Connection status indicator
- Suggested prompts
- Agent/team information

### AgentThinkingLoader.tsx

Animated loading indicator shown while the agent is processing (before first content arrives).

### ScrollToBottom.tsx

Floating button that appears when user scrolls up. Uses `useStickToBottom` context to determine visibility.

## UI Primitives (shadcn/ui)

All in `src/components/ui/`. Based on Radix UI + Tailwind CSS.

| Component | File | Radix Primitive |
|-----------|------|----------------|
| Button | `button.tsx` | Slot |
| Dialog | `dialog.tsx` | @radix-ui/react-dialog |
| Select | `select.tsx` | @radix-ui/react-select |
| Skeleton | `skeleton.tsx` | None (pure CSS) |
| Sonner | `sonner.tsx` | sonner (toast) |
| Textarea | `textarea.tsx` | None (native) |
| Tooltip | `tooltip/` | @radix-ui/react-tooltip |
| Typography | `typography/` | None |
| Icons | `icon/` | Custom SVG icons |

### Button Variants

```typescript
import { Button } from '@/components/ui/button'

<Button variant="default">Primary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
<Button size="sm">Small</Button>
<Button size="icon">Icon only</Button>
```

### Using cn() for Conditional Classes

```typescript
import { cn } from '@/lib/utils'

<div className={cn(
  "base-classes",
  isActive && "active-classes",
  variant === "error" && "text-red-500"
)}>
```

## Multimedia Components

Located in `src/components/chat/ChatArea/Messages/Multimedia/`.

### Image Rendering

Images from `ChatMessage.images` are rendered with:
- Revised prompt display
- Click-to-expand functionality
- Responsive sizing

### Video Rendering

Videos from `ChatMessage.videos` support:
- URL-based video playback
- ETA display for generation

### Audio Rendering

Audio from `ChatMessage.audio` and `ChatMessage.response_audio`:
- Base64 audio playback
- Transcript display
- Uses utilities from `src/lib/audio.ts`

## Customization Patterns

### Adding a New Sidebar Section

1. Create component in `src/components/chat/Sidebar/`
2. Import and add to `Sidebar.tsx`
3. Access store state as needed

```typescript
// src/components/chat/Sidebar/MySection.tsx
import { useStore } from '@/store'

export function MySection() {
  const selectedEndpoint = useStore((state) => state.selectedEndpoint)
  return (
    <div className="border-t px-4 py-3">
      <h3 className="text-sm font-medium">My Section</h3>
      {/* content */}
    </div>
  )
}
```

### Adding a New Message Renderer

Extend `MessageItem.tsx` to handle new content types:

```typescript
// Inside MessageItem render
{message.role === 'agent' && (
  <>
    {/* Existing: markdown, tool calls, reasoning */}
    
    {/* New: custom content */}
    {message.extra_data?.myCustomData && (
      <MyCustomRenderer data={message.extra_data.myCustomData} />
    )}
  </>
)}
```

### Custom Tool Call Card

Replace default tool call rendering:

```typescript
function ToolCallCard({ tool }: { tool: ToolCall }) {
  const isError = tool.tool_call_error
  const isComplete = tool.content !== null

  return (
    <div className={cn(
      "rounded-lg border p-3 my-2",
      isError && "border-red-500 bg-red-50",
      isComplete && "border-green-500"
    )}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm">{tool.tool_name}</span>
        {tool.metrics?.time && (
          <span className="text-xs text-muted-foreground">
            {tool.metrics.time.toFixed(1)}s
          </span>
        )}
      </div>
      <pre className="mt-2 text-xs overflow-x-auto">
        {JSON.stringify(tool.tool_args, null, 2)}
      </pre>
      {isComplete && (
        <div className="mt-2 text-sm border-t pt-2">{tool.content}</div>
      )}
    </div>
  )
}
```

### Adding Store State

Extend the store in `src/store.ts`:

```typescript
// Add to Store interface
myCustomState: string
setMyCustomState: (value: string) => void

// Add to create() initializer
myCustomState: '',
setMyCustomState: (myCustomState) => set(() => ({ myCustomState })),

// If it should persist, add to partialize:
partialize: (state) => ({
  selectedEndpoint: state.selectedEndpoint,
  myCustomState: state.myCustomState,  // add here
}),
```

### Theme Customization

Edit `src/app/globals.css` to customize colors:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    /* ... add custom CSS variables */
  }
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... dark mode overrides */
  }
}
```

Tailwind config is in `tailwind.config.ts` for extending theme values.

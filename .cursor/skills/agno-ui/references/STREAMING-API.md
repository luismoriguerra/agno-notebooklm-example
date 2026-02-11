# Streaming & API Integration Reference

Deep dive into how Agent UI communicates with AgentOS and processes streaming responses.

## Architecture Overview

```
User Input
  │
  ▼
useAIStreamHandler (orchestrator)
  │
  ├── Builds FormData request
  ├── Determines endpoint URL (agent vs team)
  │
  ▼
useAIResponseStream (low-level)
  │
  ├── fetch() with streaming body
  ├── Reads response via ReadableStream
  ├── Parses newline-delimited JSON chunks
  │
  ▼
RunResponse chunks → Event-based processing
  │
  ▼
Zustand store updates → React re-renders
```

## Request Format

Requests are sent as `FormData` (not JSON) to support file uploads:

```typescript
const formData = new FormData()
formData.append('message', 'Hello, agent!')
formData.append('stream', 'true')
formData.append('session_id', sessionId ?? '')

// For file uploads
formData.append('file', fileBlob)

// Headers (no Content-Type - browser sets multipart boundary)
const headers: Record<string, string> = {}
if (authToken) {
  headers['Authorization'] = `Bearer ${authToken}`
}
```

### Endpoint Resolution

```typescript
import { APIRoutes } from '@/api/routes'
import { constructEndpointUrl } from '@/lib/constructEndpointUrl'

const endpointUrl = constructEndpointUrl(selectedEndpoint)

// Agent mode
const runUrl = APIRoutes.AgentRun(endpointUrl).replace('{agent_id}', agentId)
// Result: http://localhost:7777/agents/my-agent/runs

// Team mode
const runUrl = APIRoutes.TeamRun(endpointUrl, teamId)
// Result: http://localhost:7777/teams/my-team/runs
```

## Response Stream Format

AgentOS returns newline-delimited JSON. Each line is a `RunResponse` object:

```json
{"event":"RunStarted","session_id":"abc-123","created_at":1700000000}
{"event":"RunContent","content":"Hello","content_type":"str","created_at":1700000001}
{"event":"ToolCallStarted","tool":{"tool_name":"search","tool_args":{"query":"AI"},"tool_call_id":"tc-1","created_at":1700000002}}
{"event":"ToolCallCompleted","tool":{"tool_name":"search","tool_call_id":"tc-1","content":"Results...","created_at":1700000003}}
{"event":"RunContent","content":"Hello, based on my search...","content_type":"str","created_at":1700000004}
{"event":"RunCompleted","content":"Hello, based on my search, here are the results.","created_at":1700000005}
```

## RunResponse Interface

Each chunk from the stream conforms to:

```typescript
interface RunResponse {
  content?: string | object
  content_type: string
  context?: MessageContext[]
  event: RunEvent
  event_data?: object
  messages?: ModelMessage[]
  metrics?: object
  model?: string
  run_id?: string
  agent_id?: string
  session_id?: string
  tool?: ToolCall              // Single tool call (new format)
  tools?: Array<ToolCall>      // Multiple tool calls (legacy format)
  created_at: number
  extra_data?: AgentExtraData
  images?: ImageData[]
  videos?: VideoData[]
  audio?: AudioData[]
  response_audio?: ResponseAudio
}
```

## Event-by-Event Handling

### RunStarted / TeamRunStarted

First event in a stream. Provides `session_id`.

```typescript
if (chunk.event === RunEvent.RunStarted || chunk.event === RunEvent.TeamRunStarted) {
  // Set session ID in URL
  setSessionId(chunk.session_id as string)
  
  // Create session entry if new
  if (!sessionId || sessionId !== chunk.session_id) {
    const sessionData = {
      session_id: chunk.session_id,
      session_name: formData.get('message') as string,
      created_at: chunk.created_at
    }
    setSessionsData((prev) => [sessionData, ...(prev ?? [])])
  }
}
```

### RunContent / TeamRunContent

Streaming text content. Content is cumulative (each chunk contains the full content so far).

```typescript
if (chunk.event === RunEvent.RunContent || chunk.event === RunEvent.TeamRunContent) {
  setMessages((prevMessages) => {
    const newMessages = [...prevMessages]
    const lastMessage = newMessages[newMessages.length - 1]
    
    if (lastMessage?.role === 'agent' && typeof chunk.content === 'string') {
      // De-duplicate: only append the new part
      const uniqueContent = chunk.content.replace(lastContent, '')
      lastMessage.content += uniqueContent
      lastContent = chunk.content
      
      // Also handle tool calls, reasoning, references, multimedia
      lastMessage.tool_calls = processChunkToolCalls(chunk, lastMessage.tool_calls)
      
      if (chunk.extra_data?.reasoning_steps) {
        lastMessage.extra_data = {
          ...lastMessage.extra_data,
          reasoning_steps: chunk.extra_data.reasoning_steps
        }
      }
      
      if (chunk.images) lastMessage.images = chunk.images
      if (chunk.videos) lastMessage.videos = chunk.videos
      if (chunk.audio) lastMessage.audio = chunk.audio
    }
    // Handle non-string content (JSON objects)
    else if (lastMessage?.role === 'agent' && typeof chunk.content !== 'string' && chunk.content !== null) {
      const jsonBlock = getJsonMarkdown(chunk.content)
      lastMessage.content += jsonBlock
    }
    // Handle audio transcripts
    else if (chunk.response_audio?.transcript) {
      lastMessage.response_audio = {
        ...lastMessage.response_audio,
        transcript: (lastMessage.response_audio?.transcript ?? '') + chunk.response_audio.transcript
      }
    }
    
    return newMessages
  })
}
```

### ToolCallStarted / ToolCallCompleted

Tool calls come as either `chunk.tool` (single, new format) or `chunk.tools` (array, legacy).

```typescript
if (chunk.event === RunEvent.ToolCallStarted || chunk.event === RunEvent.ToolCallCompleted) {
  setMessages((prevMessages) => {
    const newMessages = [...prevMessages]
    const lastMessage = newMessages[newMessages.length - 1]
    if (lastMessage?.role === 'agent') {
      lastMessage.tool_calls = processChunkToolCalls(chunk, lastMessage.tool_calls)
    }
    return newMessages
  })
}
```

### Tool Call Processing

The `processToolCall` function handles deduplication by `tool_call_id`:

```typescript
const processToolCall = (toolCall: ToolCall, prevToolCalls: ToolCall[] = []) => {
  const toolCallId = toolCall.tool_call_id || `${toolCall.tool_name}-${toolCall.created_at}`
  
  // Find existing tool call
  const existingIndex = prevToolCalls.findIndex(
    (tc) => (tc.tool_call_id && tc.tool_call_id === toolCall.tool_call_id) ||
            (!tc.tool_call_id && `${tc.tool_name}-${tc.created_at}` === toolCallId)
  )
  
  if (existingIndex >= 0) {
    // Merge update into existing
    const updated = [...prevToolCalls]
    updated[existingIndex] = { ...updated[existingIndex], ...toolCall }
    return updated
  }
  // Add new tool call
  return [...prevToolCalls, toolCall]
}

// Handles both single and array formats
const processChunkToolCalls = (chunk: RunResponse, existing: ToolCall[] = []) => {
  let updated = [...existing]
  if (chunk.tool) updated = processToolCall(chunk.tool, updated)
  if (chunk.tools?.length) {
    for (const tc of chunk.tools) updated = processToolCall(tc, updated)
  }
  return updated
}
```

### ReasoningStep / ReasoningCompleted

Reasoning steps accumulate during the stream:

```typescript
// ReasoningStep - append incoming steps
if (chunk.event === RunEvent.ReasoningStep) {
  const existingSteps = lastMessage.extra_data?.reasoning_steps ?? []
  const incomingSteps = chunk.extra_data?.reasoning_steps ?? []
  lastMessage.extra_data = {
    ...lastMessage.extra_data,
    reasoning_steps: [...existingSteps, ...incomingSteps]
  }
}

// ReasoningCompleted - replace with final steps
if (chunk.event === RunEvent.ReasoningCompleted) {
  if (chunk.extra_data?.reasoning_steps) {
    lastMessage.extra_data = {
      ...lastMessage.extra_data,
      reasoning_steps: chunk.extra_data.reasoning_steps
    }
  }
}
```

### RunCompleted / TeamRunCompleted

Final event. Replaces message content with final version:

```typescript
if (chunk.event === RunEvent.RunCompleted) {
  // Replace content entirely with final version
  const updatedContent = typeof chunk.content === 'string'
    ? chunk.content
    : JSON.stringify(chunk.content)
  
  return {
    ...message,
    content: updatedContent,
    tool_calls: processChunkToolCalls(chunk, message.tool_calls),
    images: chunk.images ?? message.images,
    videos: chunk.videos ?? message.videos,
    response_audio: chunk.response_audio,
    created_at: chunk.created_at ?? message.created_at,
    extra_data: {
      reasoning_steps: chunk.extra_data?.reasoning_steps ?? message.extra_data?.reasoning_steps,
      references: chunk.extra_data?.references ?? message.extra_data?.references
    }
  }
}
```

### RunError / TeamRunError

Error events set `streamingError: true` on the last agent message:

```typescript
if (chunk.event === RunEvent.RunError) {
  // Mark last agent message as error
  updateMessagesWithErrorState()
  
  // Set error message for display
  const errorContent = (chunk.content as string) || 'Error during run'
  setStreamingErrorMessage(errorContent)
  
  // Remove the failed session from list
  if (newSessionId) {
    setSessionsData((prev) =>
      prev?.filter((s) => s.session_id !== newSessionId) ?? null
    )
  }
}
```

## Low-Level Stream Reader

`useAIResponseStream` handles the raw fetch and stream parsing:

```typescript
const { streamResponse } = useAIResponseStream()

await streamResponse({
  apiUrl: runUrl,
  headers: { Authorization: `Bearer ${token}` },
  requestBody: formData,
  onChunk: (chunk: RunResponse) => { /* handle each event */ },
  onError: (error: Error) => { /* handle fetch/parse errors */ },
  onComplete: () => { /* cleanup */ }
})
```

It reads the response body as a stream, splits by newlines, and parses each line as JSON.

## Session Management

### Loading Sessions

```typescript
import { getAllSessionsAPI } from '@/api/os'

const sessions = await getAllSessionsAPI(
  endpoint,   // AgentOS URL
  'agent',    // or 'team'
  agentId,    // component ID
  dbId,       // database ID from agent details
  authToken   // optional
)
// Returns: { data: SessionEntry[], meta: Pagination }
```

### Loading a Session's Messages

```typescript
import { getSessionAPI } from '@/api/os'

const chatEntries = await getSessionAPI(endpoint, 'agent', sessionId, dbId, authToken)
// Returns: ChatEntry[] - each has message + response
```

`ChatEntry` structure:

```typescript
interface ChatEntry {
  message: {
    role: 'user' | 'system' | 'tool' | 'assistant'
    content: string
    created_at: number
  }
  response: {
    content: string
    tools?: ToolCall[]
    extra_data?: { reasoning_steps?, reasoning_messages?, references? }
    images?: ImageData[]
    videos?: VideoData[]
    audio?: AudioData[]
    response_audio?: { transcript?: string }
    created_at: number
  }
}
```

### Deleting a Session

```typescript
import { deleteSessionAPI } from '@/api/os'

await deleteSessionAPI(endpoint, dbId, sessionId, authToken)
```

## Error Recovery

The stream handler implements a retry pattern for failed messages:

```typescript
// Before sending a new message, check if the last exchange failed
setMessages((prevMessages) => {
  if (prevMessages.length >= 2) {
    const lastMessage = prevMessages[prevMessages.length - 1]
    const secondLast = prevMessages[prevMessages.length - 2]
    
    // If last agent message has error and preceded by user message, remove both
    if (lastMessage.role === 'agent' && lastMessage.streamingError && secondLast.role === 'user') {
      return prevMessages.slice(0, -2)
    }
  }
  return prevMessages
})
```

This allows users to retry by resending the same message - the failed pair is automatically cleaned up.

## Extending the Stream Handler

To add handling for a new event type:

1. Add the event to `RunEvent` enum in `src/types/os.ts`
2. Add a handler branch in `useAIStreamHandler.tsx` inside the `onChunk` callback
3. Update the `ChatMessage` type if new data fields are needed
4. Create UI components to render the new data

```typescript
// Example: handling a hypothetical "RunProgress" event
else if (chunk.event === RunEvent.RunProgress) {
  setMessages((prevMessages) => {
    const newMessages = [...prevMessages]
    const lastMessage = newMessages[newMessages.length - 1]
    if (lastMessage?.role === 'agent') {
      lastMessage.extra_data = {
        ...lastMessage.extra_data,
        progress: chunk.event_data  // your custom data
      }
    }
    return newMessages
  })
}
```

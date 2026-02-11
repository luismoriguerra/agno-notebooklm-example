# Database Schema & Session/Run Model

## Overview

This project uses two sets of database tables:

1. **Custom application tables** — managed by Alembic migrations (`notebooks`, `notebook_sessions`)
2. **Agno framework tables** — managed automatically by the Agno SDK (`agno_*` tables)

---

## Database Diagram

```
┌──────────────────────────┐
│       notebooks          │       CUSTOM TABLES
├──────────────────────────┤       (Alembic-managed)
│ id          PK, bigint   │
│ title       varchar(255) │
│ description text         │
│ instructions text        │
│ created_at  timestamptz  │
│ updated_at  timestamptz  │
└──────────┬───────────────┘
           │ 1:N (ON DELETE CASCADE)
           ▼
┌──────────────────────────┐         ┌────────────────────────────────────┐
│   notebook_sessions      │         │         agno_sessions              │
├──────────────────────────┤         │      AGNO FRAMEWORK TABLE          │
│ id          PK, bigint   │         ├────────────────────────────────────┤
│ notebook_id FK ──────────┘         │ session_id    PK, varchar          │
│ session_id  UNIQUE ──────────────▶ │ session_type  varchar (team/agent) │
│ created_at  timestamptz  │         │ agent_id      varchar              │
└──────────────────────────┘         │ team_id       varchar              │
                                     │ user_id       varchar              │
                                     │ session_data  jsonb                │
                                     │ agent_data    jsonb                │
                                     │ team_data     jsonb                │
                                     │ runs          jsonb (ARRAY)        │
                                     │ summary       jsonb                │
                                     │ created_at    bigint (epoch)       │
                                     │ updated_at    bigint (epoch)       │
                                     └────────────────────────────────────┘

┌─────────────────────────┐    ┌───────────────────────────┐    ┌──────────────────────┐
│   agno_components       │◄───│ agno_component_configs    │◄───│ agno_component_links │
│   (agent/team defs)     │    │  (versioned configs)      │    │ (parent→child links) │
└─────────────────────────┘    └───────────────────────────┘    └──────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  agno_memories   │  │  agno_learnings  │  │  agno_knowledge  │  │   agno_metrics   │
│  (user memories) │  │  (agent lessons) │  │  (RAG docs)      │  │  (usage stats)   │
└──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘
```

---

## Table Descriptions

### Custom Application Tables

| Table | Purpose |
|---|---|
| `notebooks` | Stores user-created notebooks with title, description, and custom instructions for the AI team. |
| `notebook_sessions` | Links an Agno `session_id` to a specific notebook. One notebook can have many sessions. |

### Agno Framework Tables

| Table | Purpose |
|---|---|
| `agno_sessions` | Stores conversation sessions. The `runs` column (JSONB array) holds every run that occurred in the session. |
| `agno_components` | Registry of agents, teams, and workflows with their component IDs and types. |
| `agno_component_configs` | Versioned configuration snapshots for each component. |
| `agno_component_links` | Parent-child relationships between components (e.g., team → member agents). |
| `agno_memories` | Long-term user memories extracted by agents (personalization across sessions). |
| `agno_learnings` | Lessons learned by agents from interactions (agent self-improvement). |
| `agno_knowledge` | RAG knowledge base documents and their metadata. |
| `agno_metrics` | Aggregated usage metrics (run counts, token usage, model usage by day). |
| `agno_eval_runs` | Evaluation/benchmark run results. |
| `agno_schema_versions` | Tracks Agno's internal schema migration version. |

---

## Session vs Run

### Session

A **session** represents an ongoing conversation between a user and the team. It is identified by a unique `session_id` (UUID). A session persists across multiple messages and is stored as a single row in `agno_sessions`.

- Created when the user sends their first message in a new chat.
- The same `session_id` is reused for all follow-up messages in that chat.
- All runs are accumulated in the `runs` JSONB array column.

### Run

A **run** represents a single processing cycle triggered by one user message. Each run has a unique `run_id` (UUID). A single user message can produce **multiple runs**:

1. A **Team-level run** — the team leader receives the user message, decides which member agents to delegate to.
2. One or more **Agent-level runs** — each member agent that the team leader delegates to gets its own run.

### Analogy

| Concept | Analogy |
|---|---|
| Session | A phone call |
| Run | One question-and-answer exchange during the call |
| Team run | The operator routing your question |
| Agent run | The specialist answering your question |

---

## Example: Session Data Flow

Given a session where a user asks 3 questions about books, here is what gets stored:

```
Session: 73ccd158-0e18-4d0e-98c9-c362f3769774
Notebook: #4 ("Books")
Total Runs: 7

User Message 1: "hello"
├── Run 1: Team (NotebookLM) → "Hello! Welcome to NotebookLM!"

User Message 2: "recommend books for a 9yo girl"
├── Run 2: Team (NotebookLM) → decides to delegate to Researcher
├── Run 3: Researcher agent → searches web, returns recommendations
├── Run 4: Team (NotebookLM) → compiles final answer for user

User Message 3: "summarize each book"
├── Run 5: Team (NotebookLM) → delegates to Researcher, then Writer
├── Run 6: Researcher agent → searches web for book summaries
├── Run 7: Writer agent → formats into clean markdown summaries
```

### Run Object Structure

Each run in the `runs` JSONB array contains:

```json
{
  "run_id": "fb02427c-3aeb-48b9-8dc0-131808f3f51a",
  "session_id": "73ccd158-0e18-4d0e-98c9-c362f3769774",
  "team_id": "notebooklm",
  "team_name": "NotebookLM",
  "agent_id": null,
  "agent_name": null,
  "status": "COMPLETED",
  "input": "{\"input_content\": \"...\"}",
  "content": "Hello! Welcome to NotebookLM!...",
  "content_type": "...",
  "messages": [ ... ],
  "member_responses": [ ... ],
  "metrics": { ... },
  "events": [ ... ],
  "model": "...",
  "model_provider": "...",
  "citations": null,
  "created_at": 1770775866
}
```

Key fields:

| Field | Description |
|---|---|
| `run_id` | Unique identifier for this run. |
| `team_id` / `agent_id` | Identifies whether this run was executed by the team leader or a member agent. Team runs have `team_id` set; agent runs have `agent_id` set. |
| `status` | `COMPLETED`, `FAILED`, etc. |
| `input` | The message or delegation instruction that triggered this run. |
| `content` | The final output/response produced by this run. |
| `messages` | Full LLM conversation array (system prompt, user message, assistant response, tool calls, etc.). |
| `metrics` | Token usage, latency, model info. |
| `created_at` | Unix epoch timestamp. |

---

## History Context Parameters

In the team configuration (`notebooklm_team.py`), two parameters control conversation memory:

```python
notebooklm_team = Team(
    ...
    add_history_to_context=True,   # Inject past runs into the prompt
    num_history_runs=5,            # Limit to last 5 runs
)
```

| Parameter | What it does |
|---|---|
| `add_history_to_context=True` | Reads previous runs from the `runs` array in `agno_sessions` and injects them into the team leader's prompt, so it can understand follow-up questions. |
| `num_history_runs=5` | Caps the injected history to the last 5 runs to avoid token bloat. |

**Important distinction:**
- `db=get_postgres_db()` → **persists** runs to the database (storage).
- `add_history_to_context=True` → **reads** stored runs back and **injects them into the prompt** (memory).

Without `add_history_to_context`, the team leader treats every message as isolated, even though old runs are saved in the database.

---

## Querying Session Data

Connect to the database:

```bash
# Via Docker
cd backend && make shell-db

# Or directly
docker compose exec notebooklm-db psql -U ai -d ai
```

Useful queries:

```sql
-- List all sessions
SELECT session_id, session_type, team_id, agent_id, created_at
FROM agno_sessions
ORDER BY created_at DESC;

-- Count runs in a session
SELECT jsonb_array_length(runs) as num_runs
FROM agno_sessions
WHERE session_id = 'your-session-id';

-- Show run summary for a session
SELECT
  r->>'run_id' as run_id,
  r->>'team_id' as team_id,
  r->>'agent_id' as agent_id,
  r->>'status' as status,
  left(r->>'input', 80) as input_truncated,
  left(r->>'content', 100) as content_truncated,
  r->>'created_at' as created_at
FROM agno_sessions,
     jsonb_array_elements(runs) AS r
WHERE session_id = 'your-session-id'
ORDER BY (r->>'created_at')::bigint;

-- Find which notebook a session belongs to
SELECT n.title, ns.session_id, ns.created_at
FROM notebook_sessions ns
JOIN notebooks n ON n.id = ns.notebook_id
WHERE ns.session_id = 'your-session-id';
```

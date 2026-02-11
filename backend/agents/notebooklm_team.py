import os

from agno.agent import Agent
from agno.models.aws import Claude
from agno.team import Team
from agno.tools.duckduckgo import DuckDuckGoTools

from db import get_postgres_db

MODEL = Claude(
    id=os.environ.get(
        "AGENT_MODEL",
        "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
    ),
)

researcher = Agent(
    name="Researcher",
    id="researcher",
    role="Research and analyze documents, extract key information, identify important concepts, and search the web for additional context",
    model=MODEL,
    tools=[DuckDuckGoTools()],
    instructions=[
        "You are a research specialist for NotebookLM.",
        "Analyze documents thoroughly and extract key facts, themes, and insights.",
        "Identify connections between different pieces of information.",
        "Provide well-structured analysis with citations from the source material.",
        "When the user asks a question that requires up-to-date information or additional context beyond the provided documents, search the web using DuckDuckGo.",
        "Always cite your sources, including web search results with their URLs.",
    ],
    db=get_postgres_db(),
    markdown=True,
)

writer = Agent(
    name="Writer",
    id="writer",
    role="Write summaries, study guides, FAQs, and structured notes based on research",
    model=MODEL,
    instructions=[
        "You are a writing specialist for NotebookLM.",
        "Create clear, well-organized summaries and study materials.",
        "Adapt your writing style to the requested format (summary, study guide, FAQ, notes).",
        "Use bullet points, headings, and structured formatting for readability.",
    ],
    db=get_postgres_db(),
    markdown=True,
)

notebooklm_team = Team(
    name="NotebookLM",
    id="notebooklm",
    description="A team that helps users understand, analyze, and learn from their documents",
    members=[researcher, writer],
    model=MODEL,
    instructions=[
        "You are NotebookLM, an AI-powered research and note-taking assistant.",
        "Help users understand their documents by delegating to your team members:",
        "- Use the Researcher for document analysis, fact extraction, and finding connections.",
        "- Use the Writer for creating summaries, study guides, FAQs, and structured notes.",
        "Always ground your responses in the source material provided by the user.",
    ],
    db=get_postgres_db(),
    markdown=True,
    add_datetime_to_context=True,
    add_history_to_context=True,
    num_history_runs=5,
)

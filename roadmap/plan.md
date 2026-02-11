Sources management -- Let users attach documents (PDF, text, URLs) to a notebook. This is the core NotebookLM feature. Would need a sources table, upload endpoint, and a way to feed source content into the Researcher agent's knowledge base via Agno's knowledge parameter.



Simplify the notebook chat sidebar -- When inside /notebook/[id], the sidebar still shows endpoint config, mode selector, and agent/team picker. These could be hidden since the notebook auto-selects the team, making the UX cleaner.

Improve the notebook home page -- Add search/filter, sorting options, and a notebook card layout instead of a table (more like Google's NotebookLM UI).


Notebook-scoped instructions in system prompt -- Currently instructions are prepended to the user message. A cleaner approach would be to dynamically set the team's instructions or additional_context parameter per run so they appear in the system prompt rather than the user message.
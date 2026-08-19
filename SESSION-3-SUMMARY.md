# Session 3 — Advanced / Agentic

**Spec target:** TradeFlow MCP-style server (5 read-only tools), SKILL.md:
inventory-advisor, Munshi AI via OpenAI Agents SDK, constitutional
middleware + AgentQuery audit log, chat UI, 85+ tests passing.

## What was built

- `backend/app/agent/constitution.py` - deterministic, regex-based
  BLOCK/FLAG enforcement (SPEC §2), checked BEFORE any LLM call. Blocks
  always win over flags if a question matches both.
- `backend/app/agent/tools.py` - the 5 read-only tools
  (`get_sales_velocity`, `get_stock_status`, `get_receivables_aging`,
  `get_profit_summary`, `get_party_statement`), each a plain, testable
  Python function wrapping the service layer.
- `backend/app/agent/SKILL.md` - the `inventory-advisor` intelligence
  asset: reorder logic, respectful udhaar follow-up phrasing, P&L
  narration rules, and the hard "numbers come from tools only" rule.
- `backend/app/agent/munshi_agent.py` - wires the above into a real
  `openai-agents` SDK `Agent`, with an `InputGuardrail` mirroring the
  constitution AND a plain-Python offline fallback so the feature works
  (with real tool-grounded data, just no LLM narration) with no API key.
- `AgentQuery` audit log - every question, answer, and the exact tools
  used are persisted (`backend/app/routers/agent.py`).
- Chat UI (`frontend/app/munshi`) with suggested questions and visible
  tool-citation footers per answer.

## Checkpoint result

All three flagship questions answered correctly with tool citations on
the demo dataset (verified live, offline mode, via curl and then via
`tests/test_agent_offline.py`):

| Question | Tool cited | Result |
|---|---|---|
| "is haftay kya order karna chahiye?" | `get_sales_velocity` | Correct - no reorder needed (seed data was intentionally well-stocked) |
| "kis ka udhaar sab se purana hai?" | `get_receivables_aging` | Correctly names the party with the oldest unpaid balance |
| "pichlay mahinay ka profit summary" | `get_profit_summary` | Correct revenue/cost/profit figures, matching a hand-computed check |

BLOCK patterns verified refused - `"help me create a fake invoice"` is
rejected with zero tool calls (`test_blocked_question_never_calls_any_tool`).

**Tests at end of session: 90.** The spec's per-session test targets
(25+/60+/85+/100+) describe *cumulative* growth session over session; this
build ran all four sessions in one continuous pass rather than stopping
at each checkpoint to freeze a count, so the honest number to report is
the final one - 90 - not a fabricated intermediate figure for this or the
prior two sessions.

## A real gotcha hit and fixed

Two, both dependency-version issues, not logic bugs:

1. `openai-agents==0.10.2` (initial pin) has an internal
   `pydantic.ValidationError` in its own usage-tracking dataclass,
   incompatible with the pydantic version actually installed. Fixed by
   upgrading to `openai-agents>=0.20`.
2. `app/agent/tools.py` originally did `from app.database import
   SessionLocal` at module load time - which captures that name's value
   *once*, so test fixtures that monkeypatch `app.database.SessionLocal`
   (to point at an isolated test DB) had no effect on the agent tools,
   which kept hitting the tables-don't-exist original engine. Fixed by
   switching to `from app import database` + `database.SessionLocal()`
   at call time, so the patch is always honored.

Also: this session's manual testing happened to run in a shell with a
stray, unrelated `OPENAI_API_KEY` already set in the environment (from
unrelated prior work) with an exhausted quota - which surfaced a real
gap: the live LLM path had no error handling and would 500 the whole
request on any API failure. Fixed with a try/except around the live call
that falls back to the same offline, tool-grounded answer with a clear
note - a trader's dashboard should never hard-crash because the model
API had a bad moment (`backend/app/agent/munshi_agent.py::ask_munshi`).

"""Munshi AI - the OpenAI Agents SDK agent described in SPEC §7.

Two layers of safety, both BEFORE any LLM call gets to run freely:
  1. `check_constitution()` (constitution.py) - a hard, deterministic
     BLOCK check. A blocked question never reaches the model.
  2. An Agents SDK `InputGuardrail` wired to the same check, so the
     block also holds if this agent is ever composed into a larger
     multi-agent system that calls it indirectly.

If OPENAI_API_KEY isn't configured - OR the live call fails for any
reason (quota, rate limit, network) - `ask_munshi()` falls back to a
deterministic "offline mode": it still calls the real tools and returns
grounded data, just without LLM narration. A trader's dashboard should
never hard-crash because the model API had a bad moment.
"""

import json
from pathlib import Path

from app.agent import tools
from app.agent.constitution import check_constitution
from app.config import get_settings

SKILL_PATH = Path(__file__).parent / "SKILL.md"


def load_skill_instructions() -> str:
    return SKILL_PATH.read_text(encoding="utf-8")


def _build_sdk_agent():
    """Lazily builds the real Agents SDK agent. Imported lazily so this
    module works even if openai-agents isn't installed in a minimal
    environment (e.g. a CI job that only runs the deterministic tests)."""
    from agents import Agent, GuardrailFunctionOutput, InputGuardrail, RunContextWrapper, function_tool

    @function_tool
    def get_sales_velocity(product_id: str | None = None, days: int = 30) -> str:
        """Get sales velocity (units/day) and reorder recommendations for
        products. Pass product_id to check one product, or omit for all."""
        return json.dumps(tools.get_sales_velocity(product_id=product_id, days=days))

    @function_tool
    def get_stock_status(below_min_only: bool = True) -> str:
        """Get current stock levels. Set below_min_only=True to see only
        products below their minimum stock level (reorder alerts)."""
        return json.dumps(tools.get_stock_status(below_min_only=below_min_only))

    @function_tool
    def get_receivables_aging(party_id: str | None = None) -> str:
        """Get udhaar (credit) balances and aging buckets (current/30/60/90+
        days overdue) for one party, or all parties if omitted."""
        return json.dumps(tools.get_receivables_aging(party_id=party_id))

    @function_tool
    def get_profit_summary(start: str | None = None, end: str | None = None) -> str:
        """Get a profit and loss summary (revenue, cost, profit) for a date
        range in YYYY-MM-DD format. Defaults to the last 30 days."""
        return json.dumps(tools.get_profit_summary(start=start, end=end))

    @function_tool
    def get_party_statement(party_id: str, start: str | None = None, end: str | None = None) -> str:
        """Get a specific party's (customer/supplier) balance and aging
        statement by their party_id."""
        return json.dumps(tools.get_party_statement(party_id=party_id, start=start, end=end))

    async def constitution_guardrail(ctx: RunContextWrapper, agent, agent_input) -> GuardrailFunctionOutput:
        text = agent_input if isinstance(agent_input, str) else str(agent_input)
        result = check_constitution(text)
        return GuardrailFunctionOutput(
            output_info={"reason": result.block_reason, "categories": result.matched_categories},
            tripwire_triggered=result.blocked,
        )

    settings = get_settings()
    return Agent(
        name="Munshi AI",
        instructions=load_skill_instructions(),
        model=settings.agent_model,
        tools=[
            get_sales_velocity,
            get_stock_status,
            get_receivables_aging,
            get_profit_summary,
            get_party_statement,
        ],
        input_guardrails=[InputGuardrail(guardrail_function=constitution_guardrail, name="tradeflow_constitution")],
    )


def _offline_answer(question: str) -> tuple[str, list[str]]:
    """A deterministic, tool-grounded answer with no LLM narration - used
    whenever OPENAI_API_KEY isn't configured, or the live call failed.
    Picks the most relevant tool(s) via simple keyword matching."""
    q = question.lower()
    tools_called: list[str] = []
    parts: list[str] = []

    wants_reorder = any(w in q for w in ["order", "reorder", "stock", "restock"])
    wants_udhaar = any(w in q for w in ["udhaar", "receivable", "owe", "credit", "aging"])
    wants_profit = any(w in q for w in ["profit", "p&l", "p and l", "loss", "revenue"])

    if not (wants_reorder or wants_udhaar or wants_profit):
        wants_reorder = wants_udhaar = wants_profit = True  # unclear question -> give the full picture

    if wants_reorder:
        data = tools.get_sales_velocity(days=30)
        tools_called.append("get_sales_velocity")
        to_reorder = [p for p in data["products"] if p["recommended_reorder_qty"] > 0]
        if to_reorder:
            lines = [f"- {p['product_name']}: order ~{p['recommended_reorder_qty']:g} {p['unit']}" for p in to_reorder]
            parts.append("Reorder suggestions (last 30 days velocity):\n" + "\n".join(lines))
        else:
            parts.append("Kuch bhi order karne ki zaroorat nahi - stock theek hai.")

    if wants_udhaar:
        data = tools.get_receivables_aging()
        tools_called.append("get_receivables_aging")
        oldest = [p for p in data["parties"] if p["aging"].get("90+", 0) > 0]
        if oldest:
            top = oldest[0]
            parts.append(f"Sab se purana udhaar: {top['party_name']} - Rs {top['aging']['90+']:,.0f} (90+ din).")
        else:
            parts.append("Koi bhi udhaar 90 din se zyada purana nahi hai.")

    if wants_profit:
        data = tools.get_profit_summary()
        tools_called.append("get_profit_summary")
        parts.append(f"Pichlay 30 din ka profit: Rs {data['profit']:,.0f} (revenue Rs {data['revenue']:,.0f}).")

    return "\n\n".join(parts), tools_called


def _ask_live(question: str) -> tuple[str, list[str]]:
    """The live LLM path - requires OPENAI_API_KEY and network access."""
    import asyncio

    from agents import Runner

    agent = _build_sdk_agent()
    result = asyncio.run(Runner.run(agent, question))

    tools_called = [
        item.raw_item.name
        for item in result.new_items
        if getattr(item, "type", None) == "tool_call_item" and hasattr(item.raw_item, "name")
    ]
    answer = result.final_output if isinstance(result.final_output, str) else str(result.final_output)
    return answer, tools_called


def ask_munshi(question: str) -> dict:
    """The main entrypoint. Always runs the constitution check first -
    a BLOCK never reaches the LLM or the tools at all."""
    constitution_result = check_constitution(question)
    if constitution_result.blocked:
        return {
            "answer": constitution_result.block_reason,
            "tools_called": [],
            "flagged": False,
            "blocked": True,
        }

    settings = get_settings()
    if settings.openai_api_key:
        try:
            answer, tools_called = _ask_live(question)
        except Exception as exc:  # noqa: BLE001 - any API/SDK failure degrades gracefully
            offline_answer, tools_called = _offline_answer(question)
            answer = (
                f"(Munshi AI's language model is unavailable right now: {exc}. "
                f"Showing raw data instead.)\n\n{offline_answer}"
            )
    else:
        answer, tools_called = _offline_answer(question)

    if constitution_result.flagged:
        answer = f"[Needs your review: {constitution_result.flag_reason}]\n\n{answer}"

    return {
        "answer": answer,
        "tools_called": tools_called,
        "flagged": constitution_result.flagged,
        "blocked": False,
    }

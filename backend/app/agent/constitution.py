"""The TradeFlow Constitution (SPEC §2) - deterministic, keyword/pattern
based enforcement that runs BEFORE any LLM call. This is intentionally
NOT an LLM judgment call: BLOCK patterns must be reliable, not merely
probable, so they're plain Python string matching, fully unit-testable
without an API key.
"""

import re
from dataclasses import dataclass, field

# Each pattern is a compiled regex tested against the lowercased question.
BLOCK_PATTERNS: dict[str, list[re.Pattern]] = {
    "tax_evasion": [
        re.compile(r"\bfake\s+invoice", re.I),
        re.compile(r"\btwo\s*books?\b|\bdual[- ]book", re.I),
        re.compile(r"\bhide\b.*\b(sales|income|revenue)\b", re.I),
        re.compile(r"\bavoid\s+tax\b|\btax\s+evasion\b", re.I),
    ],
    "financial_fraud": [
        re.compile(r"\bfake\s+(receivable|udhaar|balance)", re.I),
        re.compile(r"\bghost\s+(inventory|stock)", re.I),
        re.compile(r"\binflate\b.*\b(stock|inventory|balance)\b", re.I),
        re.compile(r"\bfor\s+(loan|bank)\s+collateral\b", re.I),
    ],
    "riba_advice": [
        re.compile(r"\binterest\s+rate\b.*\bcharge\b", re.I),
        re.compile(r"\bhow\s+much\s+interest\b.*\bcharge\b", re.I),
        re.compile(r"\binterest\s+rate\s+(advice|calculat)", re.I),
    ],
    "smuggling": [
        re.compile(r"\bundeclared\s+goods\b", re.I),
        re.compile(r"\bsmuggl", re.I),
        re.compile(r"\bavoid\s+customs\b", re.I),
    ],
    "fabricate_numbers": [
        re.compile(r"\bmake\s+up\s+a\s+number\b", re.I),
        re.compile(r"\bjust\s+guess\s+the\s+(total|amount|figure)\b", re.I),
    ],
}

FLAG_PATTERNS: dict[str, list[re.Pattern]] = {
    "bulk_deletion": [
        re.compile(r"\bdelete\s+all\b.*\bledger\b", re.I),
        re.compile(r"\bwipe\b.*\bledger\b", re.I),
    ],
    "backdated_edit": [
        re.compile(r"\bbackdate", re.I),
        re.compile(r"\bchange\s+the\s+date\s+.*\bmonths?\s+ago\b", re.I),
    ],
    "credit_limit_override": [
        re.compile(r"\boverride\s+.*\bcredit\s+limit\b", re.I),
        re.compile(r"\bignore\s+.*\bcredit\s+limit\b", re.I),
    ],
}


@dataclass
class ConstitutionResult:
    blocked: bool = False
    flagged: bool = False
    block_reason: str | None = None
    flag_reason: str | None = None
    matched_categories: list[str] = field(default_factory=list)


BLOCK_MESSAGES = {
    "tax_evasion": "I can't help with anything that fabricates invoices or hides income from tax authorities.",
    "financial_fraud": "I can't fabricate receivables, inventory, or balances - that's financial fraud.",
    "riba_advice": "I can report your data neutrally, but I won't advise on interest (riba) rates to charge.",
    "smuggling": "I can't help with undeclared goods or customs avoidance.",
    "fabricate_numbers": "I only report numbers I can actually derive from your data - I won't invent a figure.",
}


def check_constitution(question: str) -> ConstitutionResult:
    """Check a question against the TradeFlow Constitution BEFORE calling
    any LLM. Blocked questions never reach the model at all."""
    result = ConstitutionResult()

    for category, patterns in BLOCK_PATTERNS.items():
        if any(p.search(question) for p in patterns):
            result.blocked = True
            result.block_reason = BLOCK_MESSAGES[category]
            result.matched_categories.append(category)

    if result.blocked:
        return result  # a block always wins; no need to also check flags

    for category, patterns in FLAG_PATTERNS.items():
        if any(p.search(question) for p in patterns):
            result.flagged = True
            result.flag_reason = f"This request ({category.replace('_', ' ')}) needs human review before acting."
            result.matched_categories.append(category)

    return result

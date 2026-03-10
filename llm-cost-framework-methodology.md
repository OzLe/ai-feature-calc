# LLM Cost Assessment Framework — Methodology & Reference Data

> **Purpose:** This document explains the cost model, formulas, assumptions, and data sources behind the LLM Feature Cost Estimator. It is intended as a reference for product managers, engineers, and architects who need to understand, audit, or extend the framework.

---

## Table of Contents

1. [Core Cost Model](#1-core-cost-model)
2. [Input Variables & Definitions](#2-input-variables--definitions)
3. [Token Budget Methodology](#3-token-budget-methodology)
4. [Prompt Caching Model](#4-prompt-caching-model)
5. [Volume & Usage Model](#5-volume--usage-model)
6. [Model Pricing Data](#6-model-pricing-data)
7. [Feature Archetypes & Default Profiles](#7-feature-archetypes--default-profiles)
8. [Cost Driver Analysis](#8-cost-driver-analysis)
9. [Optimization Levers](#9-optimization-levers)
10. [Assumptions & Limitations](#10-assumptions--limitations)
11. [Worked Examples](#11-worked-examples)

---

## 1. Core Cost Model

The fundamental cost equation for a single LLM interaction:

```
Cost_per_interaction =
  (Fresh_input_tokens / 1,000,000) × Model_input_price
+ (Cached_input_tokens / 1,000,000) × Model_cache_price
+ (Output_tokens / 1,000,000) × Model_output_price
```

Where:

```
Fresh_input_tokens   = Total_input_tokens × (1 - Cache_ratio)
Cached_input_tokens  = Total_input_tokens × Cache_ratio

Total_input_tokens   = (System_prompt + RAG_context + User_input + History) × Agentic_multiplier
Output_tokens        = Expected_output × Agentic_multiplier
```

### Scaling to total cost

```
Daily_interactions   = DAU × Sessions_per_user_per_day × Interactions_per_session
Daily_cost           = Cost_per_interaction × Daily_interactions
Monthly_cost         = Daily_cost × 30
Annual_cost          = Daily_cost × 365
Cost_per_MAU         = Monthly_cost / MAU
```

---

## 2. Input Variables & Definitions

| Variable | Unit | Description |
|---|---|---|
| `System_prompt` | tokens | Static instructions, persona definition, tool schemas passed on every call |
| `RAG_context` | tokens | Retrieved document chunks injected per call |
| `User_input` | tokens | Average length of a user's message |
| `History_depth` | turns | Number of prior conversation turns included in context |
| `Avg_turns_history` | ratio | Fraction of history depth that's typically populated (default: 0.5) |
| `Output` | tokens | Expected response length from the model |
| `Agentic_multiplier` | integer | Number of LLM calls made per single user action |
| `Cache_ratio` | 0.0–1.0 | Fraction of input tokens served from prompt cache |
| `DAU` | users | Daily Active Users |
| `MAU` | users | Monthly Active Users |
| `Sessions_per_user` | float | Average user sessions per day |
| `Interactions_per_session` | integer | Average LLM calls triggered per session |

### Conversation History Token Calculation

History is calculated as:

```
History_tokens = History_depth × Avg_turns_history × (User_input + Output)
```

`Avg_turns_history` accounts for the fact that early in a session, few prior turns exist. A value of 0.5 represents the average state across a session lifecycle — at turn 1, history is 0; at turn N, history is full. This is a simplifying approximation for steady-state estimation.

---

## 3. Token Budget Methodology

### Token estimation rules of thumb

| Content type | Heuristic |
|---|---|
| English prose | ~1 token per 4 characters, ~0.75 tokens per word |
| Code | ~1 token per 3–4 characters (more tokens than prose due to punctuation) |
| JSON/structured data | ~1 token per 3 characters |
| 1 A4 page of text | ~500–700 tokens |
| Short user message | 50–200 tokens |
| Paragraph system prompt | 200–400 tokens |
| Tool/function schema (per tool) | 100–300 tokens |

### What inflates token counts in production

- **Tool definitions:** Each tool/function in an agentic system adds 100–300 tokens to every call, even when the tool isn't used.
- **Structured output schemas:** Asking for JSON output with a schema adds ~100–400 tokens to the prompt.
- **Few-shot examples:** Each example adds its full token length to every call.
- **Chain-of-thought reasoning:** Models like Claude and GPT-4o can generate extensive reasoning traces before the final answer, multiplying output token costs by 2–5× for complex tasks.

---

## 4. Prompt Caching Model

Prompt caching allows repeated prefixes (system prompts, RAG context) to be stored server-side and reused across calls at a significantly reduced rate.

### Pricing impact

| Provider | Cache read price (vs. standard input) | Cache write price (vs. standard input) |
|---|---|---|
| Anthropic (Claude) | ~10% of input price | ~125% of input price (one-time) |
| OpenAI (GPT-4o) | ~50% of input price | Automatic (no write cost) |
| Google (Gemini 2.5) | ~10% of input price | Automatic (no write cost) |

> **Note:** "No explicit write cost" means the provider absorbs cache write overhead; there is no additional API charge for cache population.

### Effective cache ratio by scenario

| Scenario | Expected cache ratio | Notes |
|---|---|---|
| No caching configured | 0% | Default for most deployments |
| Static system prompt only | 20–40% | System prompt cached; user input and RAG are fresh |
| Static system prompt + stable RAG | 50–70% | High-value configuration for RAG-heavy apps |
| Fully cached (batch processing) | 70–90% | Document re-processing, repeated templates |

### When caching is most valuable

Caching is most cost-effective when:

1. **System prompts are large** (>500 tokens) and repeated verbatim
2. **RAG chunks are stable** and retrieved consistently (e.g., same documents)
3. **Batch processing** uses the same prefix for many inputs
4. **Agentic loops** re-invoke the same base context on each step

**Cache hit condition:** The cached prefix must be byte-identical. Any modification to the system prompt — even whitespace — invalidates the cache entry.

---

## 5. Volume & Usage Model

### DAU/MAU ratio

The DAU/MAU ratio (also called "stickiness") directly drives cost:

| Product type | Typical DAU/MAU ratio |
|---|---|
| Viral consumer app (e.g., social, messaging) | 40–60% |
| B2C productivity tool | 20–35% |
| B2B SaaS with daily workflows | 30–50% |
| Occasional use tools | 5–15% |
| Default in framework | 20% |

Adjust the DAU/MAU ratio based on your product category. Underestimating DAU is one of the most common causes of cost surprises.

### Sessions and interactions

`Interactions_per_session` is the key volume multiplier. It represents how many times the LLM is called within a single user session, and for agentic features this can be much higher than the visible user-facing interaction count.

| Feature type | Visible user turns | Actual LLM calls |
|---|---|---|
| Simple Q&A | 1 | 1 |
| RAG chatbot | 1 | 2–3 (retrieval re-ranking, generation) |
| Code assistant | 1 | 1–2 |
| Agentic task runner | 1 | 5–15+ |
| Multi-step form filler | 1 | 3–8 |

---

## 6. Model Pricing Data

All prices are in USD per 1 million tokens as of Q1 2026. Prices are subject to change — always verify with the provider's pricing page before using for financial planning.

| Model | Provider | Tier | Input ($/1M) | Output ($/1M) | Cache read ($/1M) | Cache write ($/1M) |
|---|---|---|---|---|---|---|
| Claude Opus 4.6 | Anthropic | Premium | $5.00 | $25.00 | $0.50 | $6.25 |
| Claude Opus 4.5 | Anthropic | Premium | $15.00 | $75.00 | $1.50 | $18.75 |
| Claude Sonnet 4.6 | Anthropic | Mid | $3.00 | $15.00 | $0.30 | $3.75 |
| Claude Sonnet 4.5 | Anthropic | Mid | $3.00 | $15.00 | $0.30 | $3.75 |
| Claude Haiku 4.5 | Anthropic | Economy | $0.80 | $4.00 | $0.08 | $1.00 |
| GPT-4o | OpenAI | Mid | $2.50 | $10.00 | $1.25 | — |
| GPT-4o mini | OpenAI | Economy | $0.15 | $0.60 | $0.075 | — |
| GPT-4.1 | OpenAI | Mid | $2.00 | $8.00 | $0.50 | — |
| GPT-4.1 mini | OpenAI | Economy | $0.40 | $1.60 | $0.10 | — |
| GPT-4.1 nano | OpenAI | Economy | $0.02 | $0.15 | $0.005 | — |
| o3 | OpenAI | Premium | $2.00 | $8.00 | — | — |
| o4-mini | OpenAI | Mid | $1.10 | $4.40 | — | — |
| Gemini 2.5 Pro | Google | Mid | $1.25 | $10.00 | $0.125 | — |
| Gemini 2.5 Flash | Google | Economy | $0.30 | $2.50 | $0.03 | — |
| Gemini 1.5 Pro *(deprecated)* | Google | Mid | $1.25 | $5.00 | $0.3125 | — |
| Gemini 2.0 Flash *(EOL June 2026)* | Google | Economy | $0.10 | $0.40 | $0.025 | — |

### Output-to-input price ratio

A critical and frequently underestimated factor: **output tokens cost 3–5× more than input tokens** across all major providers.

| Provider/Model | Output:Input ratio |
|---|---|
| Claude Opus 4.6 | 5× |
| Claude Opus 4.5 | 5× |
| Claude Sonnet 4.6 | 5× |
| GPT-4o | 4× |
| GPT-4.1 | 4× |
| o3 | 4× |
| Gemini 2.5 Pro | 8× |
| GPT-4o mini | 4× |

For output-heavy features (long responses, code generation, chain-of-thought), this ratio dominates total cost.

---

## 7. Feature Archetypes & Default Profiles

The framework ships with six archetype profiles representing common AI feature patterns. Defaults are calibrated to realistic production averages observed across typical deployments.

### Archetype profiles

| Archetype | System prompt | RAG context | User input | Output | Agentic multiplier | History depth |
|---|---|---|---|---|---|---|
| Simple RAG / Q&A | 500 | 2,000 | 150 | 400 | 1 | 0 |
| Multi-turn Chatbot | 800 | 1,500 | 200 | 600 | 1 | 8 |
| Agentic Workflow | 1,500 | 2,000 | 300 | 800 | 8 | 4 |
| Document Processing | 600 | 0 | 8,000 | 1,000 | 1 | 0 |
| Code Generation | 1,000 | 3,000 | 500 | 1,500 | 2 | 3 |
| Classification / Extraction | 400 | 0 | 500 | 100 | 1 | 0 |

### Archetype cost characteristics

**Simple RAG / Q&A**
- Cost is dominated by RAG context (typically 60–70% of input tokens)
- Short output keeps total cost low
- Best candidate for economy-tier models with caching on system prompt + RAG

**Multi-turn Chatbot**
- History accumulates linearly per turn — conversations running >10 turns can see 3–5× higher token cost than turn 1
- System prompt caching provides meaningful savings
- Output token costs are significant due to conversational response lengths

**Agentic Workflow**
- The highest-cost archetype by far due to the agentic multiplier
- Each tool call re-sends the full context, creating compounding costs
- Routing sub-tasks to economy models is the single highest-ROI optimization
- Intermediate reasoning outputs (scratchpad, planning) can be truncated or elided

**Document Processing**
- Dominated by input tokens (large document context)
- Batch processing pattern; prompt caching has very high impact
- Model quality matters most for extraction accuracy; economy models often sufficient

**Code Generation**
- Code output is expensive: verbose, syntactically precise, and output-heavy
- RAG context (codebase snippets) adds significant input cost
- Multi-step patterns (draft → review → refine) double or triple call count

**Classification / Extraction**
- Lowest total cost archetype
- Short output (labels, structured fields) keeps output costs minimal
- High batch volume can still accumulate to significant monthly spend
- Economy models typically sufficient; prompt engineering is the key quality lever

---

## 8. Cost Driver Analysis

### Sensitivity ranking

The following factors are ranked by their potential to change monthly cost by ≥50%, from highest to lowest impact:

| Rank | Driver | Potential cost impact | Direction |
|---|---|---|---|
| 1 | Model selection | 10–100× | Up or down |
| 2 | Agentic multiplier | Linear (×N) | Up |
| 3 | Output token length | 3–5× premium rate | Up |
| 4 | Prompt caching | Up to −90% on cached tokens | Down |
| 5 | DAU/MAU ratio | Linear | Up |
| 6 | Conversation history depth | Linear per turn | Up |
| 7 | RAG context size | Linear | Up |
| 8 | Sessions per user | Linear | Up |

### The agentic cost trap

Agentic features are the most common source of cost overruns in AI product development. The pattern is:

```
User action → LLM call 1 (planning)
           → Tool execution (deterministic)
           → LLM call 2 (interpret result)
           → Tool execution
           → LLM call N (final response)
```

At each step, the **full context is resent** (system prompt + history + accumulated tool results). For a 5-step agent with a 4,000-token context, the actual tokens consumed can be:

```
Call 1: 4,000 tokens in
Call 2: 4,000 + tool_result_1 ≈ 5,000 tokens in
Call 3: 5,000 + tool_result_2 ≈ 6,000 tokens in
...
Total input: ~25,000 tokens (vs. 4,000 naively expected)
```

The framework simplifies this with a flat `agentic_multiplier`, which is conservative. Real agentic cost growth can be super-linear as context accumulates across steps.

---

## 9. Optimization Levers

### Lever 1: Model routing (tiering)

**Description:** Use different models for different subtasks within the same feature.

**Pattern:** Route planning, tool call interpretation, and intermediate reasoning to economy-tier models (Haiku, GPT-4o mini, Gemini Flash). Reserve premium/mid models only for the final user-facing response.

**Expected savings:** 60–85% reduction in cost for agentic features.

**Implementation complexity:** Medium — requires prompt compatibility testing across models and a routing layer.

---

### Lever 2: Prompt caching

**Description:** Cache the static prefix of the prompt (system instructions, static RAG) to serve repeated calls at 10–50% of standard input price.

**Conditions for effectiveness:**
- System prompt >500 tokens
- RAG documents are stable across many calls
- Cache prefix is byte-identical on each request

**Expected savings:** 40–70% reduction in input token costs where applicable.

**Implementation complexity:** Low — typically a flag in the API call and stable prompt construction.

---

### Lever 3: Output length constraints

**Description:** Set `max_tokens` limits and use structured output formats (JSON with defined schema) to enforce short, precise responses.

**Pattern:**
- Use streaming + `stop_sequences` to terminate early
- Replace prose responses with structured JSON where the UI renders it
- Use `max_tokens` budgets appropriate to each task type

**Expected savings:** 20–50% reduction in output token costs.

**Implementation complexity:** Low.

---

### Lever 4: History compression

**Description:** Instead of sending raw conversation history, send a compressed summary plus the last N turns.

**Strategies:**
- Sliding window: keep only the last N turns (simplest)
- Extractive compression: send a bullet-point summary of earlier context
- Running summary: maintain an LLM-generated summary that updates after each turn (adds 1 LLM call per turn but reduces subsequent input token cost)

**Expected savings:** 40–70% reduction in history-related input tokens for long sessions.

**Implementation complexity:** Medium.

---

### Lever 5: RAG precision

**Description:** Reduce RAG context size by improving retrieval precision — fewer but more relevant chunks.

**Techniques:**
- Smaller chunk sizes with overlap (256–512 tokens rather than 1,024+)
- Re-ranking retrieved chunks and selecting top-K only
- Query expansion to improve recall at smaller K
- Hybrid search (dense + sparse) to reduce false positive retrievals

**Expected savings:** 30–60% reduction in RAG context tokens.

**Implementation complexity:** Medium-High.

---

### Lever 6: Batch processing

**Description:** For non-real-time features (document analysis, enrichment, classification), use batch APIs.

**Batch API pricing:** Anthropic and OpenAI both offer ~50% discount on batch API calls (async, non-time-sensitive). Ideal for document processing, nightly enrichment jobs, and bulk classification.

**Expected savings:** 50% flat reduction for eligible workloads.

**Implementation complexity:** Low — API change only, no model or prompt changes required.

---

## 10. Assumptions & Limitations

### What the framework does NOT account for

| Limitation | Description | Mitigation |
|---|---|---|
| Super-linear agentic cost growth | Context accumulates across agent steps; the flat multiplier underestimates real agentic costs | Add 20–40% buffer for agentic features; profile real call chains |
| Reasoning/thinking tokens | Extended thinking modes (o1, Claude extended thinking) generate hidden tokens not directly visible | Test with thinking enabled; treat thinking token budget as additional output cost |
| Embedding costs | Vector search / RAG requires embedding API calls | Add embedding cost separately: ~$0.02–0.13/1M tokens for most providers |
| Infrastructure overhead | Latency buffers, retries, timeouts, and error rate can add 5–15% token overhead | Apply a 1.1–1.2× buffer on production estimates |
| Fine-tuning & training costs | One-time or periodic costs not covered by this model | Evaluate separately |
| Context window limits | Some models charge differently beyond certain context thresholds | Check provider pricing tiers for long-context pricing |
| Guardrail and moderation calls | Additional LLM calls for content moderation or safety checks | Add as a separate line item if applicable |
| Regional pricing | Some providers charge differently by region or API tier | Verify with provider for enterprise pricing |

### Precision guidance

| Estimate horizon | Recommended precision | Notes |
|---|---|---|
| Pre-PRD exploration | Order-of-magnitude | ±1–2×; use archetype defaults |
| Feature spec / build decision | ±50% range | Tune token budget with representative examples |
| Budget planning | ±25% range | Requires real traffic samples from pilot or beta |
| Financial forecasting | ±10–15% | Requires production telemetry and usage data |

---

## 11. Worked Examples

### Example A: Internal HR chatbot

**Configuration:**
- Archetype: Multi-turn Chatbot
- Model: Claude Sonnet 4.5
- System prompt: 800 tokens
- RAG context: 2,000 tokens (HR policy docs)
- User input: 150 tokens
- Output: 500 tokens
- History depth: 6 turns
- Agentic multiplier: 1
- Cache ratio: 60% (stable HR docs)
- MAU: 2,000 (employees)
- DAU: 600
- Sessions/user: 1
- Interactions/session: 4

**Calculation:**

```
History tokens      = 6 × 0.5 × (150 + 500) = 1,950 tokens
Total input         = 800 + 2,000 + 150 + 1,950 = 4,900 tokens

Cached input        = 4,900 × 0.60 = 2,940 tokens
Fresh input         = 4,900 × 0.40 = 1,960 tokens

Input cost/call     = (1,960 / 1M) × $3.00 + (2,940 / 1M) × $0.30
                    = $0.00588 + $0.000882 = $0.006762

Output cost/call    = (500 / 1M) × $15.00 = $0.0075

Total cost/call     = $0.006762 + $0.0075 = $0.014262

Daily calls         = 600 × 1 × 4 = 2,400
Daily cost          = 2,400 × $0.01426 = $34.22
Monthly cost        = $34.22 × 30 = $1,027
Annual cost         = $12,321
Cost per MAU/month  = $1,027 / 2,000 = $0.51
```

**Assessment:** Reasonable for an internal enterprise tool. No monetization concern at $0.51/MAU.

---

### Example B: Consumer-facing agentic research assistant

**Configuration:**
- Archetype: Agentic Workflow
- Model: Claude Sonnet 4.5
- System prompt: 1,500 tokens
- RAG context: 3,000 tokens (web search results)
- User input: 300 tokens
- Output: 1,000 tokens
- Agentic multiplier: 6
- History depth: 3 turns
- Cache ratio: 20%
- MAU: 50,000
- DAU: 12,500 (25% DAU/MAU)
- Sessions/user: 1.2
- Interactions/session: 3

**Calculation:**

```
History tokens      = 3 × 0.5 × (300 + 1,000) = 1,950 tokens
Total input/call    = (1,500 + 3,000 + 300 + 1,950) × 6 = 6,750 × 6 = 40,500 tokens
Total output/call   = 1,000 × 6 = 6,000 tokens

Cached input        = 40,500 × 0.20 = 8,100 tokens
Fresh input         = 40,500 × 0.80 = 32,400 tokens

Input cost/action   = (32,400 / 1M) × $3.00 + (8,100 / 1M) × $0.30
                    = $0.0972 + $0.00243 = $0.09963

Output cost/action  = (6,000 / 1M) × $15.00 = $0.09

Total cost/action   = $0.18963

Daily actions       = 12,500 × 1.2 × 3 = 45,000
Daily cost          = 45,000 × $0.18963 = $8,533
Monthly cost        = $255,990
Annual cost         = $3,111,945
Cost per MAU/month  = $255,990 / 50,000 = $5.12
```

**Assessment:** At $5.12/MAU, this feature requires either a paid tier, usage caps, or model routing to be unit-economically viable. Routing intermediate agent steps to Haiku ($0.80/$4.00) would reduce the cost by approximately 70%, bringing cost/MAU to ~$1.50.

---

## Appendix: Token Count Estimation Reference

### Quick estimation by content type

| Content | Approximate token count |
|---|---|
| "Hello, how can I help you?" | ~7 tokens |
| 1 sentence | ~15–25 tokens |
| 1 paragraph | ~80–120 tokens |
| 500-word blog post | ~650–750 tokens |
| 1,000-word document | ~1,300–1,500 tokens |
| 10-page PDF | ~5,000–8,000 tokens |
| GPT-4 system prompt (detailed) | ~500–2,000 tokens |
| Claude tool/function schema (1 tool) | ~150–300 tokens |
| SQL query (complex) | ~100–400 tokens |
| 50 lines of Python | ~200–400 tokens |

### Tokenizer differences across providers

All major providers use BPE (Byte-Pair Encoding) tokenizers, but vocabulary sizes differ. Token counts for the same text can vary by 10–20% between providers. The framework uses a single token count as a provider-neutral input; the pricing tables absorb provider-specific differences.

---

<!-- Keep in sync with FRAMEWORK_VERSION in llm-cost-framework.jsx -->
*Framework version: 2.0 — March 2026*
*Pricing data sourced from public provider pricing pages as of Q1 2026. Verify current rates before use in financial planning.*

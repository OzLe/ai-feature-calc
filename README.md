# AI Feature Cost Calculator

An interactive LLM cost estimation framework that helps teams forecast API costs for AI-powered features before they ship.

Built as a single-file React component (Claude Artifact compatible), it combines a methodology document with a fully functional calculator covering token budgets, caching strategies, volume scaling, and model comparison.

## What It Does

- **4-step wizard**: Select an archetype, configure tokens, set volume, view results
- **14+ LLM models**: Claude, GPT, Gemini families with Q1 2026 pricing
- **Prompt caching**: Models Anthropic 5-min/1-hr TTL, OpenAI, and Google caching tiers
- **Sensitivity analysis**: Tornado chart showing which parameters drive cost the most
- **Comparison mode**: Side-by-side Scenario A vs B with delta breakdown
- **Worked examples**: Pre-built HR Chatbot and Agentic Research scenarios
- **Embedding costs**: Optional RAG embedding cost calculator
- **Save/load**: localStorage persistence with named configuration profiles
- **Dark/light theme**: System preference detection with manual toggle
- **Mobile responsive**: Full touch support with adaptive layouts
- **Share via URL**: Query params + hash routing for bookmarkable configs

## Files

| File | Description |
|------|-------------|
| `llm-cost-framework.jsx` | The calculator (2,497 lines, single-file React component) |
| `llm-cost-framework-methodology.md` | The underlying cost methodology (11 sections) |
| `artifacts/` | Milestone completion reports |

## Usage

The JSX file is designed to run as a **Claude Artifact** or in any React environment that provides `useState`, `useMemo`, `useEffect`, and `useRef` from React.

### As a Claude Artifact

Paste the contents of `llm-cost-framework.jsx` into a Claude artifact with type `application/vnd.ant.react`.

### In a React Project

```jsx
import LLMCostFramework from './llm-cost-framework';

function App() {
  return <LLMCostFramework />;
}
```

Requires Tailwind CSS for styling.

## Feature Archetypes

The calculator ships with 6 pre-configured archetypes:

| Archetype | Description | Typical Monthly Cost Range |
|-----------|-------------|---------------------------|
| Simple Chatbot | Basic Q&A, short context | $50 - $500 |
| RAG Assistant | Document retrieval + generation | $200 - $2,000 |
| Code Assistant | Code generation with large context | $500 - $5,000 |
| Agentic Workflow | Multi-step tool use, high autonomy | $2,000 - $20,000 |
| Data Pipeline | Batch processing, structured output | $1,000 - $10,000 |
| Customer Support | High volume, moderate complexity | $500 - $5,000 |

## Methodology

The cost model follows the formula:

```
Monthly Cost = Daily_Interactions × Token_Budget × Price_Per_Token × 30
```

Where Token Budget accounts for:
- System prompt + RAG context + user input + output
- Conversation history depth
- Agentic multiplier for multi-step workflows
- Cache hit/miss ratios
- Reasoning token overhead (for o3/o4-mini models)

Full details in `llm-cost-framework-methodology.md`.

## Development History

Built iteratively across 4 milestones:

- **M1**: Critical fixes — formula corrections, pricing updates, input validation
- **M2**: Core enhancements — improved caching model, recommendations engine, export/share
- **M3**: Advanced features — comparison mode, sensitivity analysis, worked examples, save/load
- **M4**: Production polish — token estimator, embedding costs, mobile responsive, dark/light theme, URL routing

## License

MIT

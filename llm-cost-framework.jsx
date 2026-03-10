import { useState, useMemo, useEffect, useRef } from "react";
import modelsConfig from "./src/models-config.json";

const {
  frameworkVersion: FRAMEWORK_VERSION,
  pricingDate: PRICING_DATE,
  pricingLastUpdated: PRICING_LAST_UPDATED,
  pricingStaleDays: PRICING_STALENESS_DAYS,
  providerPricingUrls: PROVIDER_PRICING_URLS,
  models: MODELS,
  embeddingModels: EMBEDDING_MODELS,
  featureArchetypes: ARCHETYPES,
  workedExamples: WORKED_EXAMPLES,
} = modelsConfig;

const CACHE_SCENARIOS = [
  { id: "none",       label: "No caching",          ratio: 0 },
  { id: "low",        label: "Low (~20%)",           ratio: 0.20 },
  { id: "medium",     label: "Moderate (~50%)",      ratio: 0.50 },
  { id: "high",       label: "High (~80%)",          ratio: 0.80 },
];

// ─── TOKEN HEURISTICS (M3-8) ────────────────────────────────────────────────

const TOKEN_HEURISTICS = [
  { content: "English prose", tokens: "~1 token per 4 characters" },
  { content: "Code", tokens: "~1 token per 3-4 characters" },
  { content: "JSON/structured data", tokens: "~1 token per 3 characters" },
  { content: "1 A4 page of text", tokens: "~500-700 tokens" },
  { content: "Short user message", tokens: "50-200 tokens" },
  { content: "System prompt (detailed)", tokens: "500-2,000 tokens" },
  { content: "Tool schema (per tool)", tokens: "100-300 tokens" },
];

const TOKEN_INFLATORS = [
  "Tool definitions: 100-300 tokens per tool, even when unused",
  "Structured output schemas: ~100-400 tokens",
  "Few-shot examples: full token length per example",
  "Chain-of-thought reasoning: 2-5x output multiplier for complex tasks",
];

// ─── THEMES (M4-9) ──────────────────────────────────────────────────────────

const THEMES = {
  dark: {
    bg: "bg-slate-900",
    bgAlt: "bg-slate-900/50",
    bgCard: "bg-slate-800",
    bgCardSoft: "bg-slate-800/30",
    bgCardMid: "bg-slate-800/40",
    bgCardHalf: "bg-slate-800/50",
    bgCardStrong: "bg-slate-800/60",
    bgCardDense: "bg-slate-800/70",
    bgCardHover: "hover:bg-slate-800/50",
    bgCardHoverSolid: "hover:bg-slate-800",
    bgInput: "bg-slate-800",
    bgSlider: "bg-slate-700",
    bgToggleOff: "bg-slate-600",
    bgHover: "hover:bg-slate-700/50",
    bgHoverSolid: "hover:bg-slate-600",
    bgBarTrack: "bg-slate-700",
    bgDot: "bg-white/20",
    text: "text-white",
    textMuted: "text-slate-400",
    textSecondary: "text-slate-300",
    textTertiary: "text-slate-500",
    textQuaternary: "text-slate-600",
    textSubtle: "text-slate-200",
    textInvert: "text-slate-900",
    border: "border-slate-700",
    borderSoft: "border-slate-700/50",
    borderMid: "border-slate-600",
    borderHard: "border-slate-500",
    borderHardSoft: "border-slate-500/30",
    borderHeader: "border-slate-800",
    borderInput: "border-slate-700",
    accent: "text-amber-400",
    accentStrong: "text-amber-500",
    accentDark: "text-amber-300",
    tooltipBg: "bg-slate-900",
    tooltipBorder: "border-slate-600",
    tooltipText: "text-slate-300",
    infoBtnBg: "bg-slate-700",
    infoBtnText: "text-slate-400",
    infoBtnHover: "hover:bg-slate-600",
    pillSlate: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    stepInactive: "bg-slate-700 text-slate-200 hover:bg-slate-600",
    stepDisabled: "bg-slate-800/50 text-slate-600",
    gradientBg: "linear-gradient(135deg, #0a0e1a 0%, #0d1120 50%, #0a0f1e 100%)",
    textColor: "#e2e8f0",
  },
  light: {
    bg: "bg-gray-50",
    bgAlt: "bg-gray-100/50",
    bgCard: "bg-white",
    bgCardSoft: "bg-white/80",
    bgCardMid: "bg-gray-50",
    bgCardHalf: "bg-gray-50/80",
    bgCardStrong: "bg-gray-100",
    bgCardDense: "bg-gray-100",
    bgCardHover: "hover:bg-gray-50",
    bgCardHoverSolid: "hover:bg-gray-100",
    bgInput: "bg-gray-50",
    bgSlider: "bg-gray-300",
    bgToggleOff: "bg-gray-400",
    bgHover: "hover:bg-gray-100",
    bgHoverSolid: "hover:bg-gray-200",
    bgBarTrack: "bg-gray-200",
    bgDot: "bg-gray-400/30",
    text: "text-gray-900",
    textMuted: "text-gray-500",
    textSecondary: "text-gray-700",
    textTertiary: "text-gray-400",
    textQuaternary: "text-gray-400",
    textSubtle: "text-gray-800",
    textInvert: "text-white",
    border: "border-gray-200",
    borderSoft: "border-gray-200/80",
    borderMid: "border-gray-300",
    borderHard: "border-gray-400",
    borderHardSoft: "border-gray-400/50",
    borderHeader: "border-gray-200",
    borderInput: "border-gray-300",
    accent: "text-amber-600",
    accentStrong: "text-amber-600",
    accentDark: "text-amber-700",
    tooltipBg: "bg-white",
    tooltipBorder: "border-gray-300",
    tooltipText: "text-gray-700",
    infoBtnBg: "bg-gray-200",
    infoBtnText: "text-gray-500",
    infoBtnHover: "hover:bg-gray-300",
    pillSlate: "bg-gray-200/60 text-gray-600 border-gray-300/60",
    stepInactive: "bg-gray-200 text-gray-700 hover:bg-gray-300",
    stepDisabled: "bg-gray-100 text-gray-400",
    gradientBg: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #f8fafc 100%)",
    textColor: "#1e293b",
  },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function fmt(n, decimals = 2) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(decimals)}`;
}

function fmtTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

function calcCosts(cfg) {
  const model = MODELS.find(m => m.id === cfg.modelId);
  if (!model) return null;

  // Tokens per interaction
  const avgHistory = cfg.historyDepth * cfg.avgTurnsHistory * (cfg.userInput + cfg.output);
  const inputPerInteraction = cfg.systemPrompt + cfg.ragContext + cfg.userInput + avgHistory;
  const baseOutputPerInteraction = cfg.output;
  const callsPerInteraction = cfg.agenticMult;

  // Reasoning token multiplier (M3-5): reasoning models generate hidden chain-of-thought tokens
  const reasoningActive = model.reasoning && cfg.reasoningMultiplier > 1;
  const outputPerInteraction = reasoningActive
    ? baseOutputPerInteraction * cfg.reasoningMultiplier
    : baseOutputPerInteraction;
  const reasoningTokensPerInteraction = reasoningActive
    ? Math.round(baseOutputPerInteraction * (cfg.reasoningMultiplier - 1))
    : 0;

  // With agentic multiplier (each tool call can add intermediate tokens)
  const totalInputPerUserAction = inputPerInteraction * callsPerInteraction;
  const totalOutputPerUserAction = outputPerInteraction * callsPerInteraction;

  // Cache savings on input
  const cacheRatio = cfg.cacheRatio;
  const cachedInput = totalInputPerUserAction * cacheRatio;
  const freshInput = totalInputPerUserAction * (1 - cacheRatio);

  const cacheReadPrice = model.cache ?? model.in; // models without caching pay full input price
  const costPerInteractionInput = (freshInput / 1_000_000) * model.in + (cachedInput / 1_000_000) * cacheReadPrice;
  const costPerInteractionOutput = (totalOutputPerUserAction / 1_000_000) * model.out;

  // Cache write cost (amortized over expected reuses), with multi-TTL support
  const cacheWritePrice = (model.cacheWrite5min || model.cacheWrite1hr)
    ? (cfg.cacheTTL === "1hr" ? model.cacheWrite1hr : model.cacheWrite5min) || model.cacheWrite
    : (model.cacheWrite || 0);
  const cacheWriteCost = cacheWritePrice ? (cachedInput / 1_000_000) * cacheWritePrice / cfg.cacheReuses : 0;

  const costPerInteraction = costPerInteractionInput + costPerInteractionOutput + cacheWriteCost;

  // Volume
  const interactionsPerDay = cfg.dau * cfg.sessionsPerUser * cfg.interactionsPerSession;
  const interactionsPerMonth = interactionsPerDay * 30;

  let dailyCost = costPerInteraction * interactionsPerDay;
  let monthlyCost = dailyCost * 30;
  let annualCost = dailyCost * 365;

  // Infrastructure overhead buffer (M4-2)
  if (cfg.overheadBuffer > 0) {
    dailyCost *= (1 + cfg.overheadBuffer);
    monthlyCost *= (1 + cfg.overheadBuffer);
    annualCost *= (1 + cfg.overheadBuffer);
  }

  const costPerMAU = monthlyCost / cfg.mau;

  const reasoningTokensTotal = reasoningTokensPerInteraction * callsPerInteraction;
  const visibleOutputTotal = baseOutputPerInteraction * callsPerInteraction;

  const tokenBreakdown = {
    systemPrompt: cfg.systemPrompt * callsPerInteraction,
    ragContext: cfg.ragContext * callsPerInteraction,
    userInput: cfg.userInput * callsPerInteraction,
    history: Math.round(avgHistory * callsPerInteraction),
    output: visibleOutputTotal,
  };
  if (reasoningTokensTotal > 0) {
    tokenBreakdown.reasoning = reasoningTokensTotal;
  }

  return {
    model,
    inputPerInteraction: Math.round(totalInputPerUserAction),
    outputPerInteraction: Math.round(totalOutputPerUserAction),
    reasoningTokens: reasoningTokensTotal,
    cachedInput: Math.round(cachedInput),
    costPerInteraction,
    costPerInteractionInput,
    costPerInteractionOutput,
    cacheWriteCostPerInteraction: cacheWriteCost,
    interactionsPerDay: Math.round(interactionsPerDay),
    interactionsPerMonth: Math.round(interactionsPerMonth),
    dailyCost,
    monthlyCost,
    annualCost,
    costPerMAU,
    tokenBreakdown,
    overheadBuffer: cfg.overheadBuffer || 0,
  };
}

// ─── SAVE/LOAD CONFIGURATIONS (M3-4) ─────────────────────────────────────────

const STORAGE_KEY = "llm-cost-framework-configs";
const AUTO_SAVE_KEY = "llm-cost-framework-autosave";

function saveConfigToStorage(name, cfg) {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  saved.push({ name, cfg, savedAt: Date.now() });
  if (saved.length > 20) saved.shift();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  return saved;
}

function loadConfigsFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
}

function deleteConfigFromStorage(index) {
  const saved = loadConfigsFromStorage();
  saved.splice(index, 1);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  return saved;
}

function autoSaveToStorage(cfg, step) {
  try {
    localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify({ cfg, step, savedAt: Date.now() }));
  } catch { /* quota exceeded, ignore */ }
}

function loadAutoSave() {
  try {
    const data = JSON.parse(localStorage.getItem(AUTO_SAVE_KEY));
    return data && data.cfg ? data : null;
  } catch { return null; }
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// Sanitize a value for CSV to prevent formula injection in spreadsheet apps
function csvSafe(val) {
  const s = String(val);
  if (/^[=+\-@\t\r]/.test(s)) return `"'${s.replace(/"/g, '""')}"`;
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Sanitize a string for safe use in Markdown headings
function mdSafe(val) {
  return String(val).replace(/[#*\[\]<>`|\\]/g, "");
}

// Allowed cfg keys for URL param and localStorage restoration
const ALLOWED_CFG_KEYS = new Set([
  "modelId", "systemPrompt", "ragContext", "userInput", "output",
  "agenticMult", "historyDepth", "avgTurnsHistory", "mau", "dau",
  "sessionsPerUser", "interactionsPerSession", "cacheRatio", "cacheReuses",
  "cacheTTL", "reasoningMultiplier", "overheadBuffer", "embeddingEnabled",
  "embeddingModel", "embeddingDocsPerDay", "embeddingDocTokens",
]);

// Validate and sanitize a restored cfg object (from localStorage or URL params)
function validateCfg(raw) {
  if (!raw || typeof raw !== "object") return {};
  const safe = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!ALLOWED_CFG_KEYS.has(k)) continue;
    safe[k] = v;
  }
  return safe;
}

function buildCSVRows(cfg, result, label) {
  const prefix = label ? `[${label}] ` : "";
  return [
    [`${prefix}Model`, result.model.label],
    [`${prefix}Provider`, result.model.provider],
    [`${prefix}Tier`, result.model.tier],
    [`${prefix}System Prompt (tokens)`, cfg.systemPrompt],
    [`${prefix}RAG Context (tokens)`, cfg.ragContext],
    [`${prefix}User Input (tokens)`, cfg.userInput],
    [`${prefix}Output (tokens)`, cfg.output],
    [`${prefix}Reasoning Multiplier`, cfg.reasoningMultiplier],
    [`${prefix}Reasoning Tokens/Interaction`, result.reasoningTokens],
    [`${prefix}Agentic Multiplier`, cfg.agenticMult],
    [`${prefix}History Depth`, cfg.historyDepth],
    [`${prefix}Cache Ratio`, cfg.cacheRatio],
    [`${prefix}Cache Reuses`, cfg.cacheReuses],
    [`${prefix}Cache TTL`, cfg.cacheTTL],
    [`${prefix}MAU`, cfg.mau],
    [`${prefix}DAU`, cfg.dau],
    [`${prefix}Sessions/User/Day`, cfg.sessionsPerUser],
    [`${prefix}Interactions/Session`, cfg.interactionsPerSession],
    [`${prefix}Cost per Interaction`, result.costPerInteraction.toFixed(6)],
    [`${prefix}Input Cost/Interaction`, result.costPerInteractionInput.toFixed(6)],
    [`${prefix}Output Cost/Interaction`, result.costPerInteractionOutput.toFixed(6)],
    [`${prefix}Cache Write Cost/Interaction`, result.cacheWriteCostPerInteraction.toFixed(6)],
    [`${prefix}Daily Cost`, result.dailyCost.toFixed(2)],
    [`${prefix}Monthly Cost`, result.monthlyCost.toFixed(2)],
    [`${prefix}Annual Cost`, result.annualCost.toFixed(2)],
    [`${prefix}Cost per MAU`, result.costPerMAU.toFixed(4)],
    [`${prefix}Daily Interactions`, result.interactionsPerDay],
    [`${prefix}Monthly Interactions`, result.interactionsPerMonth],
    [`${prefix}Input Tokens/Interaction`, result.inputPerInteraction],
    [`${prefix}Output Tokens/Interaction`, result.outputPerInteraction],
  ];
}

function exportCSV(cfg, result, cfgB, resultB, appName) {
  let rows = [["Metric", "Value"]];
  if (appName) rows.push(["App Name", csvSafe(appName)]);
  if (cfgB && resultB) {
    rows.push(...buildCSVRows(cfg, result, "Scenario A"));
    rows.push(["", ""]);
    rows.push(...buildCSVRows(cfgB, resultB, "Scenario B"));
    rows.push(["", ""]);
    const delta = resultB.monthlyCost - result.monthlyCost;
    const deltaPct = result.monthlyCost !== 0 ? (delta / result.monthlyCost * 100) : 0;
    rows.push(["[Delta] Monthly Cost", `${delta.toFixed(2)} (${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%)`]);
    rows.push(["[Delta] Annual Cost", (resultB.annualCost - result.annualCost).toFixed(2)]);
    rows.push(["[Delta] Cost per MAU", (resultB.costPerMAU - result.costPerMAU).toFixed(4)]);
    rows.push(["[Delta] Cost per Interaction", (resultB.costPerInteraction - result.costPerInteraction).toFixed(6)]);
  } else {
    rows.push(...buildCSVRows(cfg, result, null));
  }
  const csv = rows.map(r => r.map(c => csvSafe(c)).join(",")).join("\n");
  const filename = appName ? `${appName.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase()}-cost-analysis.csv` : "llm-cost-analysis.csv";
  downloadFile(csv, filename, "text/csv");
}

function buildJSONResult(result) {
  return {
    model: result.model.label,
    provider: result.model.provider,
    costPerInteraction: result.costPerInteraction,
    costPerInteractionInput: result.costPerInteractionInput,
    costPerInteractionOutput: result.costPerInteractionOutput,
    cacheWriteCostPerInteraction: result.cacheWriteCostPerInteraction,
    dailyCost: result.dailyCost,
    monthlyCost: result.monthlyCost,
    annualCost: result.annualCost,
    costPerMAU: result.costPerMAU,
    interactionsPerDay: result.interactionsPerDay,
    interactionsPerMonth: result.interactionsPerMonth,
    inputPerInteraction: result.inputPerInteraction,
    outputPerInteraction: result.outputPerInteraction,
    reasoningTokens: result.reasoningTokens,
    tokenBreakdown: result.tokenBreakdown,
  };
}

function exportJSON(cfg, result, cfgB, resultB, appName) {
  const data = {
    ...(appName ? { appName } : {}),
    scenarioA: {
      configuration: cfg,
      results: buildJSONResult(result),
    },
  };
  if (cfgB && resultB) {
    data.scenarioB = {
      configuration: cfgB,
      results: buildJSONResult(resultB),
    };
    data.delta = {
      monthlyCost: resultB.monthlyCost - result.monthlyCost,
      monthlyCostPct: result.monthlyCost !== 0 ? ((resultB.monthlyCost - result.monthlyCost) / result.monthlyCost * 100) : 0,
      annualCost: resultB.annualCost - result.annualCost,
      costPerMAU: resultB.costPerMAU - result.costPerMAU,
      costPerInteraction: resultB.costPerInteraction - result.costPerInteraction,
    };
  }
  const filename = appName ? `${appName.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase()}-cost-analysis.json` : "llm-cost-analysis.json";
  downloadFile(JSON.stringify(data, null, 2), filename, "application/json");
}

function buildMarkdownScenario(cfg, result, label) {
  const m = result.model;
  const lines = [];
  if (label) lines.push(`### ${label}`);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Model | ${m.label} (${m.provider}) |`);
  lines.push(`| Tier | ${m.tier} |`);
  lines.push(`| System Prompt | ${cfg.systemPrompt.toLocaleString()} tokens |`);
  lines.push(`| RAG Context | ${cfg.ragContext.toLocaleString()} tokens |`);
  lines.push(`| User Input | ${cfg.userInput.toLocaleString()} tokens |`);
  lines.push(`| Output | ${cfg.output.toLocaleString()} tokens |`);
  lines.push(`| Agentic Multiplier | ${cfg.agenticMult}x |`);
  lines.push(`| History Depth | ${cfg.historyDepth} turns |`);
  if (result.reasoningTokens > 0) lines.push(`| Reasoning Multiplier | ${cfg.reasoningMultiplier}x |`);
  lines.push(`| Cache Ratio | ${(cfg.cacheRatio * 100).toFixed(0)}% |`);
  lines.push(`| Cache TTL | ${cfg.cacheTTL} |`);
  lines.push(`| MAU | ${cfg.mau.toLocaleString()} |`);
  lines.push(`| DAU | ${cfg.dau.toLocaleString()} |`);
  lines.push(`| Sessions/User/Day | ${cfg.sessionsPerUser} |`);
  lines.push(`| Interactions/Session | ${cfg.interactionsPerSession} |`);
  lines.push(``);
  lines.push(`**Cost Summary**`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Cost per Interaction | $${result.costPerInteraction.toFixed(6)} |`);
  lines.push(`| Daily Cost | ${fmt(result.dailyCost)} |`);
  lines.push(`| Monthly Cost | ${fmt(result.monthlyCost)} |`);
  lines.push(`| Annual Cost | ${fmt(result.annualCost)} |`);
  lines.push(`| Cost per MAU | $${result.costPerMAU.toFixed(4)} |`);
  lines.push(`| Daily Interactions | ${result.interactionsPerDay.toLocaleString()} |`);
  lines.push(`| Monthly Interactions | ${result.interactionsPerMonth.toLocaleString()} |`);
  return lines.join("\n");
}

function exportMarkdown(cfg, result, cfgB, resultB, appName) {
  const lines = [];
  lines.push(`# ${appName ? mdSafe(appName) : "LLM Cost Analysis"}`);
  lines.push(``);
  lines.push(`> Generated by LLM Cost Framework v${FRAMEWORK_VERSION} on ${new Date().toLocaleDateString()}`);
  lines.push(``);

  if (cfgB && resultB) {
    lines.push(buildMarkdownScenario(cfg, result, "Scenario A"));
    lines.push(``);
    lines.push(buildMarkdownScenario(cfgB, resultB, "Scenario B"));
    lines.push(``);
    const delta = resultB.monthlyCost - result.monthlyCost;
    const deltaPct = result.monthlyCost !== 0 ? (delta / result.monthlyCost * 100) : 0;
    lines.push(`### Delta`);
    lines.push(``);
    lines.push(`| Metric | Delta |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Monthly Cost | ${fmt(delta)} (${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%) |`);
    lines.push(`| Annual Cost | ${fmt(resultB.annualCost - result.annualCost)} |`);
    lines.push(`| Cost per MAU | $${(resultB.costPerMAU - result.costPerMAU).toFixed(4)} |`);
  } else {
    lines.push(buildMarkdownScenario(cfg, result, null));
  }

  lines.push(``);
  lines.push(`---`);
  lines.push(`*Pricing data: ${PRICING_DATE}*`);

  const md = lines.join("\n");
  const filename = appName ? `${appName.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase()}-cost-analysis.md` : "llm-cost-analysis.md";
  downloadFile(md, filename, "text/markdown");
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function Pill({ children, color = "amber", t }) {
  const darkColors = {
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    blue:  "bg-blue-500/15 text-blue-300 border-blue-500/30",
    green: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    red:   "bg-red-500/15 text-red-300 border-red-500/30",
    slate: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  };
  const lightColors = {
    amber: "bg-amber-100 text-amber-800 border-amber-300/50",
    blue:  "bg-blue-100 text-blue-800 border-blue-300/50",
    green: "bg-emerald-100 text-emerald-800 border-emerald-300/50",
    red:   "bg-red-100 text-red-800 border-red-300/50",
    slate: "bg-gray-100 text-gray-700 border-gray-300/50",
  };
  const colors = t && t.bg === "bg-gray-50" ? lightColors : darkColors;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${colors[color]}`}>
      {children}
    </span>
  );
}

function InfoTooltip({ text, t }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex ml-1">
      <button
        onClick={() => setOpen(!open)}
        onBlur={() => setOpen(false)}
        className={`w-5 h-5 sm:w-4 sm:h-4 rounded-full ${t.infoBtnBg} ${t.infoBtnText} text-[10px] flex items-center justify-center ${t.infoBtnHover} focus:outline-none focus:ring-1 focus:ring-amber-500`}
        aria-label="More info"
        style={{ minWidth: "20px", minHeight: "20px" }}
      >
        i
      </button>
      {open && (
        <div className={`absolute z-50 bottom-6 left-1/2 -translate-x-1/2 w-56 sm:w-64 p-3 rounded-lg ${t.tooltipBg} border ${t.tooltipBorder} text-xs ${t.tooltipText} shadow-xl leading-relaxed`}>
          {text}
        </div>
      )}
    </span>
  );
}

function SliderField({ label, sublabel, value, min, max, step = 1, onChange, display, tooltip, t }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        <label className={`text-xs sm:text-sm font-medium ${t.textSecondary}`}>{label}{tooltip && <InfoTooltip text={tooltip} t={t} />}</label>
        <span className={`text-xs sm:text-sm font-mono ${t.accent}`}>{display || value}</span>
      </div>
      {sublabel && <p className={`text-xs ${t.textTertiary}`}>{sublabel}</p>}
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={`w-full h-2 sm:h-1.5 rounded-full appearance-none cursor-pointer accent-amber-400 ${t.bgSlider} min-h-[44px] sm:min-h-0`}
        style={{ touchAction: "none" }}
      />
      <div className={`flex justify-between text-[10px] sm:text-xs ${t.textQuaternary} font-mono`}>
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

function TokenBar({ breakdown, t }) {
  const colors = {
    systemPrompt: "#f59e0b",
    ragContext:   "#3b82f6",
    userInput:    "#8b5cf6",
    history:      "#64748b",
    output:       "#10b981",
    reasoning:    "#ef4444",
  };
  const labels = {
    systemPrompt: "System Prompt",
    ragContext:   "RAG / Context",
    userInput:    "User Input",
    history:      "History",
    output:       "Output",
    reasoning:    "Reasoning (hidden)",
  };
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {Object.entries(breakdown).map(([k, v]) => (
          <div
            key={k}
            style={{ width: `${(v / total) * 100}%`, backgroundColor: colors[k] }}
            title={`${labels[k]}: ${fmtTokens(v)} tokens`}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
        {Object.entries(breakdown).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs">
            <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: colors[k] }} />
            <span className={`${t.textMuted} flex-1`}>{labels[k]}</span>
            <span className={`font-mono ${t.textSecondary}`}>{fmtTokens(v)}</span>
          </div>
        ))}
        <div className={`col-span-1 sm:col-span-2 flex items-center gap-1.5 text-xs border-t ${t.border} pt-1 mt-0.5`}>
          <div className={`w-2 h-2 rounded-sm flex-shrink-0 ${t.bgDot}`} />
          <span className={`${t.textSecondary} flex-1 font-medium`}>Total / interaction</span>
          <span className={`font-mono ${t.accent} font-bold`}>{fmtTokens(total)}</span>
        </div>
      </div>
    </div>
  );
}

function ScenarioCard({ label, cost, highlight = false, sub, t }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-amber-500/50 bg-amber-500/8" : `${t.border} ${t.bgCardHalf}`}`}>
      <div className={`text-xs sm:text-sm ${t.textMuted} mb-1`}>{label}</div>
      <div className={`text-lg sm:text-xl font-mono font-bold ${highlight ? t.accent : t.text}`}>{fmt(cost)}</div>
      {sub && <div className={`text-xs ${t.textTertiary} mt-1`}>{sub}</div>}
    </div>
  );
}

function ModelComparison({ cfg, t }) {
  const allResults = MODELS.map(m => {
    const r = calcCosts({ ...cfg, modelId: m.id });
    return { model: m, monthly: r?.monthlyCost, perInteraction: r?.costPerInteraction };
  });
  const max = Math.max(...allResults.map(r => r.monthly));
  const tierOrder = { premium: 0, mid: 1, economy: 2 };

  return (
    <div className="space-y-1">
      {["Anthropic", "OpenAI", "Google"].map(provider => {
        const providerResults = allResults
          .filter(r => r.model.provider === provider)
          .sort((a, b) => {
            if (a.model.deprecated !== b.model.deprecated) return a.model.deprecated ? 1 : -1;
            return (tierOrder[a.model.tier] || 99) - (tierOrder[b.model.tier] || 99);
          });
        return (
          <div key={provider}>
            <div className={`text-xs ${t.textTertiary} font-semibold uppercase tracking-wider mt-3 mb-1.5`}>{provider}</div>
            {providerResults.map(({ model, monthly, perInteraction }) => (
              <div key={model.id} className={`flex items-center gap-2 sm:gap-3 mb-1 ${model.id === cfg.modelId ? "opacity-100" : "opacity-60"} ${model.deprecated ? "opacity-30" : ""}`}>
                <div className={`w-28 sm:w-36 text-xs ${t.textSecondary} truncate flex-shrink-0`}>{model.label}</div>
                <div className={`flex-1 h-2 ${t.bgBarTrack} rounded-full overflow-hidden`}>
                  <div
                    className={`h-full rounded-full ${model.id === cfg.modelId ? "bg-amber-400" : tierColor(model.tier)}`}
                    style={{ width: `${(monthly / max) * 100}%` }}
                  />
                </div>
                <div className={`w-20 text-right font-mono text-xs ${t.textSecondary} flex-shrink-0`}>{fmt(monthly)}/mo</div>
                <div className="hidden sm:block">
                  <Pill color={model.tier === "premium" ? "red" : model.tier === "mid" ? "blue" : "green"} t={t}>
                    {model.tier}
                  </Pill>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function tierColor(tier) {
  return tier === "premium" ? "bg-red-400" : tier === "mid" ? "bg-blue-400" : "bg-emerald-400";
}

// ─── SENSITIVITY ANALYSIS (M3-2) ─────────────────────────────────────────────

const SENSITIVITY_PARAMS = [
  { key: "systemPrompt", label: "System Prompt", unit: "tokens" },
  { key: "ragContext", label: "RAG Context", unit: "tokens" },
  { key: "userInput", label: "User Input", unit: "tokens" },
  { key: "output", label: "Output", unit: "tokens" },
  { key: "agenticMult", label: "Agentic Multiplier", unit: "x" },
  { key: "historyDepth", label: "History Depth", unit: "turns" },
  { key: "dau", label: "DAU", unit: "users" },
  { key: "sessionsPerUser", label: "Sessions/User", unit: "" },
  { key: "interactionsPerSession", label: "Interactions/Session", unit: "" },
  { key: "cacheRatio", label: "Cache Ratio", unit: "%" },
];

function runSensitivityAnalysis(cfg, range = 0.25, enabledParams = null) {
  const baseCost = calcCosts(cfg).monthlyCost;
  return SENSITIVITY_PARAMS
    .filter(p => enabledParams === null || enabledParams[p.key])
    .map(p => {
      const val = cfg[p.key];
      let lowVal = Math.max(0, val * (1 - range));
      let highVal = val * (1 + range);
      // Clamp cacheRatio between 0 and 1
      if (p.key === "cacheRatio") {
        lowVal = Math.max(0, lowVal);
        highVal = Math.min(1.0, highVal);
      }
      const costLow = calcCosts({ ...cfg, [p.key]: lowVal }).monthlyCost;
      const costHigh = calcCosts({ ...cfg, [p.key]: highVal }).monthlyCost;
      return {
        ...p,
        baseCost,
        costLow,
        costHigh,
        delta: Math.abs(costHigh - costLow),
        lowVal,
        highVal,
      };
    })
    .sort((a, b) => b.delta - a.delta);
}

function TornadoChart({ cfg, range, enabledParams, t }) {
  const [selectedBar, setSelectedBar] = useState(null);
  const data = useMemo(() => runSensitivityAnalysis(cfg, range, enabledParams), [cfg, range, enabledParams]);

  if (data.length === 0) {
    return <p className={`text-xs ${t.textTertiary}`}>No parameters selected for analysis.</p>;
  }

  const maxDelta = Math.max(...data.map(d => Math.max(Math.abs(d.costHigh - d.baseCost), Math.abs(d.baseCost - d.costLow))));
  const topDriver = data[0];

  return (
    <div className="space-y-4">
      {/* Summary sentence (M3-12) */}
      <p className={`text-sm font-semibold ${t.text} mb-1`}>What drives your costs?</p>
      <p className={`text-xs ${t.textSecondary} leading-relaxed`}>
        Your top cost driver is <span className={`font-semibold ${t.accent}`}>{topDriver.label}</span>, which causes a{" "}
        <span className={`font-mono font-semibold ${t.accent}`}>{fmt(topDriver.delta)}</span> variation in monthly cost when changed by{" "}
        <span className={`font-mono ${t.textSubtle}`}>&plusmn;{Math.round(range * 100)}%</span>.
      </p>

      {/* Tornado bars */}
      <div className="space-y-1.5">
        {data.map((d) => {
          const leftDelta = d.baseCost - d.costLow;
          const rightDelta = d.costHigh - d.baseCost;
          const leftPct = maxDelta > 0 ? (Math.abs(leftDelta) / maxDelta) * 100 : 0;
          const rightPct = maxDelta > 0 ? (Math.abs(rightDelta) / maxDelta) * 100 : 0;
          const isSelected = selectedBar === d.key;

          return (
            <div key={d.key}>
              <div
                className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${
                  isSelected ? t.bgHover.replace("hover:", "") : t.bgCardHover
                }`}
                onClick={() => setSelectedBar(isSelected ? null : d.key)}
              >
                {/* Label */}
                <div className={`w-20 sm:w-36 text-xs ${t.textSecondary} truncate flex-shrink-0 text-right pr-2`}>
                  {d.label}
                </div>

                {/* Bar area */}
                <div className="flex-1 flex items-center" style={{ minHeight: "20px" }}>
                  {/* Left half (decrease) */}
                  <div className="flex-1 flex justify-end">
                    <div
                      className="h-5 rounded-l"
                      style={{
                        width: `${leftPct}%`,
                        minWidth: leftPct > 0 ? "2px" : "0",
                        background: "linear-gradient(90deg, #0e7490, #22d3ee)",
                      }}
                      title={`-${Math.round(range * 100)}%: ${fmt(d.costLow)}`}
                    />
                  </div>

                  {/* Center line */}
                  <div className={`w-px h-6 ${t.borderMid.replace("border", "bg")} flex-shrink-0`} />

                  {/* Right half (increase) */}
                  <div className="flex-1">
                    <div
                      className="h-5 rounded-r"
                      style={{
                        width: `${rightPct}%`,
                        minWidth: rightPct > 0 ? "2px" : "0",
                        background: "linear-gradient(90deg, #f59e0b, #d97706)",
                      }}
                      title={`+${Math.round(range * 100)}%: ${fmt(d.costHigh)}`}
                    />
                  </div>
                </div>

                {/* Delta label + range */}
                <div className="w-16 sm:w-32 text-right flex-shrink-0">
                  <div className={`text-xs font-mono ${t.textMuted}`}>{fmt(d.delta)}</div>
                  <div className={`hidden sm:block text-[10px] font-mono ${t.textTertiary}`}>{fmt(d.costLow)} &mdash; {fmt(d.costHigh)}</div>
                </div>
              </div>

              {/* Detail panel on click */}
              {isSelected && (
                <div className={`ml-2 sm:ml-40 mr-2 sm:mr-20 mb-2 p-3 rounded-lg ${t.bgCardDense} border ${t.border} text-xs space-y-1.5`}>
                  <div className={`font-semibold ${t.textSubtle}`}>{d.label}</div>
                  <div className={`grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 ${t.textMuted}`}>
                    <div>
                      Low value ({d.unit}): <span className="font-mono text-cyan-400">
                        {d.key === "cacheRatio" ? `${(d.lowVal * 100).toFixed(1)}%` : d.lowVal.toFixed(d.lowVal % 1 !== 0 ? 2 : 0)}
                      </span>
                    </div>
                    <div>
                      High value ({d.unit}): <span className={`font-mono ${t.accent}`}>
                        {d.key === "cacheRatio" ? `${(d.highVal * 100).toFixed(1)}%` : d.highVal.toFixed(d.highVal % 1 !== 0 ? 2 : 0)}
                      </span>
                    </div>
                    <div>
                      Cost at low: <span className="font-mono text-cyan-400">{fmt(d.costLow)}</span>
                    </div>
                    <div>
                      Cost at high: <span className={`font-mono ${t.accent}`}>{fmt(d.costHigh)}</span>
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      Base cost: <span className={`font-mono ${t.text}`}>{fmt(d.baseCost)}</span>
                      {" | "}Delta: <span className={`font-mono ${t.accent}`}>{fmt(d.delta)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className={`flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs ${t.textTertiary} pt-2 border-t ${t.borderSoft}`}>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm" style={{ background: "linear-gradient(90deg, #0e7490, #22d3ee)" }} />
          <span>Decrease (-{Math.round(range * 100)}%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-px h-3 ${t.borderMid.replace("border", "bg")}`} />
          <span>Base cost</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm" style={{ background: "linear-gradient(90deg, #f59e0b, #d97706)" }} />
          <span>Increase (+{Math.round(range * 100)}%)</span>
        </div>
      </div>
    </div>
  );
}

function SensitivityControls({ range, onRangeChange, enabledParams, onParamsChange, t }) {
  const rangeOptions = [
    { value: 0.10, label: "10%" },
    { value: 0.25, label: "25%" },
    { value: 0.50, label: "50%" },
  ];

  return (
    <div className="space-y-4 mb-4">
      {/* Range selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <span className={`text-xs sm:text-sm ${t.textMuted} font-medium`}>Variation range:</span>
        <div className="flex gap-1.5">
          {rangeOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => onRangeChange(opt.value)}
              className={`px-3 py-1.5 sm:py-1 rounded text-xs font-mono transition-all min-h-[44px] sm:min-h-0 ${
                range === opt.value
                  ? `bg-amber-500 ${t.textInvert} font-semibold`
                  : `${t.bgSlider} ${t.textMuted} ${t.bgHoverSolid}`
              }`}
            >
              &plusmn;{opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Parameter checkboxes */}
      <div>
        <span className={`text-xs sm:text-sm ${t.textMuted} font-medium block mb-2`}>Parameters to analyze:</span>
        <div className="flex flex-wrap gap-x-4 gap-y-2 sm:gap-y-1.5">
          {SENSITIVITY_PARAMS.map(p => (
            <label key={p.key} className={`flex items-center gap-1.5 text-xs sm:text-sm ${t.textMuted} cursor-pointer min-h-[44px] sm:min-h-0`}>
              <input
                type="checkbox"
                checked={enabledParams[p.key]}
                onChange={() => onParamsChange({ ...enabledParams, [p.key]: !enabledParams[p.key] })}
                className={`rounded ${t.borderInput} ${t.bgInput} text-amber-500 focus:ring-amber-500 w-4 h-4 sm:w-3.5 sm:h-3.5 accent-amber-500`}
              />
              {p.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── COLLAPSIBLE SECTION (M3-7) ──────────────────────────────────────────────

function CollapsibleSection({ title, defaultExpanded = true, children, t }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className={`rounded-xl border ${t.border} ${t.bgCardSoft} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between p-4 sm:p-5 text-sm font-semibold ${t.text} ${t.bgCardHover} transition-colors min-h-[44px]`}
      >
        {title}
        <span
          className={`${t.textTertiary} transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          style={{ display: "inline-block" }}
        >
          ▼
        </span>
      </button>
      {expanded && <div className="px-3 sm:px-5 pb-4 sm:pb-5">{children}</div>}
    </div>
  );
}

// ─── TOKEN ESTIMATOR (M4-1) ─────────────────────────────────────────────────

const TOKEN_CONTENT_TYPES = [
  { id: "prose", label: "English prose", charsPerToken: 4 },
  { id: "code", label: "Code", charsPerToken: 3.5 },
  { id: "json", label: "JSON / structured data", charsPerToken: 3 },
];

function TokenEstimator({ onUseFor, t }) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const [contentType, setContentType] = useState("prose");

  const selected = TOKEN_CONTENT_TYPES.find(ct => ct.id === contentType);
  const estimatedTokens = text.length > 0 ? Math.ceil(text.length / selected.charsPerToken) : 0;

  const fields = [
    { key: "systemPrompt", label: "System Prompt" },
    { key: "ragContext", label: "RAG Context" },
    { key: "userInput", label: "User Input" },
    { key: "output", label: "Output" },
  ];

  return (
    <div className={`rounded-xl border ${t.border} ${t.bgCardSoft} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between p-4 text-xs sm:text-sm font-semibold ${t.textMuted} ${t.bgCardHover} transition-colors min-h-[44px]`}
      >
        <span>Paste Text to Estimate Tokens</span>
        <span className={`${t.textTertiary} transition-transform ${expanded ? "rotate-180" : ""}`}>&#9662;</span>
      </button>
      {expanded && (
        <div className="px-3 sm:px-4 pb-4 space-y-3">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste your text here to estimate token count..."
            className={`w-full h-28 rounded-lg border ${t.border} ${t.bgAlt} text-xs ${t.textSecondary} p-3 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-y`}
          />

          <div className="flex items-center gap-3">
            <label className={`text-xs ${t.textMuted} flex-shrink-0`}>Content type:</label>
            <select
              value={contentType}
              onChange={e => setContentType(e.target.value)}
              className={`flex-1 ${t.bgInput} border ${t.border} rounded text-xs ${t.textSecondary} px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500`}
            >
              {TOKEN_CONTENT_TYPES.map(ct => (
                <option key={ct.id} value={ct.id}>{ct.label} (~{ct.charsPerToken} chars/token)</option>
              ))}
            </select>
          </div>

          {text.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-xs ${t.textMuted}`}>
                  {text.length.toLocaleString()} characters &rarr;
                </span>
                <span className={`text-sm font-mono font-bold ${t.accent}`}>
                  ~{estimatedTokens.toLocaleString()} tokens
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {fields.map(f => (
                  <button
                    key={f.key}
                    onClick={() => onUseFor(f.key, estimatedTokens)}
                    className="px-2.5 py-1.5 sm:py-1 rounded text-xs sm:text-[10px] font-medium bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors border border-amber-500/20 min-h-[44px] sm:min-h-0"
                  >
                    Use for {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className={`text-[10px] ${t.textTertiary} leading-relaxed`}>
            This is an estimate. Actual token counts vary by model and tokenizer. Use provider tokenizer tools for precise counts.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── RECOMMENDATION ENGINE ──────────────────────────────────────────────────

function RecommendationEngine({ result, cfg, archetype, t }) {
  const recs = [];

  if (cfg.cacheRatio < 0.4 && cfg.systemPrompt > 500) {
    recs.push({ type: "cache", label: "Enable prompt caching", impact: "high", detail: `Your system prompt (${fmtTokens(cfg.systemPrompt)} tokens) is large enough to benefit significantly from prompt caching. Could reduce input costs by up to 90% on cached content.` });
  }
  if (result.outputPerInteraction > 800) {
    recs.push({ type: "output", label: "Constrain output length", impact: "high", detail: `Output tokens (${fmtTokens(result.outputPerInteraction)}) are expensive. Adding structured output constraints or max_tokens limits could save ${fmt(result.monthlyCost * 0.25)}/mo.` });
  }
  const isAgenticCandidate = cfg.agenticMult > 3 && result.model.tier !== "economy";
  const isHighVolumeCandidate = result.monthlyCost > 5000 && (result.model.tier === "premium" || result.model.tier === "mid");

  if (isAgenticCandidate || isHighVolumeCandidate) {
    const detail = isAgenticCandidate
      ? `With ${cfg.agenticMult} LLM calls per interaction, consider routing tool calls and intermediate reasoning to Haiku/Flash (10-20x cheaper) while reserving the primary model for final synthesis.`
      : `At ${fmt(result.monthlyCost)}/mo with a ${result.model.tier}-tier model, consider routing simple or repetitive calls to an economy-tier model. Could save ${fmt(result.monthlyCost * 0.4)}-${fmt(result.monthlyCost * 0.6)}/mo.`;
    recs.push({ type: "model", label: "Use economy model for sub-tasks", impact: "medium", detail });
  }
  // M3-11: Broader model routing recommendation for high-volume non-economy scenarios
  if (result.monthlyCost > 10000 && result.model.tier !== "economy") {
    const cheapestEconomy = MODELS.filter(m => m.tier === "economy" && !m.deprecated)
      .sort((a, b) => a.out - b.out)[0];
    if (cheapestEconomy) {
      const economyResult = calcCosts({ ...cfg, modelId: cheapestEconomy.id });
      if (economyResult) {
        const savingsEstimate = result.monthlyCost * 0.8 - economyResult.monthlyCost * 0.8;
        recs.push({
          type: "routing",
          label: "Implement model routing for high-volume savings",
          impact: "high",
          detail: `Routing 80% of calls to ${cheapestEconomy.label} could save approximately ${fmt(savingsEstimate)}/month. Reserve your current ${result.model.label} for the 20% of calls requiring its full capability.`,
        });
      }
    }
  }
  if (cfg.historyDepth > 6) {
    recs.push({ type: "history", label: "Compress conversation history", impact: "medium", detail: `Carrying ${cfg.historyDepth} turns of history adds significant tokens. Implement sliding window + compression to reduce history overhead by 50-70%.` });
  }
  if (result.costPerMAU > 2) {
    recs.push({ type: "monetization", label: "Consider usage tiering", impact: "strategic", detail: `At ${fmt(result.costPerMAU)}/MAU, a freemium model with usage caps or per-seat pricing may be necessary to reach positive unit economics.` });
  }
  if (cfg.interactionsPerSession > 10 && cfg.agenticMult > 1) {
    recs.push({ type: "architecture", label: "Cache intermediate agent state", impact: "medium", detail: "High interaction depth with multi-step agents creates compounding costs. Persisting agent memory/state between calls can avoid redundant re-processing." });
  }
  if (cfg.ragContext > 3000) {
    recs.push({ type: "rag", label: "Optimize RAG precision", impact: "medium", detail: `Large RAG context (${fmtTokens(cfg.ragContext)} tokens) may include irrelevant chunks. Implement chunk optimization, re-ranking, and hybrid search to reduce context by 20-40% while maintaining answer quality.` });
  }
  if (archetype && (archetype.id === "doc-processing" || archetype.id === "classifier")) {
    recs.push({ type: "batch", label: "Use batch API", impact: "high", detail: `${archetype.label} workloads are typically non-real-time. Use batch API endpoints for ~50% cost reduction. Estimated savings: ${fmt(result.monthlyCost * 0.5)}/mo.` });
  }
  if (recs.length === 0) {
    recs.push({ type: "ok", label: "Architecture looks well-optimized", impact: "info", detail: "No significant optimization flags detected for this configuration." });
  }

  const impactColor = { high: "red", medium: "amber", strategic: "blue", info: "green" };
  const impactIcon  = { high: "▲", medium: "►", strategic: "◆", info: "✓" };

  return (
    <div className="space-y-2">
      {recs.map((r, i) => (
        <div key={i} className={`border ${t.border} rounded-lg p-3 ${t.bgCardMid}`}>
          <div className="flex items-center gap-2 mb-1">
            <Pill color={impactColor[r.impact]} t={t}>{impactIcon[r.impact]} {r.impact}</Pill>
            <span className={`text-sm font-medium ${t.textSubtle}`}>{r.label}</span>
          </div>
          <p className={`text-xs ${t.textMuted} leading-relaxed`}>{r.detail}</p>
        </div>
      ))}
    </div>
  );
}

// ─── VALIDATION ──────────────────────────────────────────────────────────────

function getValidationWarnings(cfg) {
  const warnings = [];
  if (cfg.dau > cfg.mau) warnings.push({ field: "dau", msg: "DAU exceeds MAU" });
  if (cfg.cacheRatio > 0 && cfg.systemPrompt + cfg.ragContext < 200) {
    warnings.push({ field: "cacheRatio", msg: "Cacheable content is very small for the selected cache ratio" });
  }
  return warnings;
}

// ─── ASSUMPTIONS PANEL ───────────────────────────────────────────────────────

function AssumptionsPanel({ cfg, model, t }) {
  const limitations = [
    { title: "Super-linear agentic cost growth", description: "The flat agentic multiplier underestimates real agentic costs. Context accumulates across agent steps.", mitigation: "Add 20-40% buffer for agentic features.", relevant: cfg.agenticMult > 3 },
    { title: "Reasoning/thinking tokens", description: "Extended thinking modes generate hidden tokens not directly visible in output.", mitigation: "Treat thinking token budget as additional output cost.", relevant: model?.reasoning },
    { title: "Embedding costs", description: "RAG requires embedding API calls (~$0.02-0.13/1M tokens) not included.", mitigation: "Add embedding cost separately.", relevant: cfg.ragContext > 0 },
    { title: "Infrastructure overhead", description: "Retries, timeouts, error rates add 5-15% token overhead.", mitigation: "Apply a 1.1-1.2x buffer.", relevant: true },
    { title: "Fine-tuning & training costs", description: "One-time or periodic model customization costs not covered.", mitigation: "Evaluate separately.", relevant: false },
    { title: "Context window limits", description: "Some models charge differently beyond certain thresholds.", mitigation: "Check provider pricing tiers.", relevant: false },
    { title: "Guardrail/moderation calls", description: "Additional LLM calls for content moderation not included.", mitigation: "Add as separate line item.", relevant: false },
    { title: "Regional pricing", description: "Some providers charge differently by region or API tier.", mitigation: "Verify with provider.", relevant: false },
  ];

  return (
    <div className="space-y-3">
      {limitations.map((l, i) => (
        <div key={i} className={`text-xs p-3 rounded-lg border ${l.relevant ? "border-amber-500/30 bg-amber-500/5" : `${t.borderSoft} ${t.bgCardSoft}`}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-semibold ${l.relevant ? t.accentDark : t.textMuted}`}>{l.title}</span>
            {l.relevant && <span className={`text-[10px] ${t.accent} bg-amber-500/15 px-1.5 py-0.5 rounded`}>relevant</span>}
          </div>
          <p className={`${t.textTertiary} leading-relaxed`}>{l.description}</p>
          <p className={`${t.textQuaternary} mt-1`}>Mitigation: {l.mitigation}</p>
        </div>
      ))}
    </div>
  );
}

// ─── COMPARISON MODE COMPONENTS (M3-1) ────────────────────────────────────────

function CompactSlider({ label, value, min, max, step = 1, onChange, display, t }) {
  return (
    <div className="flex items-center gap-2">
      <label className={`text-[10px] sm:text-xs ${t.textMuted} w-20 flex-shrink-0 truncate`} title={label}>{label}</label>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={`flex-1 h-1.5 sm:h-1 rounded-full appearance-none cursor-pointer accent-cyan-400 ${t.bgSlider} min-h-[44px] sm:min-h-0`}
        style={{ minWidth: "60px", touchAction: "none" }}
      />
      <span className="text-[10px] sm:text-xs font-mono text-cyan-400 w-14 text-right flex-shrink-0">{display || value}</span>
    </div>
  );
}

function ComparisonControls({ cfgB, setCfgB, t }) {
  const updateB = (key, val) => setCfgB(prev => ({ ...prev, [key]: val }));

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3 space-y-1.5">
      <div className="text-xs font-semibold text-cyan-300 mb-2">Scenario B Controls</div>

      {/* Model selector */}
      <div className="flex items-center gap-2">
        <label className={`text-[10px] sm:text-xs ${t.textMuted} w-20 flex-shrink-0`}>Model</label>
        <select
          value={cfgB.modelId}
          onChange={e => setCfgB(prev => ({
            ...prev,
            modelId: e.target.value,
            reasoningMultiplier: MODELS.find(m => m.id === e.target.value)?.reasoning
              ? (prev.reasoningMultiplier > 1 ? prev.reasoningMultiplier : 2)
              : 1,
          }))}
          className={`flex-1 ${t.bgInput} border ${t.border} rounded text-[10px] sm:text-xs ${t.textSecondary} px-1.5 py-1.5 sm:py-1 focus:outline-none focus:ring-1 focus:ring-cyan-500 min-h-[44px] sm:min-h-0`}
        >
          {["Anthropic", "OpenAI", "Google"].map(provider => (
            <optgroup key={provider} label={provider}>
              {MODELS.filter(m => m.provider === provider && !m.deprecated).map(m => (
                <option key={m.id} value={m.id}>{m.label} (${m.in}/${m.out})</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <CompactSlider label="Sys Prompt" value={cfgB.systemPrompt} min={100} max={8000} step={100}
        onChange={v => updateB("systemPrompt", v)} display={`${fmtTokens(cfgB.systemPrompt)}`} t={t} />
      <CompactSlider label="RAG Context" value={cfgB.ragContext} min={0} max={16000} step={250}
        onChange={v => updateB("ragContext", v)} display={`${fmtTokens(cfgB.ragContext)}`} t={t} />
      <CompactSlider label="User Input" value={cfgB.userInput} min={50} max={4000} step={50}
        onChange={v => updateB("userInput", v)} display={`${fmtTokens(cfgB.userInput)}`} t={t} />
      <CompactSlider label="Output" value={cfgB.output} min={50} max={8000} step={50}
        onChange={v => updateB("output", v)} display={`${fmtTokens(cfgB.output)}`} t={t} />
      <CompactSlider label="Agentic Mult" value={cfgB.agenticMult} min={1} max={15} step={1}
        onChange={v => updateB("agenticMult", v)} display={`x${cfgB.agenticMult}`} t={t} />
      <CompactSlider label="History" value={cfgB.historyDepth} min={0} max={20} step={1}
        onChange={v => updateB("historyDepth", v)} display={`${cfgB.historyDepth} turns`} t={t} />
      <CompactSlider label="MAU" value={cfgB.mau} min={100} max={500000} step={500}
        onChange={v => updateB("mau", v)} display={fmtTokens(cfgB.mau)} t={t} />
      <CompactSlider label="DAU" value={cfgB.dau} min={10} max={500000} step={100}
        onChange={v => updateB("dau", v)} display={fmtTokens(cfgB.dau)} t={t} />
      <CompactSlider label="Sess/User" value={cfgB.sessionsPerUser} min={0.1} max={10} step={0.1}
        onChange={v => updateB("sessionsPerUser", v)} display={cfgB.sessionsPerUser.toFixed(1)} t={t} />
      <CompactSlider label="Interact/Sess" value={cfgB.interactionsPerSession} min={1} max={50} step={1}
        onChange={v => updateB("interactionsPerSession", v)} display={`${cfgB.interactionsPerSession}`} t={t} />
      <CompactSlider label="Cache Ratio" value={cfgB.cacheRatio} min={0} max={1} step={0.05}
        onChange={v => updateB("cacheRatio", v)} display={`${Math.round(cfgB.cacheRatio * 100)}%`} t={t} />
    </div>
  );
}

function DeltaRow({ resultA, resultB, t }) {
  const metrics = [
    { label: "Monthly Cost", valA: resultA.monthlyCost, valB: resultB.monthlyCost },
    { label: "Annual Cost", valA: resultA.annualCost, valB: resultB.annualCost },
    { label: "Cost / MAU", valA: resultA.costPerMAU, valB: resultB.costPerMAU },
    { label: "Cost / Interaction", valA: resultA.costPerInteraction, valB: resultB.costPerInteraction },
  ];

  return (
    <div className={`rounded-xl border ${t.borderMid} ${t.bgCardStrong} p-4`}>
      <div className={`text-xs sm:text-sm font-semibold ${t.text} mb-3`}>Delta (B vs A)</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map(m => {
          const delta = m.valB - m.valA;
          const pct = m.valA !== 0 ? (delta / m.valA * 100) : 0;
          const cheaper = delta < 0;
          const color = delta === 0 ? t.textMuted : cheaper ? "text-emerald-400" : "text-red-400";
          const bgColor = delta === 0 ? t.bgCardHalf : cheaper ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20";

          return (
            <div key={m.label} className={`rounded-lg border ${t.border} p-2.5 ${bgColor}`}>
              <div className={`text-[10px] ${t.textMuted} mb-1`}>{m.label}</div>
              <div className={`text-sm font-mono font-bold ${color}`}>
                {delta >= 0 ? "+" : ""}{fmt(delta)}
              </div>
              <div className={`text-[10px] font-mono ${color}`}>
                {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SAVED CONFIGS DROPDOWN (M3-4) ───────────────────────────────────────────

function SavedConfigsDropdown({ savedConfigs, onSave, onLoad, onDelete, t }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`px-3 py-1.5 rounded-lg border ${t.border} ${t.textMuted} text-xs ${t.bgCardHoverSolid} transition-colors flex items-center gap-1.5`}
      >
        <span>Saved Configs</span>
        <span className={`text-[10px] transition-transform ${open ? "rotate-180" : ""}`}>&#9662;</span>
        {savedConfigs.length > 0 && (
          <span className={`bg-amber-500/20 ${t.accent} text-[10px] rounded-full px-1.5`}>{savedConfigs.length}</span>
        )}
      </button>
      {open && (
        <div className={`absolute right-0 top-full mt-1 w-72 rounded-lg border ${t.border} ${t.bg === "bg-gray-50" ? "bg-white" : "bg-slate-900"} shadow-xl z-50 overflow-hidden`}>
          {/* Save current */}
          <button
            onClick={() => {
              const name = window.prompt("Save configuration as:");
              if (name && name.trim() && name.trim().length <= 100) {
                onSave(name.trim());
                setOpen(false);
              }
            }}
            className={`w-full px-4 py-2.5 text-left text-xs ${t.accent} ${t.bgCardHoverSolid} transition-colors border-b ${t.border} font-medium`}
          >
            + Save Current As...
          </button>

          {/* Saved list */}
          {savedConfigs.length === 0 ? (
            <div className={`px-4 py-3 text-xs ${t.textTertiary}`}>No saved configurations yet.</div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {savedConfigs.map((sc, i) => (
                <div key={i} className={`px-4 py-2 flex items-center justify-between ${t.bgCardHover} border-b ${t.borderSoft}`}>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs ${t.textSecondary} truncate`}>{sc.name}</div>
                    <div className={`text-[10px] ${t.textQuaternary}`}>{new Date(sc.savedAt).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                    <button
                      onClick={() => { onLoad(sc.cfg); setOpen(false); }}
                      className={`px-2 py-1 rounded text-[10px] bg-amber-500/15 ${t.accent} hover:bg-amber-500/25 transition-colors`}
                    >
                      Load
                    </button>
                    <button
                      onClick={() => onDelete(i)}
                      className="px-2 py-1 rounded text-[10px] bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                    >
                      Del
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={`px-4 py-2 text-[10px] ${t.textQuaternary} border-t ${t.border}`}>
            {savedConfigs.length}/20 slots used
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function LLMCostFramework() {
  // ── Theme (M4-9) ──
  const [theme, setTheme] = useState(() => {
    const saved = typeof localStorage !== "undefined" && localStorage.getItem("llm-calc-theme");
    if (saved) return saved;
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });
  const t = THEMES[theme];

  useEffect(() => {
    localStorage.setItem("llm-calc-theme", theme);
  }, [theme]);

  const [step, setStep] = useState(0);
  const [archetype, setArchetype] = useState(null);

  const [cfg, setCfg] = useState({
    modelId: "claude-sonnet-4.6",
    systemPrompt: 800,
    ragContext: 1500,
    userInput: 200,
    output: 600,
    agenticMult: 1,
    historyDepth: 8,
    avgTurnsHistory: 0.5,
    mau: 5000,
    dau: 1000,
    sessionsPerUser: 1.5,
    interactionsPerSession: 5,
    cacheRatio: 0.3,
    cacheReuses: 10,
    cacheTTL: "5min",
    reasoningMultiplier: 1,
    overheadBuffer: 0,
    embeddingEnabled: false,
    embeddingModel: "text-embedding-3-small",
    embeddingDocsPerDay: 100,
    embeddingDocTokens: 1000,
  });

  const [appName, setAppName] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [loadedExample, setLoadedExample] = useState(null);
  const [tokenGuideOpen, setTokenGuideOpen] = useState(false);

  // ── Sequential Step Navigation (M4-6) ──
  const [highestStep, setHighestStep] = useState(0);
  const goToStep = (n) => {
    setStep(n);
    setHighestStep(prev => Math.max(prev, n));
  };

  // ── Pricing Staleness Warning (M4-10) ──
  const [pricingStaleDismissed, setPricingStaleDismissed] = useState(false);

  // ── Comparison Mode (M3-1) ──
  const [compareMode, setCompareMode] = useState(false);
  const [cfgB, setCfgB] = useState(null);
  const [comparisonTab, setComparisonTab] = useState("A"); // M4-4: mobile tab switching for comparison

  // ── Save/Load (M3-4) ──
  const [savedConfigs, setSavedConfigs] = useState(() => loadConfigsFromStorage());
  const autoSaveTimerRef = useRef(null);

  // Sensitivity analysis state (M3-2, M3-12)
  const [sensitivityRange, setSensitivityRange] = useState(0.25);
  const [sensitivityParams, setSensitivityParams] = useState(
    Object.fromEntries(SENSITIVITY_PARAMS.map(p => [p.key, true]))
  );

  function loadExample(example) {
    setCfg(prev => ({ ...prev, ...example.config }));
    setLoadedExample(example);
    setArchetype(null);
    goToStep(3);
  }

  // ── Comparison mode helpers (M3-1) ──
  function enterCompareMode() {
    setCfgB({ ...cfg });
    setCompareMode(true);
  }
  function exitCompareMode() {
    setCompareMode(false);
    setCfgB(null);
  }

  const resultB = useMemo(
    () => (compareMode && cfgB ? calcCosts(cfgB) : null),
    [cfgB, compareMode]
  );

  // ── Auto-save on cfg/step change, debounced 500ms (M3-4) ──
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveToStorage(cfg, step);
    }, 500);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [cfg, step]);

  // ── Auto-restore on mount: URL params take precedence, then hash, then localStorage (M3-4, M4-7) ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("modelId")) {
      const numericFields = ["systemPrompt", "ragContext", "userInput", "output", "agenticMult", "historyDepth", "avgTurnsHistory", "mau", "dau", "sessionsPerUser", "interactionsPerSession", "cacheRatio", "cacheReuses", "reasoningMultiplier", "overheadBuffer", "embeddingDocsPerDay", "embeddingDocTokens"];
      const restored = {};
      for (const [k, v] of params.entries()) {
        if (k === "appName") continue;
        if (!ALLOWED_CFG_KEYS.has(k)) continue;
        restored[k] = numericFields.includes(k) ? Number(v) : v;
      }
      if (params.has("appName")) setAppName(String(params.get("appName")).slice(0, 100));
      setCfg(prev => ({ ...prev, ...validateCfg(restored) }));
      // Check hash for step, default to 3 for shared URLs
      const hashMatch = window.location.hash.match(/step=(\d)/);
      goToStep(hashMatch ? Number(hashMatch[1]) : 3);
    } else {
      // Try auto-restore from localStorage
      const autoSaved = loadAutoSave();
      if (autoSaved && autoSaved.cfg && autoSaved.cfg.modelId) {
        setCfg(prev => ({ ...prev, ...validateCfg(autoSaved.cfg) }));
        // Check hash first, fall back to saved step
        const hashMatch = window.location.hash.match(/step=(\d)/);
        if (hashMatch) {
          const hashStep = Number(hashMatch[1]);
          if (hashStep >= 0 && hashStep <= 3) goToStep(hashStep);
        } else if (typeof autoSaved.step === "number" && autoSaved.step >= 0 && autoSaved.step <= 3) {
          goToStep(autoSaved.step);
        }
      } else {
        // No saved state — check hash for initial step
        const hashMatch = window.location.hash.match(/step=(\d)/);
        if (hashMatch) {
          const hashStep = Number(hashMatch[1]);
          if (hashStep >= 0 && hashStep <= 3) goToStep(hashStep);
        }
      }
    }
  }, []);

  // ── URL hash sync (M4-7): update hash when step changes ──
  useEffect(() => {
    const currentHash = `step=${step}`;
    if (window.location.hash !== `#${currentHash}`) {
      window.location.hash = currentHash;
    }
  }, [step]);

  // ── URL hash listener (M4-7): navigate on browser back/forward ──
  useEffect(() => {
    const handleHashChange = () => {
      const match = window.location.hash.match(/step=(\d)/);
      if (match) {
        const hashStep = Number(match[1]);
        if (hashStep >= 0 && hashStep <= 3 && hashStep <= highestStep + 1) {
          setStep(hashStep);
        }
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [highestStep]);

  // ── Save/Load handlers (M3-4) ──
  function handleSaveConfig(name) {
    const updated = saveConfigToStorage(name, cfg);
    setSavedConfigs(updated);
  }
  function handleLoadConfig(loadedCfg) {
    setCfg(prev => ({ ...prev, ...validateCfg(loadedCfg) }));
    goToStep(3);
  }
  function handleDeleteConfig(index) {
    const updated = deleteConfigFromStorage(index);
    setSavedConfigs(updated);
  }

  const update = (key, val) => setCfg(prev => ({ ...prev, [key]: val }));

  function copyShareLink() {
    const params = new URLSearchParams();
    if (appName) params.set("appName", appName);
    Object.entries(cfg).forEach(([k, v]) => params.set(k, String(v)));
    const url = `${window.location.origin}${window.location.pathname}?${params}#step=${step}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  }

  const result = useMemo(() => calcCosts(cfg), [cfg]);
  const warnings = useMemo(() => getValidationWarnings(cfg), [cfg]);

  // ── Pricing staleness check (M4-10) ──
  const daysSinceUpdate = Math.floor((Date.now() - new Date(PRICING_LAST_UPDATED)) / 86400000);
  const pricingStale = daysSinceUpdate > PRICING_STALENESS_DAYS;
  const pricingDateFormatted = new Date(PRICING_LAST_UPDATED).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const steps = ["Archetype", "Tokens", "Volume", "Results"];

  function applyArchetype(a) {
    setArchetype(a);
    setLoadedExample(null);
    setCfg(prev => ({
      ...prev,
      systemPrompt: a.defaults.systemPrompt,
      ragContext:   a.defaults.ragContext,
      userInput:    a.defaults.userInput,
      output:       a.defaults.output,
      agenticMult:  a.defaults.agenticMult,
      historyDepth: a.defaults.historyDepth,
    }));
    goToStep(1);
  }

  return (
    <div className="overflow-x-hidden" style={{
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      background: t.gradientBg,
      minHeight: "100vh",
      color: t.textColor,
    }}>
      {/* PRICING STALENESS WARNING (M4-10) */}
      {pricingStale && !pricingStaleDismissed && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-3 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className={`text-xs ${t.accentDark}`}>
            Pricing data may be outdated. Last updated {daysSinceUpdate} days ago. Verify current rates with providers:{" "}
            {Object.entries(PROVIDER_PRICING_URLS).map(([name, url], i) => (
              <span key={name}>
                {i > 0 && ", "}
                <a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-200">{name}</a>
              </span>
            ))}
          </p>
          <button
            onClick={() => setPricingStaleDismissed(true)}
            className={`${t.accent} hover:text-amber-200 text-xs sm:ml-4 flex-shrink-0 self-end sm:self-auto min-h-[44px] sm:min-h-0`}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* HEADER */}
      <div className={`border-b ${t.borderHeader}`}>
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={`${t.accent} text-lg font-mono`}>◈</span>
                <span className={`text-xs sm:text-sm font-semibold tracking-widest ${t.textMuted} uppercase`}>LLM Cost Framework</span>
              </div>
              <h1 className={`text-lg sm:text-xl font-bold ${t.text} mt-0.5`}>{appName || "AI Feature Cost Estimator"}</h1>
            </div>
            <div className="flex items-center gap-2 sm:hidden">
              {/* GitHub Link - mobile */}
              <a
                href="https://github.com/OzLe/ai-feature-calc"
                target="_blank"
                rel="noopener noreferrer"
                className={`p-2 rounded-lg border ${t.border} ${t.textMuted} ${t.bgCardHoverSolid} transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center`}
                aria-label="View on GitHub"
                title="View on GitHub"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
              </a>
              {/* Theme Toggle - mobile */}
              <button
                onClick={() => setTheme(prev => prev === "dark" ? "light" : "dark")}
                className={`p-2 rounded-lg border ${t.border} ${t.textMuted} ${t.bgCardHoverSolid} transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center`}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              >
                {theme === "dark" ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                )}
              </button>
              <SavedConfigsDropdown
                savedConfigs={savedConfigs}
                onSave={handleSaveConfig}
                onLoad={handleLoadConfig}
                onDelete={handleDeleteConfig}
                t={t}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* GitHub Link - desktop */}
            <a
              href="https://github.com/OzLe/ai-feature-calc"
              target="_blank"
              rel="noopener noreferrer"
              className={`hidden sm:flex p-2 rounded-lg border ${t.border} ${t.textMuted} ${t.bgCardHoverSolid} transition-colors items-center justify-center`}
              aria-label="View on GitHub"
              title="View on GitHub"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
            </a>
            {/* Theme Toggle - desktop */}
            <button
              onClick={() => setTheme(prev => prev === "dark" ? "light" : "dark")}
              className={`hidden sm:flex p-2 rounded-lg border ${t.border} ${t.textMuted} ${t.bgCardHoverSolid} transition-colors items-center justify-center`}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              )}
            </button>
            <div className="hidden sm:block">
              <SavedConfigsDropdown
                savedConfigs={savedConfigs}
                onSave={handleSaveConfig}
                onLoad={handleLoadConfig}
                onDelete={handleDeleteConfig}
                t={t}
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap w-full sm:w-auto pb-1 sm:pb-0 -mx-1 px-1">
              {steps.map((s, i) => {
                const canNavigate = i <= highestStep + 1;
                return (
                  <button
                    key={i}
                    onClick={() => canNavigate ? goToStep(i) : null}
                    className={`px-2 sm:px-3 py-1.5 rounded text-xs font-medium transition-all flex-shrink-0 min-h-[44px] sm:min-h-0 flex items-center ${
                      i === step
                        ? `bg-amber-500 ${t.textInvert}`
                        : canNavigate
                        ? `${t.stepInactive} cursor-pointer`
                        : `${t.stepDisabled} cursor-not-allowed opacity-50`
                    }`}
                  >
                    <span className="opacity-50 mr-1">{i + 1}.</span>{s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8">

        {/* STEP 0: ARCHETYPE */}
        {step === 0 && (
          <div>
            <div className="mb-8">
              <h2 className={`text-2xl font-bold ${t.text} mb-2`}>What type of AI feature are you building?</h2>
              <p className={`${t.textMuted} text-sm`}>Select the archetype closest to your feature. Defaults will be pre-filled and you can fine-tune them.</p>
            </div>
            <div className={`mb-6 p-4 rounded-xl border ${t.border} ${t.bgCardSoft}`}>
              <label className={`block text-xs font-semibold ${t.textMuted} uppercase tracking-wider mb-2`}>Name your app or feature</label>
              <input
                type="text"
                value={appName}
                onChange={e => setAppName(e.target.value)}
                placeholder="e.g. HR Chatbot, Code Review Agent..."
                className={`w-full px-3 py-2 rounded-lg border ${t.borderInput} ${t.bgInput} ${t.text} text-sm placeholder:${t.textTertiary} focus:outline-none focus:ring-1 focus:ring-amber-500 min-h-[44px]`}
              />
              <p className={`text-xs ${t.textTertiary} mt-1.5`}>Optional. Included when you generate a share link.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {ARCHETYPES.map(a => (
                <button
                  key={a.id}
                  onClick={() => applyArchetype(a)}
                  className={`p-4 rounded-xl border text-left transition-all hover:scale-[1.02] min-h-[44px] ${
                    archetype?.id === a.id
                      ? "border-amber-500 bg-amber-500/10"
                      : `${t.border} ${t.bgCardMid} hover:${t.borderHard.replace("border-", "border-")}`
                  }`}
                >
                  <div className={`text-2xl mb-2 ${t.accent}`}>{a.icon}</div>
                  <div className={`font-semibold ${t.text} text-sm mb-1`}>{a.label}</div>
                  <div className={`text-xs sm:text-sm ${t.textMuted} leading-relaxed`}>{a.description}</div>
                </button>
              ))}
            </div>

            <div className={`mt-6 p-4 rounded-xl border ${t.border} ${t.bgCardSoft}`}>
              <p className={`text-xs ${t.textMuted} leading-relaxed`}>
                <span className={`${t.accent} font-semibold`}>Framework methodology: </span>
                Cost per interaction = (Fresh input tokens × input price) + (Cached input tokens × cache read price) + (Output tokens × output price).
                Multiply by agentic calls per action, then scale by daily interactions × 30 days.
                Prompt caching, model selection, and architecture patterns can reduce total cost by 50-90%.
              </p>
            </div>

            {/* WORKED EXAMPLES (M3-3) */}
            <div className="mt-8">
              <h3 className={`text-lg font-bold ${t.text} mb-2`}>Or try a worked example</h3>
              <p className={`${t.textMuted} text-xs mb-4`}>Pre-configured scenarios with expected costs. Click to load and jump straight to results.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {WORKED_EXAMPLES.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => loadExample(ex)}
                    className={`p-4 rounded-xl border ${t.border} ${t.bgCardMid} hover:border-amber-500/50 hover:bg-amber-500/5 text-left transition-all hover:scale-[1.02]`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-semibold ${t.text} text-sm`}>{ex.label}</span>
                      <span className={`text-xs font-mono ${t.accent}`}>~${ex.expectedMonthlyCost.toLocaleString()}/mo</span>
                    </div>
                    <div className={`text-xs ${t.textMuted} leading-relaxed`}>{ex.description}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Pill color="slate" t={t}>{MODELS.find(m => m.id === ex.config.modelId)?.label}</Pill>
                      <Pill color="slate" t={t}>{fmtTokens(ex.config.mau)} MAU</Pill>
                      {ex.config.agenticMult > 1 && <Pill color="amber" t={t}>x{ex.config.agenticMult} agentic</Pill>}
                      {ex.config.cacheRatio > 0 && <Pill color="green" t={t}>{Math.round(ex.config.cacheRatio * 100)}% cached</Pill>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: TOKEN BUDGET */}
        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className={`text-xl font-bold ${t.text} mb-1`}>Token Budget per Interaction</h2>
                  {archetype && (
                    <button
                      onClick={() => {
                        setCfg(prev => ({
                          ...prev,
                          systemPrompt: archetype.defaults.systemPrompt,
                          ragContext: archetype.defaults.ragContext,
                          userInput: archetype.defaults.userInput,
                          output: archetype.defaults.output,
                          agenticMult: archetype.defaults.agenticMult,
                          historyDepth: archetype.defaults.historyDepth,
                        }));
                      }}
                      className={`text-xs ${t.textTertiary} hover:${t.textSecondary.replace("text-", "text-")} underline`}
                    >
                      Reset to {archetype.label} defaults
                    </button>
                  )}
                </div>
                <p className={`${t.textMuted} text-xs`}>Estimate tokens for each component of a single LLM call.</p>
              </div>

              {/* MODEL */}
              <div className="space-y-2">
                <label className={`text-xs font-medium ${t.textSecondary}`}>Model</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {["Anthropic", "OpenAI", "Google"].map(provider => {
                    const tierOrder = { premium: 0, mid: 1, economy: 2 };
                    const providerModels = MODELS
                      .filter(m => m.provider === provider)
                      .sort((a, b) => {
                        if (a.deprecated !== b.deprecated) return a.deprecated ? 1 : -1;
                        return (tierOrder[a.tier] || 99) - (tierOrder[b.tier] || 99);
                      });
                    return (
                      <div key={provider}>
                        <div className={`text-xs ${t.textTertiary} font-semibold uppercase tracking-wider mt-3 mb-1.5`}>{provider}</div>
                        {providerModels.map(m => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setCfg(prev => ({
                                ...prev,
                                modelId: m.id,
                                reasoningMultiplier: m.reasoning ? (prev.reasoningMultiplier > 1 ? prev.reasoningMultiplier : 2) : 1,
                              }));
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all mb-1.5 min-h-[44px] ${
                              cfg.modelId === m.id
                                ? `border-amber-500 bg-amber-500/10 ${t.accentDark}`
                                : `${t.border} ${t.bgCardMid} ${t.textMuted} hover:${t.borderMid.replace("border-", "border-")}`
                            } ${m.deprecated ? "opacity-50" : ""}`}
                          >
                            <span className="font-medium">
                              {m.label}
                              {m.deprecated && <span className={`text-xs ${t.textQuaternary} ml-1`}>(deprecated)</span>}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`font-mono ${t.textTertiary}`}>${m.in}/${m.out} /1M</span>
                              <Pill color={m.tier === "premium" ? "red" : m.tier === "mid" ? "blue" : "green"} t={t}>{m.tier}</Pill>
                            </div>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
                {(() => {
                  const selectedModel = MODELS.find(m => m.id === cfg.modelId);
                  return selectedModel?.deprecated ? (
                    <div className={`mt-2 p-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs ${t.accentDark}`}>
                      Warning: {selectedModel.label} is deprecated. {selectedModel.deprecationNote}
                    </div>
                  ) : null;
                })()}
              </div>

              {/* REASONING SLIDER (M3-5) */}
              {(() => {
                const selectedModel = MODELS.find(m => m.id === cfg.modelId);
                return selectedModel?.reasoning ? (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-2">
                    <SliderField
                      label="Reasoning overhead multiplier"
                      sublabel="Reasoning tokens (hidden chain-of-thought). Models with extended thinking generate 2-5x more output tokens than visible."
                      value={cfg.reasoningMultiplier}
                      min={1} max={5} step={0.5}
                      onChange={v => update("reasoningMultiplier", v)}
                      display={`x${cfg.reasoningMultiplier}`}
                      tooltip="Extended thinking models generate hidden reasoning tokens billed as output tokens. A 2x multiplier means the model generates roughly as many hidden reasoning tokens as visible output tokens."
                      t={t}
                    />
                  </div>
                ) : null;
              })()}

              {/* TOKEN ESTIMATION GUIDE (M3-8) */}
              <div className={`rounded-xl border ${t.border} ${t.bgCardSoft} overflow-hidden`}>
                <button
                  onClick={() => setTokenGuideOpen(!tokenGuideOpen)}
                  className={`w-full flex items-center justify-between p-4 text-xs sm:text-sm font-semibold ${t.textMuted} ${t.bgCardHover} transition-colors min-h-[44px]`}
                >
                  <span>Token Estimation Guide</span>
                  <span className={`${t.textTertiary} transition-transform ${tokenGuideOpen ? "rotate-180" : ""}`}>&#9662;</span>
                </button>
                {tokenGuideOpen && (
                  <div className="px-3 sm:px-4 pb-4 space-y-4">
                    <div>
                      <div className={`text-xs font-medium ${t.textSecondary} mb-2`}>Content Type to Token Estimates</div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className={`border-b ${t.border}`}>
                            <th className={`text-left ${t.textMuted} py-1.5 pr-3 font-medium`}>Content</th>
                            <th className={`text-left ${t.textMuted} py-1.5 font-medium`}>Approximate Tokens</th>
                          </tr>
                        </thead>
                        <tbody>
                          {TOKEN_HEURISTICS.map((h, i) => (
                            <tr key={i} className={`border-b ${t.borderSoft}`}>
                              <td className={`${t.textSecondary} py-1.5 pr-3`}>{h.content}</td>
                              <td className={`${t.accent} font-mono py-1.5`}>{h.tokens}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <div className={`text-xs font-medium ${t.textSecondary} mb-2`}>What Inflates Token Counts</div>
                      <ul className="space-y-1.5">
                        {TOKEN_INFLATORS.map((item, i) => (
                          <li key={i} className={`text-xs ${t.textMuted} flex items-start gap-2`}>
                            <span className={`${t.accent} mt-0.5 flex-shrink-0`}>&#9656;</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* TOKEN ESTIMATOR (M4-1) */}
              <TokenEstimator onUseFor={(field, tokens) => update(field, tokens)} t={t} />
            </div>

            <div className="space-y-4">
              <div className={`rounded-xl border ${t.border} ${t.bgCardSoft} p-4 space-y-4`}>
                <SliderField label="System Prompt" sublabel="Instructions, persona, tools definition"
                  value={cfg.systemPrompt} min={100} max={8000} step={100} onChange={v => update("systemPrompt", v)}
                  display={`${fmtTokens(cfg.systemPrompt)} tok`}
                  tooltip="Static instructions sent on every LLM call. Includes persona definition, tool schemas, output format rules. Typical: 200-400 tokens for simple prompts, 500-2000 for detailed, 2000+ for multi-tool agents." t={t} />
                <SliderField label="RAG / Context injection" sublabel="Retrieved documents, context snippets"
                  value={cfg.ragContext} min={0} max={16000} step={250} onChange={v => update("ragContext", v)}
                  display={`${fmtTokens(cfg.ragContext)} tok`}
                  tooltip="Retrieved document chunks injected per call. 1 page of text is ~500-700 tokens. Common: 1000-4000 tokens (2-8 chunks)." t={t} />
                <SliderField label="User Input" sublabel="Average user message length"
                  value={cfg.userInput} min={50} max={4000} step={50} onChange={v => update("userInput", v)}
                  display={`${fmtTokens(cfg.userInput)} tok`}
                  tooltip="Average user message length. Short question: 50-100 tokens. Detailed query: 200-500. Pasted content: 500-4000." t={t} />
                <SliderField label="Output" sublabel="Expected response length"
                  value={cfg.output} min={50} max={8000} step={50} onChange={v => update("output", v)}
                  display={`${fmtTokens(cfg.output)} tok`}
                  tooltip="Expected response length. Short answer: 100-200 tokens. Paragraph: 300-600. Long form/code: 1000-4000." t={t} />
                <SliderField label="Agentic LLM calls per user action" sublabel="1 = single call, 5+ = multi-step agent"
                  value={cfg.agenticMult} min={1} max={15} step={1} onChange={v => update("agenticMult", v)}
                  display={`×${cfg.agenticMult}`}
                  tooltip="Number of LLM calls per user action. 1 = single call. 2-3 = retrieval+generation. 5-15 = multi-step agent. Each call re-sends the full context." t={t} />
                <SliderField label="Conversation history turns" sublabel="Prior messages included in context"
                  value={cfg.historyDepth} min={0} max={20} step={1} onChange={v => update("historyDepth", v)}
                  display={`${cfg.historyDepth} turns`}
                  tooltip="Prior conversation turns included in context. Each turn adds (user input + output) tokens. At 0.5 average fill rate, 8 turns with 800 token exchanges adds ~3200 tokens." t={t} />
              </div>

              {result && (
                <div className={`rounded-xl border ${t.border} ${t.bgCardSoft} p-4`}>
                  <div className={`text-xs font-medium ${t.textMuted} mb-3`}>Token breakdown / interaction</div>
                  <TokenBar breakdown={result.tokenBreakdown} t={t} />
                  <div className={`mt-3 pt-3 border-t ${t.border} flex justify-between text-xs`}>
                    <span className={t.textMuted}>Cost per interaction</span>
                    <span className={`font-mono ${t.accent} font-bold`}>${result.costPerInteraction.toFixed(4)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="col-span-full flex justify-end">
              <button onClick={() => goToStep(2)} className={`px-5 py-2 rounded-lg bg-amber-500 ${t.textInvert} font-semibold text-sm hover:bg-amber-400 transition-colors min-h-[44px]`}>
                Next: Volume & Usage →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: VOLUME */}
        {step === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div>
                <h2 className={`text-xl font-bold ${t.text} mb-1`}>Usage Volume</h2>
                <p className={`${t.textMuted} text-xs`}>Define your user base and interaction patterns.</p>
              </div>

              <div className={`rounded-xl border ${t.border} ${t.bgCardSoft} p-4 space-y-4`}>
                <SliderField label="Monthly Active Users (MAU)"
                  value={cfg.mau} min={100} max={500000} step={500}
                  display={fmtTokens(cfg.mau) + " users"}
                  onChange={v => update("mau", v)} t={t} />
                <SliderField label="Daily Active Users (DAU)"
                  value={cfg.dau} min={10} max={500000} step={100}
                  display={fmtTokens(cfg.dau) + " users"}
                  onChange={v => update("dau", v)} t={t} />
                {warnings.filter(w => w.field === "dau").map((w, i) => (
                  <p key={i} className={`text-xs ${t.accent} mt-1`}>{w.msg}</p>
                ))}
                <SliderField label="Sessions per user per day"
                  value={cfg.sessionsPerUser} min={0.1} max={10} step={0.1}
                  display={cfg.sessionsPerUser.toFixed(1) + " sess"}
                  onChange={v => update("sessionsPerUser", v)} t={t} />
                <SliderField label="LLM interactions per session"
                  value={cfg.interactionsPerSession} min={1} max={50} step={1}
                  display={`${cfg.interactionsPerSession} calls`}
                  onChange={v => update("interactionsPerSession", v)} t={t} />
              </div>

              <div className={`rounded-xl border ${t.border} ${t.bgCardSoft} p-4 space-y-3`}>
                <div className={`text-xs font-medium ${t.textMuted} mb-1`}>Prompt Caching Strategy</div>
                <div className="grid grid-cols-2 gap-2">
                  {CACHE_SCENARIOS.map(s => (
                    <button
                      key={s.id}
                      onClick={() => update("cacheRatio", s.ratio)}
                      className={`p-2 rounded-lg border text-xs transition-all min-h-[44px] sm:min-h-0 ${
                        cfg.cacheRatio === s.ratio
                          ? `border-amber-500 bg-amber-500/10 ${t.accentDark}`
                          : `${t.border} ${t.bgCardMid} ${t.textMuted} hover:${t.borderMid.replace("border-", "border-")}`
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className={`text-xs ${t.textTertiary}`}>Caching works best when system prompt & RAG are stable. Cached tokens cost ~90% less (model-dependent).</p>
                {(() => {
                  const selectedModel = MODELS.find(m => m.id === cfg.modelId);
                  return selectedModel && selectedModel.provider !== "Anthropic" && selectedModel.cache !== null ? (
                    <p className={`text-xs ${t.textTertiary} italic`}>This provider handles cache writes automatically at no additional charge.</p>
                  ) : null;
                })()}
                {warnings.filter(w => w.field === "cacheRatio").map((w, i) => (
                  <p key={i} className={`text-xs ${t.accent} mt-1`}>{w.msg}</p>
                ))}

                {cfg.cacheRatio > 0 && (
                  <SliderField label="Cache Reuses" sublabel="Times cached prefix is reused before expiry"
                    value={cfg.cacheReuses} min={1} max={100} step={1} onChange={v => update("cacheReuses", v)}
                    display={`${cfg.cacheReuses}x`} t={t} />
                )}

                {cfg.cacheRatio > 0 && (() => {
                  const selectedModel = MODELS.find(m => m.id === cfg.modelId);
                  return selectedModel?.cacheWrite5min ? (
                    <div className="space-y-2">
                      <div className={`text-xs font-medium ${t.textSecondary}`}>Cache Write TTL</div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "5min", label: "5-minute" },
                          { id: "1hr", label: "1-hour" },
                        ].map(ttl => (
                          <button
                            key={ttl.id}
                            onClick={() => update("cacheTTL", ttl.id)}
                            className={`p-2 rounded-lg border text-xs transition-all min-h-[44px] sm:min-h-0 ${
                              cfg.cacheTTL === ttl.id
                                ? `border-amber-500 bg-amber-500/10 ${t.accentDark}`
                                : `${t.border} ${t.bgCardMid} ${t.textMuted} hover:${t.borderMid.replace("border-", "border-")}`
                            }`}
                          >
                            {ttl.label}
                          </button>
                        ))}
                      </div>
                      {cfg.cacheTTL === "1hr" && (
                        <p className="text-xs text-amber-400/70">1-hour TTL costs ~60% more to write but reduces cache miss rates for infrequent calls</p>
                      )}
                    </div>
                  ) : null;
                })()}
              </div>

              {/* PRODUCTION OVERHEAD BUFFER (M4-2) */}
              <div className={`rounded-xl border ${t.border} ${t.bgCardSoft} p-4 space-y-3`}>
                <div className="flex items-center justify-between">
                  <div className={`text-xs sm:text-sm font-medium ${t.textMuted}`}>Include production overhead</div>
                  <button
                    onClick={() => update("overheadBuffer", cfg.overheadBuffer > 0 ? 0 : 0.10)}
                    className={`relative inline-flex h-6 w-11 sm:h-5 sm:w-9 items-center rounded-full transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 ${
                      cfg.overheadBuffer > 0 ? "bg-amber-500" : t.bgToggleOff
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 sm:h-3.5 sm:w-3.5 rounded-full bg-white transition-transform ${
                      cfg.overheadBuffer > 0 ? "translate-x-5 sm:translate-x-4.5" : "translate-x-1 sm:translate-x-0.5"
                    }`} />
                  </button>
                </div>
                <p className={`text-xs ${t.textTertiary}`}>Accounts for retries, timeouts, and error rates in production.</p>
                {cfg.overheadBuffer > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[0.05, 0.10, 0.15, 0.20].map(pct => (
                      <button
                        key={pct}
                        onClick={() => update("overheadBuffer", pct)}
                        className={`p-2 rounded-lg border text-xs font-mono transition-all min-h-[44px] sm:min-h-0 ${
                          cfg.overheadBuffer === pct
                            ? `border-amber-500 bg-amber-500/10 ${t.accentDark}`
                            : `${t.border} ${t.bgCardMid} ${t.textMuted} hover:${t.borderMid.replace("border-", "border-")}`
                        }`}
                      >
                        +{Math.round(pct * 100)}%
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* EMBEDDING COST SECTION (M4-3) */}
              {cfg.ragContext > 0 && (
                <div className={`rounded-xl border ${t.border} ${t.bgCardSoft} p-4 space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div className={`text-xs sm:text-sm font-medium ${t.textMuted}`}>Include embedding costs</div>
                    <button
                      onClick={() => update("embeddingEnabled", !cfg.embeddingEnabled)}
                      className={`relative inline-flex h-6 w-11 sm:h-5 sm:w-9 items-center rounded-full transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 ${
                        cfg.embeddingEnabled ? "bg-amber-500" : t.bgToggleOff
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 sm:h-3.5 sm:w-3.5 rounded-full bg-white transition-transform ${
                        cfg.embeddingEnabled ? "translate-x-5 sm:translate-x-4.5" : "translate-x-1 sm:translate-x-0.5"
                      }`} />
                    </button>
                  </div>
                  <p className={`text-xs ${t.textTertiary}`}>RAG pipelines require embedding API calls for document indexing.</p>
                  {cfg.embeddingEnabled && (
                    <div className={`space-y-3 pt-2 border-t ${t.border}`}>
                      <div className="space-y-1">
                        <label className={`text-xs ${t.textSecondary} font-medium`}>Embedding model</label>
                        <select
                          value={cfg.embeddingModel}
                          onChange={e => update("embeddingModel", e.target.value)}
                          className={`w-full ${t.bgInput} border ${t.border} rounded-lg text-xs ${t.textSecondary} px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500`}
                        >
                          {EMBEDDING_MODELS.map(m => (
                            <option key={m.id} value={m.id}>{m.label} (${m.price}/1M tokens)</option>
                          ))}
                        </select>
                      </div>
                      <SliderField
                        label="Documents embedded per day"
                        sublabel="Unique documents indexed daily"
                        value={cfg.embeddingDocsPerDay} min={1} max={10000} step={10}
                        onChange={v => update("embeddingDocsPerDay", v)}
                        display={`${cfg.embeddingDocsPerDay.toLocaleString()} docs`}
                        t={t}
                      />
                      <SliderField
                        label="Average document size"
                        sublabel="Tokens per document"
                        value={cfg.embeddingDocTokens} min={100} max={50000} step={100}
                        onChange={v => update("embeddingDocTokens", v)}
                        display={`${fmtTokens(cfg.embeddingDocTokens)} tok`}
                        t={t}
                      />
                      {(() => {
                        const embModel = EMBEDDING_MODELS.find(m => m.id === cfg.embeddingModel);
                        const embeddingMonthlyCost = embModel
                          ? (cfg.embeddingDocsPerDay * cfg.embeddingDocTokens / 1_000_000) * embModel.price * 30
                          : 0;
                        return (
                          <div className={`rounded-lg ${t.bgAlt} border ${t.border} p-3 flex items-center justify-between`}>
                            <span className={`text-xs ${t.textMuted}`}>Estimated embedding cost</span>
                            <span className={`text-sm font-mono font-bold ${t.accent}`}>{fmt(embeddingMonthlyCost)}/mo</span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {result && (
                <>
                  <div className={`rounded-xl border ${t.border} ${t.bgCardSoft} p-4`}>
                    <div className={`text-xs font-medium ${t.textMuted} mb-3`}>Volume Funnel</div>
                    <div className="space-y-2">
                      {[
                        { label: "MAU", value: fmtTokens(cfg.mau), color: "#64748b" },
                        { label: "DAU", value: fmtTokens(cfg.dau), sub: `${((cfg.dau/cfg.mau)*100).toFixed(0)}% DAU ratio`, color: "#8b5cf6" },
                        { label: "Daily Sessions", value: fmtTokens(Math.round(cfg.dau * cfg.sessionsPerUser)), color: "#3b82f6" },
                        { label: "Daily LLM Calls", value: fmtTokens(result.interactionsPerDay), color: "#f59e0b" },
                        { label: "Monthly LLM Calls", value: fmtTokens(result.interactionsPerMonth), color: "#10b981" },
                      ].map((row, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                          <span className={`${t.textMuted} flex-1`}>{row.label}</span>
                          <span className={`font-mono ${t.textSubtle}`}>{row.value}</span>
                          {row.sub && <span className={t.textTertiary}>{row.sub}</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                    <div className={`text-xs sm:text-sm font-medium ${t.accent} mb-3`}>Quick Cost Preview</div>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      <div>
                        <div className={`text-xs ${t.textTertiary}`}>Daily</div>
                        <div className={`text-base sm:text-lg font-mono font-bold ${t.text}`}>{fmt(result.dailyCost)}</div>
                      </div>
                      <div>
                        <div className={`text-xs ${t.textTertiary}`}>Monthly</div>
                        <div className={`text-base sm:text-lg font-mono font-bold ${t.accent}`}>{fmt(result.monthlyCost)}</div>
                      </div>
                      <div>
                        <div className={`text-xs ${t.textTertiary}`}>Per MAU</div>
                        <div className={`text-base sm:text-lg font-mono font-bold ${t.text}`}>{fmt(result.costPerMAU, 3)}</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="col-span-full flex justify-between">
              <button onClick={() => goToStep(1)} className={`px-4 sm:px-5 py-2 rounded-lg border ${t.border} ${t.textSecondary} font-semibold text-sm ${t.bgCardHoverSolid} transition-colors min-h-[44px]`}>
                ← Back
              </button>
              <button onClick={() => goToStep(3)} className={`px-4 sm:px-5 py-2 rounded-lg bg-amber-500 ${t.textInvert} font-semibold text-sm hover:bg-amber-400 transition-colors min-h-[44px]`}>
                See Full Results →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: RESULTS */}
        {step === 3 && result && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h2 className={`text-xl sm:text-2xl font-bold ${t.text}`}>Cost Analysis</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`${t.textMuted} text-sm`}>{archetype?.label}</span>
                  <span className={t.textQuaternary}>·</span>
                  <span className={`${t.textMuted} text-sm`}>{result.model.label}</span>
                  {compareMode && <Pill color="blue" t={t}>Comparison Mode</Pill>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {!compareMode && (
                  <button onClick={enterCompareMode} className="px-3 py-1.5 rounded-lg border border-cyan-500/40 text-cyan-400 text-xs hover:bg-cyan-500/10 transition-colors font-medium min-h-[44px] sm:min-h-0">
                    Compare
                  </button>
                )}
                {compareMode && (
                  <button onClick={exitCompareMode} className="px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400 text-xs hover:bg-red-500/10 transition-colors font-medium min-h-[44px] sm:min-h-0">
                    Exit Comparison
                  </button>
                )}
                <button onClick={() => goToStep(0)} className={`px-3 py-1.5 rounded-lg border ${t.border} ${t.textMuted} text-xs ${t.bgCardHoverSolid} transition-colors min-h-[44px] sm:min-h-0`}>
                  Start Over
                </button>
                <button onClick={() => exportCSV(cfg, result, cfgB, resultB, appName)} className={`px-3 py-1.5 rounded-lg border ${t.border} ${t.textMuted} text-xs ${t.bgCardHoverSolid} transition-colors min-h-[44px] sm:min-h-0`}>
                  Export CSV
                </button>
                <button onClick={() => exportJSON(cfg, result, cfgB, resultB, appName)} className={`px-3 py-1.5 rounded-lg border ${t.border} ${t.textMuted} text-xs ${t.bgCardHoverSolid} transition-colors min-h-[44px] sm:min-h-0`}>
                  Export JSON
                </button>
                <button onClick={() => exportMarkdown(cfg, result, cfgB, resultB, appName)} className={`px-3 py-1.5 rounded-lg border ${t.border} ${t.textMuted} text-xs ${t.bgCardHoverSolid} transition-colors min-h-[44px] sm:min-h-0`}>
                  Export MD
                </button>
                <button onClick={copyShareLink} className={`px-3 py-1.5 rounded-lg border ${t.border} ${t.textMuted} text-xs ${t.bgCardHoverSolid} transition-colors min-h-[44px] sm:min-h-0`}>
                  {shareCopied ? "Copied!" : "Share Link"}
                </button>
              </div>
            </div>

            {/* WORKED EXAMPLE BANNER (M3-3) */}
            {loadedExample && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs sm:text-sm text-blue-300">
                  Loaded worked example: <span className={`font-semibold ${t.text}`}>{loadedExample.label}</span>. Expected monthly cost: <span className={`font-mono font-semibold ${t.accent}`}>${loadedExample.expectedMonthlyCost.toLocaleString()}</span>.
                </div>
                <button
                  onClick={() => setLoadedExample(null)}
                  className={`text-xs ${t.textMuted} self-end sm:self-auto sm:ml-4 min-h-[44px] sm:min-h-0`}
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* ── COMPARISON MODE LAYOUT (M3-1, M4-4 mobile tabs) ── */}
            {compareMode && resultB ? (
              <>
                {/* Delta Row */}
                <DeltaRow resultA={result} resultB={resultB} t={t} />

                {/* Mobile: tab switcher (visible below md breakpoint) */}
                <div className={`md:hidden flex rounded-lg overflow-hidden border ${t.border}`}>
                  <button
                    onClick={() => setComparisonTab("A")}
                    className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors min-h-[44px] ${
                      comparisonTab === "A"
                        ? `bg-amber-500/20 ${t.accent} border-b-2 border-amber-500`
                        : `${t.bgCardHalf} ${t.textMuted} ${t.bgCardHoverSolid}`
                    }`}
                  >
                    Scenario A
                  </button>
                  <button
                    onClick={() => setComparisonTab("B")}
                    className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors min-h-[44px] ${
                      comparisonTab === "B"
                        ? "bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-500"
                        : `${t.bgCardHalf} ${t.textMuted} ${t.bgCardHoverSolid}`
                    }`}
                  >
                    Scenario B
                  </button>
                </div>

                {/* Two-column comparison grid (desktop: side-by-side, mobile: tab-switched) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* ─── SCENARIO A ─── */}
                  <div className={`space-y-4 ${comparisonTab !== "A" ? "hidden md:block" : ""}`}>
                    <div className={`text-sm font-bold ${t.accent} px-1 border-b border-amber-500/30 pb-2`}>Scenario A (current)</div>

                    {/* Cost Cards A */}
                    <div className="grid grid-cols-2 gap-2">
                      <ScenarioCard label="Monthly Cost" cost={result.monthlyCost} highlight sub={`${fmtTokens(result.interactionsPerMonth)} calls/mo`} t={t} />
                      <ScenarioCard label="Annual Cost" cost={result.annualCost} sub={result.model.label} t={t} />
                      <ScenarioCard label="Cost / MAU" cost={result.costPerMAU} sub="fully loaded" t={t} />
                      <ScenarioCard label="Cost / Interaction" cost={result.costPerInteraction} sub={`${fmtTokens(result.inputPerInteraction + result.outputPerInteraction)} tok`} t={t} />
                    </div>

                    {/* Token Breakdown A */}
                    <div className={`rounded-xl border ${t.border} ${t.bgCardSoft} p-4`}>
                      <div className={`text-xs font-medium ${t.textMuted} mb-3`}>Token Breakdown (A)</div>
                      <TokenBar breakdown={result.tokenBreakdown} t={t} />
                      <div className={`grid grid-cols-2 gap-2 pt-2 border-t ${t.border} mt-3`}>
                        <div>
                          <div className={`text-[10px] sm:text-xs ${t.textMuted}`}>Input cost</div>
                          <div className={`text-xs font-mono ${t.text}`}>${result.costPerInteractionInput.toFixed(5)}</div>
                        </div>
                        <div>
                          <div className={`text-[10px] sm:text-xs ${t.textMuted}`}>Output cost</div>
                          <div className={`text-xs font-mono ${t.text}`}>${result.costPerInteractionOutput.toFixed(5)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ─── SCENARIO B ─── */}
                  <div className={`space-y-4 ${comparisonTab !== "B" ? "hidden md:block" : ""}`}>
                    <div className="text-sm font-bold text-cyan-400 px-1 border-b border-cyan-500/30 pb-2">Scenario B (comparison)</div>

                    {/* Cost Cards B */}
                    <div className="grid grid-cols-2 gap-2">
                      <ScenarioCard label="Monthly Cost" cost={resultB.monthlyCost} highlight sub={`${fmtTokens(resultB.interactionsPerMonth)} calls/mo`} t={t} />
                      <ScenarioCard label="Annual Cost" cost={resultB.annualCost} sub={resultB.model.label} t={t} />
                      <ScenarioCard label="Cost / MAU" cost={resultB.costPerMAU} sub="fully loaded" t={t} />
                      <ScenarioCard label="Cost / Interaction" cost={resultB.costPerInteraction} sub={`${fmtTokens(resultB.inputPerInteraction + resultB.outputPerInteraction)} tok`} t={t} />
                    </div>

                    {/* Token Breakdown B */}
                    <div className={`rounded-xl border ${t.border} ${t.bgCardSoft} p-4`}>
                      <div className={`text-xs font-medium ${t.textMuted} mb-3`}>Token Breakdown (B)</div>
                      <TokenBar breakdown={resultB.tokenBreakdown} t={t} />
                      <div className={`grid grid-cols-2 gap-2 pt-2 border-t ${t.border} mt-3`}>
                        <div>
                          <div className={`text-[10px] sm:text-xs ${t.textMuted}`}>Input cost</div>
                          <div className={`text-xs font-mono ${t.text}`}>${resultB.costPerInteractionInput.toFixed(5)}</div>
                        </div>
                        <div>
                          <div className={`text-[10px] sm:text-xs ${t.textMuted}`}>Output cost</div>
                          <div className={`text-xs font-mono ${t.text}`}>${resultB.costPerInteractionOutput.toFixed(5)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Scenario B Controls */}
                    <ComparisonControls cfgB={cfgB} setCfgB={setCfgB} t={t} />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* ── SINGLE SCENARIO LAYOUT (original) ── */}
                {/* COST CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <ScenarioCard label="Per Interaction" cost={result.costPerInteraction} sub={`${fmtTokens(result.inputPerInteraction + result.outputPerInteraction)} tokens`} t={t} />
                  <ScenarioCard label="Daily Cost" cost={result.dailyCost} sub={`${fmtTokens(result.interactionsPerDay)} calls/day`} t={t} />
                  <ScenarioCard label="Monthly Cost" cost={result.monthlyCost} highlight sub={`${fmtTokens(result.interactionsPerMonth)} calls/month`} t={t} />
                  <ScenarioCard label="Cost per MAU" cost={result.costPerMAU} sub="monthly, fully loaded" t={t} />
                </div>

                {/* PRODUCTION OVERHEAD LINE ITEM (M4-2) */}
                {result.overheadBuffer > 0 && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-center justify-between">
                    <div className={`text-xs ${t.accentDark}`}>
                      Production overhead: <span className="font-mono font-semibold">+{fmt(result.monthlyCost - result.monthlyCost / (1 + result.overheadBuffer))}/month</span> <span className={t.textMuted}>({Math.round(result.overheadBuffer * 100)}%)</span>
                    </div>
                    <div className={`text-xs ${t.textTertiary}`}>Includes retries, timeouts, error rates</div>
                  </div>
                )}

                {/* EMBEDDING COST LINE ITEM (M4-3) */}
                {cfg.embeddingEnabled && cfg.ragContext > 0 && (() => {
                  const embModel = EMBEDDING_MODELS.find(m => m.id === cfg.embeddingModel);
                  const embeddingMonthlyCost = embModel
                    ? (cfg.embeddingDocsPerDay * cfg.embeddingDocTokens / 1_000_000) * embModel.price * 30
                    : 0;
                  const embeddingAnnualCost = embeddingMonthlyCost * 12;
                  return (
                    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-xs text-blue-300 font-medium">
                          Embedding infrastructure
                        </div>
                        <div className={`text-xs ${t.textTertiary}`}>Separate from LLM inference costs</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className={`text-xs ${t.textMuted}`}>
                          {embModel?.label} &middot; {cfg.embeddingDocsPerDay.toLocaleString()} docs/day &middot; {fmtTokens(cfg.embeddingDocTokens)} tok/doc
                        </div>
                        <div className="text-sm font-mono font-semibold text-blue-300">
                          {fmt(embeddingMonthlyCost)}/mo <span className={`${t.textTertiary} font-normal`}>({fmt(embeddingAnnualCost)}/yr)</span>
                        </div>
                      </div>
                      <div className="mt-1.5 pt-1.5 border-t border-blue-500/10 flex items-center justify-between">
                        <span className={`text-xs ${t.textTertiary}`}>Total with embeddings</span>
                        <span className={`text-sm font-mono font-bold ${t.accent}`}>{fmt(result.monthlyCost + embeddingMonthlyCost)}/mo</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* TOKEN BREAKDOWN (M3-7: collapsible, default expanded) */}
                  <CollapsibleSection title="Token Breakdown / Action" defaultExpanded={true} t={t}>
                    <div className="space-y-4">
                      <TokenBar breakdown={result.tokenBreakdown} t={t} />
                      <div className={`grid grid-cols-2 gap-3 pt-2 border-t ${t.border}`}>
                        <div>
                          <div className={`text-xs ${t.textMuted}`}>Input cost / interaction</div>
                          <div className={`text-sm font-mono font-semibold ${t.text}`}>${result.costPerInteractionInput.toFixed(5)}</div>
                        </div>
                        <div>
                          <div className={`text-xs ${t.textMuted}`}>Output cost / interaction</div>
                          <div className={`text-sm font-mono font-semibold ${t.text}`}>${result.costPerInteractionOutput.toFixed(5)}</div>
                        </div>
                        <div>
                          <div className={`text-xs ${t.textMuted}`}>Cache write cost / interaction</div>
                          <div className={`text-sm font-mono font-semibold ${t.text}`}>${result.cacheWriteCostPerInteraction.toFixed(5)}</div>
                        </div>
                        <div>
                          <div className={`text-xs ${t.textMuted}`}>Cached input tokens</div>
                          <div className="text-sm font-mono font-semibold text-emerald-400">{fmtTokens(result.cachedInput)} ({Math.round(cfg.cacheRatio * 100)}%)</div>
                        </div>
                        <div>
                          <div className={`text-xs ${t.textMuted}`}>Agentic multiplier</div>
                          <div className={`text-sm font-mono font-semibold ${t.accent}`}>×{cfg.agenticMult}</div>
                        </div>
                        {result.reasoningTokens > 0 && (
                          <div>
                            <div className={`text-xs ${t.textMuted}`}>Reasoning tokens (hidden)</div>
                            <div className="text-sm font-mono font-semibold text-red-400">{fmtTokens(result.reasoningTokens)} ({cfg.reasoningMultiplier}x multiplier)</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CollapsibleSection>

                  {/* ANNUAL SCENARIO (M3-7: collapsible, default expanded) */}
                  <CollapsibleSection title="Annual Projections" defaultExpanded={true} t={t}>
                    <div className="space-y-3">
                      {[
                        { label: "Conservative (×0.5 volume)", cost: result.annualCost * 0.5, note: "Early-stage, limited rollout" },
                        { label: "Base case", cost: result.annualCost, note: "Current projections", highlight: true },
                        { label: "Growth (×2 volume)", cost: result.annualCost * 2, note: "Strong PMF & growth" },
                        { label: "Scale (×5 volume)", cost: result.annualCost * 5, note: "Mature product, full scale" },
                      ].map((s, i) => (
                        <div key={i} className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg ${s.highlight ? "bg-amber-500/10 border border-amber-500/30" : t.bgCardHalf}`}>
                          <div>
                            <div className={`font-medium ${s.highlight ? t.accentDark : t.textSecondary}`}>{s.label}</div>
                            <div className={t.textTertiary}>{s.note}</div>
                          </div>
                          <div className={`font-mono font-bold text-sm ${s.highlight ? t.accent : t.text}`}>{fmt(s.cost)}</div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleSection>
                </div>
              </>
            )}

            {/* Sections below always visible (not duplicated in comparison) */}

            {/* MODEL COMPARISON (M3-7: collapsible, default collapsed) */}
            <CollapsibleSection title="Model Comparison at Same Volume" defaultExpanded={false} t={t}>
              <ModelComparison cfg={cfg} t={t} />
            </CollapsibleSection>

            {/* SENSITIVITY ANALYSIS (M3-2, M3-12: collapsible, default collapsed) */}
            <CollapsibleSection title="Sensitivity Analysis" defaultExpanded={false} t={t}>
              <SensitivityControls
                range={sensitivityRange}
                onRangeChange={setSensitivityRange}
                enabledParams={sensitivityParams}
                onParamsChange={setSensitivityParams}
                t={t}
              />
              <TornadoChart cfg={cfg} range={sensitivityRange} enabledParams={sensitivityParams} t={t} />
            </CollapsibleSection>

            {/* RECOMMENDATIONS (M3-7: collapsible, default expanded) */}
            <CollapsibleSection title="Optimization Recommendations" defaultExpanded={true} t={t}>
              <RecommendationEngine result={result} cfg={cfg} archetype={archetype} t={t} />
            </CollapsibleSection>

            {/* FRAMEWORK REFERENCE (M3-7: collapsible, default collapsed) */}
            <CollapsibleSection title="Framework Reference — Cost Drivers" defaultExpanded={false} t={t}>
              <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs ${t.textMuted}`}>
                {[
                  { factor: "Model tier", impact: "10-100x", lever: "Match capability to task complexity" },
                  { factor: "Output length", impact: "3-5x premium", lever: "Output tokens cost more; use streaming + early stop" },
                  { factor: "Prompt caching", impact: "Up to -90%", lever: "Cache stable system prompts & RAG chunks" },
                  { factor: "Agentic depth", impact: "Multiplier xN", lever: "Minimize LLM calls; use deterministic steps where possible" },
                  { factor: "History window", impact: "Linear growth", lever: "Sliding window + summarization compression" },
                  { factor: "RAG context", impact: "Scales with docs", lever: "Chunk size optimization; relevance scoring" },
                ].map((row, i) => (
                  <div key={i} className={`space-y-0.5 border-l ${t.border} pl-3`}>
                    <div className={`font-semibold ${t.textSecondary}`}>{row.factor}</div>
                    <div className={`${t.accent} font-mono`}>{row.impact}</div>
                    <div className={`${t.textTertiary} leading-relaxed`}>{row.lever}</div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            {/* ASSUMPTIONS & LIMITATIONS (M3-7: collapsible, default collapsed) */}
            <CollapsibleSection title="Assumptions & Limitations" defaultExpanded={false} t={t}>
              <AssumptionsPanel cfg={cfg} model={result.model} t={t} />
            </CollapsibleSection>

            <div className="flex flex-col sm:flex-row justify-start gap-2">
              <button onClick={() => goToStep(1)} className={`px-4 py-2 rounded-lg border ${t.border} ${t.textSecondary} font-semibold text-sm ${t.bgCardHoverSolid} transition-colors min-h-[44px]`}>
                ← Adjust Tokens
              </button>
              <button onClick={() => goToStep(2)} className={`px-4 py-2 rounded-lg border ${t.border} ${t.textSecondary} font-semibold text-sm ${t.bgCardHoverSolid} transition-colors min-h-[44px]`}>
                ← Adjust Volume
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className={`text-center text-xs ${t.textQuaternary} mt-4 sm:mt-8 pb-4 px-3 space-y-1`}>
        <div>
          Framework v{FRAMEWORK_VERSION} | Pricing last updated: {pricingDateFormatted}
          <br className="sm:hidden" />
          <span className="hidden sm:inline"> | </span>
          <span className={t.textTertiary}>Verify current rates before use in financial planning</span>
        </div>
        <div>
          Created by Oz Levi | <a href="https://www.linkedin.com/company/semanticops-ai/" target="_blank" rel="noopener noreferrer" className={`${t.accent} underline hover:opacity-80`}>SemanticOps AI</a>
        </div>
        <div className={t.textQuaternary}>
          This tool is provided "as is" without warranty of any kind. The creators are not responsible for any damages or losses arising from its use.
        </div>
      </div>
    </div>
  );
}

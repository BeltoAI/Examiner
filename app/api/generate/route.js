import { NextResponse } from "next/server";
import { tryParseJsonLoose } from "../../../lib/jsonRepair";
import { shuffleArray, isTrueFalseChoiceList, clamp } from "../../../lib/examUtils";

export const dynamic = "force-dynamic";
const BASE = process.env.LLM_URL || "http://minibelto.duckdns.org:8007";
const URL = `${BASE}/v1/completions`;

// --- Tuning & guards ---
const MAX_PROMPT_CHARS = 24000;   // keep under typical 8k context when combined with instructions
const MAX_TOKENS_OUT   = 1024;    // smaller = less chance of truncation/garbage
const TEMP              = 0.0;    // deterministic JSON
const RETRIES           = 2;      // retry both stages

function truncateLecture(lecture) {
  let s = String(lecture || "");
  if (s.length <= MAX_PROMPT_CHARS) return s;
  // keep head and tail; most lectures have key defs up front and recap at the end
  const head = s.slice(0, Math.floor(MAX_PROMPT_CHARS * 0.55));
  const tail = s.slice(-Math.floor(MAX_PROMPT_CHARS * 0.35));
  return `${head}\n...\n${tail}`;
}

// --- Prompts ---
function buildDraftPrompt(lecture, { title }) {
  return `
You construct exams strictly from the given lecture. Choose a sensible mix: mostly 4-option MCQs, some True/False, 1–3 Essays. Aim for 12–18 total if content allows (fewer is OK).
Return STRICT JSON ONLY. No prose. No code fences. No markdown.

{
  "title": "${title ?? "Generated Exam"}",
  "instructions": "Read carefully. Answer based only on the lecture. No outside sources.",
  "questions": [
    {
      "id": "q1",
      "type": "mcq|true_false|essay",
      "question": "Standalone question based ONLY on the lecture.",
      "choices": ["A","B","C","D"],   // omit for essay
      "correct_choice": 0,             // 0-based; for true_false: 0=True, 1=False
      "explanation": "1 sentence rationale grounded in the lecture.",
      "points": 1
    }
  ]
}

Hard constraints:
- MCQ: EXACTLY four distinct, lecture-plausible options; single correct. No True/False disguised as MCQ.
- True/False: unambiguous from the lecture only.
- Essay: prompt must require synthesis from lecture; no outside facts.
- Remove anachronisms or unsupported claims.
Lecture:
"""
${lecture}
"""`.trim();
}

function buildValidatePrompt(lecture, draft) {
  return `
You are a validator/fixer. Input: lecture + DRAFT exam JSON. Output: valid JSON only (same schema). Keep the AI-chosen number of questions.

Validation rules:
- Every question answerable from the lecture only; remove/repair unsupported items.
- MCQ: exactly 4 distinct choices, one correct; no T/F disguised as MCQ.
- True/False: unambiguous; rewrite if ambiguous.
- Essay: synthesis prompts tied to lecture; "explanation" can include a short rubric hint.
- Ensure each item has "points" (essay default 5). Keep JSON minimal (no extra keys).

Lecture:
"""
${lecture}
"""

DRAFT:
${JSON.stringify(draft, null, 2)}
`.trim();
}

// --- LLM caller with retries & shape handling ---
async function callLLM(prompt, signal) {
  const body = { model: "local", prompt, max_tokens: MAX_TOKENS_OUT, temperature: TEMP };
  const r = await fetch(URL, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), cache: "no-store", signal
  });
  const raw = await r.text();
  if (!r.ok) throw new Error(`LLM ${r.status}: ${raw.slice(0, 400)}`);
  try {
    const j = JSON.parse(raw);
    if (j?.choices?.[0]?.text) return String(j.choices[0].text);
    if (j?.content) return String(j.content);
    if (j?.questions) return JSON.stringify(j);
  } catch { /* ignore */ }
  return raw;
}

async function callLLMRetry(prompt, signal, tries = RETRIES) {
  let err;
  for (let i = 0; i <= tries; i++) {
    try {
      const txt = await callLLM(prompt, signal);
      if (txt && txt.trim()) return txt;
      err = new Error("Empty LLM response");
    } catch (e) { err = e; }
    await new Promise(r => setTimeout(r, 400 * (i + 1))); // backoff
  }
  throw err;
}

// --- Normalization & guards ---
function normalizeExam(parsed, options) {
  const out = {
    title: parsed?.title || options?.title || "Generated Exam",
    instructions: parsed?.instructions || "Answer all questions.",
    questions: []
  };
  const list = Array.isArray(parsed?.questions) ? parsed.questions : [];

  for (let i = 0; i < list.length; i++) {
    const q = list[i] || {};
    let type = ["mcq","true_false","essay"].includes(q.type) ? q.type : "mcq";
    let question = q.question || "Question text missing.";
    let points = Number.isFinite(q.points) ? q.points : (type === "essay" ? 5 : 1);
    let explanation = q.explanation || "";

    if (type === "mcq") {
      let choices = Array.isArray(q.choices) ? q.choices.slice(0, 4) : [];
      if (choices.length !== 4 || isTrueFalseChoiceList(choices)) {
        // degrade into proper True/False to prevent junk MCQs
        type = "true_false";
      } else {
        // shuffle MCQ choices but keep correct alignment
        const tagged = choices.map((c, idx) => ({ c: String(c), idx }));
        const shuffled = shuffleArray(tagged);
        const ci = clamp(Number.isInteger(q.correct_choice) ? q.correct_choice : 0, 0, choices.length - 1);
        const newIndex = shuffled.findIndex(x => x.idx === ci);
        out.questions.push({
          id: q.id || `q${i + 1}`,
          type: "mcq",
          question,
          choices: shuffled.map(x => x.c),
          correct_choice: clamp(newIndex, 0, 3),
          explanation,
          points
        });
        continue;
      }
    }

    if (type === "true_false") {
      const ci = q.correct_choice === 1 ? 1 : 0;
      out.questions.push({
        id: q.id || `q${i + 1}`,
        type: "true_false",
        question,
        choices: ["True", "False"],
        correct_choice: ci,
        explanation,
        points
      });
      continue;
    }

    // essay
    out.questions.push({
      id: q.id || `q${i + 1}`,
      type: "essay",
      question,
      explanation,
      points
    });
  }
  return out;
}

// Last-resort fallback: extract basics from lecture without outside facts
function safeFallbackFromLecture(lecture, { title }) {
  const text = String(lecture || "").replace(/\s+/g, " ").trim();
  const sentences = text.split(/(?<=[.!?])\s+/).slice(0, 12);
  const tfBase = sentences.slice(0, 4).filter(s => s.length > 30);
  const mcBase = sentences.slice(4, 10).filter(s => s.length > 40);
  const essayBase = sentences.slice(10, 12);

  const tfQs = tfBase.map((s, i) => ({
    id: `qtf${i+1}`,
    type: "true_false",
    question: s,
    choices: ["True","False"],
    correct_choice: 0,
    explanation: "Statement taken directly from lecture.",
    points: 1
  }));

  const mcQs = mcBase.map((s, i) => {
    // crude noun-phrase distractors by slicing; still grounded in sentence text
    const a = s.slice(0, 60).trim();
    const b = s.slice(20, 80).trim();
    const c = s.slice(40, 100).trim();
    const d = s.slice(10, 70).trim();
    const choices = shuffleArray([a, b, c, d].map(x => x || s));
    const correct_choice = choices.findIndex(x => x === a) >= 0 ? choices.findIndex(x => x === a) : 0;
    return {
      id: `qmc${i+1}`,
      type: "mcq",
      question: `Based on the lecture: ${s}`,
      choices,
      correct_choice,
      explanation: "Answer derived from the lecture sentence.",
      points: 1
    };
  }).slice(0, 6);

  const essays = (essayBase.length ? essayBase : sentences.slice(-2)).map((s, i) => ({
    id: `qes${i+1}`,
    type: "essay",
    question: `Explain, using the lecture, the significance of: ${s}`,
    explanation: "Rubric: clarity, evidence from lecture, structure.",
    points: 5
  })).slice(0, 2);

  const questions = [...mcQs, ...tfQs, ...essays];
  return {
    title: title || "Generated Exam",
    instructions: "Answer based only on the lecture.",
    questions: questions.length ? questions : [{
      id: "q1",
      type: "essay",
      question: "Summarize the core argument of the lecture.",
      explanation: "Rubric: accuracy, key points, structure.",
      points: 5
    }]
  };
}

export async function POST(req) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Timeout (120s)")), 120000);
  try {
    const { lecture, options } = await req.json();
    if (!lecture || !lecture.trim()) {
      return NextResponse.json({ error: "Missing lecture" }, { status: 400 });
    }
    const truncated = truncateLecture(lecture);
    const opts = options || {};

    // Stage 1: draft (with retries)
    let draftTxt, draft;
    try {
      draftTxt = await callLLMRetry(buildDraftPrompt(truncated, opts), controller.signal);
      try { draft = JSON.parse(draftTxt); } catch { draft = tryParseJsonLoose(draftTxt); }
    } catch (e) {
      // total failure on draft → fallback
      const fallback = safeFallbackFromLecture(truncated, opts);
      return NextResponse.json(fallback);
    }
    if (!draft?.questions?.length) {
      const fallback = safeFallbackFromLecture(truncated, opts);
      return NextResponse.json(fallback);
    }

    // Stage 2: validate (with retries); if it fails, keep draft
    let fixedTxt, fixed = null;
    try {
      fixedTxt = await callLLMRetry(buildValidatePrompt(truncated, draft), controller.signal);
      try { fixed = JSON.parse(fixedTxt); } catch { fixed = tryParseJsonLoose(fixedTxt); }
    } catch { /* ignore; use draft */ }

    const normalized = normalizeExam(fixed?.questions?.length ? fixed : draft, opts);

    if (!normalized.questions.length) {
      const fallback = safeFallbackFromLecture(truncated, opts);
      return NextResponse.json(fallback);
    }
    return NextResponse.json(normalized);
  } catch (e) {
    // absolute last resort
    const msg = e?.message || String(e);
    const minimal = safeFallbackFromLecture("", { title: "Generated Exam" });
    return NextResponse.json({ ...minimal, _warning: `Server error, fallback used: ${msg}` });
  } finally {
    clearTimeout(timer);
  }
}

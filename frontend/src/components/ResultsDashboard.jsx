// src/components/ResultsDashboard.jsx
import React, { useState, useRef } from "react";
import MathText from "./MathText";

const MARKS_CORRECT = 4;
const MARKS_WRONG = -1;

const STATUS_CONFIG = {
  correct: { label: "Correct", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: "✓", marks: `+${MARKS_CORRECT}` },
  wrong:   { label: "Wrong",   color: "text-red-400",     bg: "bg-red-500/10 border-red-500/30",       icon: "✗", marks: `${MARKS_WRONG}` },
  skipped: { label: "Skipped", color: "text-slate-400",   bg: "bg-slate-800 border-slate-700",         icon: "—", marks: "0" },
};

function recomputeResults(results, answerMap) {
  return results.map(r => {
    const qid = String(r.question.id);
    const correctIdx = answerMap.hasOwnProperty(qid)
      ? answerMap[qid]
      : r.question.correct_answer_index;
    const question = { ...r.question, correct_answer_index: correctIdx };
    const answered = r.selectedIndex !== null && r.selectedIndex !== undefined;
    const correct  = answered && r.selectedIndex === correctIdx;
    const wrong    = answered && !correct;
    return {
      ...r,
      question,
      status: correct ? "correct" : wrong ? "wrong" : "skipped",
      marks:  correct ? MARKS_CORRECT : wrong ? MARKS_WRONG : 0,
    };
  });
}

export default function ResultsDashboard({ results: initialResults, onRetry }) {
  const [results, setResults]           = useState(initialResults);
  const [filter, setFilter]             = useState("all");
  const [expandedId, setExpandedId]     = useState(null);
  const [answerMap, setAnswerMap]       = useState({});          // {qid: 0-based idx}
  const [akPanel, setAkPanel]           = useState(false);       // show/hide panel
  const [akMode, setAkMode]             = useState("pdf");       // "pdf" | "manual"
  const [akLoading, setAkLoading]       = useState(false);
  const [akStatus, setAkStatus]         = useState(null);        // success/error msg
  const [manualEdits, setManualEdits]   = useState({});          // temp edits in manual mode
  const akFileRef = useRef(null);

  const correct   = results.filter(r => r.status === "correct").length;
  const wrong     = results.filter(r => r.status === "wrong").length;
  const skipped   = results.filter(r => r.status === "skipped").length;
  const total     = results.reduce((s, r) => s + r.marks, 0);
  const maxMarks  = results.length * MARKS_CORRECT;
  const percentage = Math.max(0, (total / maxMarks) * 100).toFixed(1);

  const subjects = [...new Set(results.map(r => r.question.subject))];
  const subjectStats = subjects.map(sub => {
    const sr = results.filter(r => r.question.subject === sub);
    const sc = sr.filter(r => r.status === "correct").length;
    return { subject: sub, total: sr.length, correct: sc,
             marks: sr.reduce((s, r) => s + r.marks, 0),
             pct: Math.round((sc / sr.length) * 100) };
  });

  const getRank = () => {
    if (percentage >= 90) return { label: "Excellent", color: "text-emerald-400", emoji: "🏆" };
    if (percentage >= 75) return { label: "Good",      color: "text-blue-400",    emoji: "🎯" };
    if (percentage >= 50) return { label: "Average",   color: "text-amber-400",   emoji: "📈" };
    return { label: "Needs Work", color: "text-red-400", emoji: "📚" };
  };

  const rank     = getRank();
  const filtered = filter === "all" ? results : results.filter(r => r.status === filter);

  // ── Apply answer map and recompute ─────────────────────────────────────
  const applyAnswerMap = (map) => {
    setAnswerMap(map);
    setResults(recomputeResults(initialResults, map));
  };

  // ── PDF answer key import ───────────────────────────────────────────────
  const handleAKPdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAkLoading(true);
    setAkStatus(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res  = await fetch("/api/parse-answer-key", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      const map = data.answers || {};
      if (Object.keys(map).length === 0) {
        setAkStatus({ type: "warn", msg: "No answer key found in PDF. Try manual entry." });
      } else {
        applyAnswerMap(map);
        setAkStatus({ type: "ok", msg: `Imported ${Object.keys(map).length} answers successfully.` });
        setAkPanel(false);
      }
    } catch (err) {
      setAkStatus({ type: "err", msg: err.message });
    } finally {
      setAkLoading(false);
      e.target.value = "";
    }
  };

  // ── Manual answer key apply ─────────────────────────────────────────────
  const applyManual = () => {
    const merged = { ...answerMap, ...manualEdits };
    applyAnswerMap(merged);
    setAkStatus({ type: "ok", msg: `Applied ${Object.keys(manualEdits).length} manual overrides.` });
    setManualEdits({});
    setAkPanel(false);
  };

  const labelToIdx = { A: 0, B: 1, C: 2, D: 3 };
  const idxToLabel = ["A", "B", "C", "D"];

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-5xl mx-auto">

        {/* Score Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 mb-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-400/5 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="text-6xl mb-3">{rank.emoji}</div>
            <div className={`text-5xl font-black mb-1 ${rank.color}`}>{rank.label}</div>
            <div className="text-slate-400 text-sm mb-6">Performance Assessment</div>
            <div className="flex items-end justify-center gap-2 mb-4">
              <span className="text-7xl font-black text-white">{total}</span>
              <span className="text-2xl text-slate-500 mb-3">/ {maxMarks}</span>
            </div>
            <div className="text-slate-400 text-sm">{percentage}% Score</div>
            <div className="mt-4 h-3 bg-slate-800 rounded-full overflow-hidden max-w-sm mx-auto">
              <div className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-amber-400 to-amber-300"
                style={{ width: `${percentage}%` }} />
            </div>

            {/* Answer Key Button */}
            <div className="mt-5">
              <button
                onClick={() => { setAkPanel(p => !p); setAkStatus(null); }}
                className="px-5 py-2 rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-400 text-xs font-semibold hover:bg-amber-400/20 transition-colors"
              >
                {Object.keys(answerMap).length > 0
                  ? `✓ Answer key applied (${Object.keys(answerMap).length}) — Update`
                  : "🗝 Import Answer Key"}
              </button>
            </div>
          </div>
        </div>

        {/* Answer Key Panel */}
        {akPanel && (
          <div className="bg-slate-900 border border-amber-400/20 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-sm uppercase tracking-wider">Answer Key</h3>
              <div className="flex gap-2">
                {["pdf", "manual"].map(m => (
                  <button key={m} onClick={() => setAkMode(m)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono capitalize transition-colors
                      ${akMode === m ? "bg-amber-400 text-slate-900 font-bold" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
                    {m === "pdf" ? "📄 Import from PDF" : "✏️ Manual Entry"}
                  </button>
                ))}
              </div>
            </div>

            {akMode === "pdf" && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-slate-400 text-sm text-center">Upload the answer key PDF (can be the same exam PDF if answers are at the end).</p>
                <input ref={akFileRef} type="file" accept=".pdf" className="hidden" onChange={handleAKPdfUpload} />
                <button
                  onClick={() => akFileRef.current?.click()}
                  disabled={akLoading}
                  className="px-6 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-slate-200 text-sm hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  {akLoading ? "Extracting…" : "Choose PDF"}
                </button>
              </div>
            )}

            {akMode === "manual" && (
              <div>
                <p className="text-slate-400 text-sm mb-4">Set correct answer for each question. Leave blank to keep existing.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
                  {results.map(r => {
                    const qid = String(r.question.id);
                    const current = manualEdits.hasOwnProperty(qid)
                      ? manualEdits[qid]
                      : answerMap.hasOwnProperty(qid)
                        ? answerMap[qid]
                        : r.question.correct_answer_index;
                    return (
                      <div key={qid} className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2">
                        <span className="text-slate-400 text-xs font-mono w-6">Q{qid}</span>
                        <div className="flex gap-1">
                          {["A","B","C","D"].map((lbl, i) => (
                            <button key={lbl}
                              onClick={() => setManualEdits(prev => ({ ...prev, [qid]: i }))}
                              className={`w-6 h-6 rounded text-xs font-bold transition-colors
                                ${current === i
                                  ? "bg-amber-400 text-slate-900"
                                  : "bg-slate-700 text-slate-400 hover:bg-slate-600"}`}>
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={applyManual}
                    disabled={Object.keys(manualEdits).length === 0}
                    className="px-6 py-2 rounded-xl bg-amber-400 text-slate-900 font-bold text-sm hover:bg-amber-300 disabled:opacity-40 transition-colors"
                  >
                    Apply Changes
                  </button>
                </div>
              </div>
            )}

            {akStatus && (
              <div className={`mt-3 px-4 py-2 rounded-xl text-sm text-center
                ${akStatus.type === "ok"   ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : akStatus.type === "warn" ? "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                :                            "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                {akStatus.msg}
              </div>
            )}
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Correct",  value: correct, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
            { label: "Wrong",    value: wrong,   color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20" },
            { label: "Skipped",  value: skipped, color: "text-slate-400",   bg: "bg-slate-800 border-slate-700" },
            { label: "Accuracy", value: `${correct > 0 ? ((correct/(correct+wrong))*100).toFixed(0) : 0}%`,
              color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`border rounded-2xl p-5 text-center ${bg}`}>
              <div className={`text-3xl font-black mb-1 ${color}`}>{value}</div>
              <div className="text-slate-500 text-xs uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>

        {/* Marking scheme */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 flex items-center gap-6 text-sm">
          <span className="text-slate-500 text-xs uppercase tracking-wider font-mono">Marking Scheme</span>
          <span className="text-emerald-400 font-bold">Correct: +{MARKS_CORRECT}</span>
          <span className="text-red-400 font-bold">Wrong: {MARKS_WRONG}</span>
          <span className="text-slate-400 font-bold">Skipped: 0</span>
        </div>

        {/* Subject-wise */}
        {subjects.length > 1 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">Subject-wise Analysis</h3>
            <div className="space-y-3">
              {subjectStats.map(({ subject, total: st, correct: sc, marks: sm, pct }) => (
                <div key={subject} className="flex items-center gap-4">
                  <div className="w-24 text-slate-400 text-sm truncate">{subject}</div>
                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-slate-400 text-xs w-28 text-right">
                    {sc}/{st} · <span className={sm >= 0 ? "text-emerald-400" : "text-red-400"}>{sm > 0 ? "+" : ""}{sm}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Q-by-Q Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-white font-bold text-sm uppercase tracking-wider">Question Breakdown</h3>
            <div className="flex gap-2">
              {["all", "correct", "wrong", "skipped"].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono capitalize transition-colors
                    ${filter === f ? "bg-amber-400 text-slate-900 font-bold" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
                  {f} {f !== "all" && `(${results.filter(r => r.status === f).length})`}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filtered.map((result) => {
              const cfg  = STATUS_CONFIG[result.status];
              const isOpen = expandedId === result.question.id;
              const akOverridden = answerMap.hasOwnProperty(String(result.question.id));
              return (
                <div key={result.question.id} className={`border rounded-xl transition-colors ${cfg.bg}`}>
                  <button
                    onClick={() => setExpandedId(isOpen ? null : result.question.id)}
                    className="w-full flex items-center gap-4 p-4 text-left"
                  >
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${cfg.color} bg-current/10`}>
                      {cfg.icon}
                    </span>
                    <span className="text-slate-400 text-xs font-mono w-6 flex-shrink-0">Q{result.question.id}</span>
                    {akOverridden && <span className="text-amber-400 text-xs">🗝</span>}
                    <MathText text={result.question.question_text} hasMath={result.question.has_math} className="text-white text-sm flex-1 truncate" />
                    <span className={`text-sm font-bold flex-shrink-0 ${cfg.color}`}>{cfg.marks}</span>
                    <span className="text-slate-600 text-xs ml-2">{isOpen ? "▲" : "▼"}</span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-slate-700/50 pt-3">
                      <MathText text={result.question.question_text} hasMath={result.question.has_math} className="text-slate-300 text-sm mb-3 block" />
                      <div className="space-y-2">
                        {result.question.options.map((opt, i) => {
                          const isCorrect  = i === result.question.correct_answer_index;
                          const isSelected = i === result.selectedIndex;
                          return (
                            <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                              ${isCorrect  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                              : isSelected ? "bg-red-500/10 border border-red-500/30 text-red-300"
                              : "text-slate-500"}`}
                            >
                              <span className="font-bold w-5">{opt.label}</span>
                              <MathText text={opt.text} hasMath={result.question.has_math} />
                              {isCorrect  && <span className="ml-auto text-emerald-400 text-xs font-bold">CORRECT</span>}
                              {isSelected && !isCorrect && <span className="ml-auto text-red-400 text-xs font-bold">YOUR ANSWER</span>}
                            </div>
                          );
                        })}
                      </div>
                      {akOverridden && (
                        <p className="text-amber-400/60 text-xs mt-2">🗝 Correct answer set via imported answer key</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-center mt-8">
          <button onClick={onRetry}
            className="px-8 py-3 bg-amber-400 text-slate-900 font-black rounded-2xl hover:bg-amber-300 transition-colors text-sm">
            ↑ Upload New PDF
          </button>
        </div>
      </div>
    </div>
  );
}
// src/components/QuestionPalette.jsx
import React, { useState } from "react";

const STATUS_STYLES = {
  answered:    "bg-emerald-500 text-white border-emerald-500",
  current:     "bg-amber-400 text-slate-900 border-amber-400 ring-2 ring-amber-400/50",
  unattempted: "bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500",
};

const SUBJECT_COLORS = {
  Biology:     { active: "bg-emerald-500 text-white border-emerald-500",     dot: "bg-emerald-500" },
  Chemistry:   { active: "bg-blue-500 text-white border-blue-500",           dot: "bg-blue-500" },
  Physics:     { active: "bg-violet-500 text-white border-violet-500",       dot: "bg-violet-500" },
  Mathematics: { active: "bg-rose-500 text-white border-rose-500",           dot: "bg-rose-500" },
  General:     { active: "bg-slate-500 text-white border-slate-500",         dot: "bg-slate-500" },
};

function subjectColor(subject) {
  return SUBJECT_COLORS[subject] ?? { active: "bg-amber-400 text-slate-900 border-amber-400", dot: "bg-amber-400" };
}

export default function QuestionPalette({ questions, answers, currentIndex, onJump }) {
  const [activeSubject, setActiveSubject] = useState("All");

  const getStatus = (index) => {
    if (index === currentIndex) return "current";
    if (answers[index] !== undefined && answers[index] !== null) return "answered";
    return "unattempted";
  };

  const subjects = [...new Set(questions.map(q => q.subject))];
  const tabs = ["All", ...subjects];

  const handleTabClick = (subject) => {
    setActiveSubject(subject);
    if (subject !== "All") {
      const firstQ = questions.find(q => q.subject === subject);
      if (firstQ) {
        const idx = questions.findIndex(q => q.id === firstQ.id);
        if (idx !== -1) onJump(idx);
      }
    }
  };

  const visibleSubjects = activeSubject === "All" ? subjects : [activeSubject];

  const answeredCount = Object.values(answers).filter(a => a !== null && a !== undefined).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 w-64 flex-shrink-0 h-fit sticky top-6">
      <h3 className="text-white font-bold text-sm mb-3 uppercase tracking-wider">Question Palette</h3>

      {/* Subject filter tabs */}
      {subjects.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {tabs.map(tab => {
            const isActive = activeSubject === tab;
            const colors = tab === "All" ? null : subjectColor(tab);
            return (
              <button
                key={tab}
                onClick={() => handleTabClick(tab)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all duration-150
                  ${isActive
                    ? tab === "All"
                      ? "bg-amber-400 text-slate-900 border-amber-400"
                      : colors.active
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200"
                  }`}
              >
                {tab !== "All" && (
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? "bg-white/70" : subjectColor(tab).dot}`} />
                )}
                {tab === "All" ? "All" : tab.slice(0, 4)}
              </button>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-slate-800">
        {[
          { label: "Current",     cls: "bg-amber-400" },
          { label: "Answered",    cls: "bg-emerald-500" },
          { label: "Not Visited", cls: "bg-slate-900 border border-slate-700" },
        ].map(({ label, cls }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${cls}`} />
            <span className="text-slate-500 text-xs">{label}</span>
          </div>
        ))}
      </div>

      {/* Question buttons grouped by subject */}
      {visibleSubjects.map(subject => {
        const subjectQs = questions.filter(q => q.subject === subject);
        const colors = subjectColor(subject);
        const subjectAnswered = subjectQs.filter((_, localIdx) => {
          const origIdx = questions.findIndex(oq => oq.id === subjectQs[localIdx].id);
          return answers[origIdx] !== undefined && answers[origIdx] !== null;
        }).length;

        return (
          <div key={subject} className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                <p className="text-slate-400 text-xs font-mono uppercase tracking-wider">{subject}</p>
              </div>
              <span className="text-slate-600 text-xs">
                {subjectAnswered}/{subjectQs.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {subjectQs.map(q => {
                const origIdx = questions.findIndex(oq => oq.id === q.id);
                const status = getStatus(origIdx);
                return (
                  <button
                    key={q.id}
                    onClick={() => onJump(origIdx)}
                    className={`w-9 h-9 rounded-lg border text-xs font-bold transition-all duration-150 ${STATUS_STYLES[status]}`}
                  >
                    {q.id}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Summary footer */}
      <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-emerald-400 font-bold text-lg">{answeredCount}</div>
          <div className="text-slate-600 text-xs">Done</div>
        </div>
        <div>
          <div className="text-slate-400 font-bold text-lg">{questions.length - answeredCount}</div>
          <div className="text-slate-600 text-xs">Left</div>
        </div>
        <div>
          <div className="text-white font-bold text-lg">{questions.length}</div>
          <div className="text-slate-600 text-xs">Total</div>
        </div>
      </div>
    </div>
  );
}

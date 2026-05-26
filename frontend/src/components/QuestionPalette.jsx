// src/components/QuestionPalette.jsx
import React, { useState, useCallback } from "react";

const STATUS_STYLES = {
  answered:    "bg-emerald-500 text-white border-emerald-500",
  current:     "bg-amber-400 text-slate-900 border-amber-400 ring-2 ring-amber-400/50",
  unattempted: "bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500",
};

export default function QuestionPalette({ questions, answers, currentIndex, onJump }) {
  const getStatus = (index) => {
    if (index === currentIndex) return "current";
    if (answers[index] !== undefined && answers[index] !== null) return "answered";
    return "unattempted";
  };

  const subjects = [...new Set(questions.map(q => q.subject))];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 w-64 flex-shrink-0 h-fit sticky top-6">
      <h3 className="text-white font-bold text-sm mb-4 uppercase tracking-wider">Question Palette</h3>

      <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-slate-800">
        {[
          { label: "Current",    cls: "bg-amber-400" },
          { label: "Answered",   cls: "bg-emerald-500" },
          { label: "Not Visited",cls: "bg-slate-900 border border-slate-700" },
        ].map(({ label, cls }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${cls}`}></div>
            <span className="text-slate-500 text-xs">{label}</span>
          </div>
        ))}
      </div>

      {subjects.map(subject => {
        const subjectQs = questions.filter(q => q.subject === subject);
        return (
          <div key={subject} className="mb-4">
            <p className="text-slate-500 text-xs font-mono uppercase tracking-wider mb-2">{subject}</p>
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

      <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-emerald-400 font-bold text-lg">
            {Object.values(answers).filter(a => a !== null && a !== undefined).length}
          </div>
          <div className="text-slate-600 text-xs">Done</div>
        </div>
        <div>
          <div className="text-slate-400 font-bold text-lg">
            {questions.length - Object.values(answers).filter(a => a !== null && a !== undefined).length}
          </div>
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
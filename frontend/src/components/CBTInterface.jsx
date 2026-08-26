// src/components/CBTInterface.jsx
import React, { useState, useCallback, useEffect, useRef } from "react";
import Timer from "./Timer";
import QuestionPalette from "./QuestionPalette";
import MathText from "./MathText";
import ImageCropperModal from "./ImageCropperModal";

const MARKS_CORRECT = 4;
const MARKS_WRONG = -1;
const MARKS_SKIPPED = 0;

export default function CBTInterface({ questions: initialQuestions, durationMinutes = 180, pageImages = {}, onSubmit }) {
  const [questions, setQuestions] = useState(initialQuestions);

  const loadState = () => {
    try {
      const saved = localStorage.getItem("cbt_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.questionsLength === initialQuestions.length) return parsed;
      }
    } catch (e) {
      console.error("Failed to load session", e);
    }
    return null;
  };
  const savedState = loadState();

  const [currentIndex, setCurrentIndex] = useState(savedState ? savedState.currentIndex : 0);
  const [answers, setAnswers] = useState(savedState ? savedState.answers : {});
  const [endTime] = useState(savedState ? savedState.endTime : Date.now() + durationMinutes * 60000);
  
  const calculateTimeLeft = () => Math.max(0, Math.floor((endTime - Date.now()) / 1000));
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());
  
  const [showConfirm, setShowConfirm] = useState(false);
  
  // { isOpen: boolean, questionId: number, optionIndex: number | null }
  const [cropperState, setCropperState] = useState({ isOpen: false, questionId: null, optionIndex: null });

  useEffect(() => {
    if (timeLeft <= 0 && calculateTimeLeft() <= 0) { handleSubmit(true); return; }
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [endTime]);

  useEffect(() => {
    localStorage.setItem("cbt_session", JSON.stringify({
      questionsLength: questions.length, currentIndex, answers, endTime
    }));
  }, [questions.length, currentIndex, answers, endTime]);

  const currentQuestion = questions[currentIndex];

  const selectOption = (optIdx) => {
    setAnswers(prev => ({
      ...prev,
      [currentIndex]: prev[currentIndex] === optIdx ? null : optIdx,
    }));
  };

  const handleSubmit = useCallback((autoSubmit = false) => {
    if (!autoSubmit && !showConfirm) { setShowConfirm(true); return; }
    localStorage.removeItem("cbt_session");
    const results = questions.map((q, i) => {
      const answered = answers[i] !== undefined && answers[i] !== null;
      const correct = answered && answers[i] === q.correct_answer_index;
      const wrong = answered && !correct;
      return {
        question: q,
        selectedIndex: answers[i] ?? null,
        status: correct ? "correct" : wrong ? "wrong" : "skipped",
        marks: correct ? MARKS_CORRECT : wrong ? MARKS_WRONG : MARKS_SKIPPED,
      };
    });
    onSubmit(results);
  }, [answers, questions, showConfirm, onSubmit]);

  const goTo = (idx) => setCurrentIndex(Math.max(0, Math.min(questions.length - 1, idx)));

  const handleCropComplete = (base64Data, mimeType) => {
    const { questionId, optionIndex } = cropperState;
    if (!questionId) return;

    setQuestions(prev => prev.map(q => {
      if (q.id === questionId) {
        if (optionIndex !== null) {
          // Update option diagram
          const newOptions = [...q.options];
          newOptions[optionIndex] = { 
            ...newOptions[optionIndex], 
            diagram_base64: base64Data, 
            diagram_mime: mimeType 
          };
          return { ...q, options: newOptions };
        } else {
          // Update question diagram
          return { ...q, diagram_base64: base64Data, diagram_mime: mimeType, has_image: true };
        }
      }
      return q;
    }));
    
    setCropperState({ isOpen: false, questionId: null, optionIndex: null });
  };

  const triggerDiagramCrop = (questionId, optionIndex = null) => {
    setCropperState({ isOpen: true, questionId, optionIndex });
  };

  const selectedOption = answers[currentIndex] ?? null;
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-slate-950 p-4">
      {cropperState.isOpen && (
        <ImageCropperModal
          base64Image={pageImages[currentQuestion.page_number]}
          onClose={() => setCropperState({ isOpen: false, questionId: null, optionIndex: null })}
          onCropComplete={handleCropComplete}
        />
      )}

      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-white text-xl font-bold mb-2">Submit Test?</h2>
            <p className="text-slate-400 text-sm mb-6">
              Answered: {Object.values(answers).filter(a => a !== null && a !== undefined).length} / {questions.length}
              <br />Unanswered questions will be marked as skipped (0 marks).
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Continue Test
              </button>
              <button
                onClick={() => handleSubmit(true)}
                className="flex-1 py-2.5 rounded-xl bg-amber-400 text-slate-900 font-bold hover:bg-amber-300 transition-colors"
              >
                Submit Now
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 bg-slate-900 border border-slate-800 rounded-2xl px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center text-slate-900 font-black text-sm">
              CBT
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Question {currentIndex + 1} of {questions.length}</p>
              <p className="text-slate-500 text-xs font-mono">{currentQuestion.subject}</p>
            </div>
          </div>
          <Timer seconds={timeLeft} onExpire={() => handleSubmit(true)} />
          <button
            onClick={() => handleSubmit(false)}
            className="px-5 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-500/20 transition-colors"
          >
            Submit Test
          </button>
        </div>

        <div className="h-1 bg-slate-800 rounded-full mb-6 overflow-hidden">
          <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="flex gap-6 items-start">
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-8">
            {(currentQuestion.has_math || currentQuestion.has_image) && (
              <div className="mb-4 px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono flex items-center gap-2">
                {currentQuestion.has_math && <span>∑ Math rendering active (KaTeX)</span>}
                {currentQuestion.has_image && <span>🖼 Diagram attached</span>}
              </div>
            )}

            <div className="mb-6">
              <span className="inline-block bg-amber-400/10 text-amber-400 text-xs font-mono px-2 py-0.5 rounded mb-3">
                Q{currentQuestion.id}
              </span>
              {/* Render question text — preserve newlines for match-the-following tables */}
              <div className="text-white text-lg leading-relaxed font-medium whitespace-pre-wrap">
                <MathText
                  text={currentQuestion.question_text}
                  hasMath={currentQuestion.has_math}
                  className="text-white text-lg leading-relaxed font-medium"
                />
              </div>
            </div>

            {/* Diagram block */}
            {currentQuestion.diagram_base64 ? (
              <div className="mb-6">
                <div className="flex justify-center mb-2">
                  <img
                    src={`data:${currentQuestion.diagram_mime || "image/png"};base64,${currentQuestion.diagram_base64}`}
                    alt={`Diagram for Q${currentQuestion.id}`}
                    className="max-h-64 max-w-full rounded-xl border border-slate-700 object-contain bg-white/5"
                  />
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={() => triggerDiagramCrop(currentQuestion.id)}
                    className="text-xs text-slate-500 hover:text-slate-300 underline transition-colors"
                  >
                    Replace diagram
                  </button>
                </div>
              </div>
            ) : currentQuestion.has_image ? (
              <div className="mb-6 flex flex-col items-center gap-2 border border-dashed border-slate-700 rounded-xl py-6">
                <span className="text-slate-500 text-sm">No diagram extracted for this question</span>
                <button
                  onClick={() => triggerDiagramCrop(currentQuestion.id)}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-xs hover:bg-slate-700 transition-colors"
                >
                  + Add diagram manually
                </button>
              </div>
            ) : null}

            <div className="space-y-3">
              {currentQuestion.options.map((opt, i) => {
                const isSelected = selectedOption === i;
                const isIllegible = opt.text.toLowerCase().includes("illegible");
                return (
                  <button
                    key={i}
                    onClick={() => selectOption(i)}
                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border text-left transition-all duration-150
                      ${isSelected
                        ? "border-amber-400 bg-amber-400/10 text-white"
                        : "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-500 hover:bg-slate-800"
                      }`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors
                      ${isSelected ? "bg-amber-400 text-slate-900" : "bg-slate-700 text-slate-400"}`}>
                      {opt.label}
                    </span>
                    <div className="flex-1">
                      {isIllegible ? (
                        <div className="flex flex-col gap-2 items-start">
                          <span className="text-sm text-slate-500 italic">
                            [Structure/diagram — see question paper]
                          </span>
                          {!opt.diagram_base64 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); triggerDiagramCrop(currentQuestion.id, i); }}
                              className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-xs hover:bg-slate-700 transition-colors"
                            >
                              + Crop diagram for option
                            </button>
                          )}
                        </div>
                      ) : (
                        <MathText text={opt.text} hasMath={currentQuestion.has_math} className="text-sm leading-relaxed" />
                      )}
                      
                      {opt.diagram_base64 && (
                        <div className="mt-3">
                          <img
                            src={`data:${opt.diagram_mime || "image/png"};base64,${opt.diagram_base64}`}
                            alt={`Option ${opt.label}`}
                            className="max-h-32 max-w-full rounded-lg border border-slate-700 object-contain bg-white/5"
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); triggerDiagramCrop(currentQuestion.id, i); }}
                            className="text-xs text-slate-500 hover:text-slate-300 underline transition-colors mt-2 block"
                          >
                            Replace diagram
                          </button>
                        </div>
                      )}
                    </div>
                    {isSelected && <span className="ml-auto text-amber-400 text-lg">✓</span>}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-800">
              <button
                onClick={() => goTo(currentIndex - 1)}
                disabled={currentIndex === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Previous
              </button>
              <button
                onClick={() => setAnswers(prev => ({ ...prev, [currentIndex]: null }))}
                className="px-4 py-2.5 rounded-xl text-slate-500 text-sm hover:text-slate-300 transition-colors"
              >
                Clear Response
              </button>
              {currentIndex < questions.length - 1 ? (
                <button
                  onClick={() => goTo(currentIndex + 1)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 transition-colors"
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={() => handleSubmit(false)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-400 text-slate-900 font-bold hover:bg-amber-300 transition-colors"
                >
                  Submit Test ✓
                </button>
              )}
            </div>
          </div>

          <QuestionPalette questions={questions} answers={answers} currentIndex={currentIndex} onJump={goTo} />
        </div>
      </div>
    </div>
  );
}
// src/App.jsx
import React, { useState, useEffect } from "react";
import UploadZone from "./components/UploadZone";
import CBTInterface from "./components/CBTInterface";
import ResultsDashboard from "./components/ResultsDashboard";
import { preloadKatex } from "./components/MathText";
import "katex/dist/katex.min.css";

export default function App() {
  const [phase, setPhase] = useState("upload");
  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [error, setError] = useState(null);

  useEffect(() => { preloadKatex(); }, []);

  const handleUploadSuccess = (data) => {
    setQuestions(data.questions);
    setWarnings(data.warnings || []);
    setDurationMinutes(data.duration_minutes || 180);
    setError(null);
    setPhase("test");
  };

  const handleUploadError = (msg) => setError(msg);

  const handleSubmit = (resultData) => {
    setResults(resultData);
    setPhase("results");
  };

  const handleRetry = () => {
    setPhase("upload");
    setQuestions([]);
    setResults([]);
    setWarnings([]);
    setError(null);
  };

  return (
    <>
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 backdrop-blur text-white px-6 py-3 rounded-2xl text-sm font-medium shadow-xl flex items-center gap-3 max-w-md">
          <span>⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {phase === "test" && warnings.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 max-w-sm bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-xl">
          <p className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
            ⚠ PDF Parsing Warnings ({warnings.length})
          </p>
          <ul className="space-y-1 max-h-32 overflow-y-auto">
            {warnings.map((w, i) => (
              <li key={i} className="text-slate-400 text-xs">{w}</li>
            ))}
          </ul>
        </div>
      )}

      {phase === "upload" && (
        <UploadZone onUploadSuccess={handleUploadSuccess} onUploadError={handleUploadError} />
      )}

      {phase === "test" && (
        <CBTInterface
          questions={questions}
          durationMinutes={durationMinutes}
          onSubmit={handleSubmit}
        />
      )}

      {phase === "results" && (
        <ResultsDashboard results={results} onRetry={handleRetry} />
      )}
    </>
  );
}
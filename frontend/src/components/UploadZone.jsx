// src/components/UploadZone.jsx
import React, { useState, useCallback } from "react";

export default function UploadZone({ onUploadSuccess, onUploadError }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [progress, setProgress] = useState("");

  const processFile = useCallback(async (file) => {
    if (!file || file.type !== "application/pdf") {
      onUploadError("Please upload a valid PDF file.");
      return;
    }
    setFileName(file.name);
    setIsLoading(true);
    setProgress("Uploading PDF...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Upload failed");
      }

      const { task_id } = await res.json();
      setProgress("Starting AI processing...");
      
      // Polling loop
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/status/${task_id}`);
          if (!statusRes.ok) throw new Error("Status check failed");
          const statusData = await statusRes.json();
          
          if (statusData.status === "error") {
            clearInterval(pollInterval);
            throw new Error(statusData.error || "Parsing failed");
          } else if (statusData.status === "completed") {
            clearInterval(pollInterval);
            setProgress(`Found ${statusData.result.total} questions! (${statusData.result.duration_minutes} min exam)`);
            setTimeout(() => onUploadSuccess(statusData.result), 800);
          } else {
            setProgress(statusData.progress || "Processing...");
          }
        } catch (pollErr) {
          clearInterval(pollInterval);
          onUploadError(pollErr.message);
          setIsLoading(false);
          setFileName(null);
          setProgress("");
        }
      }, 3000);

    } catch (e) {
      onUploadError(e.message);
      setIsLoading(false);
      setFileName(null);
      setProgress("");
    }
  }, [onUploadSuccess, onUploadError]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    processFile(e.dataTransfer.files[0]);
  }, [processFile]);

  const handleFileInput = (e) => processFile(e.target.files[0]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/30 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span className="text-amber-400 text-xs font-mono tracking-widest uppercase">CBT Generator</span>
          </div>
          <h1 className="text-5xl font-black text-white tracking-tight mb-3">Upload Exam PDF</h1>
          <p className="text-slate-400 text-lg">Drop any question paper — we'll build an interactive test instantly.</p>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-300 cursor-pointer
            ${isDragging ? "border-amber-400 bg-amber-400/5 scale-[1.02]" : "border-slate-700 bg-slate-900 hover:border-slate-500 hover:bg-slate-800/50"}
            ${isLoading ? "pointer-events-none" : ""}`}
          onClick={() => !isLoading && document.getElementById("pdf-input").click()}
        >
          <input id="pdf-input" type="file" accept=".pdf" className="hidden" onChange={handleFileInput} />

          {isLoading ? (
            <div className="flex flex-col items-center gap-5">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 border-4 border-slate-700 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-amber-400 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl">🧠</span></div>
              </div>
              <div>
                <p className="text-white font-semibold text-lg">{fileName}</p>
                <p className="text-amber-400 text-sm mt-1 font-mono">{progress}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-4xl">📄</div>
              <div>
                <p className="text-white text-xl font-bold mb-1">{isDragging ? "Release to upload" : "Drag & drop your PDF here"}</p>
                <p className="text-slate-500 text-sm">or click to browse — max 25MB</p>
              </div>
              <div className="flex gap-2 mt-2">
                {["JEE", "NEET", "UPSC", "GRE", "Custom"].map(tag => (
                  <span key={tag} className="px-3 py-1 rounded-full text-xs bg-slate-800 text-slate-400 border border-slate-700">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[
            { icon: "⚡", label: "AI-Powered Parsing" },
            { icon: "🎯", label: "+4 / −1 Marking" },
            { icon: "📊", label: "Instant Results" },
          ].map(({ icon, label }) => (
            <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <div className="text-xl mb-1">{icon}</div>
              <div className="text-slate-400 text-xs">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
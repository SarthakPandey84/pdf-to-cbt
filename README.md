<div align="center">
# 📄 PDF-to-CBT Generator
**Drop a question paper. Get an interactive exam.**
Convert competitive exam PDFs — JEE, NEET, UPSC, GRE, and more — into fully interactive Computer-Based Tests using AI-powered parsing, OCR fallbacks, and real-time math rendering.
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Groq](https://img.shields.io/badge/Groq-LLaMA_3.3_70B-F55036?style=flat-square)](https://console.groq.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)
</div>
---
## How it works

┌──────────────┐ ┌─────────────────────────────────────┐ ┌────────────────────┐
│ Upload PDF │ ──► │ FastAPI Backend │ ──► │ React Frontend │
│ (≤ 20 MB) │ │ │ │ │
└──────────────┘ │ 1. pdfplumber — vector text │ │ • Live timer │
│ 2. Tesseract OCR — scanned pages │ │ • KaTeX math │
│ 3. Boundary-aware chunker │ │ • Question palette│
│ 4. Groq LLaMA-3.3 — JSON parser │ │ • Subject filters │
│ 5. Diagram extractor + mapper │ │ • Results + grading│
└─────────────────────────────────────┘ └────────────────────┘

---
## Features
### 🔍 PDF Engine & OCR
| Capability | Detail |
|---|---|
| Vector text extraction | `pdfplumber` reads native text layers with page-level warnings for math and images |
| Scanned PDF fallback | Pages converted to 300 DPI via `pdf2image` / Poppler, then OCR'd with `pytesseract` |
| Math detection | Flags pages containing `\frac`, `\sqrt`, `∫`, `∑`, and Greek characters |
| Max file size | 20 MB |
### 🧠 LLM Parsing Pipeline
| Capability | Detail |
|---|---|
| Boundary-aware chunker | Splits at question boundaries using `r'(?m)^(?=\s*\d{1,2}\.\s+\S)'` — no sentence fragmentation |
| Sub-chunk retry | Empty results trigger automatic bisection at the nearest question index and retry |
| Deduplication | 80-character stem hash fingerprints remove overlapping questions across chunks |
| Rate-limit handling | Parses Groq's `retry-after` header and waits the exact required duration |
| Mock fallback | Returns sample questions when no API key is set — frontend dev works without Groq |
### 🖼 Diagram Extraction
| Capability | Detail |
|---|---|
| Bounding-box extraction | Pulls `x0`, `top`, `x1`, `bottom` from PDF object tables |
| Noise filtering | Skips decorative elements smaller than 50 × 50 px |
| Heuristic page mapper | Matches question stem text to page to assign the right diagram |
| Inline embedding | Images base64-encoded as `image/png` — no file storage needed |
| Manual override | Upload a replacement diagram for any question directly in the test UI |
### ⚡ Interactive Frontend
| Capability | Detail |
|---|---|
| Three-phase flow | Upload → Test → Results orchestrated by `App.jsx` |
| Smart timer | Reads duration from PDF headers; defaults to 3 min/question, max 180 min |
| Warning states | Amber pulse below 5 min · Red critical pulse below 60 s · Auto-submit on expiry |
| KaTeX math | Lazily pre-compiles `$$...$$`, `$...$`, `\(...\)`, `\[...\]` — no SSR flicker |
| Subject filter tabs | Colour-coded tabs per subject — click to filter palette and jump to first question |
| Per-subject progress | Live `answered/total` count per subject in the palette |
| Answer key import | Upload a separate answer-key PDF or override answers manually post-submission |
### 📊 Grading

Correct answer → +4 marks
Wrong answer → −1 mark
Skipped / cleared → 0 marks

Clicking a selected option again deselects it (reverts to 0 marks).
---
## Tech Stack

Backend Python 3.11 · FastAPI · Uvicorn
LLM Groq Cloud — llama-3.3-70b-versatile
PDF Processing pdfplumber · pdf2image · pytesseract · Poppler
Frontend React 18 · Vite 5 · Tailwind CSS 3
Math Rendering KaTeX
Containers Docker · Docker Compose · Nginx

---
## Project Structure

pdf-to-cbt/
├── backend/
│ ├── main.py # FastAPI — extraction, OCR, chunking, Groq, all routes
│ ├── requirements.txt # Python dependencies
│ └── Dockerfile # Debian slim + Tesseract + Poppler
│
├── frontend/
│ ├── index.html # Root HTML with KaTeX stylesheet link
│ ├── vite.config.js # Port config + /api reverse proxy to :8000
│ ├── tailwind.config.js # Content path config
│ ├── postcss.config.js # PostCSS setup
│ ├── package.json # Dependencies and scripts
│ └── src/
│ ├── App.jsx # Phase orchestrator (upload / test / results)
│ ├── main.jsx # React entry point
│ ├── index.css # Tailwind directives + global styles
│ └── components/
│ ├── UploadZone.jsx # Drag-and-drop uploader with network states
│ ├── CBTInterface.jsx # Test viewport — questions, options, navigation
│ ├── QuestionPalette.jsx # Sidebar with subject filter tabs + status tracking
│ ├── Timer.jsx # Countdown with amber / red warning thresholds
│ ├── MathText.jsx # Lazy KaTeX renderer for inline + display math
│ └── ResultsDashboard.jsx # Score breakdown + answer key import / override
│
└── docker-compose.yml # Full-stack orchestration with env var passthrough

---
## API Reference
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload exam PDF → returns questions, warnings, duration |
| `POST` | `/api/parse-answer-key` | Upload answer-key PDF → returns `{question_id: answer_index}` |
| `PATCH` | `/api/questions/answer-key` | Apply manual answer key → validates and returns confirmed map |
| `POST` | `/api/question/{id}/image` | Upload replacement diagram for a specific question |
| `GET` | `/health` | Health check |
---
## Configuration
| Variable | Where | Description |
|---|---|---|
| `GROQ_API_KEY` | `.env` at project root | **Required.** Get a free key at [console.groq.com](https://console.groq.com) |
| `LLM_MODEL` | `backend/main.py` line 41 | Model string. Default: `llama-3.3-70b-versatile` |
| `POPPLER_PATH` | OS environment | Override Poppler binary path. Auto-detected if on `$PATH` |
| `CHUNK_SIZE` | `backend/main.py` | Max chars per LLM chunk. Default: `3500` |
| `CHUNK_OVERLAP` | `backend/main.py` | Overlap between chunks. Default: `400` |
| `MAX_TEXT` | `backend/main.py` | Total text cap sent to LLM. Default: `40000` |
---
## Setup
### Prerequisites
Create a `.env` file in the project root:
```bash
GROQ_API_KEY=gsk_your_key_here

Option A — Docker Compose ✦ Recommended
No manual dependency installation. One command builds and starts everything.

docker-compose up --build

Service	URL
React frontend	http://localhost:3000
FastAPI backend	http://localhost:8000
/api/* requests from the frontend are automatically proxied to the backend.

Option B — Manual Setup
1. Install system binaries
Both must be available on your system PATH.

<details> <summary><strong>macOS</strong></summary>
brew install tesseract poppler

</details> <details> <summary><strong>Ubuntu / Debian</strong></summary>
sudo apt install tesseract-ocr poppler-utils

</details> <details> <summary><strong>Windows</strong></summary>
Tesseract: UB Mannheim installer
Poppler: oschwartz10612/poppler-windows
Add both install directories to your system PATH.

</details>
2. Backend
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

3. Frontend
cd frontend
npm install
npm run dev

Open http://localhost:3000 in your browser.

Usage
1. Upload     Drop an exam PDF (max 20 MB) onto the upload zone.
2. Test       Answer questions using the palette sidebar.
              Click an option to select · click again to deselect.
              Use subject filter tabs to jump between sections.
3. Submit     Click Submit or let the timer auto-submit on expiry.
4. Results    Review your score, subject breakdown, and per-question detail.
              Import a separate answer-key PDF or set answers manually
              for real-time score recalculation.

Edge Cases
<details> <summary><strong>Math / LaTeX equations</strong></summary>
PDFs often bake equations into vector paths with no extractable text. The backend detects math-bearing pages and the frontend renders all delimited expressions through KaTeX instead of displaying raw strings.

</details> <details> <summary><strong>Scanned / image-only PDFs</strong></summary>
When pdfplumber returns fewer than 100 characters, the system automatically escalates to Tesseract OCR at 300 DPI. Quality varies with scan resolution and print clarity.

</details> <details> <summary><strong>Missing answer keys</strong></summary>
When no answer key is found, correct_answer_index is set to -1 for all questions. The Results Dashboard offers two recovery paths: automated extraction via /api/parse-answer-key or manual per-question override with live score recalculation.

</details> <details> <summary><strong>"Match the Following" questions</strong></summary>
The LLM prompt explicitly handles column-format questions. Both Column I and Column II are embedded in question_text as a structured block so the full table is preserved and displayed correctly.

</details> <details> <summary><strong>Diagram-only answer options</strong></summary>
When answer options are chemical structures or diagrams that OCR cannot read, the backend sets has_image: true and uses "illegible (structure/diagram)" as placeholder text, prompting the user to refer to the original paper.

</details>
Development Notes
Vite's /api proxy to :8000 means no CORS changes are needed during local development.
The CHUNK_SIZE, CHUNK_OVERLAP, and MAX_TEXT constants in backend/main.py can be tuned to balance cost, latency, and parsing accuracy.
Setting GROQ_API_KEY to an empty string activates the mock question set — useful for frontend work without consuming API quota.
Roadmap
 Subject-filter tabs in the question palette
 Local test history via browser localStorage
 Multi-correct (MSQ) question type support
 Export results as a downloadable PDF report
 Dark / light theme toggle
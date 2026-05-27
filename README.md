# 📄 PDF-to-CBT Generator

> Transform any competitive exam PDF into a fully interactive, timed Computer-Based Test — in seconds.

Built for JEE, NEET, UPSC, GRE, and any structured question paper format. Powered by **FastAPI**, **React + Vite**, **Groq LLaMA 3.3 70B**, and a custom multi-layer PDF extraction engine with OCR fallback.

![Stack](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi)
![Stack](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?style=flat-square&logo=react)
![Stack](https://img.shields.io/badge/LLM-Groq%20LLaMA%203.3%2070B-orange?style=flat-square)
![Stack](https://img.shields.io/badge/Containerized-Docker-2496ED?style=flat-square&logo=docker)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## 📸 What It Does

1. **Upload** any competitive exam PDF
2. **Automatic extraction** — text, math, diagrams, subjects, duration
3. **Interactive CBT** launches instantly with a live countdown timer
4. **Review results** with subject-wise breakdown and answer key import

---

## ✨ Feature Highlights

### 🛠 Multi-Layer PDF Extraction Engine

| Layer | Technology | Trigger |
|---|---|---|
| Primary | `pdfplumber` vector text extraction | Always attempted first |
| Fallback | `pytesseract` OCR via `pdf2image` @ 300 DPI | Low text density or scanned PDFs |

**Chunking Strategy:**
- `CHUNK_SIZE = 3500` tokens, `CHUNK_OVERLAP = 400`, `MAX_TEXT = 40,000` chars
- Boundary-aware regex sliding window prevents mid-question splits
- Failed chunks auto-bisect and retry independently
- Subject headers propagate across all chunks to maintain context

### 🖼 Diagram Extraction & Assignment
- Extracts per-image bounding boxes (`x0`, `top`, `x1`, `bottom`) from PDF object tables
- Skips decorative elements and lines under 50px
- Heuristic page-mapping engine assigns one diagram per question
- Diagrams returned as base64 — no temp file storage needed

### ⏱ Smart Duration Detection
- Scans PDF headers with regex for patterns like `3 Hours`, `180 Mins`, `Duration: 3:00`
- Falls back to `min(question_count × 3, 180)` minutes if not found
- Timer displays amber warning below 5 minutes, critical pulse below 60 seconds

### 🧮 KaTeX Math Rendering
- Handles `$$...$$`, `$...$`, `\(...\)`, `\[...\]` inline and block formats
- Lazy-loaded to prevent SSR flicker
- `whitespace-pre-wrap` for match/column-style questions

### 📊 Results & Answer Key System
- Scoring: **+4** correct / **−1** wrong / **0** skipped
- Subject-wise score breakdown
- Import answer key from a separate PDF via `/api/parse-answer-key`
- Manual A/B/C/D override grid with live score recomputation
- 🗝 indicator on questions with overridden answers

---

## 📂 Project Structure

```
pdf-to-cbt/
│
├── backend/
│   ├── main.py                  # FastAPI app — extraction, OCR, chunking, Groq integration
│   ├── requirements.txt         # Python dependencies
│   └── Dockerfile               # Python 3.11-slim + Tesseract + Poppler
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Phase orchestrator: Upload → CBT → Results
│   │   ├── main.jsx             # React entry point
│   │   ├── index.css            # Tailwind base styles
│   │   └── components/
│   │       ├── UploadZone.jsx       # Drag-and-drop upload with progress states
│   │       ├── CBTInterface.jsx     # Active test — questions, options, navigation
│   │       ├── QuestionPalette.jsx  # Subject-grouped side palette (answered/current/unattempted)
│   │       ├── Timer.jsx            # Countdown with multi-tier warning states
│   │       ├── MathText.jsx         # KaTeX inline + block math renderer
│   │       └── ResultsDashboard.jsx # Score analytics, subject breakdown, answer key panel
│   │
│   ├── index.html               # HTML root with KaTeX stylesheet
│   ├── vite.config.js           # Dev proxy: /api → localhost:8000
│   ├── tailwind.config.js       # Tailwind content paths
│   ├── postcss.config.js        # PostCSS config
│   ├── nginx.conf               # Nginx: port 3000, /api reverse proxy to backend
│   └── Dockerfile               # Multi-stage: Node build → Nginx Alpine
│
├── docker-compose.yml           # Full stack orchestration
└── .env                         # API keys and local paths (never commit this)
```

---

## ⚙️ Configuration

Create a `.env` file in the **project root**:

```env
GROQ_API_KEY=gsk_your_key_here
POPPLER_PATH=C:\Program Files\poppler\Library\bin
```

> **Linux/Docker users**: Omit `POPPLER_PATH` — Poppler is installed automatically inside the container.

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ Yes | Get free at [console.groq.com](https://console.groq.com/settings/billing) |
| `POPPLER_PATH` | ⚠️ Windows only | Path to Poppler `bin/` directory |

---

## 🚀 Getting Started

### Option A — Docker (Recommended)

The fastest way to run the full stack with zero dependency setup.

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```bash
# 1. Clone the repository
git clone https://github.com/SarthakPandey84/pdf-to-cbt.git
cd pdf-to-cbt

# 2. Create your .env file
echo GROQ_API_KEY=gsk_your_key_here > .env

# 3. Build and launch
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend (React) | http://localhost:3000 |
| Backend (FastAPI) | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

---

### Option B — Manual Local Setup

#### Step 1 — System Dependencies

Install and verify these are accessible from your terminal PATH:

**Tesseract OCR v5+**
- Windows: [UB Mannheim installer](https://github.com/UB-Mannheim/tesseract/wiki)
- Linux: `sudo apt install tesseract-ocr`
- Mac: `brew install tesseract`

**Poppler**
- Windows: [Poppler for Windows](https://github.com/oschwartz10612/poppler-windows/releases/) → extract and add `bin/` to PATH
- Linux: `sudo apt install poppler-utils`
- Mac: `brew install poppler`

Verify installation:
```bash
tesseract --version
pdftoppm -v
```

#### Step 2 — Backend

```bash
cd backend
python -m venv venv

# Activate (Windows)
venv\Scripts\activate
# Activate (Linux/Mac)
source venv/bin/activate

pip install -r requirements.txt
cd ..
python -m uvicorn backend.main:app --reload --port 8000
```

#### Step 3 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**

---

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/parse-pdf` | Upload PDF → returns parsed questions, duration, subjects |
| `POST` | `/api/parse-answer-key` | Upload answer key PDF → returns mapped answers |
| `PATCH` | `/api/questions/answer-key` | Apply answer key to current question set |

**`POST /api/parse-pdf` Response shape:**
```json
{
  "questions": [
    {
      "id": 1,
      "subject": "Physics",
      "question": "A particle moves with...",
      "options": ["A. 2 m/s", "B. 4 m/s", "C. 6 m/s", "D. 8 m/s"],
      "correct_answer": "B",
      "image": "<base64_string_or_null>"
    }
  ],
  "duration_minutes": 180,
  "total_questions": 60
}
```

---

## 🧠 Tech Stack

| Category | Technology |
|---|---|
| **LLM** | Groq `llama-3.3-70b-versatile` · `temperature=0.1` · `max_tokens=4096` |
| **Backend** | Python 3.11 · FastAPI · Uvicorn |
| **PDF Extraction** | pdfplumber · pdf2image · Pillow |
| **OCR** | Tesseract v5.5 · pytesseract · Poppler |
| **Frontend** | React 18 · Vite 5 · Tailwind CSS v3 |
| **Math Rendering** | KaTeX |
| **Containerization** | Docker · Nginx Alpine |
| **Environment** | python-dotenv |

---

## 🗺 Roadmap

- [ ] End-to-end Docker deployment test with `2018_Eng_IAT.pdf` (60 questions, 3hr timer)
- [ ] Cloud deployment — Railway / Render / Fly.io guide
- [ ] Multi-file batch upload support
- [ ] User accounts and saved test history
- [ ] Export results as PDF report
- [ ] Support for numerical answer type (NAT) questions
- [ ] Accessibility improvements (keyboard navigation, screen reader support)

---

## 🤝 Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgements

- [Groq](https://groq.com) for blazing-fast LLM inference
- [pdfplumber](https://github.com/jsvine/pdfplumber) for reliable PDF text extraction
- [KaTeX](https://katex.org) for fast client-side math rendering
- [Tailwind CSS](https://tailwindcss.com) for the UI foundation

---

<p align="center">Built with ☕ and too many PDFs.</p>
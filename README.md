```markdown
# PDF-to-CBT Generator (Full Stack)

An automated, full-stack pipeline that converts flat, competitive exam PDF question papers (such as JEE, NEET, UPSC, and GRE) into interactive Computer-Based Tests (CBT). Powered by high-accuracy Python extraction utilities, custom boundary-aware text chunking algorithms, and intelligent LLM JSON parsers.

---

## 🚀 Key System Features

### 🛠 Custom PDF Engine & Fallbacks
* **Dual-Layer Extraction**: Uses `pdfplumber` to extract native vector text layers. Detects structural warnings such as embedded math blocks and unextracted diagram coordinates dynamically.
* **Tesseract OCR Fallbacks**: If vector text density is insufficient (e.g., heavily scanned image-only PDFs), the system seamlessly pipes high-resolution page buffers (`300 DPI` via `pdf2image` and `poppler`) through `pytesseract` optical character recognition with pre-compiled alphanumeric normalization.

### 🧠 Intelligent Context Chunking & Extraction
* **Layout-Aware Token Chunking**: Implements a native regex sliding-window chunker (`split_into_question_chunks`) configured to detect standalone question bounds (`r'(?m)^(?=\s*\d{1,2}\.\s+\S)'`). Prevents sentence fragmentation and optimizes context placement for deep LLM reasoning.
* **Deterministic Sub-Chunk Retry Logic**: Automatically catches rate limits or output truncations. Under-performing JSON buffers are bisected at localized question indices and re-sent through a targeted retry loop.
* **Cross-Question Token Deduplication**: Matches extracted strings using a localized stem hash (`80-char index`) to remove duplicate or overlapping chunks before parsing back to the client.

### 🖼 Coordinate-Based Multiple Diagram Extraction
* **Spatial Intersection Bounds**: Extracts absolute rectangular bounding boxes (`x0`, `top`, `x1`, `bottom`) for individual geometric assets or formulas directly from PDF object tables. Ignores cosmetic lines or decorative elements smaller than 50px.
* **Heuristic Page-Mapping Engine**: Dynamically calculates structural matches between parsed text tokens and image locations. Couples detached base64 diagram strings back to their corresponding interactive questions.

### ⏱ Advanced Interactive Frontend Runtime
* **Smart Exam Detection**: Automatically scans exam headings for temporal indicators (e.g., `3 Hours`, `Duration: 180 Mins`) using regular expressions, dynamically defaulting to a localized allocation format (`3 minutes per question`) if missing.
* **Visual Warning States**: Employs an exact countdown component featuring custom ticking hooks and multi-tier alerting milestones (amber animations below 5 mins, critical pulsing below 60 seconds) with automated auto-submit containment.
* **Isolated KaTeX Component**: Implements a lazy-loaded KaTeX parsing architecture that avoids SSR flickering. Pre-compiles inline math block fragments (`$$...$$`, `$..$`, `\(..\)`, `\[..\]`) to string variables for ultra-fluid viewport painting.

---

## 📂 System Architecture

```text
pdf-to-cbt/
├── backend/
│   ├── main.py              # FastAPI app, PDF/OCR extraction engine, & Groq client integration
│   ├── Dockerfile           # Debian slim build containing Tesseract-OCR binary layers & Poppler utils
│   └── requirements.txt     # Python dependencies (FastAPI, Groq, pdfplumber, pytesseract, etc.)
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Phase orchestrator (Upload → Test View → Analytical Dashboard)
│   │   ├── main.jsx         # UI initialization mount point
│   │   ├── index.css        # Core style layer with Tailwind directives & vector font sizing
│   │   └── components/
│   │       ├── UploadZone.jsx       # Drag-and-drop landing page with network processing states
│   │       ├── CBTInterface.jsx     # Active assessment viewport containing option controls
│   │       ├── QuestionPalette.jsx  # Side navigation component tracking state distributions
│   │       ├── Timer.jsx            # Countdown module featuring state warning thresholds
│   │       ├── MathText.jsx         # Custom pre-loading abstract math rendering engine (KaTeX)
│   │       └── ResultsDashboard.jsx # Analytics view with custom answer key override flows
│   ├── package.json         # Build definitions and node modules manifests
│   ├── vite.config.js       # Bundler setup specifying reverse API loop configuration
│   ├── tailwind.config.js   # Style compiler path targeting criteria
│   ├── postcss.config.js    # Style processing configuration
│   ├── index.html           # Document root script injector containing KaTeX style sheets
│   └── Dockerfile           # Optimized multi-stage build running Node compilation inside Nginx Alpine
└── docker-compose.yml       # Production-ready stack manager exposing cross-container environment variables

```

---

## ⚙️ Core Configuration Variables

The system relies on specific environment parameters for its data parsing and schema normalization layers:

| Key Name | Location | Format / Values | Operational Scope |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | `.env` (Root) | `gsk_...` | Authorizes LLM calls to Groq Cloud endpoint. |
| `LLM_MODEL` | `backend/main.py` | `llama-3.3-70b-versatile` | Orchestrates strict JSON schema code generation. |
| `POPPLER_PATH` | Container / OS | `/usr/bin` (or custom path) | Converts binary vector paths into high-density raster files. |
| `CORS Allow Origin` | `backend/main.py` | `http://localhost:3000` | Secures cross-origin requests from the client. |

---

## 🚀 Step-by-Step Installation

Ensure you have your environment credentials set up beforehand. Create a `.env` file in your root folder:

```bash
GROQ_API_KEY=your_actual_groq_api_key_here

```

### Method A: Docker Compose (Recommended Production Setup)

Run the entire architecture locally inside optimized isolated system containers with a single command:

```bash
docker-compose up --build

```

* The React client will spin up at `http://localhost:3000`
* The FastAPI server will map to `http://localhost:8000`
* Reverse proxies route internal paths (`/api/*`) flawlessly between endpoints.

---

### Method B: Manual Native Development Setup

#### 1. System Prerequisites (Mandatory)

Because this application relies on low-level binary compilers to perform advanced image text parsing, you must install these utilities to your native system environment variables path:

* **Tesseract OCR Engine**: Install the core package and make sure `tesseract` is accessible via your terminal.
* **Poppler Utilities**: Required for PDF page conversion. Verify that binary commands like `pdftoppm` are fully recognized by your terminal path variables.

#### 2. Backend Setup

```cmd
cd backend
python -m venv venv
call venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

```

#### 3. Frontend Setup

```cmd
cd frontend
npm install
npm run dev

```

Open `http://localhost:3000` in your web browser.

---

## 📊 Evaluation Mechanics

### Marking Grid Matrix

The grading metrics follow strict standard formats utilized across advanced scientific entrance examinations:

* **Correct Submission**: `+4 Marks`
* **Incorrect Submission**: `-1 Negative Mark`
* **Skipped/Cleared Field**: `0 Marks`

### Advanced Post-Exam Answer Key Flow

By default, if an exam document does not containerize explicit metadata mapping solutions, the backend extracts schemas using an index of `-1` (marked as *Unknown Evaluation Structure*). To resolve this gracefully, the platform provides a dual-interface processing panel inside the results view:

1. **Automated End-Block OCR Scanning**: Click **"Import Answer Key"** to pass the same or an external document tracking sheet into an isolated endpoint (`/api/parse-answer-key`). This uses a specialized prompt pattern (`ANSWER_KEY_PROMPT`) to automatically isolate matrix structures matching standard keys (e.g., `1-A, 2-B` tables).
2. **Dynamic Manual Overrides**: Provides interactive viewport blocks directly inside the app to manually configure answer parameters, forcing real-time client score recalculations across all completed fields.

```

```
```markdown
# CBT Generator — Full Stack

PDF upload → AI parsing → Interactive computer-based test → Graded results.

## Project Structure


```

cbt-app/
├── backend/
│   ├── main.py           # FastAPI — PDF extraction + LLM parsing
│   └── requirements.txt  # Python package dependencies
└── frontend/
├── src/
│   ├── App.jsx                      # Phase orchestrator (upload/test/results)
│   ├── components/
│   │   ├── UploadZone.jsx           # Drag-and-drop PDF uploader
│   │   ├── CBTInterface.jsx         # Question view, nav, timer
│   │   ├── QuestionPalette.jsx      # Jump-to-question sidebar
│   │   ├── Timer.jsx                # Countdown with warning states
│   │   └── ResultsDashboard.jsx     # Grading + breakdown
│   ├── main.jsx                     # Application root entry point
│   └── index.css                    # Tailwind layout injections & scrollbar configurations
├── package.json                     # Node script runner & framework package metrics
├── vite.config.js                   # Development bundle compilation & reverse /api proxy map
├── tailwind.config.js               # Utility CSS build boundaries mapping
└── index.html                       # Base template HTML core incorporating static web metrics

```

---

## Setup

### Native Setup (Manual Configuration)

#### System Prerequisites
Because this application relies on compiled image extraction systems to handle document reading, you must install these binaries directly into your operating system environment variables:
* **Tesseract OCR Engine**: Required for text parsing when encountering locked or vector-free imagery.
* **Poppler Utilities**: Core dependency required to translate high-resolution binary images into multi-tier layout sheets.

#### Backend
```cmd
cd backend
python -m venv venv
call venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

```

#### Frontend

```cmd
cd frontend
npm install
npm run dev
# Open http://localhost:3000

```

---

### Docker Compose Container Setup (Recommended Setup)

Alternatively, spin up the entire multi-container architecture inside system layers without configuring local dependencies using the provided single-line build script:

```bash
docker-compose up --build

```

* **Frontend Web Access**: `http://localhost:3000`
* **FastAPI Server Instance**: `http://localhost:8000`

---

## LLM API Key Configuration

The application implements a `.env` environment variables loader mapping directly at your project structure root folder layer:

```bash
GROQ_API_KEY=gsk_your_actual_groq_api_credential_token

```

Inside `backend/main.py`, the system coordinates queries via standard server environment structures:

```python
LLM_API_KEY  = os.environ.get("GROQ_API_KEY", "")
LLM_MODEL    = "llama-3.3-70b-versatile"

```

* **Production Engine**: Uses a strict system prompt instruction map forcing specialized Groq structural schemas out of `Llama 3.3 70B`.
* **Local Hardcoded Sandbox**: If no key is declared inside the local execution environment, the application acts on standard safe fallback structures containing native multi-subject evaluation models.

---

## Grading Scheme

The scoring layout strictly evaluates user selections relative to normalized integers sent by the layout parsing system:

| Status | Marks | Definition / Behavior |
| --- | --- | --- |
| **Correct** | `+4` | Answer matches the target index array precisely. |
| **Wrong** | `-1` | Selected response entry does not match the valid option block. |
| **Skipped** | `0` | Field was explicitly left un-submitted or deselected by user actions. |

* Clicking an active selected item a second time automatically deselects that index choice, reverting its score status safely back to `Skipped`.

---

## Timer

The session timer calculates precise exam tracking windows depending directly on specific parameter keys passed over during the initial generation request:

```js
// Configured inside backend/main.py via the structural duration check
duration_minutes = detect_duration_minutes(raw_text, len(questions))

```

* **Regex Header Parsing**: The backend scans document metadata looking for duration syntax matching values like `3 Hours`, `Duration: 180 Minutes` or explicit temporal headers.
* **Fallback Matrix Strategy**: If missing, the engine allocates an analytical default pace matching competitive exams (`3 minutes per extracted question`, up to a maximum limit cap of `180 minutes`).
* **Client Handling**: The frontend automatically enforces an absolute submission trigger if time-remaining states resolve completely down to `0` seconds.

---

## Edge Cases & Architectural Infrastructure

### 1. Math / LaTeX Equation Parsing

* **Core Problem**: Equations embedded inside highly optimized entrance sheets are rendered to mathematical paths or vector imagery blocks, resulting in empty string properties when parsing plain characters.
* **System Resolution**: The backend flags potential layout disruptions via regex verification models checking for symbols (`\\frac`, `\\sqrt`, `∫`, `∑`). It passes targets to `pytesseract` over high-resolution pixel grids.
* **Viewport Injection Handling**: Instead of simple textual paragraphs, the frontend implements native lazy-loaded string segment extractors. These structures extract delimiter segments (`$$...$$`, `$..$`, `\(..\)`, `\[..\]`) and translate strings directly into full vector font blocks via the integrated application style sheets.

### 2. Layout Coordinate Diagram Harvesting

* **Core Problem**: Core figures, structural tables, charts, or diagrams inside test sheets carry no text-layer strings and get separated from their original problem descriptions.
* **System Resolution**: The engine pulls relative physical space bounding parameters (`x0`, `top`, `x1`, `bottom`) for spatial layout components explicitly from PDF metrics structures. It runs image extraction maps and translates target graphics directly into inline storage configurations using safe base64 serialization layouts.
* **Context Preservation**: Text blocks undergo contextual layout page checks to automatically attach extracted visual elements back to their respective user-viewable question containers.

### 3. Missing Solution Keys

* **Core Problem**: If source exam pages exclude direct answers or contain split evaluation sheets, correct keys return indexes pointing to an unknown state (`-1`).
* **System Resolution**: The framework embeds a post-test solution panel directly within the analytical feedback display. This feature supports automatic text mining using an isolated end-block processing route (`/api/parse-answer-key`), alongside granular interactive controls allowing manual configuration overrides that recalculate scores on-the-fly.

---

## Complete Customization Checklist

* [x] Integrate safe parsing layers capturing math definitions via full inline KaTeX components.
* [x] Configure adaptive dual-layer image parsing utilities tracking scanned layouts via Tesseract OCR structures.
* [x] Connect sequential boundary-aware logic blocks to securely isolate user configuration credentials from public storage systems.
* [ ] Add explicit category filtering options inside the tracking palette dashboard UI for sub-section navigation.
* [ ] Build local user history preservation tools leveraging standard localized client storage mechanisms.

```

```
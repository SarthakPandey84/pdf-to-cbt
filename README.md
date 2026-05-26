# CBT Generator — Full Stack

PDF upload → AI parsing → Interactive computer-based test → Graded results.

## Project Structure

```
cbt-app/
├── backend/
│   ├── main.py           # FastAPI — PDF extraction + LLM parsing
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx                      # Phase orchestrator (upload/test/results)
    │   ├── components/
    │   │   ├── UploadZone.jsx           # Drag-and-drop PDF uploader
    │   │   ├── CBTInterface.jsx         # Question view, nav, timer
    │   │   ├── QuestionPalette.jsx      # Jump-to-question sidebar
    │   │   ├── Timer.jsx                # Countdown with warning states
    │   │   └── ResultsDashboard.jsx     # Grading + breakdown
    │   ├── main.jsx
    │   └── index.css
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── index.html
```

---

## Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
# Add your API key to main.py: LLM_API_KEY = "sk-..."
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

---

## LLM API Key Configuration

In `backend/main.py`, set:
```python
LLM_API_KEY = "YOUR_KEY_HERE"
LLM_MODEL   = "claude-sonnet-4-20250514"   # Anthropic
LLM_URL     = "https://api.anthropic.com/v1/messages"
```

**To switch to OpenAI:**
1. Change `LLM_URL` to `https://api.openai.com/v1/chat/completions`
2. Uncomment the OpenAI block in `call_llm_api()`
3. Comment out the Anthropic block
4. Set `LLM_MODEL = "gpt-4o"`

Without an API key, the app uses 4 hardcoded demo questions for local testing.

---

## Grading Scheme

| Status  | Marks |
|---------|-------|
| Correct | +4    |
| Wrong   | −1    |
| Skipped | 0     |

Toggling the same option deselects it (treated as skipped).

---

## Timer

Default: `questions.length × 72 seconds` (mimics JEE/NEET 3hr/90Q pace).
Change in `CBTInterface.jsx`:
```js
const [timeLeft, setTimeLeft] = useState(questions.length * 72);
```
Auto-submits on expiry.

---

## Edge Cases

### Math / LaTeX Equations

**Problem:** PDFs with MathType/rendered equations embed math as images, not text.
pdfplumber extracts surrounding text but math images become blank regions.

**Production Strategy:**
1. `pdfplumber` detects `page.images` — flag those pages.
2. Run `pytesseract` OCR on flagged pages: `page.to_image(resolution=300).original` → `pytesseract.image_to_string()`.
3. OCR often captures Greek letters (α, β, ∑) and common operators.
4. In the LLM prompt, include: *"Treat mathematical expressions as LaTeX. Preserve them using \\frac{}{}, \\sqrt{}, \\sum, etc."*
5. In the frontend, replace `<p>{question_text}</p>` with a KaTeX renderer:
   ```bash
   npm install katex react-katex
   ```
   ```jsx
   import { InlineMath, BlockMath } from 'react-katex';
   import 'katex/dist/katex.min.css';
   // Then: <InlineMath math={question.question_text} />
   ```
6. The `has_math: true` flag on each question is already set by the backend — use it to conditionally render KaTeX vs plain text.

### Diagrams / Embedded Images

**Problem:** Diagrams (circuit diagrams, graphs, anatomical figures) are raster images inside the PDF. They carry no extractable text.

**Production Strategy:**
1. `pdfplumber` exposes `page.images` with bounding boxes (`x0, y0, x1, y1`).
2. Crop and extract:
   ```python
   img = page.to_image(resolution=150)
   cropped = img.original.crop((x0, y0, x1, y1))
   # Convert to base64:
   buf = BytesIO(); cropped.save(buf, format="PNG")
   b64 = base64.b64encode(buf.getvalue()).decode()
   ```
3. Pass base64 image to a **vision-capable LLM** (Claude claude-sonnet-4-20250514, GPT-4o) with:
   *"This image is embedded in a question. Describe it briefly for the question context, or label it [FIGURE: description]."*
4. The `has_image: true` flag tells the frontend to render an `[IMAGE]` placeholder or an actual `<img>` tag if the backend returns a base64 URI.
5. For fully image-scanned PDFs (no text layer), run full-page OCR with `pytesseract` and then parse.

### Scanned / Image-only PDFs

pdfplumber will return empty text. The `/api/upload` endpoint raises HTTP 422 in this case.
**Fix:** Install `pytesseract` + `Pillow` and add:
```python
from PIL import Image
import pytesseract

for page in pdf.pages:
    if not page.extract_text():
        img = page.to_image(resolution=300).original
        text = pytesseract.image_to_string(img)
        full_text.append(text)
```

### Answer Key Absent

If the PDF has no answer key, the LLM sets `correct_answer_index: -1`.
The results dashboard still shows the question breakdown — marks will be 0 for all (no scoring possible).
You can add a post-test "enter answer key" flow to handle this.

---

## Customization Checklist

- [ ] Add KaTeX rendering for math questions
- [ ] Add pytesseract for scanned PDFs  
- [ ] Set actual LLM API key
- [ ] Adjust timer duration per exam type
- [ ] Add section-wise time limits (JEE pattern)
- [ ] Persist results to localStorage for review later
- [ ] Add "Mark for Review" status in palette (yellow)

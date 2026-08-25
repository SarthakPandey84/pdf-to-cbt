"""
CBT Generator Backend - FastAPI
"""

import json
import re
import os
import time
import base64
import tempfile
from groq import Groq
import pdfplumber
from io import BytesIO
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import pytesseract
from pdf2image import convert_from_path
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from concurrent.futures import ThreadPoolExecutor


load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv()  # also try cwd

app = FastAPI(title="CBT Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://pdf-to-cbt-frontend.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────

LLM_API_KEY  = os.environ.get("GROQ_API_KEY", "")
LLM_MODEL    = "llama-3.3-70b-versatile"

_poppler_env = os.environ.get("POPPLER_PATH", "").strip()
POPPLER_PATH = _poppler_env if _poppler_env else None

CHUNK_SIZE    = 3500   # reduced so chunks fit LLM context better
CHUNK_OVERLAP = 400
MAX_TEXT      = 100000
RETRY_WAIT    = 65
MAX_RETRIES   = 3

# ─────────────────────────────────────────────
# MODELS
# ─────────────────────────────────────────────

class Option(BaseModel):
    label: str
    text: str

class Question(BaseModel):
    id: int
    subject: Optional[str] = "General"
    question_text: str
    options: List[Option]
    correct_answer_index: int
    has_math: bool = False
    has_image: bool = False
    diagram_base64: Optional[str] = None
    diagram_mime: Optional[str] = None

class ParseResponse(BaseModel):
    questions: List[Question]
    total: int
    warnings: List[str]
    duration_minutes: int  # NEW: exam duration hint for frontend timer


# ─────────────────────────────────────────────
# PDF EXTRACTION (with OCR fallback)
# ─────────────────────────────────────────────

def extract_text_from_pdf(file_bytes: bytes) -> tuple[str, List[str]]:
    warnings = []
    full_text = []

    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            if page.images:
                warnings.append(
                    f"Page {i+1} contains {len(page.images)} embedded image(s). "
                    "Diagram content is NOT extracted as text."
                )
            if re.search(r"\\frac|\\sqrt|\\sum|∫|∑|√|α|β|θ|λ|μ|σ", text):
                warnings.append(f"Page {i+1} may contain math symbols. KaTeX rendering recommended.")
            full_text.append(text)

    combined = "\n\n--- PAGE BREAK ---\n\n".join(full_text)
    real_text = re.sub(r"--- PAGE BREAK ---", "", combined).strip()

    if len(real_text) < 100:
        print("Text extraction insufficient — falling back to OCR...")
        warnings.append("Scanned PDF detected. Using OCR (accuracy may vary).")
        ocr_pages = []

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        try:
            images = convert_from_path(tmp_path, dpi=300, poppler_path=POPPLER_PATH)
            
            def process_image(i_img):
                i, img = i_img
                page_text = pytesseract.image_to_string(img)
                page_text = re.sub(r'\[p?([ABCDabcd])\]', r'(\1)', page_text)
                page_text = re.sub(r'\[([ABCDabcd])\)', r'(\1)', page_text)
                print(f"OCR Page {i+1} length: {len(page_text)}")
                return i, f"--- Page {i+1} ---\n{page_text}"

            with ThreadPoolExecutor() as executor:
                results = list(executor.map(process_image, enumerate(images)))
            
            results.sort(key=lambda x: x[0])
            ocr_pages = [text for _, text in results]
            
            combined = "\n\n".join(ocr_pages)
        finally:
            os.unlink(tmp_path)

    print(f"TOTAL EXTRACTED TEXT LENGTH: {len(combined)}")
    print(f"FIRST 500 CHARS:\n{combined[:500]}")
    return combined, warnings


# ─────────────────────────────────────────────
# IMAGE EXTRACTION — per image, not per page union bbox
# ─────────────────────────────────────────────

def extract_images_from_pdf(file_bytes: bytes) -> dict[int, list[tuple[str, str]]]:
    """
    Returns {page_number: [(base64, mime), ...]} — multiple images per page supported.
    """
    page_images: dict[int, list[tuple[str, str]]] = {}

    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        for i, page in enumerate(pdf.pages):
            if not page.images:
                continue

            page_imgs = []
            for img_meta in page.images:
                try:
                    x0  = max(0, img_meta["x0"] - 2)
                    top = max(0, img_meta["top"] - 2)
                    x1  = min(page.width,  img_meta["x1"] + 2)
                    bot = min(page.height, img_meta["bottom"] + 2)

                    # Skip tiny images (decorations, borders < 50px)
                    if (x1 - x0) < 50 or (bot - top) < 50:
                        continue

                    cropped = page.within_bbox((x0, top, x1, bot)).to_image(resolution=150)
                    buf = BytesIO()
                    cropped.save(buf, format="PNG")
                    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
                    page_imgs.append((b64, "image/png"))
                    print(f"  Extracted image {len(page_imgs)} from page {i+1} bbox=({x0:.0f},{top:.0f},{x1:.0f},{bot:.0f})")
                except Exception as e:
                    print(f"  Image extract failed page {i+1}: {e}")

            if page_imgs:
                page_images[i + 1] = page_imgs

    return page_images


def map_images_to_questions(
    questions: list[dict],
    page_images: dict[int, list[tuple[str, str]]],
    raw_text: str
) -> list[dict]:
    """Map each image-bearing question to the best individual image."""
    page_texts: dict[int, str] = {}
    segments = raw_text.split("--- Page ")
    for seg in segments:
        m = re.match(r"(\d+) ---\n(.*)", seg, re.DOTALL)
        if m:
            page_texts[int(m.group(1))] = m.group(2).lower()

    if not page_texts:
        parts = raw_text.split("--- PAGE BREAK ---")
        for idx, part in enumerate(parts):
            page_texts[idx + 1] = part.lower()

    # Build flat list: [(page_num, img_idx, b64, mime), ...]
    all_images = []
    for pnum, imgs in sorted(page_images.items()):
        for img_idx, (b64, mime) in enumerate(imgs):
            all_images.append((pnum, img_idx, b64, mime))

    # Track which images have been assigned
    assigned: set[tuple[int,int]] = set()

    for q in questions:
        if not q.get("has_image"):
            continue

        stem = q.get("question_text", "")[:50].lower().strip()
        best_page = None

        # Find which page contains this question's text
        for pnum, ptext in page_texts.items():
            if stem and stem[:20] in ptext:
                best_page = pnum
                break

        # Pick first unassigned image on best_page
        matched = None
        if best_page is not None:
            for pnum, img_idx, b64, mime in all_images:
                if pnum == best_page and (pnum, img_idx) not in assigned:
                    matched = (pnum, img_idx, b64, mime)
                    break

        # Fallback: nearest page with unassigned image
        if matched is None:
            ref_page = best_page or 1
            candidates = [(pnum, img_idx, b64, mime) for pnum, img_idx, b64, mime in all_images
                          if (pnum, img_idx) not in assigned]
            if candidates:
                matched = min(candidates, key=lambda x: abs(x[0] - ref_page))

        if matched:
            pnum, img_idx, b64, mime = matched
            assigned.add((pnum, img_idx))
            q["diagram_base64"] = b64
            q["diagram_mime"]   = mime
            print(f"  Q{q.get('id')} → page {pnum} image {img_idx}")

    return questions


# ─────────────────────────────────────────────
# SMART CHUNKER
# ─────────────────────────────────────────────

def split_into_question_chunks(text: str) -> list[str]:
    """Split at question number boundaries. Fallback to overlap chunking."""
    boundary_pattern = re.compile(r'(?m)^(?=\s*\d{1,2}\.\s+\S)')
    positions = [m.start() for m in boundary_pattern.finditer(text)]

    if len(positions) < 3:
        print("  No question boundaries detected — using overlap chunking")
        chunks = []
        i = 0
        while i < len(text):
            chunks.append(text[i:i + CHUNK_SIZE])
            i += CHUNK_SIZE - CHUNK_OVERLAP
        return chunks

    print(f"  Found {len(positions)} question boundaries")
    chunks = []
    chunk_start_idx = 0

    while chunk_start_idx < len(positions):
        start = positions[chunk_start_idx]
        last_valid_idx = chunk_start_idx
        end = len(text)

        for j in range(chunk_start_idx + 1, len(positions)):
            if positions[j] - start > CHUNK_SIZE:
                break
            last_valid_idx = j
            end = positions[j]

        overlap_idx = max(0, chunk_start_idx - 1)
        chunk_start = positions[overlap_idx]
        chunks.append(text[chunk_start:end if last_valid_idx > chunk_start_idx else len(text)])

        if last_valid_idx == chunk_start_idx:
            chunk_start_idx += 1
        else:
            chunk_start_idx = last_valid_idx

    if positions:
        tail = text[positions[-2] if len(positions) > 1 else positions[-1]:]
        if tail and (not chunks or tail not in chunks[-1]):
            chunks.append(tail)

    print(f"  Split into {len(chunks)} boundary-aware chunks")
    return chunks


# ─────────────────────────────────────────────
# PROMPTS
# ─────────────────────────────────────────────

SYSTEM_PROMPT = """You are a strict JSON API. Output ONLY a valid JSON array. No markdown, no backticks, no explanation.

Parse ALL multiple-choice questions from the OCR text. Do NOT skip any question even if partially damaged by OCR.

CRITICAL RULES:
1. Subject: Use section headers (BIOLOGY, CHEMISTRY, MATHEMATICS, PHYSICS). Once a header is seen, ALL subsequent questions belong to that subject until the next header. Do NOT default to "General".
2. Option labels may appear as (A)/(B)/(C)/(D), A), B), A., or inline — normalize to A/B/C/D.
3. Question stem always comes BEFORE options; never include it as an option.
4. Question numbers like "1.", "2." — exclude the number from question_text.
5. For "Match the Following" questions: include the FULL table content (Column I and Column II entries) in question_text. Format as: "<stem>\n\nColumn I: a.<x>, b.<y>, c.<z>, d.<w>\nColumn II: 1.<x>, 2.<y>, 3.<z>, 4.<w>".
6. For structure/diagram-based questions where options contain chemical structures or images that OCR cannot read: set has_image=true and use "illegible (structure/diagram)" as option text.
7. correct_answer_index: set to -1 if unknown. Do NOT guess.
8. has_math: true if question or options contain equations, formulas, superscripts, or scientific notation.
9. has_image: true if question references a figure, diagram, graph, or image, OR if any option contains a structure/formula that OCR cannot represent.

JSON schema per question:
{"id":<int>,"subject":"<Biology|Chemistry|Mathematics|Physics|General>","question_text":"<full stem including table data for match questions>","options":[{"label":"A","text":"<text>"},{"label":"B","text":"<text>"},{"label":"C","text":"<text>"},{"label":"D","text":"<text>"}],"correct_answer_index":<0-based int or -1>,"has_math":<bool>,"has_image":<bool>}

Return [] only if truly nothing parseable. Include questions with 3 options if 4th is unreadable — use "illegible" as text."""

ANSWER_KEY_PROMPT = """You are a strict JSON API. Output ONLY a valid JSON object. No markdown, no backticks, no explanation.

Extract the answer key from this exam text. Answer keys appear as:
- "1. A  2. B  3. C" or "1-A, 2-B" or tables with Q/Answer columns
- Section headers like "ANSWERS", "ANSWER KEY", "SOLUTIONS"

Return ONLY this format:
{"answers": {"1": 0, "2": 1, "3": 2}}

Where values are 0-based indices: A=0, B=1, C=2, D=3.
If no answer key found, return {"answers": {}}."""


# ─────────────────────────────────────────────
# JSON SAFETY PARSER
# ─────────────────────────────────────────────

def safe_parse_json(raw: str) -> list:
    raw = re.sub(r"```json|```", "", raw).strip()
    try:
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if match:
            return json.loads(match.group())
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    objects = []
    for match in re.finditer(r'\{[^{}]*"question_text"[^{}]*\}', raw, re.DOTALL):
        try:
            objects.append(json.loads(match.group()))
        except json.JSONDecodeError:
            continue

    if objects:
        print(f"Salvaged {len(objects)} questions from truncated JSON")
        return objects

    raise json.JSONDecodeError("Could not parse any questions", raw, 0)


# ─────────────────────────────────────────────
# GROQ CALL WITH RETRY
# ─────────────────────────────────────────────

def call_groq_with_retry(client: Groq, messages: list) -> str:
    for attempt in range(MAX_RETRIES):
        try:
            response = client.chat.completions.create(
                model=LLM_MODEL,
                messages=messages,
                temperature=0.1,
                max_tokens=4096,
            )
            return response.choices[0].message.content
        except Exception as e:
            err = str(e)
            if "rate_limit_exceeded" in err and attempt < MAX_RETRIES - 1:
                wait_match = re.search(r"try again in (?:(\d+)m)?([\d.]+)s", err)
                wait = (int(wait_match.group(1) or 0) * 60 + float(wait_match.group(2)) + 5) if wait_match else RETRY_WAIT
                print(f"  Rate limit hit. Waiting {wait:.0f}s (attempt {attempt+1}/{MAX_RETRIES})...")
                time.sleep(wait)
            else:
                raise


# ─────────────────────────────────────────────
# DETECT EXAM DURATION FROM TEXT
# ─────────────────────────────────────────────

def detect_duration_minutes(text: str, question_count: int) -> int:
    """Try to read duration from exam header. Fallback: 3 min/question."""
    patterns = [
        r'(\d+)\s*hours?\s*(\d*)\s*minutes?',
        r'time\s*:\s*(\d+)\s*hours?\s*(\d*)',
        r'duration\s*:\s*(\d+)\s*h(?:r|our)?s?\s*(\d*)',
        r'(\d+)\s*hrs?\b',
    ]
    first_500 = text[:1000].lower()
    for pat in patterns:
        m = re.search(pat, first_500)
        if m:
            hrs = int(m.group(1))
            mins = int(m.group(2)) if m.lastindex >= 2 and m.group(2) else 0
            total = hrs * 60 + mins
            if total > 0:
                print(f"  Detected exam duration: {total} minutes")
                return total
    # Fallback: standard competitive exam — 3 min per question, max 180
    fallback = min(question_count * 3, 180)
    print(f"  Duration not found in text. Using fallback: {fallback} min")
    return fallback


# ─────────────────────────────────────────────
# LLM CALL — SMART CHUNKED + DEDUP + RETRY ON EMPTY
# ─────────────────────────────────────────────

def call_llm_api(raw_text: str) -> list[dict]:
    if not LLM_API_KEY:
        print("No GROQ_API_KEY set — returning mock questions")
        return _mock_questions()

    client = Groq(api_key=LLM_API_KEY)
    text = raw_text[:MAX_TEXT]

    chunks = split_into_question_chunks(text)
    print(f"Total chunks to process: {len(chunks)}")
    all_questions = []

    def process_and_retry(idx_chunk):
        idx, chunk = idx_chunk
        print(f"Processing chunk {idx+1}/{len(chunks)} (len={len(chunk)})...")
        questions = _process_chunk(client, chunk, idx + 1, len(chunks))

        # If chunk failed AND is large, split it in half and retry
        if not questions and len(chunk) > 1500:
            print(f"  Chunk {idx+1} failed — splitting in half and retrying...")
            mid = len(chunk) // 2
            # Find nearest question boundary
            boundary = re.search(r'\n\s*\d{1,2}\.\s+', chunk[mid:])
            split_at = mid + boundary.start() if boundary else mid
            for sub_idx, sub in enumerate([chunk[:split_at], chunk[split_at:]]):
                if sub.strip():
                    sub_qs = _process_chunk(client, sub, f"{idx+1}.{sub_idx+1}", "sub")
                    questions.extend(sub_qs)
        return idx, questions

    with ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(process_and_retry, enumerate(chunks)))
    
    results.sort(key=lambda x: x[0])
    for _, qs in results:
        all_questions.extend(qs)

    # Dedup by 80-char stem
    seen = set()
    unique = []
    for q in all_questions:
        key = q.get("question_text", "")[:80].strip().lower()
        if key and key not in seen:
            seen.add(key)
            unique.append(q)

    # Re-number sequentially
    for i, q in enumerate(unique):
        q["id"] = i + 1

    print(f"Final: {len(unique)} unique questions after dedup")
    return unique


def _process_chunk(client: Groq, chunk: str, label, total) -> list[dict]:
    try:
        raw_json = call_groq_with_retry(client, [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": f"Parse these exam questions:\n\n{chunk}"},
        ])
        print(f"  Chunk {label}/{total} response preview:", raw_json[:150])
        questions = safe_parse_json(raw_json)
        print(f"  Chunk {label}/{total} parsed {len(questions)} questions")
        return questions
    except Exception as e:
        print(f"  Chunk {label}/{total} failed: {e}")
        return []


# ─────────────────────────────────────────────
# MOCK FALLBACK
# ─────────────────────────────────────────────

def _mock_questions() -> list[dict]:
    return [
        {
            "id": 1, "subject": "Physics",
            "question_text": "A body is thrown vertically upward with velocity u. The ratio of kinetic energy to potential energy at height h = u²/4g is:",
            "options": [
                {"label": "A", "text": "1:3"}, {"label": "B", "text": "3:1"},
                {"label": "C", "text": "1:1"}, {"label": "D", "text": "2:1"}
            ],
            "correct_answer_index": 1, "has_math": True, "has_image": False
        },
        {
            "id": 2, "subject": "Chemistry",
            "question_text": "Which of the following has the highest ionic character?",
            "options": [
                {"label": "A", "text": "HF"}, {"label": "B", "text": "HCl"},
                {"label": "C", "text": "HBr"}, {"label": "D", "text": "HI"}
            ],
            "correct_answer_index": 0, "has_math": False, "has_image": False
        },
    ]


# ─────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────

@app.post("/api/upload", response_model=ParseResponse)
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files accepted.")

    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Max 20MB.")

    raw_text, warnings = extract_text_from_pdf(contents)

    clean_check = re.sub(r"--- PAGE BREAK ---", "", raw_text).strip()
    if not clean_check:
        raise HTTPException(status_code=422, detail="Could not extract any text from PDF (even with OCR).")

    page_images = extract_images_from_pdf(contents)
    print(f"Extracted image sets from {len(page_images)} page(s)")

    if len(raw_text) > MAX_TEXT:
        warnings.append(f"PDF too large. Only the first {MAX_TEXT} characters were processed.")

    try:
        raw_questions = call_llm_api(raw_text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="LLM returned invalid JSON. Try again.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM API error: {str(e)}")

    if not raw_questions:
        raise HTTPException(status_code=422, detail="No questions could be parsed from the PDF.")

    raw_questions = map_images_to_questions(raw_questions, page_images, raw_text)

    questions = []
    for q in raw_questions:
        try:
            questions.append(Question(**q))
        except Exception:
            warnings.append(f"Skipped malformed question id={q.get('id', '?')}")

    duration_minutes = detect_duration_minutes(raw_text, len(questions))

    return ParseResponse(
        questions=questions,
        total=len(questions),
        warnings=warnings,
        duration_minutes=duration_minutes,
    )


@app.post("/api/question/{question_id}/image")
async def upload_question_image(question_id: int, file: UploadFile = File(...)):
    allowed = {"image/png", "image/jpeg", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="PNG/JPEG/WEBP only.")
    if file.size and file.size > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image too large. Max 5MB.")
    data = await file.read()
    b64 = base64.b64encode(data).decode("utf-8")
    return {"question_id": question_id, "diagram_base64": b64, "diagram_mime": file.content_type}


@app.post("/api/parse-answer-key")
async def parse_answer_key(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files accepted.")

    contents = await file.read()
    raw_text, _ = extract_text_from_pdf(contents)
    if len(raw_text) < 4000:
        tail = raw_text
    else:
        tail = raw_text[int(len(raw_text) * 0.6):]

    if not LLM_API_KEY:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured.")

    client = Groq(api_key=LLM_API_KEY)
    try:
        raw_json = call_groq_with_retry(client, [
            {"role": "system", "content": ANSWER_KEY_PROMPT},
            {"role": "user",   "content": f"Extract answer key:\n\n{tail}"},
        ])
        raw_json = re.sub(r"```json|```", "", raw_json).strip()
        data = json.loads(raw_json)
        answers = {str(k): int(v) for k, v in data.get("answers", {}).items()}
        return {"answers": answers}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Answer key extraction failed: {str(e)}")


@app.patch("/api/questions/answer-key")
async def apply_manual_answer_key(payload: dict):
    answers = payload.get("answers", {})
    validated = {
        str(qid): int(idx)
        for qid, idx in answers.items()
        if isinstance(idx, int) and 0 <= idx <= 3
    }
    return {"answers": validated}


@app.get("/health")
def health():
    return {"status": "ok"}
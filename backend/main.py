"""
CBT Generator Backend - FastAPI (Groq Llama 3.2 90B Vision)
"""

import json
import re
import os
import time
import base64
import tempfile
import uuid
from io import BytesIO
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import pdfplumber
from groq import Groq
from dotenv import load_dotenv
import concurrent.futures

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv()

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

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
LLM_MODEL = "qwen/qwen3.8-27b"
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

RETRY_WAIT = 5
MAX_RETRIES = 3

# ─────────────────────────────────────────────
# MODELS
# ─────────────────────────────────────────────

class Option(BaseModel):
    label: str
    text: str
    diagram_base64: Optional[str] = None
    diagram_mime: Optional[str] = None

class Question(BaseModel):
    id: int
    subject: Optional[str] = "General"
    question_text: str
    options: List[Option]
    correct_answer_index: int
    has_math: bool = False
    has_image: bool = False
    page_number: int = 1
    diagram_base64: Optional[str] = None
    diagram_mime: Optional[str] = None

class ParseResponse(BaseModel):
    questions: List[Question]
    total: int
    warnings: List[str]
    duration_minutes: int
    page_images: dict[int, str] = {}

# ─────────────────────────────────────────────
# EXTRACTION
# ─────────────────────────────────────────────

def extract_pdf_data(file_bytes: bytes) -> dict:
    """
    Returns dict with page images and extracted diagrams.
    {
      "pages": {page_num: base64_full_page},
      "diagrams": {page_num: [(b64, mime), ...]}
    }
    """
    data = {"pages": {}, "diagrams": {}}

    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        for i, page in enumerate(pdf.pages):
            page_num = i + 1
            
            # Extract full page image for Groq Vision
            page_img = page.to_image(resolution=100)
            buf = BytesIO()
            page_img.original.save(buf, format="PNG")
            data["pages"][page_num] = base64.b64encode(buf.getvalue()).decode("utf-8")
            
            # Extract embedded diagrams
            if page.images:
                page_imgs = []
                for img_meta in page.images:
                    try:
                        x0  = max(0, img_meta["x0"] - 2)
                        top = max(0, img_meta["top"] - 2)
                        x1  = min(page.width,  img_meta["x1"] + 2)
                        bot = min(page.height, img_meta["bottom"] + 2)

                        if (x1 - x0) < 50 or (bot - top) < 50:
                            continue

                        cropped = page.within_bbox((x0, top, x1, bot)).to_image(resolution=150)
                        buf_crop = BytesIO()
                        cropped.original.save(buf_crop, format="PNG")
                        b64 = base64.b64encode(buf_crop.getvalue()).decode("utf-8")
                        page_imgs.append((b64, "image/png"))
                    except Exception as e:
                        pass
                if page_imgs:
                    data["diagrams"][page_num] = page_imgs

    return data


def map_images_to_questions(
    questions: list[dict],
    page_diagrams: dict[int, list[tuple[str, str]]]
) -> list[dict]:
    assigned: set[tuple[int,int]] = set()

    for q in questions:
        if not q.get("has_image"):
            continue
            
        pnum = q.get("page_number", 1)
        matched = None
        
        if pnum in page_diagrams:
            for img_idx, (b64, mime) in enumerate(page_diagrams[pnum]):
                if (pnum, img_idx) not in assigned:
                    matched = (pnum, img_idx, b64, mime)
                    break
                    
        if not matched:
            all_images = [(p, i, b, m) for p, imgs in page_diagrams.items() for i, (b, m) in enumerate(imgs)]
            candidates = [x for x in all_images if (x[0], x[1]) not in assigned]
            if candidates:
                matched = min(candidates, key=lambda x: abs(x[0] - pnum))

        if matched:
            p, img_idx, b64, mime = matched
            assigned.add((p, img_idx))
            q["diagram_base64"] = b64
            q["diagram_mime"]   = mime

    return questions

# ─────────────────────────────────────────────
# PROMPTS
# ─────────────────────────────────────────────

SYSTEM_PROMPT = """You are a strict JSON API. Output ONLY a valid JSON object. No markdown, no backticks, no explanation.

Parse the exam questions from this page image.

CRITICAL RULES:
1. Subject: Use section headers (BIOLOGY, CHEMISTRY, MATHEMATICS, PHYSICS).
2. Option labels may appear as (A)/(B)/(C)/(D), A), B), A., or inline — normalize to A/B/C/D.
3. Question stem always comes BEFORE options; never include it as an option.
4. Question numbers like "1.", "2." — exclude the number from question_text.
5. For "Match the Following" questions: include the FULL table content (Column I and Column II entries) in question_text.
6. For structure/diagram-based questions where options contain images: set has_image=true and use "illegible (structure/diagram)" as option text.
7. correct_answer_index: set to -1 if unknown. Do NOT guess.
8. has_math: true if question or options contain equations, formulas, superscripts, or scientific notation. Format ALL math with KaTeX delimiters ($...$ for inline, $$...$$ for block).
9. has_image: true if question references a figure, diagram, graph, or image.

JSON schema:
{
  "questions": [
    {
      "subject": "<Biology|Chemistry|Mathematics|Physics|General>",
      "question_text": "<full stem>",
      "options": [
        {"label": "A", "text": "<text>"},
        {"label": "B", "text": "<text>"},
        {"label": "C", "text": "<text>"},
        {"label": "D", "text": "<text>"}
      ],
      "correct_answer_index": <0-based int or -1>,
      "has_math": <bool>,
      "has_image": <bool>
    }
  ]
}"""

# ─────────────────────────────────────────────
# GROQ CALL WITH RETRY
# ─────────────────────────────────────────────

def process_page_with_groq(page_num: int, base64_image: str) -> list[dict]:
    if not groq_client:
        raise ValueError("GROQ_API_KEY is not set")
        
    for attempt in range(MAX_RETRIES):
        try:
            response = groq_client.chat.completions.create(
                model=LLM_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": SYSTEM_PROMPT},
                            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{base64_image}"}}
                        ]
                    }
                ],
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            raw = response.choices[0].message.content
            data = json.loads(raw)
            questions = data.get("questions", [])
            for q in questions:
                q["page_number"] = page_num
            return questions
        except Exception as e:
            err = str(e)
            if "429" in err and attempt < MAX_RETRIES - 1:
                import re
                match = re.search(r"try again in ([0-9.]+)s", err)
                wait_time = float(match.group(1)) if match else RETRY_WAIT
                print(f"Rate limited on page {page_num}. Waiting {wait_time}s...")
                time.sleep(wait_time + 0.5)
            else:
                print(f"Error parsing page {page_num}: {err}")
                return []

# ─────────────────────────────────────────────
# ROUTES & BACKGROUND TASKS
# ─────────────────────────────────────────────

tasks = {}

def process_pdf_task(task_id: str, contents: bytes):
    try:
        tasks[task_id]["progress"] = "Extracting images from PDF..."
        pdf_data = extract_pdf_data(contents)
        
        if not groq_client:
            tasks[task_id]["status"] = "completed"
            tasks[task_id]["result"] = ParseResponse(questions=[], total=0, warnings=["No GROQ_API_KEY set"], duration_minutes=180, page_images={}).dict()
            return

        total_pages = len(pdf_data['pages'])
        tasks[task_id]["progress"] = f"Calling AI for {total_pages} pages..."
        
        warnings = []
        all_raw_questions = []
        pages_processed = 0
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = {
                executor.submit(process_page_with_groq, pnum, b64): pnum
                for pnum, b64 in pdf_data["pages"].items()
            }
            for future in concurrent.futures.as_completed(futures):
                pages_processed += 1
                tasks[task_id]["progress"] = f"Parsed {pages_processed}/{total_pages} pages..."
                
                page_questions = future.result()
                if page_questions:
                    all_raw_questions.extend(page_questions)
                else:
                    warnings.append(f"Failed to parse questions on page {futures[future]}")

        if not all_raw_questions:
            tasks[task_id]["status"] = "error"
            tasks[task_id]["error"] = "No questions could be parsed from the PDF."
            return

        tasks[task_id]["progress"] = "Mapping diagrams to questions..."
        all_raw_questions = map_images_to_questions(all_raw_questions, pdf_data["diagrams"])

        questions = []
        for i, q in enumerate(all_raw_questions):
            q["id"] = i + 1 
            try:
                questions.append(Question(**q))
            except Exception:
                warnings.append(f"Skipped malformed question id={q.get('id', '?')}")

        duration_minutes = min(len(questions) * 3, 180)

        response = ParseResponse(
            questions=questions,
            total=len(questions),
            warnings=warnings,
            duration_minutes=duration_minutes,
            page_images=pdf_data["pages"]
        )
        
        tasks[task_id]["status"] = "completed"
        tasks[task_id]["result"] = response.dict()
        
    except Exception as e:
        tasks[task_id]["status"] = "error"
        tasks[task_id]["error"] = str(e)


@app.post("/api/upload")
async def upload_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files accepted.")

    contents = await file.read()
    if len(contents) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Max 25MB.")

    task_id = str(uuid.uuid4())
    tasks[task_id] = {"status": "processing", "progress": "Starting..."}
    
    background_tasks.add_task(process_pdf_task, task_id, contents)
    
    return {"task_id": task_id}

@app.get("/api/status/{task_id}")
def get_task_status(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return tasks[task_id]

@app.post("/api/question/{question_id}/image")
async def upload_question_image(question_id: int, file: UploadFile = File(...)):
    allowed = {"image/png", "image/jpeg", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="PNG/JPEG/WEBP only.")
    data = await file.read()
    b64 = base64.b64encode(data).decode("utf-8")
    return {"question_id": question_id, "diagram_base64": b64, "diagram_mime": file.content_type}

@app.post("/api/parse-answer-key")
async def parse_answer_key(file: UploadFile = File(...)):
    raise HTTPException(status_code=501, detail="Auto answer-key not available in Groq Vision mode.")

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
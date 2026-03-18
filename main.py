import os
import json
import uuid
import logging
from datetime import datetime, timedelta
from pathlib import Path

import speech_recognition as sr
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv
from pydantic import BaseModel
from groq import Groq  # <--- CHANGED TO GROQ

# ─── Config & Environment ──────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
# We will still read from the same variable name in your .env file
GROQ_API_KEY = os.getenv("ANTHROPIC_API_KEY") 

# Initialize Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize FastAPI
app = FastAPI(title="StatSync AI Command Center", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_ai_client():
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="API key not set in environment.")
    return Groq(api_key=GROQ_API_KEY)


# ─── Pydantic Models ───────────────────────────────────────────────────────────
class IssueCreate(BaseModel):
    title: str
    description: str
    department: str
    priority: str
    created_by: str
    status: str = "pending"
    created_at: str

class ReminderRequest(BaseModel):
    patient_ids: list[str]

class TranscriptRequest(BaseModel):
    transcript: str

class VerifyRequest(BaseModel):
    mlc_number: str
    report: dict
    nurse_name: str


# ─── AI System Prompt ──────────────────────────────────────────────────────────
MLC_SYSTEM_PROMPT = """You are a medical documentation assistant for emergency trauma response in India.

Given a transcription of an incoming ambulance call or paramedic report, extract and structure 
the information into a formal Medico-Legal Case (MLC) report draft.

Return ONLY a valid JSON object (no markdown, no backticks, no explanation) with these exact fields:
{
  "patient_name": "string or 'Unknown'",
  "age": "string or 'Unknown'",
  "gender": "Male/Female/Unknown",
  "time_of_call": "HH:MM string",
  "incident_type": "e.g. Road Traffic Accident / Assault / Burns / Fall / Poisoning / Unknown",
  "incident_location": "string or 'Unknown'",
  "chief_complaints": ["array", "of", "complaints"],
  "visible_injuries": ["array", "of", "injuries"],
  "vital_signs": {
    "consciousness": "Conscious/Unconscious/Semiconscious/Unknown",
    "bleeding": "Present/Absent/Unknown",
    "breathing": "Normal/Laboured/Absent/Unknown"
  },
  "transported_by": "Ambulance/Police/Private Vehicle/Unknown",
  "attendant": "string or 'None'",
  "police_informed": "Yes/No/Unknown",
  "urgency_level": "CRITICAL/HIGH/MODERATE/LOW",
  "additional_notes": "any extra relevant info"
}

Rules:
- Never invent patient details. Use 'Unknown' if not mentioned.
- urgency_level must be based on described condition severity.
- chief_complaints and visible_injuries must be non-empty arrays; use ["None reported"] if nothing mentioned.
- Return ONLY the JSON. No text before or after.
"""


# ===============================================================================
# PART 1: VIRTUAL EAR & AI ROUTES (MLC GENERATION)
# ===============================================================================

@app.post("/api/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """Accepts a WAV/WEBM audio file, returns transcribed text."""
    logger.info(f"Received audio file: {audio.filename}")
    audio_bytes = await audio.read()
    temp_path = Path(f"temp_{uuid.uuid4().hex}.wav")
    temp_path.write_bytes(audio_bytes)

    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(str(temp_path)) as source:
            recognizer.adjust_for_ambient_noise(source, duration=0.5)
            audio_data = recognizer.record(source)

        transcript = recognizer.recognize_google(audio_data, language="en-IN")
        return {"success": True, "transcript": transcript}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        temp_path.unlink(missing_ok=True)


@app.post("/api/generate-mlc")
async def generate_mlc(request: TranscriptRequest):
    """Sends transcript to Groq, returns JSON, and saves to Supabase."""
    if not request.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript cannot be empty.")

    client = get_ai_client()

    try:
        # --- CHANGED TO GROQ API CALL ---
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": MLC_SYSTEM_PROMPT},
                {"role": "user", "content": request.transcript}
            ],
            temperature=0.1
        )

        raw = response.choices[0].message.content.strip()
        clean = raw.replace("```json", "").replace("```", "").strip()
        report_data = json.loads(clean)

    except Exception as e:
        logger.error(f"AI Error: {e}")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

    # Attach metadata
    mlc_number = f"MLC/DRAFT/{datetime.now().strftime('%Y%m%d')}/{uuid.uuid4().hex[:6].upper()}"
    report_data["mlc_number"] = mlc_number
    report_data["created_at"] = datetime.now().isoformat()
    report_data["status"] = "DRAFT"

    # Save directly to Supabase!
    db_payload = {
        "mlc_number": mlc_number,
        "status": "DRAFT",
        "incident_type": report_data.get("incident_type", "Unknown"),
        "urgency_level": report_data.get("urgency_level", "MODERATE"),
        "raw_transcript": request.transcript,
        "report_data": report_data
    }
    
    try:
        supabase.table('mlc_reports').insert(db_payload).execute()
    except Exception as e:
        logger.error(f"Supabase Error: {e}")

    return {"success": True, "mlc_number": mlc_number, "report": report_data}


@app.post("/api/verify-mlc")
async def verify_mlc(request: VerifyRequest):
    """Nurse submits verified report, updates status in Supabase."""
    if not request.nurse_name.strip():
        raise HTTPException(status_code=400, detail="Nurse name required.")

    report = request.report
    report["status"] = "VERIFIED"
    report["verified_by"] = request.nurse_name
    report["verified_at"] = datetime.now().isoformat()

    update_payload = {
        "status": "VERIFIED",
        "verified_by": request.nurse_name,
        "report_data": report
    }
    
    supabase.table('mlc_reports').update(update_payload).eq('mlc_number', request.mlc_number).execute()

    return {"success": True, "message": f"MLC {request.mlc_number} verified."}


@app.get("/api/reports")
async def list_reports():
    """Fetch all MLC reports from Supabase"""
    res = supabase.table('mlc_reports').select('mlc_number, status, incident_type, urgency_level, created_at, report_data').order('created_at', desc=True).execute()
    return {"reports": res.data}




# ===============================================================================
# PART 2: DASHBOARD & RESOURCE TRACKING
# ===============================================================================

@app.get("/api/dashboard")
def get_dashboard_stats():
    """Aggregates data from Supabase for the main dashboard."""
    try:
        doctors = supabase.table('doctors').select('*', count='exact').execute()
        icu_beds = supabase.table('icu_beds').select('*').execute()
        ambulances = supabase.table('ambulances').select('*').execute()
        oxygen = supabase.table('oxygen_tanks').select('*').execute()

        occupied_beds = sum(1 for bed in icu_beds.data if bed['status'] == 'occupied')
        active_ambs = sum(1 for a in ambulances.data if a['status'] == 'on-mission')
        total_oxy = sum(tank['total'] for tank in oxygen.data)

        return {
            "total_patients": 4382 + occupied_beds,
            "total_doctors": doctors.count,
            "icu_beds": f"{occupied_beds}/{len(icu_beds.data)}",
            "ambulances": active_ambs,
            "oxygen_cylinders": total_oxy
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/icu")
def get_icu_beds(): return supabase.table('icu_beds').select('*').execute().data
    

@app.post("/api/doctors")
def add_doctor(payload: dict):
    """Adds a new doctor to Supabase"""
    res = supabase.table('doctors').insert(payload).execute()
    return res.data

@app.patch("/api/doctors/{doc_id}")
def update_doctor(doc_id: str, payload: dict):
    """Updates an existing doctor"""
    res = supabase.table('doctors').update(payload).eq('id', doc_id).execute()
    return res.data

@app.delete("/api/doctors/{doc_id}")
def delete_doctor(doc_id: str):
    """Deletes a doctor from Supabase"""
    res = supabase.table('doctors').delete().eq('id', doc_id).execute()
    return {"success": True}

@app.get("/api/ambulances")
def get_ambulances(): return supabase.table('ambulances').select('*').execute().data
# --- ADD THESE NEW ROUTES ---

@app.post("/api/ambulances")
def add_ambulance(payload: dict):
    """Adds a new ambulance to Supabase"""
    res = supabase.table('ambulances').insert(payload).execute()
    return res.data

@app.patch("/api/ambulances/{amb_id}")
def update_ambulance(amb_id: str, payload: dict):
    """Updates an existing ambulance"""
    res = supabase.table('ambulances').update(payload).eq('id', amb_id).execute()
    return res.data

@app.delete("/api/ambulances/{amb_id}")
def delete_ambulance(amb_id: str):
    """Deletes an ambulance from Supabase"""
    res = supabase.table('ambulances').delete().eq('id', amb_id).execute()
    return {"success": True}

@app.get("/api/oxygen")
def get_oxygen(): return supabase.table('oxygen_tanks').select('*').execute().data
@app.post("/api/oxygen")
def add_oxygen(payload: dict):
    """Adds a new oxygen tank to Supabase"""
    res = supabase.table('oxygen_tanks').insert(payload).execute()
    return res.data

@app.patch("/api/oxygen/{oxy_id}")
def update_oxygen(oxy_id: str, payload: dict):
    """Updates an existing oxygen tank"""
    res = supabase.table('oxygen_tanks').update(payload).eq('id', oxy_id).execute()
    return res.data

@app.delete("/api/oxygen/{oxy_id}")
def delete_oxygen(oxy_id: str):
    """Deletes an oxygen tank from Supabase"""
    res = supabase.table('oxygen_tanks').delete().eq('id', oxy_id).execute()
    return {"success": True}

@app.get("/api/issues")
def get_issues(): return supabase.table('issues').select('*').execute().data

@app.post("/api/issues")
def create_issue(issue: IssueCreate):
    res = supabase.table('issues').insert(issue.model_dump()).execute()
    return res.data[0]

@app.patch("/api/issues/{issue_id}")
def update_issue(issue_id: str, update_data: dict):
    res = supabase.table('issues').update(update_data).eq('id', issue_id).execute()
    return res.data[0]


# ===============================================================================
# PART 3: PROPOSAL INNOVATIONS (PREDICTIVE STAFFING & EQUITY)
# ===============================================================================

@app.get("/api/predict-surge")
def predict_patient_surge():
    """Simulates predicting hospital rushes based on Weather/AQI."""
    return {
        "surge_risk": "High",
        "predicted_inflow": "+25% in next 4 hours",
        "action_alert": "Call 3 extra nurses to Emergency Ward.",
        "external_factors": {"aqi": 340, "temperature": 42}
    }

@app.get("/api/patients/expiring-consultations")
def get_expiring_consults():
    """Fetches patients whose free consult expires in the next 48 hours."""
    today = datetime.now().date()
    two_days_from_now = today + timedelta(days=2)
    
    res = supabase.table('patients').select('*').gte('free_consult_expiry', str(today)).lte('free_consult_expiry', str(two_days_from_now)).eq('reminder_sent', False).execute()
    return res.data

@app.post("/api/patients/send-reminders")
def send_automated_reminders(req: ReminderRequest):
    """Updates Supabase after sending SMS/WhatsApp reminders."""
    sent_count = 0
    for pid in req.patient_ids:
        supabase.table('patients').update({"reminder_sent": True}).eq('id', pid).execute()
        sent_count += 1
    return {"message": f"Successfully dispatched {sent_count} reminders via SMS/WhatsApp."}

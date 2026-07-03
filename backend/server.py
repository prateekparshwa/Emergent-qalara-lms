"""Qalara LMS backend.

Foundation: Emergent Google Auth (session-based), users/sessions/buyers/settings
collections, seed data on startup, and read-only endpoints for the app shell.
"""
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime, timezone, timedelta
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Qalara LMS API")
api_router = APIRouter(prefix="/api")

EDITOR_DOMAIN = "qalara.com"
EMERGENT_SESSION_DATA_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
SESSION_TTL_DAYS = 7


# ---------- Models ----------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str  # 'editor' | 'viewer'


class AmNote(BaseModel):
    text: str
    author_email: str
    timestamp: str


class OutreachEmail(BaseModel):
    subject: str
    body: str
    drafted_at: Optional[str] = None
    sent_at: Optional[str] = None
    status: str = "DRAFTED"


class Buyer(BaseModel):
    id: str
    organization: str
    website: Optional[str] = ""
    email: Optional[str] = ""
    contact_name: Optional[str] = ""
    designation: Optional[str] = ""
    country: Optional[str] = ""
    business_type: Optional[str] = ""
    org_size: Optional[str] = ""
    purchase_potential: str = "UNKNOWN"
    potential_rationale: Optional[str] = ""
    account_manager: Optional[str] = ""
    am_notes: List[AmNote] = []
    sources_from_india: bool = False
    segment: str = "directory"
    enrichment: Optional[Any] = None
    enrichment_updated_at: Optional[str] = None
    moodboard: Optional[Any] = None
    outreach_status: str = "NONE"
    outreach_emails: List[OutreachEmail] = []
    lead_score: Optional[float] = None
    created_at: str
    updated_at: str


# ---------- Helpers ----------
def _role_for(email: str) -> str:
    return "editor" if email.lower().endswith(f"@{EDITOR_DOMAIN}") else "viewer"


async def _get_session_token(request: Request) -> Optional[str]:
    token = request.cookies.get("session_token")
    if token:
        return token
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


async def get_current_user(request: Request) -> User:
    token = await _get_session_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_doc = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")

    return User(
        user_id=user_doc["user_id"],
        email=user_doc["email"],
        name=user_doc.get("name", ""),
        picture=user_doc.get("picture"),
        role=user_doc.get("role", _role_for(user_doc["email"])),
    )


# ---------- Auth endpoints ----------
class SessionExchangeRequest(BaseModel):
    session_id: str


@api_router.post("/auth/session")
async def exchange_session(payload: SessionExchangeRequest, response: Response):
    """Exchange a one-time session_id from Emergent for a persistent session_token."""
    async with httpx.AsyncClient(timeout=10.0) as http:
        r = await http.get(
            EMERGENT_SESSION_DATA_URL,
            headers={"X-Session-ID": payload.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = r.json()

    email = data["email"]
    role = _role_for(email)
    now = datetime.now(timezone.utc)

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": data.get("name", existing.get("name", "")),
                "picture": data.get("picture", existing.get("picture")),
                "role": role,
                "updated_at": now.isoformat(),
            }},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name", ""),
            "picture": data.get("picture"),
            "role": role,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        })

    session_token = data["session_token"]
    expires_at = now + timedelta(days=SESSION_TTL_DAYS)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": now,
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )

    return {
        "user_id": user_id,
        "email": email,
        "name": data.get("name", ""),
        "picture": data.get("picture"),
        "role": role,
    }


@api_router.get("/auth/me")
async def auth_me(user: User = Depends(get_current_user)):
    return user.model_dump()


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = await _get_session_token(request)
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/", samesite="none", secure=True)
    return {"ok": True}


# ---------- Buyers endpoints (read-only foundation) ----------
@api_router.get("/buyers")
async def list_buyers(user: User = Depends(get_current_user)):
    docs = await db.buyers.find({}, {"_id": 0}).to_list(1000)
    return docs


@api_router.get("/settings/qalara_profile")
async def get_qalara_profile(user: User = Depends(get_current_user)):
    doc = await db.settings.find_one({"key": "qalara_profile"}, {"_id": 0})
    if not doc:
        return {}
    return doc.get("value", {})


# ---------- Seeding ----------
async def _seed():
    now_iso = datetime.now(timezone.utc).isoformat()

    if await db.settings.count_documents({"key": "qalara_profile"}) == 0:
        await db.settings.insert_one({
            "key": "qalara_profile",
            "value": {
                "about": (
                    "Qalara is an Indian export marketplace connecting global "
                    "wholesale buyers with curated Indian artisan producers of "
                    "home décor, textiles, kitchenware and lifestyle goods."
                ),
                "categories": [
                    "Home Décor", "Textiles & Rugs", "Kitchen & Tableware",
                    "Lighting", "Furniture", "Wellness & Lifestyle",
                ],
                "producer_base": "500+ vetted artisan clusters across 15 Indian states.",
                "moqs": "Flexible MOQs from 50 units; container consolidation supported.",
                "export_markets": ["USA", "UK", "Germany", "France", "Australia", "Japan"],
                "certifications": ["GOTS", "Fair Trade", "SEDEX", "GRS"],
                "value_props": [
                    "Curated, brand-safe artisan supply",
                    "Ethical sourcing & full traceability",
                    "Consolidated shipments across categories",
                    "Design collaboration & private-label ready",
                ],
            },
        })

    if await db.buyers.count_documents({}) == 0:
        samples = [
            {
                "organization": "Nordic Home Collective",
                "website": "https://nordichomecollective.com",
                "email": "sourcing@nordichomecollective.com",
                "contact_name": "Astrid Berg",
                "designation": "Head of Sourcing",
                "country": "Sweden",
                "business_type": "Retailer",
                "org_size": "50-200",
                "purchase_potential": "HIGH",
                "potential_rationale": "Actively expanding Indian handwoven rug range; 30 stores across Nordics.",
                "account_manager": "Rhea Kapoor",
                "sources_from_india": True,
                "segment": "directory",
            },
            {
                "organization": "Maison Terracotta",
                "website": "https://maison-terracotta.fr",
                "email": "hello@maison-terracotta.fr",
                "contact_name": "Élodie Marchand",
                "designation": "Founder",
                "country": "France",
                "business_type": "Brand",
                "org_size": "10-50",
                "purchase_potential": "MEDIUM",
                "potential_rationale": "Boutique brand exploring ceramic and block-print collaborations.",
                "account_manager": "Vikram Shah",
                "sources_from_india": False,
                "segment": "discover",
            },
            {
                "organization": "Willowbrook Wholesale",
                "website": "https://willowbrookwholesale.co.uk",
                "email": "buying@willowbrookwholesale.co.uk",
                "contact_name": "Oliver Hastings",
                "designation": "Category Manager, Home",
                "country": "United Kingdom",
                "business_type": "Wholesaler",
                "org_size": "200-500",
                "purchase_potential": "HIGH",
                "potential_rationale": "Category expansion in kitchen textiles; existing India import volume.",
                "account_manager": "Rhea Kapoor",
                "sources_from_india": True,
                "segment": "directory",
            },
            {
                "organization": "Kōgei Living",
                "website": "https://kogei-living.jp",
                "email": "info@kogei-living.jp",
                "contact_name": "Haruto Tanaka",
                "designation": "Buyer",
                "country": "Japan",
                "business_type": "Retailer",
                "org_size": "10-50",
                "purchase_potential": "LOW",
                "potential_rationale": "Prefers domestic craft; open to complementary Indian textiles.",
                "account_manager": "Ananya Sen",
                "sources_from_india": False,
                "segment": "discover",
            },
            {
                "organization": "Highland & Harbor Co.",
                "website": "https://highlandharbor.com",
                "email": "trade@highlandharbor.com",
                "contact_name": "Marcus Bell",
                "designation": "VP of Merchandising",
                "country": "USA",
                "business_type": "Distributor",
                "org_size": "500-1000",
                "purchase_potential": "HIGH",
                "potential_rationale": "Distributes to 400+ boutiques; strong pipeline for décor + lighting.",
                "account_manager": "Vikram Shah",
                "sources_from_india": True,
                "segment": "directory",
            },
        ]
        docs = []
        for s in samples:
            docs.append({
                "id": f"buyer_{uuid.uuid4().hex[:12]}",
                **s,
                "am_notes": [],
                "enrichment": None,
                "enrichment_updated_at": None,
                "moodboard": None,
                "outreach_status": "NONE",
                "outreach_emails": [],
                "lead_score": None,
                "created_at": now_iso,
                "updated_at": now_iso,
            })
        await db.buyers.insert_many(docs)


@app.on_event("startup")
async def on_startup():
    await _seed()


# CORS
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

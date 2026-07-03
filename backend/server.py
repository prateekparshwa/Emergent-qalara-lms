"""Qalara LMS backend.

Foundation: Emergent Google Auth (session-based), users/sessions/buyers/settings
collections, seed data on startup, and read-only endpoints for the app shell.
"""
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import io
import json
import uuid
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime, timezone, timedelta
import httpx
import pandas as pd
from bs4 import BeautifulSoup
from urllib.parse import quote_plus
from emergentintegrations.llm.chat import LlmChat, UserMessage

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


# ---------- Buyers endpoints ----------
BUYER_FIELDS_ALLOWED = [
    "organization", "website", "email", "contact_name", "designation", "country",
    "business_type", "org_size", "purchase_potential", "potential_rationale",
    "account_manager", "sources_from_india",
]
PROTECTED_ON_UPDATE = {
    "am_notes", "enrichment", "enrichment_updated_at", "moodboard",
    "outreach_status", "outreach_emails", "lead_score", "account_manager",
    "id", "created_at",
}


async def require_editor(user: User = Depends(get_current_user)) -> User:
    if user.role != "editor":
        raise HTTPException(status_code=403, detail="Editors only")
    return user


def _parse_bool(v) -> bool:
    if isinstance(v, bool):
        return v
    if v is None:
        return False
    return str(v).strip().lower() in {"true", "yes", "y", "1", "t"}


def _normalize_potential(v) -> str:
    if v is None:
        return "UNKNOWN"
    s = str(v).strip().upper()
    for k in ("HIGH", "MEDIUM", "LOW", "UNKNOWN"):
        if s.startswith(k):
            return k
    return "UNKNOWN"


def _norm_website(w) -> Optional[str]:
    if not w:
        return None
    s = str(w).strip().lower()
    s = re.sub(r"^https?://", "", s)
    s = s.rstrip("/")
    return s or None


def _read_upload(content: bytes, filename: str) -> pd.DataFrame:
    name = (filename or "").lower()
    if name.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content), dtype=str, keep_default_na=False)
    elif name.endswith(".xlsx") or name.endswith(".xls"):
        df = pd.read_excel(io.BytesIO(content), dtype=str)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type; use .csv or .xlsx")
    df = df.fillna("")
    df.columns = [str(c).strip() for c in df.columns]
    return df


@api_router.post("/buyers/import/preview")
async def import_preview(file: UploadFile = File(...), user: User = Depends(require_editor)):
    content = await file.read()
    df = _read_upload(content, file.filename or "")
    return {
        "columns": list(df.columns),
        "sample_rows": df.head(3).astype(str).to_dict(orient="records"),
        "total_rows": int(len(df)),
        "allowed_fields": BUYER_FIELDS_ALLOWED,
    }


@api_router.post("/buyers/import/commit")
async def import_commit(
    file: UploadFile = File(...),
    mapping: str = Form(...),
    user: User = Depends(require_editor),
):
    try:
        mp: Dict[str, str] = json.loads(mapping)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid mapping JSON")

    # csv_col -> buyer_field, filtered to allowed fields only
    rev: Dict[str, str] = {}
    for col, field in mp.items():
        if field and field in BUYER_FIELDS_ALLOWED:
            rev[field] = col

    if not rev.get("organization"):
        raise HTTPException(status_code=400, detail="'organization' column must be mapped")

    content = await file.read()
    df = _read_upload(content, file.filename or "")

    # Cache all existing buyers for dedup
    existing_all = await db.buyers.find({}, {"_id": 0}).to_list(100000)
    by_website: Dict[str, dict] = {}
    by_org_email: Dict[tuple, dict] = {}
    for b in existing_all:
        w = _norm_website(b.get("website"))
        if w:
            by_website[w] = b
        org = str(b.get("organization", "")).strip().lower()
        email = str(b.get("email", "")).strip().lower()
        if org and email:
            by_org_email[(org, email)] = b

    now_iso = datetime.now(timezone.utc).isoformat()
    inserted = updated = skipped = 0

    for _, row in df.iterrows():
        record: Dict[str, Any] = {}
        for field, col in rev.items():
            val = row.get(col, "")
            if field == "sources_from_india":
                record[field] = _parse_bool(val)
            elif field == "purchase_potential":
                record[field] = _normalize_potential(val)
            else:
                record[field] = str(val).strip() if val is not None else ""

        org = str(record.get("organization", "")).strip()
        if not org:
            skipped += 1
            continue

        website_norm = _norm_website(record.get("website"))
        email_lc = str(record.get("email", "")).strip().lower()

        existing = None
        if website_norm and website_norm in by_website:
            existing = by_website[website_norm]
        elif org.lower() and email_lc and (org.lower(), email_lc) in by_org_email:
            existing = by_org_email[(org.lower(), email_lc)]

        if existing:
            # preserve protected fields; only set mapped ones (except protected)
            update_fields = {k: v for k, v in record.items() if k not in PROTECTED_ON_UPDATE}
            update_fields["updated_at"] = now_iso
            update_fields["segment"] = existing.get("segment", "directory")
            await db.buyers.update_one({"id": existing["id"]}, {"$set": update_fields})
            updated += 1
        else:
            doc = {
                "id": f"buyer_{uuid.uuid4().hex[:12]}",
                "organization": org,
                "website": record.get("website", ""),
                "email": record.get("email", ""),
                "contact_name": record.get("contact_name", ""),
                "designation": record.get("designation", ""),
                "country": record.get("country", ""),
                "business_type": record.get("business_type", ""),
                "org_size": record.get("org_size", ""),
                "purchase_potential": record.get("purchase_potential", "UNKNOWN"),
                "potential_rationale": record.get("potential_rationale", ""),
                "account_manager": record.get("account_manager", ""),
                "am_notes": [],
                "sources_from_india": record.get("sources_from_india", False),
                "segment": "directory",
                "enrichment": None,
                "enrichment_updated_at": None,
                "moodboard": None,
                "outreach_status": "NONE",
                "outreach_emails": [],
                "lead_score": None,
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            await db.buyers.insert_one(doc)
            # update caches so a duplicate later in the same file matches this new row
            if website_norm:
                by_website[website_norm] = doc
            if email_lc:
                by_org_email[(org.lower(), email_lc)] = doc
            inserted += 1

    return {"inserted": inserted, "updated": updated, "skipped": skipped}


@api_router.get("/buyers/stats")
async def buyer_stats(user: User = Depends(get_current_user)):
    total = await db.buyers.count_documents({})
    high = await db.buyers.count_documents(
        {"purchase_potential": {"$regex": "^HIGH", "$options": "i"}}
    )
    medium = await db.buyers.count_documents(
        {"purchase_potential": {"$regex": "^MEDIUM", "$options": "i"}}
    )
    with_enrichment = await db.buyers.count_documents(
        {"enrichment": {"$nin": [None]}, "enrichment_updated_at": {"$nin": [None, ""]}}
    )
    assigned = await db.buyers.count_documents(
        {"account_manager": {"$nin": ["", None]}}
    )
    return {
        "total": total,
        "high": high,
        "medium": medium,
        "with_enrichment": with_enrichment,
        "assigned": assigned,
    }


@api_router.get("/buyers/suggest")
async def buyer_suggest(q: str = "", user: User = Depends(get_current_user)):
    q = q.strip()
    if not q:
        return []
    esc = re.escape(q)
    query = {
        "$or": [
            {"organization": {"$regex": f"^{esc}", "$options": "i"}},
            {"email": {"$regex": esc, "$options": "i"}},
            {"website": {"$regex": esc, "$options": "i"}},
        ]
    }
    items = await db.buyers.find(
        query,
        {"_id": 0, "id": 1, "organization": 1, "country": 1, "email": 1, "website": 1},
    ).limit(8).to_list(8)
    return items


@api_router.get("/buyers/account-managers")
async def list_account_managers(user: User = Depends(get_current_user)):
    ams = await db.buyers.distinct("account_manager")
    return sorted([a for a in ams if a])


@api_router.get("/buyers/filter-facets")
async def filter_facets(user: User = Depends(get_current_user)):
    countries = await db.buyers.distinct("country")
    business_types = await db.buyers.distinct("business_type")
    return {
        "countries": sorted([c for c in countries if c]),
        "business_types": sorted([b for b in business_types if b]),
    }


@api_router.get("/buyers")
async def list_buyers(
    q: str = "",
    country: str = "",
    business_type: str = "",
    purchase_potential: str = "",
    account_manager: str = "",
    sources_from_india: Optional[str] = None,
    unassigned: bool = False,
    page: int = 1,
    page_size: int = 50,
    user: User = Depends(get_current_user),
):
    query: Dict[str, Any] = {}
    ands: List[Dict[str, Any]] = []

    if country:
        query["country"] = country
    if business_type:
        query["business_type"] = business_type
    if purchase_potential:
        query["purchase_potential"] = {
            "$regex": f"^{re.escape(purchase_potential)}",
            "$options": "i",
        }
    if account_manager:
        query["account_manager"] = account_manager
    if sources_from_india in ("true", "false"):
        query["sources_from_india"] = sources_from_india == "true"
    if unassigned:
        ands.append({
            "$or": [
                {"account_manager": ""},
                {"account_manager": None},
                {"account_manager": {"$exists": False}},
            ]
        })
    q = q.strip()
    if q:
        esc = re.escape(q)
        ands.append({
            "$or": [
                {"organization": {"$regex": f"^{esc}", "$options": "i"}},
                {"email": {"$regex": esc, "$options": "i"}},
                {"website": {"$regex": esc, "$options": "i"}},
            ]
        })
    if ands:
        query["$and"] = ands

    page = max(1, int(page))
    page_size = max(1, min(200, int(page_size)))
    total = await db.buyers.count_documents(query)
    skip = (page - 1) * page_size
    items = await (
        db.buyers.find(query, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(page_size)
        .to_list(page_size)
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@api_router.get("/buyers/{buyer_id}")
async def get_buyer(buyer_id: str, user: User = Depends(get_current_user)):
    doc = await db.buyers.find_one({"id": buyer_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Buyer not found")
    # Return am_notes newest-first
    doc["am_notes"] = sorted(
        doc.get("am_notes") or [],
        key=lambda n: n.get("timestamp") or "",
        reverse=True,
    )
    return doc


class BuyerPatch(BaseModel):
    account_manager: Optional[str] = None


@api_router.patch("/buyers/{buyer_id}")
async def patch_buyer(buyer_id: str, payload: BuyerPatch, user: User = Depends(require_editor)):
    update: Dict[str, Any] = {}
    if payload.account_manager is not None:
        update["account_manager"] = payload.account_manager
    if not update:
        raise HTTPException(status_code=400, detail="No editable fields provided")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.buyers.update_one({"id": buyer_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Buyer not found")
    return await db.buyers.find_one({"id": buyer_id}, {"_id": 0})


class NotePayload(BaseModel):
    text: str


@api_router.post("/buyers/{buyer_id}/notes")
async def add_buyer_note(buyer_id: str, payload: NotePayload, user: User = Depends(require_editor)):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Note text required")
    note = {
        "text": text,
        "author_email": user.email,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.buyers.update_one(
        {"id": buyer_id},
        {"$push": {"am_notes": note}, "$set": {"updated_at": note["timestamp"]}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Buyer not found")
    doc = await db.buyers.find_one({"id": buyer_id}, {"_id": 0})
    doc["am_notes"] = sorted(
        doc.get("am_notes") or [],
        key=lambda n: n.get("timestamp") or "",
        reverse=True,
    )
    return doc


@api_router.get("/settings/qalara_profile")
async def get_qalara_profile(user: User = Depends(get_current_user)):
    doc = await db.settings.find_one({"key": "qalara_profile"}, {"_id": 0})
    if not doc:
        return {}
    return doc.get("value", {})


# ---------- AI Enrichment ----------
QALARA_CATEGORIES = [
    "Home Décor", "Textiles & Rugs", "Kitchen & Tableware",
    "Lighting", "Furniture", "Wellness & Lifestyle",
]

ENRICH_SYSTEM = (
    "You are a B2B sourcing analyst for Qalara, an Indian export marketplace "
    "connecting global wholesale buyers with Indian artisan producers of "
    "home décor, textiles, kitchenware and lifestyle goods."
)

ENRICH_INSTRUCTION = """Analyze the company below as a potential BUYER of Indian home décor, textiles, kitchenware and lifestyle goods.

Return ONLY a JSON object (no prose, no code fences) with this exact schema:
{
  "summary": "2-3 sentence overview",
  "products_sold": ["..."],
  "target_customers": "one short sentence",
  "markets_served": ["..."],
  "estimated_size": "e.g. 10-50 employees / small boutique / mid-market retailer",
  "brand_style": "one sentence on their aesthetic",
  "purchase_potential": "HIGH" or "MEDIUM" or "LOW",
  "potential_rationale": "2 sentences supporting the rating",
  "fit_categories": ["subset of: Home Décor, Textiles & Rugs, Kitchen & Tableware, Lighting, Furniture, Wellness & Lifestyle"]
}
"""


async def _fetch_site_text(url: str) -> str:
    if not url:
        return ""
    u = url.strip()
    if not u.startswith(("http://", "https://")):
        u = "https://" + u

    tf_key = os.environ.get("TINYFISH_API_KEY", "")
    # Primary: Tinyfish Fetch (returns markdown)
    if tf_key:
        try:
            async with httpx.AsyncClient(timeout=20.0) as h:
                r = await h.post(
                    "https://api.fetch.tinyfish.ai",
                    headers={"X-API-Key": tf_key, "Content-Type": "application/json"},
                    json={"urls": [u], "format": "markdown"},
                )
                if r.status_code == 200:
                    data = r.json()
                    results = data.get("results") or []
                    if results:
                        md = results[0].get("markdown") or results[0].get("content") or ""
                        if md:
                            text = " ".join(md.split())
                            return text[:8000]
        except Exception as e:
            logger.info("tinyfish fetch failed for %s: %s", u, e)

    # Fallback: plain httpx + BeautifulSoup
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0,
                                     headers={"User-Agent": "Mozilla/5.0 QalaraLMS/0.3"}) as h:
            r = await h.get(u)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            for tag in soup(["script", "style", "noscript", "svg", "iframe"]):
                tag.decompose()
            text = " ".join(soup.get_text(separator=" ").split())
            return text[:8000]
    except Exception as e:
        logger.info("site fetch fallback failed for %s: %s", u, e)
        return ""


async def _web_search_snippets(query: str) -> List[str]:
    tf_key = os.environ.get("TINYFISH_API_KEY", "")
    if tf_key:
        try:
            async with httpx.AsyncClient(timeout=15.0) as h:
                r = await h.get(
                    "https://api.search.tinyfish.ai",
                    params={"query": query, "language": "en"},
                    headers={"X-API-Key": tf_key},
                )
                if r.status_code == 200:
                    data = r.json()
                    out = []
                    for item in (data.get("results") or [])[:6]:
                        t = item.get("title") or ""
                        s = item.get("snippet") or ""
                        line = (f"{t} — {s}" if t and s else t or s).strip()
                        if line:
                            out.append(line)
                    return out
        except Exception as e:
            logger.info("tinyfish search failed for %s: %s", query, e)

    # Fallback: DuckDuckGo HTML (no key)
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0,
                                     headers={"User-Agent": "Mozilla/5.0"}) as h:
            r = await h.get("https://duckduckgo.com/html/", params={"q": query})
            soup = BeautifulSoup(r.text, "html.parser")
            snippets = []
            for el in soup.select(".result__snippet, a.result__snippet")[:5]:
                t = " ".join(el.get_text(" ").split())
                if t:
                    snippets.append(t)
            return snippets
    except Exception as e:
        logger.info("web search fallback failed for %s: %s", query, e)
        return []


def _extract_json(s: str) -> dict:
    s = s.strip()
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z]*\n?", "", s)
        s = re.sub(r"\n?```$", "", s)
    start = s.find("{")
    end = s.rfind("}")
    if start >= 0 and end > start:
        s = s[start:end + 1]
    return json.loads(s)


@api_router.post("/buyers/{buyer_id}/enrich")
async def enrich_buyer(buyer_id: str, force: bool = False, user: User = Depends(require_editor)):
    buyer = await db.buyers.find_one({"id": buyer_id}, {"_id": 0})
    if not buyer:
        raise HTTPException(status_code=404, detail="Buyer not found")

    # 7-day guard
    if not force and buyer.get("enrichment_updated_at"):
        try:
            last = datetime.fromisoformat(buyer["enrichment_updated_at"])
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - last < timedelta(days=7):
                return {"needs_confirm": True, "last_enriched": buyer["enrichment_updated_at"]}
        except Exception:
            pass

    site_text = await _fetch_site_text(buyer.get("website", ""))
    query = f"{buyer.get('organization', '')} {buyer.get('country', '')} wholesale retail".strip()
    snippets = await _web_search_snippets(query)

    prompt = (
        f"Company: {buyer.get('organization', '')}\n"
        f"Country: {buyer.get('country', '')}\n"
        f"Website: {buyer.get('website', '')}\n"
        f"Existing business_type: {buyer.get('business_type', '')}\n\n"
        f"--- Site homepage text (may be empty) ---\n{site_text or '[unavailable]'}\n\n"
        f"--- Web search snippets ---\n" + ("\n".join(f"- {s}" for s in snippets) or "[none]") + "\n\n"
        + ENRICH_INSTRUCTION
    )

    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    llm_error = None
    enrichment_json: Optional[dict] = None
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"enrich-{buyer_id}-{uuid.uuid4().hex[:6]}",
            system_message=ENRICH_SYSTEM,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        raw = await chat.send_message(UserMessage(text=prompt))
        enrichment_json = _extract_json(str(raw))
    except Exception as e:
        logger.warning("LLM enrichment failed for %s: %s", buyer_id, e)
        llm_error = str(e)

    now_iso = datetime.now(timezone.utc).isoformat()
    update: Dict[str, Any] = {"updated_at": now_iso}

    if enrichment_json:
        # normalize potential
        pp = _normalize_potential(enrichment_json.get("purchase_potential"))
        enrichment_json["purchase_potential"] = pp
        # coerce arrays
        for k in ("products_sold", "markets_served", "fit_categories"):
            if not isinstance(enrichment_json.get(k), list):
                enrichment_json[k] = []
        update["enrichment"] = enrichment_json
        update["enrichment_updated_at"] = now_iso
        # fill purchase_potential only if previously unknown/empty
        prev_pp = (buyer.get("purchase_potential") or "").upper()
        if prev_pp in ("", "UNKNOWN") and pp in ("HIGH", "MEDIUM", "LOW"):
            update["purchase_potential"] = pp
            if not (buyer.get("potential_rationale") or "").strip():
                update["potential_rationale"] = enrichment_json.get("potential_rationale") or ""
    else:
        # partial result: still record the attempt with error
        update["enrichment"] = {
            "error": llm_error or "Analysis unavailable",
            "site_text_len": len(site_text),
            "snippets_count": len(snippets),
        }
        update["enrichment_updated_at"] = now_iso

    await db.buyers.update_one({"id": buyer_id}, {"$set": update})
    doc = await db.buyers.find_one({"id": buyer_id}, {"_id": 0})
    doc["am_notes"] = sorted(doc.get("am_notes") or [], key=lambda n: n.get("timestamp") or "", reverse=True)
    doc["_debug"] = {
        "site_text_chars": len(site_text),
        "snippets": len(snippets),
        "llm_ok": enrichment_json is not None,
        "llm_error": llm_error,
    }
    return doc


# ---------- Moodboard ----------
async def _scrape_image_urls(url: str, limit: int = 12) -> List[str]:
    if not url:
        return []
    u = url.strip()
    if not u.startswith(("http://", "https://")):
        u = "https://" + u
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0,
                                     headers={"User-Agent": "Mozilla/5.0 QalaraLMS/0.3"}) as h:
            r = await h.get(u)
            r.raise_for_status()
            base = str(r.url)
            soup = BeautifulSoup(r.text, "html.parser")
    except Exception as e:
        logger.info("moodboard scrape failed for %s: %s", u, e)
        return []

    from urllib.parse import urljoin
    imgs, seen = [], set()
    for tag in soup.find_all(["img", "source"]):
        src = tag.get("src") or tag.get("data-src") or tag.get("srcset") or ""
        if "," in src:
            src = src.split(",")[0].strip().split(" ")[0]
        if not src:
            continue
        low = src.lower().strip()
        if low.startswith("data:") or low.endswith(".svg") or ".svg?" in low:
            continue
        try:
            w = int(tag.get("width") or 0); hh = int(tag.get("height") or 0)
            if (w and w < 100) or (hh and hh < 100):
                continue
        except (ValueError, TypeError):
            pass
        if re.search(r"(favicon|sprite|icon|logo)", low):
            continue
        absolute = urljoin(base, src)
        if absolute in seen:
            continue
        seen.add(absolute)
        imgs.append(absolute)
        if len(imgs) >= limit:
            break
    return imgs


MOODBOARD_SYSTEM = "You are a brand-identity analyst. Given a company's homepage text, extract their visual identity in strict JSON."
MOODBOARD_INSTRUCTION = """Extract this brand's visual identity. Return ONLY a JSON object:
{
  "tagline": "their tagline or a 6-word summary of their vibe",
  "color_palette": ["#RRGGBB", ...5 hex colors],
  "brand_voice": ["2-3 adjectives"],
  "typography_feel": "one phrase, e.g. 'clean geometric sans'",
  "aesthetic_keywords": ["5 keywords"]
}
"""


@api_router.post("/buyers/{buyer_id}/moodboard")
async def generate_moodboard(buyer_id: str, force: bool = False, user: User = Depends(require_editor)):
    buyer = await db.buyers.find_one({"id": buyer_id}, {"_id": 0})
    if not buyer:
        raise HTTPException(status_code=404, detail="Buyer not found")

    existing = buyer.get("moodboard") or {}
    if not force and existing.get("generated_at"):
        try:
            last = datetime.fromisoformat(existing["generated_at"])
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - last < timedelta(days=7):
                return {"needs_confirm": True, "last_generated": existing["generated_at"]}
        except Exception:
            pass

    website = buyer.get("website", "")
    images = await _scrape_image_urls(website)
    site_text = await _fetch_site_text(website)

    prompt = (
        f"Company: {buyer.get('organization','')}\nCountry: {buyer.get('country','')}\n\n"
        f"--- Site text ---\n{site_text or '[unavailable]'}\n\n" + MOODBOARD_INSTRUCTION
    )

    visual, llm_error = None, None
    try:
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY", ""),
            session_id=f"moodboard-{buyer_id}-{uuid.uuid4().hex[:6]}",
            system_message=MOODBOARD_SYSTEM,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        raw = await chat.send_message(UserMessage(text=prompt))
        visual = _extract_json(str(raw))
    except Exception as e:
        logger.warning("moodboard LLM failed for %s: %s", buyer_id, e)
        llm_error = str(e)

    if visual:
        for k in ("color_palette", "brand_voice", "aesthetic_keywords"):
            if not isinstance(visual.get(k), list):
                visual[k] = []

    now_iso = datetime.now(timezone.utc).isoformat()
    moodboard = {
        "images": images,
        "tagline": (visual or {}).get("tagline", ""),
        "color_palette": (visual or {}).get("color_palette", []),
        "brand_voice": (visual or {}).get("brand_voice", []),
        "typography_feel": (visual or {}).get("typography_feel", ""),
        "aesthetic_keywords": (visual or {}).get("aesthetic_keywords", []),
        "generated_at": now_iso,
        "error": llm_error,
    }
    await db.buyers.update_one({"id": buyer_id}, {"$set": {"moodboard": moodboard, "updated_at": now_iso}})
    doc = await db.buyers.find_one({"id": buyer_id}, {"_id": 0})
    doc["am_notes"] = sorted(doc.get("am_notes") or [], key=lambda n: n.get("timestamp") or "", reverse=True)
    return doc


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

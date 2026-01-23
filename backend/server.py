from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from pymongo import MongoClient
from bson import ObjectId
import os
import re
import base64
import random

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="CampusPool API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Collections
users_collection = db["users"]
rides_collection = db["rides"]
ride_requests_collection = db["ride_requests"]
chat_messages_collection = db["chat_messages"]
sos_events_collection = db["sos_events"]  # Phase 4: SOS Events
ratings_collection = db["ratings"]  # Phase 6: Ratings & Feedback
event_tags_collection = db["event_tags"]  # Phase 7: Event Tags
reports_collection = db["reports"]  # Phase 8: User Reports
audit_logs_collection = db["audit_logs"]  # Phase 8: Admin Audit Logs

# JWT Config
JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Allowed email domain
ALLOWED_EMAIL_DOMAIN = "@rvce.edu.in"

# Phase 5: RVCE-specific Pickup Points
PICKUP_POINTS = [
    {"id": "main_gate", "name": "Main Gate", "description": "RVCE Main Entrance"},
    {"id": "library", "name": "Central Library", "description": "Near Library Building"},
    {"id": "canteen", "name": "Main Canteen", "description": "Central Canteen Area"},
    {"id": "cse_block", "name": "CSE Block", "description": "Computer Science Building"},
    {"id": "ece_block", "name": "ECE Block", "description": "Electronics Building"},
    {"id": "mech_block", "name": "Mechanical Block", "description": "Mechanical Engineering Building"},
    {"id": "civil_block", "name": "Civil Block", "description": "Civil Engineering Building"},
    {"id": "admin_block", "name": "Admin Block", "description": "Administrative Building"},
    {"id": "hostel_gate", "name": "Hostel Gate", "description": "Boys/Girls Hostel Entrance"},
    {"id": "sports_complex", "name": "Sports Complex", "description": "Near Playground/Gym"},
    {"id": "parking_lot", "name": "Parking Lot", "description": "Main Parking Area"},
    {"id": "back_gate", "name": "Back Gate", "description": "Rear Campus Exit"},
]

# Phase 5: Recurrence Patterns
RECURRENCE_PATTERNS = [
    {"id": "weekdays", "name": "Weekdays", "days": [0, 1, 2, 3, 4]},  # Mon-Fri
    {"id": "weekends", "name": "Weekends", "days": [5, 6]},  # Sat-Sun
    {"id": "daily", "name": "Daily", "days": [0, 1, 2, 3, 4, 5, 6]},
    {"id": "mon_wed_fri", "name": "Mon/Wed/Fri", "days": [0, 2, 4]},
    {"id": "tue_thu", "name": "Tue/Thu", "days": [1, 3]},
]

# Phase 7: RVCE Branches and Academic Years
BRANCHES = [
    {"id": "cse", "name": "Computer Science"},
    {"id": "ise", "name": "Information Science"},
    {"id": "ece", "name": "Electronics & Communication"},
    {"id": "eee", "name": "Electrical & Electronics"},
    {"id": "me", "name": "Mechanical Engineering"},
    {"id": "cv", "name": "Civil Engineering"},
    {"id": "bt", "name": "Biotechnology"},
    {"id": "ch", "name": "Chemical Engineering"},
    {"id": "im", "name": "Industrial Management"},
    {"id": "te", "name": "Telecommunication"},
]

ACADEMIC_YEARS = [
    {"id": "1", "name": "1st Year"},
    {"id": "2", "name": "2nd Year"},
    {"id": "3", "name": "3rd Year"},
    {"id": "4", "name": "4th Year"},
]

# Phase 7: Badge Definitions
BADGE_DEFINITIONS = [
    {"id": "first_ride", "name": "First Ride", "description": "Completed your first ride", "icon": "🎉", "threshold": 1},
    {"id": "rides_5", "name": "Rising Star", "description": "Completed 5 rides", "icon": "⭐", "threshold": 5},
    {"id": "rides_10", "name": "Road Warrior", "description": "Completed 10 rides", "icon": "🏆", "threshold": 10},
    {"id": "rides_25", "name": "Campus Hero", "description": "Completed 25 rides", "icon": "🦸", "threshold": 25},
    {"id": "eco_warrior", "name": "Eco Warrior", "description": "Saved 50kg CO2", "icon": "🌱", "threshold_co2": 50},
    {"id": "eco_champion", "name": "Eco Champion", "description": "Saved 100kg CO2", "icon": "🌍", "threshold_co2": 100},
]

# Phase 7: CO2 Constants
CO2_PER_KM_SAVED = 0.21  # kg CO2 saved per km shared
AVG_RIDE_DISTANCE_KM = 8  # Average ride distance estimate
COST_PER_KM_SOLO = 12  # Estimated cost per km for solo travel (auto/cab)

# Pydantic Models
class UserSignup(BaseModel):
    email: str
    password: str
    name: str
    role: str = Field(..., pattern="^(rider|driver)$")

class UserLogin(BaseModel):
    email: str
    password: str

class UserProfile(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    # Vehicle details for drivers
    vehicle_model: Optional[str] = None
    vehicle_number: Optional[str] = None
    vehicle_color: Optional[str] = None

class RideCreate(BaseModel):
    source: str
    destination: str
    source_lat: Optional[float] = None
    source_lng: Optional[float] = None
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    date: str
    time: str
    available_seats: int = Field(..., ge=1, le=10)
    estimated_cost: float = Field(..., ge=0)
    # Phase 5: Pickup point and recurring ride fields
    pickup_point: Optional[str] = None  # Pickup point ID from PICKUP_POINTS
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None  # Pattern ID from RECURRENCE_PATTERNS
    recurrence_days_ahead: Optional[int] = Field(default=None, ge=1, le=30)  # How many days to generate
    # Phase 7: Event tag
    event_tag: Optional[str] = None  # Event tag ID

class RideUpdate(BaseModel):
    source: Optional[str] = None
    destination: Optional[str] = None
    source_lat: Optional[float] = None
    source_lng: Optional[float] = None
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    date: Optional[str] = None
    time: Optional[str] = None
    available_seats: Optional[int] = None
    estimated_cost: Optional[float] = None
    pickup_point: Optional[str] = None
    event_tag: Optional[str] = None  # Phase 7: Event tag

class RideRequestCreate(BaseModel):
    ride_id: str
    is_urgent: bool = False  # Phase 5: Instant/urgent ride request

class RideRequestAction(BaseModel):
    action: str = Field(..., pattern="^(accept|reject)$")

# Verification Models
class VerificationUpload(BaseModel):
    student_id_image: str  # Base64 encoded image

class VerificationAction(BaseModel):
    action: str = Field(..., pattern="^(approve|reject)$")
    reason: Optional[str] = None  # Required for rejection

# Phase 3: Chat and PIN Models
class ChatMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)

class StartRideRequest(BaseModel):
    pin: str = Field(..., min_length=4, max_length=4)

# Phase 4: SOS and Live Ride Models
class SOSCreate(BaseModel):
    ride_request_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    message: Optional[str] = None

class SOSAction(BaseModel):
    action: str = Field(..., pattern="^(review|resolve)$")
    notes: Optional[str] = None

# Phase 6: Rating Models
class RatingCreate(BaseModel):
    ride_request_id: str
    rating: int = Field(..., ge=1, le=5)  # 1-5 stars
    feedback: Optional[str] = Field(None, max_length=500)  # Optional text feedback

# Phase 7: Event Tag Models
class EventTagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=200)

class EventTagUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=200)
    is_active: Optional[bool] = None

# Phase 7: User Profile Update with Community Fields
class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_number: Optional[str] = None
    vehicle_color: Optional[str] = None
    branch: Optional[str] = None
    academic_year: Optional[str] = None

# Phase 8: Report Models
class ReportCreate(BaseModel):
    reported_user_id: Optional[str] = None
    ride_id: Optional[str] = None
    category: str = Field(..., pattern="^(safety|behavior|misuse|other)$")
    description: str = Field(..., min_length=10, max_length=1000)

class ReportAction(BaseModel):
    action: str = Field(..., pattern="^(warn|suspend|disable|dismiss)$")
    admin_notes: Optional[str] = Field(None, max_length=500)

# Phase 8: User Status Update
class UserStatusUpdate(BaseModel):
    is_active: bool
    reason: Optional[str] = Field(None, max_length=500)

# Phase 8: Promote User to Admin
class PromoteUserRequest(BaseModel):
    confirm: bool = True

# Phase 6: Trust Level Thresholds
TRUST_THRESHOLDS = {
    "trusted": {"min_rating": 4.0, "min_rides": 5},  # 4+ stars with 5+ rides
    "new_user": {"max_rides": 4},  # Less than 5 completed rides
    "needs_review": {"max_rating": 2.5}  # Below 2.5 stars
}

def calculate_trust_level(avg_rating: float, ride_count: int) -> dict:
    """Calculate trust level based on rating and ride count"""
    if ride_count < TRUST_THRESHOLDS["new_user"]["max_rides"]:
        return {"level": "new", "label": "New User", "color": "gray"}
    elif avg_rating and avg_rating < TRUST_THRESHOLDS["needs_review"]["max_rating"]:
        return {"level": "low", "label": "Needs Review", "color": "red"}
    elif avg_rating and avg_rating >= TRUST_THRESHOLDS["trusted"]["min_rating"] and ride_count >= TRUST_THRESHOLDS["trusted"]["min_rides"]:
        return {"level": "trusted", "label": "Trusted", "color": "green"}
    else:
        return {"level": "regular", "label": "Regular", "color": "blue"}

def get_user_rating_stats(user_id: str) -> dict:
    """Get aggregated rating statistics for a user"""
    # Get all ratings where this user was rated
    ratings = list(ratings_collection.find({"rated_user_id": user_id}))
    
    if not ratings:
        return {
            "average_rating": None,
            "total_ratings": 0,
            "rating_distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        }
    
    total = len(ratings)
    sum_ratings = sum(r["rating"] for r in ratings)
    avg = round(sum_ratings / total, 2) if total > 0 else None
    
    # Calculate distribution
    distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for r in ratings:
        distribution[r["rating"]] = distribution.get(r["rating"], 0) + 1
    
    return {
        "average_rating": avg,
        "total_ratings": total,
        "rating_distribution": distribution
    }

# Phase 7: Calculate user badges
def calculate_user_badges(user_id: str, ride_count: int = None) -> list:
    """Calculate earned badges for a user"""
    if ride_count is None:
        # Count completed rides
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if user and user.get("role") == "driver":
            ride_count = rides_collection.count_documents({
                "driver_id": user_id,
                "status": "completed"
            })
        else:
            ride_count = ride_requests_collection.count_documents({
                "rider_id": user_id,
                "status": "completed"
            })
    
    # Calculate CO2 saved
    co2_saved = ride_count * AVG_RIDE_DISTANCE_KM * CO2_PER_KM_SAVED
    
    badges = []
    for badge in BADGE_DEFINITIONS:
        earned = False
        if "threshold" in badge:
            earned = ride_count >= badge["threshold"]
        elif "threshold_co2" in badge:
            earned = co2_saved >= badge["threshold_co2"]
        
        if earned:
            badges.append({
                "id": badge["id"],
                "name": badge["name"],
                "description": badge["description"],
                "icon": badge["icon"],
                "earned": True
            })
    
    return badges

# Phase 7: Calculate user stats
def calculate_user_stats(user_id: str, user_role: str) -> dict:
    """Calculate comprehensive user statistics"""
    # Get completed rides/requests
    rides_offered = 0
    rides_taken = 0
    
    if user_role == "driver":
        rides_offered = rides_collection.count_documents({
            "driver_id": user_id,
            "status": "completed"
        })
        # Also count rides taken if user has ever been a rider
        rides_taken = ride_requests_collection.count_documents({
            "rider_id": user_id,
            "status": "completed"
        })
    else:
        rides_taken = ride_requests_collection.count_documents({
            "rider_id": user_id,
            "status": "completed"
        })
        # Also count rides offered if user has ever been a driver
        rides_offered = rides_collection.count_documents({
            "driver_id": user_id,
            "status": "completed"
        })
    
    total_rides = rides_offered + rides_taken
    
    # Calculate distance and savings
    total_distance_km = total_rides * AVG_RIDE_DISTANCE_KM
    total_co2_saved = total_distance_km * CO2_PER_KM_SAVED
    
    # Calculate money saved (estimated solo cost - actual ride cost)
    money_saved = 0
    if user_role == "rider" or rides_taken > 0:
        completed_requests = list(ride_requests_collection.find({
            "rider_id": user_id,
            "status": "completed"
        }))
        for req in completed_requests:
            ride = rides_collection.find_one({"_id": ObjectId(req["ride_id"])})
            if ride:
                solo_cost = AVG_RIDE_DISTANCE_KM * COST_PER_KM_SOLO
                actual_cost = ride.get("estimated_cost", 0)
                money_saved += max(0, solo_cost - actual_cost)
    
    if user_role == "driver" or rides_offered > 0:
        completed_rides = list(rides_collection.find({
            "driver_id": user_id,
            "status": "completed"
        }))
        for ride in completed_rides:
            # Count riders who completed
            rider_count = ride_requests_collection.count_documents({
                "ride_id": str(ride["_id"]),
                "status": "completed"
            })
            if rider_count > 0:
                # Driver saved by splitting cost
                solo_cost = AVG_RIDE_DISTANCE_KM * COST_PER_KM_SOLO
                money_saved += solo_cost * rider_count / (rider_count + 1)
    
    # Calculate ride streak
    streak = calculate_ride_streak(user_id, user_role)
    
    return {
        "rides_offered": rides_offered,
        "rides_taken": rides_taken,
        "total_rides": total_rides,
        "total_distance_km": round(total_distance_km, 1),
        "total_co2_saved_kg": round(total_co2_saved, 2),
        "money_saved": round(money_saved, 0),
        "streak": streak
    }

# Phase 7: Calculate ride streak
def calculate_ride_streak(user_id: str, user_role: str) -> dict:
    """Calculate consecutive days of ride usage"""
    # Get all completed ride dates for this user
    ride_dates = set()
    
    if user_role == "driver":
        rides = rides_collection.find({
            "driver_id": user_id,
            "status": "completed"
        }, {"date": 1})
        for r in rides:
            if r.get("date"):
                ride_dates.add(r["date"])
    
    requests = ride_requests_collection.find({
        "rider_id": user_id,
        "status": "completed"
    })
    for req in requests:
        ride = rides_collection.find_one({"_id": ObjectId(req["ride_id"])}, {"date": 1})
        if ride and ride.get("date"):
            ride_dates.add(ride["date"])
    
    if not ride_dates:
        return {"current": 0, "longest": 0}
    
    # Sort dates
    sorted_dates = sorted(ride_dates)
    
    # Calculate current streak (from today backwards)
    today = datetime.now().strftime("%Y-%m-%d")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    
    current_streak = 0
    check_date = today
    
    while check_date in ride_dates or (current_streak == 0 and yesterday in ride_dates):
        if check_date in ride_dates:
            current_streak += 1
        elif current_streak == 0 and yesterday in ride_dates:
            check_date = yesterday
            continue
        else:
            break
        check_date = (datetime.strptime(check_date, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    
    # Calculate longest streak
    longest_streak = 0
    temp_streak = 1
    
    for i in range(1, len(sorted_dates)):
        prev_date = datetime.strptime(sorted_dates[i-1], "%Y-%m-%d")
        curr_date = datetime.strptime(sorted_dates[i], "%Y-%m-%d")
        
        if (curr_date - prev_date).days == 1:
            temp_streak += 1
        else:
            longest_streak = max(longest_streak, temp_streak)
            temp_streak = 1
    
    longest_streak = max(longest_streak, temp_streak)
    
    return {
        "current": current_streak,
        "longest": longest_streak
    }

# Phase 7: Calculate weekly summary
def calculate_weekly_summary(user_id: str, user_role: str) -> dict:
    """Calculate stats for the last 7 days"""
    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    today = datetime.now().strftime("%Y-%m-%d")
    
    rides_completed = 0
    co2_saved = 0
    money_saved = 0
    
    # Get rides in last 7 days
    if user_role == "driver":
        rides = list(rides_collection.find({
            "driver_id": user_id,
            "status": "completed",
            "date": {"$gte": week_ago, "$lte": today}
        }))
        rides_completed = len(rides)
        for ride in rides:
            rider_count = ride_requests_collection.count_documents({
                "ride_id": str(ride["_id"]),
                "status": "completed"
            })
            if rider_count > 0:
                solo_cost = AVG_RIDE_DISTANCE_KM * COST_PER_KM_SOLO
                money_saved += solo_cost * rider_count / (rider_count + 1)
                co2_saved += AVG_RIDE_DISTANCE_KM * CO2_PER_KM_SAVED
    
    # Get ride requests in last 7 days
    requests = list(ride_requests_collection.find({
        "rider_id": user_id,
        "status": "completed"
    }))
    
    for req in requests:
        ride = rides_collection.find_one({"_id": ObjectId(req["ride_id"])})
        if ride and ride.get("date", "") >= week_ago and ride.get("date", "") <= today:
            rides_completed += 1
            solo_cost = AVG_RIDE_DISTANCE_KM * COST_PER_KM_SOLO
            actual_cost = ride.get("estimated_cost", 0)
            money_saved += max(0, solo_cost - actual_cost)
            co2_saved += AVG_RIDE_DISTANCE_KM * CO2_PER_KM_SAVED
    
    return {
        "period": f"{week_ago} to {today}",
        "rides_completed": rides_completed,
        "co2_saved_kg": round(co2_saved, 2),
        "money_saved": round(money_saved, 0)
    }

# Phase 8: Log admin action
def log_admin_action(admin_id: str, admin_name: str, action_type: str, target_type: str, target_id: str, details: dict = None):
    """Log an admin action for audit trail"""
    audit_log = {
        "admin_id": admin_id,
        "admin_name": admin_name,
        "action_type": action_type,  # e.g., 'user_disabled', 'verification_approved', 'report_handled'
        "target_type": target_type,  # e.g., 'user', 'ride', 'report', 'sos'
        "target_id": target_id,
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    audit_logs_collection.insert_one(audit_log)

# Helper functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def validate_email_domain(email: str) -> bool:
    return email.lower().endswith(ALLOWED_EMAIL_DOMAIN)

def generate_ride_pin() -> str:
    """Generate a 4-digit PIN for ride verification"""
    return str(random.randint(1000, 9999))

def estimate_ride_duration(source: str, destination: str) -> int:
    """Estimate ride duration in minutes based on source/destination length as proxy for distance"""
    # Simple heuristic: longer place names often mean farther destinations
    # Base time: 15-45 minutes for typical campus rides
    base_time = 20
    # Add some variation based on string length (proxy for complexity/distance)
    distance_factor = (len(source) + len(destination)) // 10
    return base_time + (distance_factor * 5)  # Returns estimated minutes

def calculate_estimated_arrival(start_time_str: str, duration_minutes: int) -> str:
    """Calculate ETA based on start time and duration"""
    try:
        start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
        eta = start_time + timedelta(minutes=duration_minutes)
        return eta.isoformat()
    except:
        return None

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = users_collection.find_one({"_id": ObjectId(user_id)}, {"password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        # Check if user account is disabled (allow admins to continue)
        if user.get("is_active") == False and not user.get("is_admin"):
            raise HTTPException(status_code=403, detail="Your account has been disabled. Please contact support.")
        user["id"] = str(user["_id"])
        del user["_id"]
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def serialize_user(user: dict) -> dict:
    # Count completed rides for this user
    ride_count = 0
    user_id_str = str(user["_id"])
    
    if user.get("role") == "driver":
        ride_count = rides_collection.count_documents({
            "driver_id": user_id_str,
            "status": "completed"
        })
    else:
        ride_count = ride_requests_collection.count_documents({
            "rider_id": user_id_str,
            "status": "completed"
        })
    
    # Phase 6: Get rating statistics
    rating_stats = get_user_rating_stats(user_id_str)
    trust_level = calculate_trust_level(rating_stats["average_rating"], ride_count)
    
    # Phase 7: Calculate badges
    badges = calculate_user_badges(user_id_str, ride_count)
    
    result = {
        "id": user_id_str,
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "is_admin": user.get("is_admin", False),
        "verification_status": user.get("verification_status", "unverified"),
        "rejection_reason": user.get("rejection_reason"),
        "verified_at": user.get("verified_at"),
        "ride_count": ride_count,
        "created_at": user.get("created_at", ""),
        # Phase 6: Rating and Trust fields
        "average_rating": rating_stats["average_rating"],
        "total_ratings": rating_stats["total_ratings"],
        "rating_distribution": rating_stats["rating_distribution"],
        "trust_level": trust_level,
        # Phase 7: Community and Engagement fields
        "branch": user.get("branch"),
        "academic_year": user.get("academic_year"),
        "badges": badges,
        # Phase 8: Account status fields
        "is_active": user.get("is_active", True),
        "is_suspended": user.get("is_suspended", False),
        "warning_count": user.get("warning_count", 0)
    }
    
    # Include vehicle details for drivers
    if user.get("role") == "driver":
        result["vehicle_model"] = user.get("vehicle_model")
        result["vehicle_number"] = user.get("vehicle_number")
        result["vehicle_color"] = user.get("vehicle_color")
    
    return result

# Phase 7: Get event tag name helper
def get_event_tag_name(tag_id: str) -> str:
    """Get event tag name from ID"""
    if not tag_id:
        return None
    tag = event_tags_collection.find_one({"_id": ObjectId(tag_id)})
    return tag["name"] if tag else None

# Phase 7: Get branch name helper
def get_branch_name(branch_id: str) -> str:
    """Get branch name from ID"""
    if not branch_id:
        return None
    for branch in BRANCHES:
        if branch["id"] == branch_id:
            return branch["name"]
    return None

# Phase 7: Get academic year name helper
def get_academic_year_name(year_id: str) -> str:
    """Get academic year name from ID"""
    if not year_id:
        return None
    for year in ACADEMIC_YEARS:
        if year["id"] == year_id:
            return year["name"]
    return None

def serialize_ride(ride: dict) -> dict:
    driver = users_collection.find_one({"_id": ObjectId(ride["driver_id"])}, {"password": 0})
    driver_name = driver["name"] if driver else "Unknown"
    driver_verification_status = driver.get("verification_status", "unverified") if driver else "unverified"
    
    # Phase 6: Get driver rating stats and trust level
    driver_rating_stats = get_user_rating_stats(ride["driver_id"])
    driver_completed_rides = rides_collection.count_documents({
        "driver_id": ride["driver_id"],
        "status": "completed"
    })
    driver_trust_level = calculate_trust_level(driver_rating_stats["average_rating"], driver_completed_rides)
    
    # Count accepted requests (including ongoing and completed for completed rides)
    # For completed rides, we want to show the total riders who were part of the ride
    if ride.get("status") == "completed":
        # Include completed requests to show accurate rider count for past rides
        accepted_requests = ride_requests_collection.count_documents({
            "ride_id": str(ride["_id"]),
            "status": {"$in": ["accepted", "ongoing", "completed"]}
        })
    else:
        # For active rides, only count accepted and ongoing
        accepted_requests = ride_requests_collection.count_documents({
            "ride_id": str(ride["_id"]),
            "status": {"$in": ["accepted", "ongoing"]}
        })
    
    seats_taken = accepted_requests
    seats_available = ride["available_seats"] - seats_taken
    cost_per_rider = ride["estimated_cost"] / (seats_taken + 1) if seats_taken > 0 else ride["estimated_cost"]
    
    # Phase 5: Get pickup point name
    pickup_point_id = ride.get("pickup_point")
    pickup_point_name = None
    if pickup_point_id:
        for pp in PICKUP_POINTS:
            if pp["id"] == pickup_point_id:
                pickup_point_name = pp["name"]
                break
    
    return {
        "id": str(ride["_id"]),
        "driver_id": ride["driver_id"],
        "driver_name": driver_name,
        "driver_verification_status": driver_verification_status,
        # Phase 6: Driver rating and trust info
        "driver_average_rating": driver_rating_stats["average_rating"],
        "driver_total_ratings": driver_rating_stats["total_ratings"],
        "driver_trust_level": driver_trust_level,
        "driver_completed_rides": driver_completed_rides,
        "source": ride["source"],
        "destination": ride["destination"],
        "source_lat": ride.get("source_lat"),
        "source_lng": ride.get("source_lng"),
        "destination_lat": ride.get("destination_lat"),
        "destination_lng": ride.get("destination_lng"),
        "date": ride["date"],
        "time": ride["time"],
        "available_seats": ride["available_seats"],
        "seats_available": seats_available,
        "seats_taken": seats_taken,
        "estimated_cost": ride["estimated_cost"],
        "cost_per_rider": round(cost_per_rider, 2),
        "status": ride["status"],
        # Phase 5: New fields
        "pickup_point": pickup_point_id,
        "pickup_point_name": pickup_point_name,
        "is_recurring": ride.get("is_recurring", False),
        "recurrence_pattern": ride.get("recurrence_pattern"),
        "parent_ride_id": ride.get("parent_ride_id"),  # For recurring ride instances
        # Phase 7: Event tag and driver community info
        "event_tag": ride.get("event_tag"),
        "event_tag_name": get_event_tag_name(ride.get("event_tag")),
        "driver_branch": driver.get("branch") if driver else None,
        "driver_branch_name": get_branch_name(driver.get("branch")) if driver else None,
        "driver_academic_year": driver.get("academic_year") if driver else None,
        "driver_academic_year_name": get_academic_year_name(driver.get("academic_year")) if driver else None,
        "created_at": ride.get("created_at", "")
    }

def serialize_ride_request(request: dict) -> dict:
    rider = users_collection.find_one({"_id": ObjectId(request["rider_id"])}, {"password": 0})
    ride = rides_collection.find_one({"_id": ObjectId(request["ride_id"])})
    driver = users_collection.find_one({"_id": ObjectId(ride["driver_id"])}, {"password": 0}) if ride else None
    
    # Phase 4: Calculate ETA for ongoing rides
    estimated_arrival = None
    estimated_duration = None
    if request.get("ride_started_at") and ride:
        estimated_duration = estimate_ride_duration(ride["source"], ride["destination"])
        estimated_arrival = calculate_estimated_arrival(request["ride_started_at"], estimated_duration)
    
    return {
        "id": str(request["_id"]),
        "ride_id": request["ride_id"],
        "rider_id": request["rider_id"],
        "rider_name": rider["name"] if rider else "Unknown",
        "rider_email": rider["email"] if rider else "Unknown",
        "rider_verification_status": rider.get("verification_status", "unverified") if rider else "unverified",
        "ride_source": ride["source"] if ride else "Unknown",
        "ride_destination": ride["destination"] if ride else "Unknown",
        "source_lat": ride.get("source_lat") if ride else None,
        "source_lng": ride.get("source_lng") if ride else None,
        "destination_lat": ride.get("destination_lat") if ride else None,
        "destination_lng": ride.get("destination_lng") if ride else None,
        "ride_date": ride["date"] if ride else "Unknown",
        "ride_time": ride["time"] if ride else "Unknown",
        "ride_estimated_cost": ride["estimated_cost"] if ride else 0,
        "status": request["status"],
        "ride_pin": request.get("ride_pin"),  # Phase 3: Include PIN
        "ride_started_at": request.get("ride_started_at"),  # Phase 3: Include start time
        # Phase 4: Additional fields for live ride
        "driver_id": ride["driver_id"] if ride else None,
        "driver_name": driver["name"] if driver else "Unknown",
        "driver_verification_status": driver.get("verification_status", "unverified") if driver else "unverified",
        # Phase 4: Vehicle details for live ride
        "driver_vehicle_model": driver.get("vehicle_model") if driver else None,
        "driver_vehicle_number": driver.get("vehicle_number") if driver else None,
        "driver_vehicle_color": driver.get("vehicle_color") if driver else None,
        "estimated_arrival": estimated_arrival,
        "estimated_duration_minutes": estimated_duration,
        "reached_safely_at": request.get("reached_safely_at"),
        "completed_at": request.get("completed_at"),
        # Phase 5: Urgent/instant ride request
        "is_urgent": request.get("is_urgent", False),
        "pickup_point": ride.get("pickup_point") if ride else None,
        "pickup_point_name": None,  # Will be populated below
        "created_at": request.get("created_at", "")
    }

def serialize_ride_request_with_pickup(request: dict) -> dict:
    """Serialize ride request with pickup point name resolution"""
    result = serialize_ride_request(request)
    # Resolve pickup point name
    if result.get("pickup_point"):
        for pp in PICKUP_POINTS:
            if pp["id"] == result["pickup_point"]:
                result["pickup_point_name"] = pp["name"]
                break
    return result

def serialize_chat_message(message: dict) -> dict:
    sender = users_collection.find_one({"_id": ObjectId(message["sender_id"])}, {"password": 0})
    return {
        "id": str(message["_id"]),
        "ride_request_id": message["ride_request_id"],
        "sender_id": message["sender_id"],
        "sender_name": sender["name"] if sender else "Unknown",
        "sender_role": sender["role"] if sender else "Unknown",
        "message": message["message"],
        "created_at": message.get("created_at", "")
    }

# Phase 4: SOS Event Serializer
def serialize_sos_event(sos: dict) -> dict:
    ride_request = ride_requests_collection.find_one({"_id": ObjectId(sos["ride_request_id"])}) if sos.get("ride_request_id") else None
    triggered_by_user = users_collection.find_one({"_id": ObjectId(sos["triggered_by"])}, {"password": 0}) if sos.get("triggered_by") else None
    
    # Get ride and participants info
    ride = None
    rider = None
    driver = None
    if ride_request:
        ride = rides_collection.find_one({"_id": ObjectId(ride_request["ride_id"])})
        rider = users_collection.find_one({"_id": ObjectId(ride_request["rider_id"])}, {"password": 0})
        if ride:
            driver = users_collection.find_one({"_id": ObjectId(ride["driver_id"])}, {"password": 0})
    
    return {
        "id": str(sos["_id"]),
        "ride_request_id": sos.get("ride_request_id"),
        "triggered_by": sos.get("triggered_by"),
        "triggered_by_name": triggered_by_user["name"] if triggered_by_user else "Unknown",
        "triggered_by_role": triggered_by_user["role"] if triggered_by_user else "Unknown",
        "latitude": sos.get("latitude"),
        "longitude": sos.get("longitude"),
        "message": sos.get("message"),
        "status": sos.get("status", "active"),
        "admin_notes": sos.get("admin_notes"),
        "reviewed_at": sos.get("reviewed_at"),
        "resolved_at": sos.get("resolved_at"),
        "resolved_by": sos.get("resolved_by"),
        "created_at": sos.get("created_at", ""),
        # Ride details
        "ride_source": ride["source"] if ride else "Unknown",
        "ride_destination": ride["destination"] if ride else "Unknown",
        "ride_date": ride["date"] if ride else "Unknown",
        "ride_time": ride["time"] if ride else "Unknown",
        # Participant details
        "rider_name": rider["name"] if rider else "Unknown",
        "rider_email": rider["email"] if rider else "Unknown",
        "driver_name": driver["name"] if driver else "Unknown",
        "driver_email": driver["email"] if driver else "Unknown",
    }

# Seed admin user on startup
@app.on_event("startup")
async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@rvce.edu.in")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin@123")
    
    existing_admin = users_collection.find_one({"email": admin_email})
    if not existing_admin:
        admin_user = {
            "email": admin_email,
            "password": get_password_hash(admin_password),
            "name": "Admin",
            "role": "admin",
            "is_admin": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        users_collection.insert_one(admin_user)
        print(f"Admin user created: {admin_email}")
    else:
        print(f"Admin user already exists: {admin_email}")

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "CampusPool API"}

# Auth endpoints
@app.post("/api/auth/signup")
async def signup(user: UserSignup):
    if not validate_email_domain(user.email):
        raise HTTPException(status_code=400, detail=f"Only {ALLOWED_EMAIL_DOMAIN} emails are allowed")
    
    existing_user = users_collection.find_one({"email": user.email.lower()})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = {
        "email": user.email.lower(),
        "password": get_password_hash(user.password),
        "name": user.name,
        "role": user.role,
        "is_admin": False,
        "verification_status": "unverified",
        "student_id_image": None,
        "rejection_reason": None,
        "verified_at": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = users_collection.insert_one(new_user)
    token = create_access_token({"user_id": str(result.inserted_id)})
    
    return {
        "message": "User created successfully",
        "token": token,
        "user": {
            "id": str(result.inserted_id),
            "email": new_user["email"],
            "name": new_user["name"],
            "role": new_user["role"],
            "is_admin": new_user["is_admin"],
            "verification_status": new_user["verification_status"],
            "ride_count": 0
        }
    }

@app.post("/api/auth/login")
async def login(user: UserLogin):
    db_user = users_collection.find_one({"email": user.email.lower()})
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check if user account is disabled
    if db_user.get("is_active") == False:
        raise HTTPException(status_code=403, detail="Your account has been disabled. Please contact support.")
    
    token = create_access_token({"user_id": str(db_user["_id"])})
    
    return {
        "message": "Login successful",
        "token": token,
        "user": serialize_user(db_user)
    }

@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}

# Profile endpoints
@app.get("/api/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}

@app.put("/api/profile")
async def update_profile(profile: UserProfile, current_user: dict = Depends(get_current_user)):
    update_data = {}
    if profile.name:
        update_data["name"] = profile.name
    if profile.role and profile.role in ["rider", "driver"]:
        update_data["role"] = profile.role
    
    # Phase 4: Vehicle details for drivers
    if profile.vehicle_model is not None:
        update_data["vehicle_model"] = profile.vehicle_model
    if profile.vehicle_number is not None:
        update_data["vehicle_number"] = profile.vehicle_number
    if profile.vehicle_color is not None:
        update_data["vehicle_color"] = profile.vehicle_color
    
    if update_data:
        users_collection.update_one(
            {"_id": ObjectId(current_user["id"])},
            {"$set": update_data}
        )
    
    updated_user = users_collection.find_one({"_id": ObjectId(current_user["id"])}, {"password": 0})
    updated_user["id"] = str(updated_user["_id"])
    del updated_user["_id"]
    
    return {"message": "Profile updated", "user": updated_user}

# Ride endpoints
@app.post("/api/rides")
async def create_ride(ride: RideCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can post rides")
    
    # Check verification status
    if current_user.get("verification_status") != "verified":
        raise HTTPException(status_code=403, detail="Only verified users can post rides. Please complete ID verification first.")
    
    # Phase 5: Validate pickup point if provided
    if ride.pickup_point:
        valid_pickup_ids = [pp["id"] for pp in PICKUP_POINTS]
        if ride.pickup_point not in valid_pickup_ids:
            raise HTTPException(status_code=400, detail="Invalid pickup point")
    
    # Phase 5: Validate recurrence pattern if recurring
    if ride.is_recurring:
        if not ride.recurrence_pattern:
            raise HTTPException(status_code=400, detail="Recurrence pattern is required for recurring rides")
        if not ride.recurrence_days_ahead:
            raise HTTPException(status_code=400, detail="Number of days ahead is required for recurring rides")
        
        valid_patterns = [p["id"] for p in RECURRENCE_PATTERNS]
        if ride.recurrence_pattern not in valid_patterns:
            raise HTTPException(status_code=400, detail="Invalid recurrence pattern")
    
    new_ride = {
        "driver_id": current_user["id"],
        "source": ride.source,
        "destination": ride.destination,
        "source_lat": ride.source_lat,
        "source_lng": ride.source_lng,
        "destination_lat": ride.destination_lat,
        "destination_lng": ride.destination_lng,
        "date": ride.date,
        "time": ride.time,
        "available_seats": ride.available_seats,
        "estimated_cost": ride.estimated_cost,
        "status": "active",
        # Phase 5: New fields
        "pickup_point": ride.pickup_point,
        "is_recurring": ride.is_recurring,
        "recurrence_pattern": ride.recurrence_pattern if ride.is_recurring else None,
        "parent_ride_id": None,  # This is the parent ride
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = rides_collection.insert_one(new_ride)
    new_ride["_id"] = result.inserted_id
    parent_ride_id = str(result.inserted_id)
    
    # Phase 5: Create recurring ride instances
    created_rides = [serialize_ride(new_ride)]
    if ride.is_recurring and ride.recurrence_pattern and ride.recurrence_days_ahead:
        pattern = next((p for p in RECURRENCE_PATTERNS if p["id"] == ride.recurrence_pattern), None)
        if pattern:
            try:
                base_date = datetime.strptime(ride.date, "%Y-%m-%d")
                for day_offset in range(1, ride.recurrence_days_ahead + 1):
                    future_date = base_date + timedelta(days=day_offset)
                    # Check if this day matches the pattern
                    if future_date.weekday() in pattern["days"]:
                        # Check if ride already exists for this date (avoid duplicates)
                        existing = rides_collection.find_one({
                            "driver_id": current_user["id"],
                            "source": ride.source,
                            "destination": ride.destination,
                            "date": future_date.strftime("%Y-%m-%d"),
                            "time": ride.time
                        })
                        if not existing:
                            recurring_ride = {
                                "driver_id": current_user["id"],
                                "source": ride.source,
                                "destination": ride.destination,
                                "source_lat": ride.source_lat,
                                "source_lng": ride.source_lng,
                                "destination_lat": ride.destination_lat,
                                "destination_lng": ride.destination_lng,
                                "date": future_date.strftime("%Y-%m-%d"),
                                "time": ride.time,
                                "available_seats": ride.available_seats,
                                "estimated_cost": ride.estimated_cost,
                                "status": "active",
                                "pickup_point": ride.pickup_point,
                                "is_recurring": False,  # Instance is not recurring itself
                                "recurrence_pattern": None,
                                "parent_ride_id": parent_ride_id,
                                "created_at": datetime.now(timezone.utc).isoformat()
                            }
                            rec_result = rides_collection.insert_one(recurring_ride)
                            recurring_ride["_id"] = rec_result.inserted_id
                            created_rides.append(serialize_ride(recurring_ride))
            except ValueError:
                pass  # Invalid date format, skip recurring
    
    return {
        "message": f"Ride created successfully{' with ' + str(len(created_rides) - 1) + ' recurring instances' if len(created_rides) > 1 else ''}",
        "ride": created_rides[0],
        "recurring_rides_created": len(created_rides) - 1
    }

@app.get("/api/rides")
async def get_rides(
    destination: Optional[str] = None,
    source: Optional[str] = None,
    date: Optional[str] = None,
    # Phase 5: Smart matching parameters
    time_window: Optional[int] = None,  # Time window in minutes (15, 30, 60)
    preferred_time: Optional[str] = None,  # HH:MM format
    pickup_point: Optional[str] = None,
    # Phase 7: Community and event filters
    event_tag: Optional[str] = None,
    branch: Optional[str] = None,
    academic_year: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"status": "active"}
    
    # Basic filters
    if date:
        query["date"] = date
    if pickup_point:
        query["pickup_point"] = pickup_point
    # Phase 7: Event tag filter
    if event_tag:
        query["event_tag"] = event_tag
    
    rides = list(rides_collection.find(query).sort("created_at", -1))
    serialized_rides = []
    recommended_rides = []
    
    # Phase 5: Smart matching helper functions
    def calculate_route_score(ride, src_keyword, dest_keyword):
        """Calculate route similarity score (0-100)"""
        score = 0
        if src_keyword:
            src_lower = src_keyword.lower()
            ride_src_lower = ride["source"].lower()
            if src_lower in ride_src_lower or ride_src_lower in src_lower:
                score += 50
            elif any(word in ride_src_lower for word in src_lower.split()):
                score += 25
        
        if dest_keyword:
            dest_lower = dest_keyword.lower()
            ride_dest_lower = ride["destination"].lower()
            if dest_lower in ride_dest_lower or ride_dest_lower in dest_lower:
                score += 50
            elif any(word in ride_dest_lower for word in dest_lower.split()):
                score += 25
        
        return score
    
    def calculate_time_diff_minutes(ride_time, preferred):
        """Calculate time difference in minutes"""
        try:
            ride_parts = ride_time.split(":")
            pref_parts = preferred.split(":")
            ride_mins = int(ride_parts[0]) * 60 + int(ride_parts[1])
            pref_mins = int(pref_parts[0]) * 60 + int(pref_parts[1])
            return abs(ride_mins - pref_mins)
        except:
            return 9999
    
    for ride in rides:
        serialized = serialize_ride(ride)
        
        # Only show rides with available seats
        if serialized["seats_available"] <= 0:
            continue
        
        # Phase 7: Filter by driver's branch/academic year
        if branch and serialized.get("driver_branch") != branch:
            continue
        if academic_year and serialized.get("driver_academic_year") != academic_year:
            continue
        
        # Phase 5: Calculate match score
        route_score = 0
        time_diff = None
        is_recommended = False
        
        # Route-based matching
        if source or destination:
            route_score = calculate_route_score(ride, source, destination)
            if route_score >= 50:
                is_recommended = True
        
        # Time window matching
        if preferred_time and time_window:
            time_diff = calculate_time_diff_minutes(ride["time"], preferred_time)
            if time_diff <= time_window:
                is_recommended = True
                serialized["time_diff_minutes"] = time_diff
            else:
                # Skip rides outside time window if strict filtering
                continue
        elif preferred_time:
            time_diff = calculate_time_diff_minutes(ride["time"], preferred_time)
            serialized["time_diff_minutes"] = time_diff
        
        serialized["route_score"] = route_score
        serialized["is_recommended"] = is_recommended
        
        if is_recommended:
            recommended_rides.append(serialized)
        else:
            serialized_rides.append(serialized)
    
    # Sort recommended rides by score (higher first), then by time diff (lower first)
    recommended_rides.sort(key=lambda x: (-x.get("route_score", 0), x.get("time_diff_minutes", 9999)))
    
    # Combine: recommended first, then rest
    all_rides = recommended_rides + serialized_rides
    
    return {
        "rides": all_rides,
        "recommended_count": len(recommended_rides),
        "total_count": len(all_rides)
    }

# Phase 5: Get available pickup points
@app.get("/api/pickup-points")
async def get_pickup_points():
    """Get list of RVCE campus pickup points"""
    return {"pickup_points": PICKUP_POINTS}

# Phase 5: Get recurrence patterns
@app.get("/api/recurrence-patterns")
async def get_recurrence_patterns():
    """Get available recurrence patterns for recurring rides"""
    return {"patterns": RECURRENCE_PATTERNS}

@app.get("/api/rides/{ride_id}")
async def get_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    try:
        ride = rides_collection.find_one({"_id": ObjectId(ride_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ride ID")
    
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    return {"ride": serialize_ride(ride)}

@app.get("/api/rides/driver/my-rides")
async def get_my_rides(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can access this endpoint")
    
    rides = list(rides_collection.find({"driver_id": current_user["id"]}).sort("created_at", -1))
    return {"rides": [serialize_ride(ride) for ride in rides]}

@app.put("/api/rides/{ride_id}")
async def update_ride(ride_id: str, ride: RideUpdate, current_user: dict = Depends(get_current_user)):
    try:
        existing_ride = rides_collection.find_one({"_id": ObjectId(ride_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ride ID")
    
    if not existing_ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if existing_ride["driver_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only update your own rides")
    
    update_data = {}
    if ride.source:
        update_data["source"] = ride.source
    if ride.destination:
        update_data["destination"] = ride.destination
    if ride.source_lat is not None:
        update_data["source_lat"] = ride.source_lat
    if ride.source_lng is not None:
        update_data["source_lng"] = ride.source_lng
    if ride.destination_lat is not None:
        update_data["destination_lat"] = ride.destination_lat
    if ride.destination_lng is not None:
        update_data["destination_lng"] = ride.destination_lng
    if ride.date:
        update_data["date"] = ride.date
    if ride.time:
        update_data["time"] = ride.time
    if ride.available_seats is not None:
        update_data["available_seats"] = ride.available_seats
    if ride.estimated_cost is not None:
        update_data["estimated_cost"] = ride.estimated_cost
    
    if update_data:
        rides_collection.update_one({"_id": ObjectId(ride_id)}, {"$set": update_data})
    
    updated_ride = rides_collection.find_one({"_id": ObjectId(ride_id)})
    return {"message": "Ride updated", "ride": serialize_ride(updated_ride)}

@app.delete("/api/rides/{ride_id}")
async def delete_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    try:
        existing_ride = rides_collection.find_one({"_id": ObjectId(ride_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ride ID")
    
    if not existing_ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if existing_ride["driver_id"] != current_user["id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="You can only delete your own rides")
    
    rides_collection.delete_one({"_id": ObjectId(ride_id)})
    ride_requests_collection.delete_many({"ride_id": ride_id})
    chat_messages_collection.delete_many({"ride_id": ride_id})  # Phase 3: Delete chat messages
    
    return {"message": "Ride deleted successfully"}

@app.put("/api/rides/{ride_id}/complete")
async def complete_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    try:
        existing_ride = rides_collection.find_one({"_id": ObjectId(ride_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ride ID")
    
    if not existing_ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if existing_ride["driver_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the driver can complete this ride")
    
    rides_collection.update_one({"_id": ObjectId(ride_id)}, {"$set": {"status": "completed"}})
    
    # Update all accepted/ongoing requests to completed
    ride_requests_collection.update_many(
        {"ride_id": ride_id, "status": {"$in": ["accepted", "ongoing"]}},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    updated_ride = rides_collection.find_one({"_id": ObjectId(ride_id)})
    return {"message": "Ride completed", "ride": serialize_ride(updated_ride)}

# Ride Request endpoints
@app.post("/api/ride-requests")
async def create_ride_request(request: RideRequestCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "rider":
        raise HTTPException(status_code=403, detail="Only riders can request rides")
    
    # Check verification status
    if current_user.get("verification_status") != "verified":
        raise HTTPException(status_code=403, detail="Only verified users can request rides. Please complete ID verification first.")
    
    try:
        ride = rides_collection.find_one({"_id": ObjectId(request.ride_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ride ID")
    
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride["status"] != "active":
        raise HTTPException(status_code=400, detail="This ride is no longer active")
    
    # Phase 5: Validate urgent request - must be for rides within active time window (next 60 mins)
    if request.is_urgent:
        try:
            ride_datetime_str = f"{ride['date']} {ride['time']}"
            ride_datetime = datetime.strptime(ride_datetime_str, "%Y-%m-%d %H:%M")
            now = datetime.now()
            time_diff = (ride_datetime - now).total_seconds() / 60  # minutes
            
            # Urgent requests only valid for rides starting within 60 minutes
            if time_diff > 60 or time_diff < -10:  # Allow 10 min past for flexibility
                raise HTTPException(
                    status_code=400, 
                    detail="Urgent requests can only be made for rides starting within the next 60 minutes"
                )
        except ValueError:
            pass  # If date parsing fails, allow the request
    
    # Check if already requested
    existing_request = ride_requests_collection.find_one({
        "ride_id": request.ride_id,
        "rider_id": current_user["id"]
    })
    
    if existing_request:
        raise HTTPException(status_code=400, detail="You have already requested this ride")
    
    # Check seat availability
    accepted_count = ride_requests_collection.count_documents({
        "ride_id": request.ride_id,
        "status": {"$in": ["accepted", "ongoing"]}
    })
    
    if accepted_count >= ride["available_seats"]:
        raise HTTPException(status_code=400, detail="No seats available")
    
    new_request = {
        "ride_id": request.ride_id,
        "rider_id": current_user["id"],
        "status": "requested",
        "ride_pin": None,  # Phase 3: PIN will be generated on acceptance
        "is_urgent": request.is_urgent,  # Phase 5: Urgent/instant ride flag
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = ride_requests_collection.insert_one(new_request)
    new_request["_id"] = result.inserted_id
    
    return {
        "message": "Urgent ride request submitted! Driver will be notified." if request.is_urgent else "Ride request submitted",
        "request": serialize_ride_request(new_request)
    }

@app.get("/api/ride-requests/my-requests")
async def get_my_requests(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "rider":
        raise HTTPException(status_code=403, detail="Only riders can access this endpoint")
    
    requests = list(ride_requests_collection.find({"rider_id": current_user["id"]}).sort("created_at", -1))
    return {"requests": [serialize_ride_request(req) for req in requests]}

@app.get("/api/ride-requests/ride/{ride_id}")
async def get_ride_requests(ride_id: str, current_user: dict = Depends(get_current_user)):
    try:
        ride = rides_collection.find_one({"_id": ObjectId(ride_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ride ID")
    
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride["driver_id"] != current_user["id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="You can only view requests for your own rides")
    
    requests = list(ride_requests_collection.find({"ride_id": ride_id}).sort("created_at", -1))
    return {"requests": [serialize_ride_request(req) for req in requests]}

@app.get("/api/ride-requests/driver/pending")
async def get_driver_pending_requests(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can access this endpoint")
    
    # Get all rides by this driver
    driver_rides = list(rides_collection.find({"driver_id": current_user["id"]}))
    ride_ids = [str(ride["_id"]) for ride in driver_rides]
    
    # Get pending requests for these rides
    requests = list(ride_requests_collection.find({
        "ride_id": {"$in": ride_ids},
        "status": "requested"
    }).sort("created_at", -1))
    
    return {"requests": [serialize_ride_request(req) for req in requests]}

# Phase 3: Get driver's accepted requests (for managing ongoing rides)
@app.get("/api/ride-requests/driver/accepted")
async def get_driver_accepted_requests(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can access this endpoint")
    
    # Get all rides by this driver
    driver_rides = list(rides_collection.find({"driver_id": current_user["id"]}))
    ride_ids = [str(ride["_id"]) for ride in driver_rides]
    
    # Get accepted and ongoing requests for these rides
    requests = list(ride_requests_collection.find({
        "ride_id": {"$in": ride_ids},
        "status": {"$in": ["accepted", "ongoing"]}
    }).sort("created_at", -1))
    
    return {"requests": [serialize_ride_request(req) for req in requests]}

@app.put("/api/ride-requests/{request_id}")
async def handle_ride_request(request_id: str, action: RideRequestAction, current_user: dict = Depends(get_current_user)):
    try:
        ride_request = ride_requests_collection.find_one({"_id": ObjectId(request_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    if not ride_request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    ride = rides_collection.find_one({"_id": ObjectId(ride_request["ride_id"])})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride["driver_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the driver can handle this request")
    
    if ride_request["status"] != "requested":
        raise HTTPException(status_code=400, detail="Request already processed")
    
    new_status = "accepted" if action.action == "accept" else "rejected"
    
    # Check seat availability for acceptance
    if action.action == "accept":
        accepted_count = ride_requests_collection.count_documents({
            "ride_id": ride_request["ride_id"],
            "status": {"$in": ["accepted", "ongoing"]}
        })
        if accepted_count >= ride["available_seats"]:
            raise HTTPException(status_code=400, detail="No seats available")
    
    update_data = {"status": new_status}
    
    # Phase 3: Generate PIN when accepting
    if action.action == "accept":
        update_data["ride_pin"] = generate_ride_pin()
        update_data["accepted_at"] = datetime.now(timezone.utc).isoformat()
    
    ride_requests_collection.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": update_data}
    )
    
    updated_request = ride_requests_collection.find_one({"_id": ObjectId(request_id)})
    return {"message": f"Request {new_status}", "request": serialize_ride_request(updated_request)}

# Phase 3: Start Ride with PIN verification
@app.post("/api/ride-requests/{request_id}/start")
async def start_ride(request_id: str, pin_data: StartRideRequest, current_user: dict = Depends(get_current_user)):
    """Start ride after PIN verification - Driver only"""
    try:
        ride_request = ride_requests_collection.find_one({"_id": ObjectId(request_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    if not ride_request:
        raise HTTPException(status_code=404, detail="Ride request not found")
    
    ride = rides_collection.find_one({"_id": ObjectId(ride_request["ride_id"])})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Only driver can start the ride
    if ride["driver_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the driver can start this ride")
    
    # Check if request is in accepted status
    if ride_request["status"] != "accepted":
        if ride_request["status"] == "ongoing":
            raise HTTPException(status_code=400, detail="Ride has already started")
        raise HTTPException(status_code=400, detail="Ride request must be accepted before starting")
    
    # Verify PIN
    if ride_request.get("ride_pin") != pin_data.pin:
        raise HTTPException(status_code=400, detail="Incorrect PIN. Please verify with the rider.")
    
    # Update request status to ongoing
    ride_requests_collection.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {
            "status": "ongoing",
            "ride_started_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    updated_request = ride_requests_collection.find_one({"_id": ObjectId(request_id)})
    return {"message": "Ride started successfully!", "request": serialize_ride_request(updated_request)}

# Phase 3: Chat endpoints
@app.get("/api/chat/{request_id}/messages")
async def get_chat_messages(request_id: str, current_user: dict = Depends(get_current_user)):
    """Get chat messages for a ride request - Only participants can access"""
    try:
        ride_request = ride_requests_collection.find_one({"_id": ObjectId(request_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    if not ride_request:
        raise HTTPException(status_code=404, detail="Ride request not found")
    
    ride = rides_collection.find_one({"_id": ObjectId(ride_request["ride_id"])})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Check if user is participant (rider or driver) or admin
    is_rider = ride_request["rider_id"] == current_user["id"]
    is_driver = ride["driver_id"] == current_user["id"]
    is_admin = current_user.get("is_admin", False)
    
    if not (is_rider or is_driver or is_admin):
        raise HTTPException(status_code=403, detail="Only ride participants can access chat")
    
    # Chat only available after acceptance
    if ride_request["status"] == "requested" or ride_request["status"] == "rejected":
        raise HTTPException(status_code=403, detail="Chat is only available after ride acceptance")
    
    messages = list(chat_messages_collection.find({"ride_request_id": request_id}).sort("created_at", 1))
    
    return {
        "messages": [serialize_chat_message(msg) for msg in messages],
        "chat_enabled": ride_request["status"] in ["accepted", "ongoing"],  # Disable after completion
        "request_status": ride_request["status"]
    }

@app.post("/api/chat/{request_id}/messages")
async def send_chat_message(request_id: str, chat_data: ChatMessage, current_user: dict = Depends(get_current_user)):
    """Send a chat message - Only participants can send"""
    try:
        ride_request = ride_requests_collection.find_one({"_id": ObjectId(request_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    if not ride_request:
        raise HTTPException(status_code=404, detail="Ride request not found")
    
    ride = rides_collection.find_one({"_id": ObjectId(ride_request["ride_id"])})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Check if user is participant
    is_rider = ride_request["rider_id"] == current_user["id"]
    is_driver = ride["driver_id"] == current_user["id"]
    
    if not (is_rider or is_driver):
        raise HTTPException(status_code=403, detail="Only ride participants can send messages")
    
    # Chat only available after acceptance and before completion
    if ride_request["status"] not in ["accepted", "ongoing"]:
        if ride_request["status"] == "completed":
            raise HTTPException(status_code=403, detail="Chat is disabled after ride completion")
        raise HTTPException(status_code=403, detail="Chat is only available after ride acceptance")
    
    new_message = {
        "ride_request_id": request_id,
        "ride_id": ride_request["ride_id"],
        "sender_id": current_user["id"],
        "message": chat_data.message,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = chat_messages_collection.insert_one(new_message)
    new_message["_id"] = result.inserted_id
    
    return {"message": "Message sent", "chat_message": serialize_chat_message(new_message)}

# Admin endpoints
@app.get("/api/admin/users")
async def admin_get_users(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = list(users_collection.find({}, {"password": 0}))
    return {"users": [serialize_user(user) for user in users]}

@app.get("/api/admin/rides")
async def admin_get_rides(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    rides = list(rides_collection.find().sort("created_at", -1))
    return {"rides": [serialize_ride(ride) for ride in rides]}

# Verification endpoints
@app.post("/api/verification/upload")
async def upload_verification(data: VerificationUpload, current_user: dict = Depends(get_current_user)):
    """Upload student ID for verification"""
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admins do not need verification")
    
    # Validate base64 image
    try:
        # Check if it's a valid base64 string with data URL prefix
        if not data.student_id_image.startswith("data:image/"):
            raise HTTPException(status_code=400, detail="Invalid image format. Please upload a valid image.")
        
        # Extract the base64 part and validate
        base64_part = data.student_id_image.split(",")[1] if "," in data.student_id_image else data.student_id_image
        base64.b64decode(base64_part)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid image data")
    
    # Update user with verification data
    users_collection.update_one(
        {"_id": ObjectId(current_user["id"])},
        {
            "$set": {
                "student_id_image": data.student_id_image,
                "verification_status": "pending",
                "rejection_reason": None,
                "submitted_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Student ID uploaded successfully. Awaiting admin verification."}

@app.get("/api/verification/status")
async def get_verification_status(current_user: dict = Depends(get_current_user)):
    """Get current user's verification status"""
    user = users_collection.find_one({"_id": ObjectId(current_user["id"])}, {"password": 0})
    
    return {
        "verification_status": user.get("verification_status", "unverified"),
        "rejection_reason": user.get("rejection_reason"),
        "verified_at": user.get("verified_at"),
        "submitted_at": user.get("submitted_at"),
        "has_uploaded_id": user.get("student_id_image") is not None
    }

@app.get("/api/admin/verifications")
async def get_pending_verifications(current_user: dict = Depends(get_current_user)):
    """Get all pending verification requests - Admin only"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get all users with pending verification
    pending_users = list(users_collection.find(
        {"verification_status": "pending"},
        {"password": 0}
    ).sort("submitted_at", -1))
    
    result = []
    for user in pending_users:
        result.append({
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "student_id_image": user.get("student_id_image"),
            "submitted_at": user.get("submitted_at"),
            "created_at": user.get("created_at")
        })
    
    return {"verifications": result}

@app.get("/api/admin/verifications/all")
async def get_all_verifications(current_user: dict = Depends(get_current_user)):
    """Get all verification records - Admin only"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get all non-admin users
    all_users = list(users_collection.find(
        {"is_admin": {"$ne": True}},
        {"password": 0}
    ).sort("submitted_at", -1))
    
    result = []
    for user in all_users:
        result.append({
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "verification_status": user.get("verification_status", "unverified"),
            "student_id_image": user.get("student_id_image"),
            "rejection_reason": user.get("rejection_reason"),
            "submitted_at": user.get("submitted_at"),
            "verified_at": user.get("verified_at"),
            "created_at": user.get("created_at")
        })
    
    return {"verifications": result}

@app.put("/api/admin/verifications/{user_id}")
async def handle_verification(user_id: str, action: VerificationAction, current_user: dict = Depends(get_current_user)):
    """Approve or reject a verification request - Admin only"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if action.action == "approve":
        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "verification_status": "verified",
                    "verified_at": datetime.now(timezone.utc).isoformat(),
                    "rejection_reason": None,
                    "verified_by": current_user["id"]
                }
            }
        )
        # Phase 8: Log admin action
        log_admin_action(
            admin_id=current_user["id"],
            admin_name=current_user["name"],
            action_type="verification_approved",
            target_type="user",
            target_id=user_id,
            details={"user_name": user["name"]}
        )
        return {"message": f"User {user['name']} has been verified successfully"}
    
    elif action.action == "reject":
        if not action.reason:
            raise HTTPException(status_code=400, detail="Rejection reason is required")
        
        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "verification_status": "rejected",
                    "rejection_reason": action.reason,
                    "verified_at": None,
                    "rejected_by": current_user["id"]
                }
            }
        )
        # Phase 8: Log admin action
        log_admin_action(
            admin_id=current_user["id"],
            admin_name=current_user["name"],
            action_type="verification_rejected",
            target_type="user",
            target_id=user_id,
            details={"user_name": user["name"], "reason": action.reason}
        )
        return {"message": f"User {user['name']}'s verification has been rejected"}

# Public profile endpoint
@app.get("/api/users/{user_id}/profile")
async def get_user_profile(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get public profile of a user (limited info)"""
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)}, {"password": 0, "student_id_image": 0})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Count completed rides
    ride_count = 0
    if user.get("role") == "driver":
        ride_count = rides_collection.count_documents({
            "driver_id": user_id,
            "status": "completed"
        })
    else:
        ride_count = ride_requests_collection.count_documents({
            "rider_id": user_id,
            "status": "completed"
        })
    
    # Phase 6: Get rating statistics
    rating_stats = get_user_rating_stats(user_id)
    trust_level = calculate_trust_level(rating_stats["average_rating"], ride_count)
    
    # Phase 7: Get branch and academic year names
    branch_name = get_branch_name(user.get("branch"))
    academic_year_name = get_academic_year_name(user.get("academic_year"))
    
    # Phase 7: Check for mutual academic details with current user
    mutual_info = {}
    if user.get("branch") and user.get("branch") == current_user.get("branch"):
        mutual_info["same_branch"] = True
        mutual_info["branch_name"] = branch_name
    if user.get("academic_year") and user.get("academic_year") == current_user.get("academic_year"):
        mutual_info["same_year"] = True
        mutual_info["year_name"] = academic_year_name
    
    # Return limited public info
    return {
        "profile": {
            "id": str(user["_id"]),
            "name": user["name"],
            "role": user["role"],
            "verification_status": user.get("verification_status", "unverified"),
            "ride_count": ride_count,
            "created_at": user.get("created_at"),
            # Phase 6: Rating and Trust info
            "average_rating": rating_stats["average_rating"],
            "total_ratings": rating_stats["total_ratings"],
            "trust_level": trust_level,
            # Phase 7: Community info
            "branch": user.get("branch"),
            "branch_name": branch_name,
            "academic_year": user.get("academic_year"),
            "academic_year_name": academic_year_name,
            "mutual_info": mutual_info if mutual_info else None,
            # Phase 7: Badges
            "badges": calculate_user_badges(user_id, ride_count)
        }
    }

# ============================================
# Phase 4: Live Ride & Safety Endpoints
# ============================================

@app.get("/api/ride-requests/{request_id}/live")
async def get_live_ride_details(request_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed ride information for live ride screen"""
    try:
        ride_request = ride_requests_collection.find_one({"_id": ObjectId(request_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    if not ride_request:
        raise HTTPException(status_code=404, detail="Ride request not found")
    
    ride = rides_collection.find_one({"_id": ObjectId(ride_request["ride_id"])})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Check authorization - only participants can view
    is_rider = ride_request["rider_id"] == current_user["id"]
    is_driver = ride["driver_id"] == current_user["id"]
    is_admin = current_user.get("is_admin", False)
    
    if not (is_rider or is_driver or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to view this ride")
    
    # Check if there's an active SOS for this ride
    active_sos = sos_events_collection.find_one({
        "ride_request_id": request_id,
        "status": {"$in": ["active", "reviewed"]}
    })
    
    serialized = serialize_ride_request(ride_request)
    serialized["has_active_sos"] = active_sos is not None
    serialized["sos_id"] = str(active_sos["_id"]) if active_sos else None
    
    return {"ride": serialized}

@app.post("/api/ride-requests/{request_id}/reached-safely")
async def mark_reached_safely(request_id: str, current_user: dict = Depends(get_current_user)):
    """Rider confirms safe arrival - marks ride as completed"""
    try:
        ride_request = ride_requests_collection.find_one({"_id": ObjectId(request_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    if not ride_request:
        raise HTTPException(status_code=404, detail="Ride request not found")
    
    # Only the rider can mark reached safely
    if ride_request["rider_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the rider can confirm safe arrival")
    
    # Must be in ongoing status
    if ride_request["status"] != "ongoing":
        if ride_request["status"] == "completed":
            raise HTTPException(status_code=400, detail="Ride is already completed")
        raise HTTPException(status_code=400, detail="Ride must be ongoing to mark as completed")
    
    # Update ride request to completed
    now = datetime.now(timezone.utc).isoformat()
    ride_requests_collection.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {
            "status": "completed",
            "reached_safely_at": now,
            "completed_at": now
        }}
    )
    
    # Check if all requests for this ride are completed
    ride_id = ride_request["ride_id"]
    pending_requests = ride_requests_collection.count_documents({
        "ride_id": ride_id,
        "status": {"$in": ["accepted", "ongoing"]}
    })
    
    # If no more active requests, mark the ride as completed
    if pending_requests == 0:
        rides_collection.update_one(
            {"_id": ObjectId(ride_id)},
            {"$set": {"status": "completed"}}
        )
    
    updated_request = ride_requests_collection.find_one({"_id": ObjectId(request_id)})
    return {
        "message": "Arrived safely! Ride completed.",
        "request": serialize_ride_request(updated_request)
    }

@app.post("/api/sos")
async def trigger_sos(sos_data: SOSCreate, current_user: dict = Depends(get_current_user)):
    """Trigger SOS emergency during an ongoing ride"""
    try:
        ride_request = ride_requests_collection.find_one({"_id": ObjectId(sos_data.ride_request_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ride request ID")
    
    if not ride_request:
        raise HTTPException(status_code=404, detail="Ride request not found")
    
    ride = rides_collection.find_one({"_id": ObjectId(ride_request["ride_id"])})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Only participants can trigger SOS
    is_rider = ride_request["rider_id"] == current_user["id"]
    is_driver = ride["driver_id"] == current_user["id"]
    
    if not (is_rider or is_driver):
        raise HTTPException(status_code=403, detail="Only ride participants can trigger SOS")
    
    # Must be ongoing ride
    if ride_request["status"] != "ongoing":
        raise HTTPException(status_code=400, detail="SOS can only be triggered during an ongoing ride")
    
    # Check if there's already an active SOS for this ride
    existing_sos = sos_events_collection.find_one({
        "ride_request_id": sos_data.ride_request_id,
        "status": {"$in": ["active", "reviewed"]}
    })
    
    if existing_sos:
        raise HTTPException(status_code=400, detail="An SOS alert is already active for this ride")
    
    # Create SOS event
    new_sos = {
        "ride_request_id": sos_data.ride_request_id,
        "ride_id": ride_request["ride_id"],
        "triggered_by": current_user["id"],
        "triggered_by_role": current_user["role"],
        "latitude": sos_data.latitude,
        "longitude": sos_data.longitude,
        "message": sos_data.message,
        "status": "active",
        "admin_notes": None,
        "reviewed_at": None,
        "resolved_at": None,
        "resolved_by": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = sos_events_collection.insert_one(new_sos)
    new_sos["_id"] = result.inserted_id
    
    return {
        "message": "SOS alert triggered! Help is on the way.",
        "sos": serialize_sos_event(new_sos)
    }

@app.get("/api/sos/my-active")
async def get_my_active_sos(current_user: dict = Depends(get_current_user)):
    """Get user's active SOS events"""
    active_sos = list(sos_events_collection.find({
        "triggered_by": current_user["id"],
        "status": {"$in": ["active", "reviewed"]}
    }).sort("created_at", -1))
    
    return {"sos_events": [serialize_sos_event(sos) for sos in active_sos]}

@app.get("/api/admin/sos")
async def admin_get_sos_events(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Admin: Get all SOS events"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if status:
        query["status"] = status
    
    sos_events = list(sos_events_collection.find(query).sort("created_at", -1))
    
    # Get counts for dashboard
    active_count = sos_events_collection.count_documents({"status": "active"})
    reviewed_count = sos_events_collection.count_documents({"status": "reviewed"})
    resolved_count = sos_events_collection.count_documents({"status": "resolved"})
    
    return {
        "sos_events": [serialize_sos_event(sos) for sos in sos_events],
        "counts": {
            "active": active_count,
            "reviewed": reviewed_count,
            "resolved": resolved_count,
            "total": active_count + reviewed_count + resolved_count
        }
    }

@app.put("/api/admin/sos/{sos_id}")
async def admin_update_sos(
    sos_id: str,
    action: SOSAction,
    current_user: dict = Depends(get_current_user)
):
    """Admin: Update SOS event status"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        sos = sos_events_collection.find_one({"_id": ObjectId(sos_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid SOS ID")
    
    if not sos:
        raise HTTPException(status_code=404, detail="SOS event not found")
    
    now = datetime.now(timezone.utc).isoformat()
    update_data = {}
    
    if action.action == "review":
        update_data = {
            "status": "under_review",
            "reviewed_at": now,
            "reviewed_by": current_user["id"],
            "admin_notes": action.notes
        }
        message = "SOS marked as under review"
    elif action.action == "resolve":
        update_data = {
            "status": "resolved",
            "resolved_at": now,
            "resolved_by": current_user["id"],
            "admin_notes": action.notes or sos.get("admin_notes")
        }
        message = "SOS resolved successfully"
    
    sos_events_collection.update_one(
        {"_id": ObjectId(sos_id)},
        {"$set": update_data}
    )
    
    # Phase 8: Log admin action
    log_admin_action(
        admin_id=current_user["id"],
        admin_name=current_user["name"],
        action_type=f"sos_{action.action}",
        target_type="sos",
        target_id=sos_id,
        details={"previous_status": sos.get("status"), "notes": action.notes}
    )
    
    updated_sos = sos_events_collection.find_one({"_id": ObjectId(sos_id)})
    return {"message": message, "sos": serialize_sos_event(updated_sos)}

# Update admin stats to include SOS counts
@app.get("/api/admin/stats")
async def admin_get_stats(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_users = users_collection.count_documents({})
    total_riders = users_collection.count_documents({"role": "rider"})
    total_drivers = users_collection.count_documents({"role": "driver"})
    total_rides = rides_collection.count_documents({})
    active_rides = rides_collection.count_documents({"status": "active"})
    completed_rides = rides_collection.count_documents({"status": "completed"})
    total_requests = ride_requests_collection.count_documents({})
    pending_requests = ride_requests_collection.count_documents({"status": "requested"})
    ongoing_rides = ride_requests_collection.count_documents({"status": "ongoing"})
    
    # Verification stats
    verified_users = users_collection.count_documents({"verification_status": "verified"})
    pending_verifications = users_collection.count_documents({"verification_status": "pending"})
    unverified_users = users_collection.count_documents({"verification_status": "unverified"})
    rejected_verifications = users_collection.count_documents({"verification_status": "rejected"})
    
    # Phase 4: SOS stats
    active_sos = sos_events_collection.count_documents({"status": "active"})
    total_sos = sos_events_collection.count_documents({})
    
    # Phase 8: Report stats
    pending_reports = reports_collection.count_documents({"status": "pending"})
    total_reports = reports_collection.count_documents({})
    
    return {
        "stats": {
            "total_users": total_users,
            "total_riders": total_riders,
            "total_drivers": total_drivers,
            "total_rides": total_rides,
            "active_rides": active_rides,
            "completed_rides": completed_rides,
            "ongoing_rides": ongoing_rides,
            "total_requests": total_requests,
            "pending_requests": pending_requests,
            "verified_users": verified_users,
            "pending_verifications": pending_verifications,
            "unverified_users": unverified_users,
            "rejected_verifications": rejected_verifications,
            # Phase 4
            "active_sos": active_sos,
            "total_sos": total_sos,
            # Phase 8
            "pending_reports": pending_reports,
            "total_reports": total_reports
        }
    }

# ==========================================
# Phase 6: Feedback, History & Trust Loop
# ==========================================

# Phase 6: Submit rating after ride completion
@app.post("/api/ratings")
async def submit_rating(rating_data: RatingCreate, current_user: dict = Depends(get_current_user)):
    """Submit a rating for a completed ride"""
    try:
        ride_request = ride_requests_collection.find_one({"_id": ObjectId(rating_data.ride_request_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ride request ID")
    
    if not ride_request:
        raise HTTPException(status_code=404, detail="Ride request not found")
    
    # Verify the ride is completed
    if ride_request["status"] != "completed":
        raise HTTPException(status_code=400, detail="Can only rate completed rides")
    
    ride = rides_collection.find_one({"_id": ObjectId(ride_request["ride_id"])})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Determine who is rating whom
    rider_id = ride_request["rider_id"]
    driver_id = ride["driver_id"]
    
    if current_user["id"] == rider_id:
        # Rider is rating the driver
        rated_user_id = driver_id
        rater_role = "rider"
    elif current_user["id"] == driver_id:
        # Driver is rating the rider
        rated_user_id = rider_id
        rater_role = "driver"
    else:
        raise HTTPException(status_code=403, detail="You were not part of this ride")
    
    # Check for duplicate rating (one rating per ride per rater)
    existing_rating = ratings_collection.find_one({
        "ride_request_id": rating_data.ride_request_id,
        "rater_id": current_user["id"]
    })
    
    if existing_rating:
        raise HTTPException(status_code=400, detail="You have already rated this ride")
    
    # Create the rating
    new_rating = {
        "ride_request_id": rating_data.ride_request_id,
        "ride_id": ride_request["ride_id"],
        "rater_id": current_user["id"],
        "rater_role": rater_role,
        "rated_user_id": rated_user_id,
        "rating": rating_data.rating,
        "feedback": rating_data.feedback,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = ratings_collection.insert_one(new_rating)
    new_rating["id"] = str(result.inserted_id)
    
    # Get updated rating stats for the rated user
    rated_user_stats = get_user_rating_stats(rated_user_id)
    
    return {
        "message": "Rating submitted successfully",
        "rating": {
            "id": str(result.inserted_id),
            "rating": rating_data.rating,
            "feedback": rating_data.feedback,
            "created_at": new_rating["created_at"]
        },
        "rated_user_new_average": rated_user_stats["average_rating"]
    }

# Phase 6: Check if user can rate a specific ride
@app.get("/api/ratings/can-rate/{ride_request_id}")
async def can_rate_ride(ride_request_id: str, current_user: dict = Depends(get_current_user)):
    """Check if current user can rate this ride"""
    try:
        ride_request = ride_requests_collection.find_one({"_id": ObjectId(ride_request_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ride request ID")
    
    if not ride_request:
        return {"can_rate": False, "reason": "Ride request not found"}
    
    # Check if ride is completed
    if ride_request["status"] != "completed":
        return {"can_rate": False, "reason": "Ride is not completed"}
    
    ride = rides_collection.find_one({"_id": ObjectId(ride_request["ride_id"])})
    if not ride:
        return {"can_rate": False, "reason": "Ride not found"}
    
    # Check if user is part of this ride
    rider_id = ride_request["rider_id"]
    driver_id = ride["driver_id"]
    
    if current_user["id"] not in [rider_id, driver_id]:
        return {"can_rate": False, "reason": "Not part of this ride"}
    
    # Check if already rated
    existing_rating = ratings_collection.find_one({
        "ride_request_id": ride_request_id,
        "rater_id": current_user["id"]
    })
    
    if existing_rating:
        return {"can_rate": False, "reason": "Already rated", "existing_rating": existing_rating["rating"]}
    
    # Determine who would be rated
    if current_user["id"] == rider_id:
        rated_user = users_collection.find_one({"_id": ObjectId(driver_id)}, {"password": 0})
        rated_role = "driver"
    else:
        rated_user = users_collection.find_one({"_id": ObjectId(rider_id)}, {"password": 0})
        rated_role = "rider"
    
    return {
        "can_rate": True,
        "rated_user_id": str(rated_user["_id"]) if rated_user else None,
        "rated_user_name": rated_user["name"] if rated_user else "Unknown",
        "rated_role": rated_role
    }

# Phase 6: Get ratings for a specific user
@app.get("/api/users/{user_id}/ratings")
async def get_user_ratings(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get aggregated ratings for a user"""
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)}, {"password": 0})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    rating_stats = get_user_rating_stats(user_id)
    
    # Count completed rides
    ride_count = 0
    if user.get("role") == "driver":
        ride_count = rides_collection.count_documents({
            "driver_id": user_id,
            "status": "completed"
        })
    else:
        ride_count = ride_requests_collection.count_documents({
            "rider_id": user_id,
            "status": "completed"
        })
    
    trust_level = calculate_trust_level(rating_stats["average_rating"], ride_count)
    
    return {
        "user_id": user_id,
        "name": user["name"],
        "role": user["role"],
        "average_rating": rating_stats["average_rating"],
        "total_ratings": rating_stats["total_ratings"],
        "rating_distribution": rating_stats["rating_distribution"],
        "ride_count": ride_count,
        "trust_level": trust_level
    }

# Phase 6: Get ride history for current user
@app.get("/api/ride-history")
async def get_ride_history(current_user: dict = Depends(get_current_user)):
    """Get ride history for the current user"""
    user_id = current_user["id"]
    user_role = current_user["role"]
    
    history = []
    
    if user_role == "driver":
        # Get all completed rides by this driver
        rides = list(rides_collection.find({
            "driver_id": user_id,
            "status": "completed"
        }).sort("created_at", -1))
        
        for ride in rides:
            # Get all completed requests for this ride
            requests = list(ride_requests_collection.find({
                "ride_id": str(ride["_id"]),
                "status": "completed"
            }))
            
            for req in requests:
                rider = users_collection.find_one({"_id": ObjectId(req["rider_id"])}, {"password": 0})
                
                # Check if rating exists for this ride
                my_rating = ratings_collection.find_one({
                    "ride_request_id": str(req["_id"]),
                    "rater_id": user_id
                })
                their_rating = ratings_collection.find_one({
                    "ride_request_id": str(req["_id"]),
                    "rated_user_id": user_id
                })
                
                history.append({
                    "ride_request_id": str(req["_id"]),
                    "ride_id": str(ride["_id"]),
                    "role": "driver",
                    "other_user_id": req["rider_id"],
                    "other_user_name": rider["name"] if rider else "Unknown",
                    "other_user_role": "rider",
                    "source": ride["source"],
                    "destination": ride["destination"],
                    "date": ride["date"],
                    "time": ride["time"],
                    "cost": ride["estimated_cost"],
                    "completed_at": req.get("completed_at"),
                    "reached_safely_at": req.get("reached_safely_at"),
                    "my_rating": my_rating["rating"] if my_rating else None,
                    "their_rating": their_rating["rating"] if their_rating else None,
                    "can_rate": my_rating is None,
                    "pickup_point": ride.get("pickup_point")
                })
    else:
        # Rider: Get all completed ride requests
        requests = list(ride_requests_collection.find({
            "rider_id": user_id,
            "status": "completed"
        }).sort("created_at", -1))
        
        for req in requests:
            ride = rides_collection.find_one({"_id": ObjectId(req["ride_id"])})
            if not ride:
                continue
            
            driver = users_collection.find_one({"_id": ObjectId(ride["driver_id"])}, {"password": 0})
            
            # Check if rating exists
            my_rating = ratings_collection.find_one({
                "ride_request_id": str(req["_id"]),
                "rater_id": user_id
            })
            their_rating = ratings_collection.find_one({
                "ride_request_id": str(req["_id"]),
                "rated_user_id": user_id
            })
            
            history.append({
                "ride_request_id": str(req["_id"]),
                "ride_id": req["ride_id"],
                "role": "rider",
                "other_user_id": ride["driver_id"],
                "other_user_name": driver["name"] if driver else "Unknown",
                "other_user_role": "driver",
                "source": ride["source"],
                "destination": ride["destination"],
                "date": ride["date"],
                "time": ride["time"],
                "cost": ride["estimated_cost"],
                "completed_at": req.get("completed_at"),
                "reached_safely_at": req.get("reached_safely_at"),
                "my_rating": my_rating["rating"] if my_rating else None,
                "their_rating": their_rating["rating"] if their_rating else None,
                "can_rate": my_rating is None,
                "pickup_point": ride.get("pickup_point")
            })
    
    return {
        "history": history,
        "total_count": len(history)
    }

# Phase 6: Get individual ride summary
@app.get("/api/ride-history/{ride_request_id}")
async def get_ride_summary(ride_request_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed summary of a specific ride"""
    try:
        ride_request = ride_requests_collection.find_one({"_id": ObjectId(ride_request_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ride request ID")
    
    if not ride_request:
        raise HTTPException(status_code=404, detail="Ride request not found")
    
    ride = rides_collection.find_one({"_id": ObjectId(ride_request["ride_id"])})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Verify user is part of this ride
    rider_id = ride_request["rider_id"]
    driver_id = ride["driver_id"]
    
    if current_user["id"] not in [rider_id, driver_id] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="You were not part of this ride")
    
    rider = users_collection.find_one({"_id": ObjectId(rider_id)}, {"password": 0})
    driver = users_collection.find_one({"_id": ObjectId(driver_id)}, {"password": 0})
    
    # Get ratings
    rider_rating = ratings_collection.find_one({
        "ride_request_id": ride_request_id,
        "rater_id": rider_id
    })
    driver_rating = ratings_collection.find_one({
        "ride_request_id": ride_request_id,
        "rater_id": driver_id
    })
    
    # Determine current user's role in this ride
    is_rider = current_user["id"] == rider_id
    is_driver = current_user["id"] == driver_id
    
    return {
        "summary": {
            "ride_request_id": ride_request_id,
            "ride_id": str(ride["_id"]),
            "status": ride_request["status"],
            # Route info
            "source": ride["source"],
            "destination": ride["destination"],
            "pickup_point": ride.get("pickup_point"),
            "date": ride["date"],
            "time": ride["time"],
            "cost": ride["estimated_cost"],
            # Timestamps
            "created_at": ride_request.get("created_at"),
            "accepted_at": ride_request.get("accepted_at"),
            "ride_started_at": ride_request.get("ride_started_at"),
            "completed_at": ride_request.get("completed_at"),
            "reached_safely_at": ride_request.get("reached_safely_at"),
            # Participants
            "rider": {
                "id": rider_id,
                "name": rider["name"] if rider else "Unknown",
                "verification_status": rider.get("verification_status") if rider else "unverified"
            },
            "driver": {
                "id": driver_id,
                "name": driver["name"] if driver else "Unknown",
                "verification_status": driver.get("verification_status") if driver else "unverified",
                "vehicle_model": driver.get("vehicle_model") if driver else None,
                "vehicle_number": driver.get("vehicle_number") if driver else None,
                "vehicle_color": driver.get("vehicle_color") if driver else None
            },
            # Ratings
            "rider_gave_rating": rider_rating["rating"] if rider_rating else None,
            "rider_gave_feedback": rider_rating["feedback"] if rider_rating else None,
            "driver_gave_rating": driver_rating["rating"] if driver_rating else None,
            "driver_gave_feedback": driver_rating["feedback"] if driver_rating else None,
            # Current user context
            "is_rider": is_rider,
            "is_driver": is_driver,
            "can_rate": (is_rider and not rider_rating) or (is_driver and not driver_rating)
        }
    }

# Phase 6: Get pending ratings (rides completed but not yet rated)
@app.get("/api/ratings/pending")
async def get_pending_ratings(current_user: dict = Depends(get_current_user)):
    """Get list of completed rides that need rating"""
    user_id = current_user["id"]
    user_role = current_user["role"]
    
    pending = []
    
    if user_role == "driver":
        # Get completed rides by this driver
        rides = list(rides_collection.find({
            "driver_id": user_id,
            "status": "completed"
        }))
        
        for ride in rides:
            requests = list(ride_requests_collection.find({
                "ride_id": str(ride["_id"]),
                "status": "completed"
            }))
            
            for req in requests:
                # Check if already rated
                existing = ratings_collection.find_one({
                    "ride_request_id": str(req["_id"]),
                    "rater_id": user_id
                })
                
                if not existing:
                    rider = users_collection.find_one({"_id": ObjectId(req["rider_id"])}, {"password": 0})
                    pending.append({
                        "ride_request_id": str(req["_id"]),
                        "other_user_id": req["rider_id"],
                        "other_user_name": rider["name"] if rider else "Unknown",
                        "other_user_role": "rider",
                        "source": ride["source"],
                        "destination": ride["destination"],
                        "date": ride["date"],
                        "completed_at": req.get("completed_at")
                    })
    else:
        # Rider: Get completed requests
        requests = list(ride_requests_collection.find({
            "rider_id": user_id,
            "status": "completed"
        }))
        
        for req in requests:
            # Check if already rated
            existing = ratings_collection.find_one({
                "ride_request_id": str(req["_id"]),
                "rater_id": user_id
            })
            
            if not existing:
                ride = rides_collection.find_one({"_id": ObjectId(req["ride_id"])})
                if ride:
                    driver = users_collection.find_one({"_id": ObjectId(ride["driver_id"])}, {"password": 0})
                    pending.append({
                        "ride_request_id": str(req["_id"]),
                        "other_user_id": ride["driver_id"],
                        "other_user_name": driver["name"] if driver else "Unknown",
                        "other_user_role": "driver",
                        "source": ride["source"],
                        "destination": ride["destination"],
                        "date": ride["date"],
                        "completed_at": req.get("completed_at")
                    })
    
    return {
        "pending_ratings": pending,
        "count": len(pending)
    }

# Phase 6: Admin - Get all ratings (for moderation)
@app.get("/api/admin/ratings")
async def admin_get_all_ratings(
    min_rating: Optional[int] = None,
    max_rating: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Admin: Get all ratings for moderation"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if min_rating:
        query["rating"] = {"$gte": min_rating}
    if max_rating:
        if "rating" in query:
            query["rating"]["$lte"] = max_rating
        else:
            query["rating"] = {"$lte": max_rating}
    
    ratings = list(ratings_collection.find(query).sort("created_at", -1).limit(100))
    
    result = []
    for r in ratings:
        rater = users_collection.find_one({"_id": ObjectId(r["rater_id"])}, {"password": 0})
        rated = users_collection.find_one({"_id": ObjectId(r["rated_user_id"])}, {"password": 0})
        
        result.append({
            "id": str(r["_id"]),
            "rating": r["rating"],
            "feedback": r.get("feedback"),
            "rater_name": rater["name"] if rater else "Unknown",
            "rater_role": r["rater_role"],
            "rated_user_name": rated["name"] if rated else "Unknown",
            "created_at": r.get("created_at")
        })
    
    # Stats
    total_ratings = ratings_collection.count_documents({})
    low_ratings = ratings_collection.count_documents({"rating": {"$lte": 2}})
    
    return {
        "ratings": result,
        "stats": {
            "total_ratings": total_ratings,
            "low_ratings_count": low_ratings
        }
    }

# Phase 6: Admin - Get users with low trust
@app.get("/api/admin/low-trust-users")
async def admin_get_low_trust_users(current_user: dict = Depends(get_current_user)):
    """Admin: Get users with low ratings that need review"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get all users except admins
    users = list(users_collection.find({"is_admin": {"$ne": True}}, {"password": 0}))
    
    low_trust_users = []
    for user in users:
        user_id = str(user["_id"])
        rating_stats = get_user_rating_stats(user_id)
        
        # Count completed rides
        ride_count = 0
        if user.get("role") == "driver":
            ride_count = rides_collection.count_documents({
                "driver_id": user_id,
                "status": "completed"
            })
        else:
            ride_count = ride_requests_collection.count_documents({
                "rider_id": user_id,
                "status": "completed"
            })
        
        trust_level = calculate_trust_level(rating_stats["average_rating"], ride_count)
        
        # Only include users with low trust level
        if trust_level["level"] == "low" or (rating_stats["average_rating"] and rating_stats["average_rating"] < 3.0):
            low_trust_users.append({
                "id": user_id,
                "name": user["name"],
                "email": user["email"],
                "role": user["role"],
                "verification_status": user.get("verification_status", "unverified"),
                "average_rating": rating_stats["average_rating"],
                "total_ratings": rating_stats["total_ratings"],
                "ride_count": ride_count,
                "trust_level": trust_level
            })
    
    # Sort by average rating (lowest first)
    low_trust_users.sort(key=lambda x: x["average_rating"] or 0)
    
    return {
        "low_trust_users": low_trust_users,
        "count": len(low_trust_users)
    }

# ==========================================
# Phase 7: Community, Engagement & Insights APIs
# ==========================================

# Phase 7: Get branches list
@app.get("/api/branches")
async def get_branches():
    """Get list of RVCE branches for community discovery"""
    return {"branches": BRANCHES}

# Phase 7: Get academic years list
@app.get("/api/academic-years")
async def get_academic_years():
    """Get list of academic years for community discovery"""
    return {"academic_years": ACADEMIC_YEARS}

# Phase 7: Event Tag Management - Admin Create Event Tag
@app.post("/api/admin/event-tags")
async def create_event_tag(tag: EventTagCreate, current_user: dict = Depends(get_current_user)):
    """Admin: Create a new event tag"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if tag with same name exists
    existing = event_tags_collection.find_one({"name": {"$regex": f"^{tag.name}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Event tag with this name already exists")
    
    new_tag = {
        "name": tag.name,
        "description": tag.description,
        "is_active": True,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = event_tags_collection.insert_one(new_tag)
    
    return {
        "message": "Event tag created successfully",
        "event_tag": {
            "id": str(result.inserted_id),
            "name": new_tag["name"],
            "description": new_tag["description"],
            "is_active": new_tag["is_active"],
            "created_at": new_tag["created_at"]
        }
    }

# Phase 7: Get all event tags
@app.get("/api/event-tags")
async def get_event_tags(include_inactive: bool = False):
    """Get all event tags for ride tagging"""
    query = {} if include_inactive else {"is_active": {"$ne": False}}
    tags = list(event_tags_collection.find(query).sort("created_at", -1))
    
    return {
        "event_tags": [
            {
                "id": str(tag["_id"]),
                "name": tag["name"],
                "description": tag.get("description"),
                "is_active": tag.get("is_active", True),
                "created_at": tag.get("created_at", "")
            }
            for tag in tags
        ]
    }

# Phase 7: Update event tag
@app.put("/api/admin/event-tags/{tag_id}")
async def update_event_tag(tag_id: str, tag_update: EventTagUpdate, current_user: dict = Depends(get_current_user)):
    """Admin: Update an event tag"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        existing_tag = event_tags_collection.find_one({"_id": ObjectId(tag_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid tag ID")
    
    if not existing_tag:
        raise HTTPException(status_code=404, detail="Event tag not found")
    
    update_data = {}
    if tag_update.name is not None:
        update_data["name"] = tag_update.name
    if tag_update.description is not None:
        update_data["description"] = tag_update.description
    if tag_update.is_active is not None:
        update_data["is_active"] = tag_update.is_active
    
    if update_data:
        event_tags_collection.update_one({"_id": ObjectId(tag_id)}, {"$set": update_data})
    
    updated_tag = event_tags_collection.find_one({"_id": ObjectId(tag_id)})
    
    return {
        "message": "Event tag updated",
        "event_tag": {
            "id": str(updated_tag["_id"]),
            "name": updated_tag["name"],
            "description": updated_tag.get("description"),
            "is_active": updated_tag.get("is_active", True)
        }
    }

# Phase 7: Delete event tag
@app.delete("/api/admin/event-tags/{tag_id}")
async def delete_event_tag(tag_id: str, current_user: dict = Depends(get_current_user)):
    """Admin: Delete an event tag"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        existing_tag = event_tags_collection.find_one({"_id": ObjectId(tag_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid tag ID")
    
    if not existing_tag:
        raise HTTPException(status_code=404, detail="Event tag not found")
    
    event_tags_collection.delete_one({"_id": ObjectId(tag_id)})
    
    # Remove tag from rides that had it
    rides_collection.update_many(
        {"event_tag": tag_id},
        {"$unset": {"event_tag": ""}}
    )
    
    return {"message": "Event tag deleted successfully"}

# Phase 7: Get user statistics
@app.get("/api/user/stats")
async def get_user_stats(current_user: dict = Depends(get_current_user)):
    """Get comprehensive statistics for the current user"""
    user_id = current_user["id"]
    user_role = current_user["role"]
    
    stats = calculate_user_stats(user_id, user_role)
    badges = calculate_user_badges(user_id, stats["total_rides"])
    
    return {
        "stats": stats,
        "badges": badges,
        "badge_definitions": BADGE_DEFINITIONS  # So frontend knows about upcoming badges
    }

# Phase 7: Get weekly summary
@app.get("/api/user/weekly-summary")
async def get_user_weekly_summary(current_user: dict = Depends(get_current_user)):
    """Get weekly usage summary for the current user"""
    summary = calculate_weekly_summary(current_user["id"], current_user["role"])
    return {"weekly_summary": summary}

# Phase 7: Update user profile with community fields
@app.put("/api/profile/community")
async def update_profile_community(profile: UserProfileUpdate, current_user: dict = Depends(get_current_user)):
    """Update user profile including community fields (branch, academic year)"""
    update_data = {}
    
    if profile.name:
        update_data["name"] = profile.name
    if profile.role and profile.role in ["rider", "driver"]:
        update_data["role"] = profile.role
    if profile.vehicle_model is not None:
        update_data["vehicle_model"] = profile.vehicle_model
    if profile.vehicle_number is not None:
        update_data["vehicle_number"] = profile.vehicle_number
    if profile.vehicle_color is not None:
        update_data["vehicle_color"] = profile.vehicle_color
    
    # Phase 7: Community fields
    if profile.branch is not None:
        # Validate branch
        valid_branches = [b["id"] for b in BRANCHES]
        if profile.branch and profile.branch not in valid_branches:
            raise HTTPException(status_code=400, detail="Invalid branch")
        update_data["branch"] = profile.branch if profile.branch else None
    
    if profile.academic_year is not None:
        # Validate academic year
        valid_years = [y["id"] for y in ACADEMIC_YEARS]
        if profile.academic_year and profile.academic_year not in valid_years:
            raise HTTPException(status_code=400, detail="Invalid academic year")
        update_data["academic_year"] = profile.academic_year if profile.academic_year else None
    
    if update_data:
        users_collection.update_one(
            {"_id": ObjectId(current_user["id"])},
            {"$set": update_data}
        )
    
    updated_user = users_collection.find_one({"_id": ObjectId(current_user["id"])}, {"password": 0})
    
    return {"message": "Profile updated", "user": serialize_user(updated_user)}

# Phase 7: Community rides - filter by branch/academic year
@app.get("/api/rides/community")
async def get_community_rides(
    branch: Optional[str] = None,
    academic_year: Optional[str] = None,
    event_tag: Optional[str] = None,
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get rides filtered by community attributes"""
    query = {"status": "active"}
    
    if date:
        query["date"] = date
    
    if event_tag:
        query["event_tag"] = event_tag
    
    # Get all active rides
    rides = list(rides_collection.find(query).sort("created_at", -1))
    
    # Filter by driver's branch/academic year
    filtered_rides = []
    for ride in rides:
        serialized = serialize_ride(ride)
        
        # Skip rides with no seats
        if serialized["seats_available"] <= 0:
            continue
        
        # Filter by branch if specified
        if branch and serialized.get("driver_branch") != branch:
            continue
        
        # Filter by academic year if specified
        if academic_year and serialized.get("driver_academic_year") != academic_year:
            continue
        
        filtered_rides.append(serialized)
    
    return {
        "rides": filtered_rides,
        "total_count": len(filtered_rides),
        "filters": {
            "branch": branch,
            "academic_year": academic_year,
            "event_tag": event_tag
        }
    }

# Phase 7: Get rides by event tag
@app.get("/api/rides/event/{event_tag_id}")
async def get_rides_by_event(event_tag_id: str, current_user: dict = Depends(get_current_user)):
    """Get all active rides for a specific event"""
    try:
        tag = event_tags_collection.find_one({"_id": ObjectId(event_tag_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid event tag ID")
    
    if not tag:
        raise HTTPException(status_code=404, detail="Event tag not found")
    
    rides = list(rides_collection.find({
        "event_tag": event_tag_id,
        "status": "active"
    }).sort("date", 1))
    
    return {
        "event_tag": {
            "id": str(tag["_id"]),
            "name": tag["name"],
            "description": tag.get("description")
        },
        "rides": [serialize_ride(r) for r in rides if serialize_ride(r)["seats_available"] > 0],
        "total_count": len(rides)
    }

# Phase 7: Eco Impact Stats - Global platform stats
@app.get("/api/eco-impact")
async def get_eco_impact():
    """Get platform-wide eco impact statistics"""
    # Count all completed rides
    completed_rides = rides_collection.count_documents({"status": "completed"})
    completed_requests = ride_requests_collection.count_documents({"status": "completed"})
    
    # Calculate total impact
    total_shared_rides = completed_requests  # Each completed request = 1 shared ride
    total_distance_km = total_shared_rides * AVG_RIDE_DISTANCE_KM
    total_co2_saved_kg = total_distance_km * CO2_PER_KM_SAVED
    
    # Equivalent metrics for visualization
    trees_equivalent = round(total_co2_saved_kg / 21, 1)  # 1 tree absorbs ~21kg CO2/year
    fuel_liters_saved = round(total_distance_km / 12, 1)  # ~12km per liter average
    
    return {
        "eco_impact": {
            "total_shared_rides": total_shared_rides,
            "total_distance_km": round(total_distance_km, 1),
            "total_co2_saved_kg": round(total_co2_saved_kg, 2),
            "trees_equivalent": trees_equivalent,
            "fuel_liters_saved": fuel_liters_saved,
            "active_users": users_collection.count_documents({"verification_status": "verified"})
        }
    }

# Phase 7: Badge definitions endpoint
@app.get("/api/badges")
async def get_badge_definitions():
    """Get all badge definitions"""
    return {"badges": BADGE_DEFINITIONS}

# ==========================================
# Phase 8: Admin, Moderation & Governance
# ==========================================

# Phase 8: User Management - Enable/Disable User
@app.put("/api/admin/users/{user_id}/status")
async def admin_update_user_status(user_id: str, status_update: UserStatusUpdate, current_user: dict = Depends(get_current_user)):
    """Admin: Enable or disable a user account"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Cannot disable admin accounts")
    
    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "is_active": status_update.is_active,
            "status_reason": status_update.reason,
            "status_updated_at": datetime.now(timezone.utc).isoformat(),
            "status_updated_by": current_user["id"]
        }}
    )
    
    # Log admin action
    log_admin_action(
        admin_id=current_user["id"],
        admin_name=current_user["name"],
        action_type="user_enabled" if status_update.is_active else "user_disabled",
        target_type="user",
        target_id=user_id,
        details={"reason": status_update.reason, "user_name": user["name"]}
    )
    
    action = "enabled" if status_update.is_active else "disabled"
    return {"message": f"User {user['name']} has been {action}"}

# Phase 8: Promote User to Admin
@app.put("/api/admin/users/{user_id}/promote")
async def admin_promote_user(user_id: str, request: PromoteUserRequest, current_user: dict = Depends(get_current_user)):
    """Admin: Promote a user to admin role"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not request.confirm:
        raise HTTPException(status_code=400, detail="Confirmation required")
    
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("is_admin"):
        raise HTTPException(status_code=400, detail="User is already an admin")
    
    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "is_admin": True,
            "role": "admin",
            "promoted_at": datetime.now(timezone.utc).isoformat(),
            "promoted_by": current_user["id"]
        }}
    )
    
    # Log admin action
    log_admin_action(
        admin_id=current_user["id"],
        admin_name=current_user["name"],
        action_type="user_promoted",
        target_type="user",
        target_id=user_id,
        details={"user_name": user["name"], "previous_role": user["role"]}
    )
    
    return {"message": f"User {user['name']} has been promoted to admin"}

# Phase 8: Delete User (Hard Delete)
@app.delete("/api/admin/users/{user_id}")
async def admin_delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Admin: Permanently delete a user and all their data"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Cannot delete admin accounts")
    
    user_name = user["name"]
    
    # Delete all user's rides
    user_rides = list(rides_collection.find({"driver_id": user_id}))
    ride_ids = [str(r["_id"]) for r in user_rides]
    
    # Delete ride requests for user's rides
    if ride_ids:
        ride_requests_collection.delete_many({"ride_id": {"$in": ride_ids}})
        # Delete chat messages for user's rides
        chat_messages_collection.delete_many({"ride_id": {"$in": ride_ids}})
    
    # Delete user's own ride requests
    user_requests = list(ride_requests_collection.find({"rider_id": user_id}))
    user_request_ids = [str(r["_id"]) for r in user_requests]
    
    # Delete chat messages from user's requests
    if user_request_ids:
        chat_messages_collection.delete_many({"ride_request_id": {"$in": user_request_ids}})
    
    ride_requests_collection.delete_many({"rider_id": user_id})
    
    # Delete user's rides
    rides_collection.delete_many({"driver_id": user_id})
    
    # Delete ratings given by and received by user
    ratings_collection.delete_many({"$or": [{"rater_id": user_id}, {"rated_user_id": user_id}]})
    
    # Delete SOS events triggered by user
    sos_events_collection.delete_many({"triggered_by": user_id})
    
    # Delete reports by and against user
    reports_collection.delete_many({"$or": [{"reporter_id": user_id}, {"reported_user_id": user_id}]})
    
    # Delete chat messages sent by user
    chat_messages_collection.delete_many({"sender_id": user_id})
    
    # Finally delete the user
    users_collection.delete_one({"_id": ObjectId(user_id)})
    
    # Log admin action
    log_admin_action(
        admin_id=current_user["id"],
        admin_name=current_user["name"],
        action_type="user_deleted",
        target_type="user",
        target_id=user_id,
        details={"user_name": user_name, "user_email": user["email"]}
    )
    
    return {"message": f"User {user_name} and all associated data have been permanently deleted"}

# Phase 8: Verification Management - Revoke Verification
@app.put("/api/admin/verifications/{user_id}/revoke")
async def admin_revoke_verification(user_id: str, current_user: dict = Depends(get_current_user)):
    """Admin: Revoke a user's verification status"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("verification_status") != "verified":
        raise HTTPException(status_code=400, detail="User is not verified")
    
    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "verification_status": "unverified",
            "verified_at": None,
            "verification_revoked_at": datetime.now(timezone.utc).isoformat(),
            "verification_revoked_by": current_user["id"]
        }}
    )
    
    # Log admin action
    log_admin_action(
        admin_id=current_user["id"],
        admin_name=current_user["name"],
        action_type="verification_revoked",
        target_type="user",
        target_id=user_id,
        details={"user_name": user["name"]}
    )
    
    return {"message": f"Verification revoked for {user['name']}"}

# Phase 8: Submit a Report (User endpoint)
@app.post("/api/reports")
async def create_report(report: ReportCreate, current_user: dict = Depends(get_current_user)):
    """Submit a report against a user or ride"""
    if not report.reported_user_id and not report.ride_id:
        raise HTTPException(status_code=400, detail="Must specify either a user or ride to report")
    
    # Validate reported user if provided
    reported_user = None
    if report.reported_user_id:
        try:
            reported_user = users_collection.find_one({"_id": ObjectId(report.reported_user_id)})
        except:
            raise HTTPException(status_code=400, detail="Invalid reported user ID")
        if not reported_user:
            raise HTTPException(status_code=404, detail="Reported user not found")
        if report.reported_user_id == current_user["id"]:
            raise HTTPException(status_code=400, detail="Cannot report yourself")
    
    # Validate ride if provided
    reported_ride = None
    if report.ride_id:
        try:
            reported_ride = rides_collection.find_one({"_id": ObjectId(report.ride_id)})
        except:
            raise HTTPException(status_code=400, detail="Invalid ride ID")
        if not reported_ride:
            raise HTTPException(status_code=404, detail="Ride not found")
    
    new_report = {
        "reporter_id": current_user["id"],
        "reporter_name": current_user["name"],
        "reported_user_id": report.reported_user_id,
        "reported_user_name": reported_user["name"] if reported_user else None,
        "ride_id": report.ride_id,
        "category": report.category,
        "description": report.description,
        "status": "pending",  # pending, under_review, resolved, dismissed
        "admin_notes": None,
        "action_taken": None,
        "handled_by": None,
        "handled_at": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = reports_collection.insert_one(new_report)
    
    return {
        "message": "Report submitted successfully. Our team will review it.",
        "report_id": str(result.inserted_id)
    }

# Phase 8: Get Reports (Admin)
@app.get("/api/admin/reports")
async def admin_get_reports(
    status: Optional[str] = None,
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Admin: Get all reports"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    
    reports = list(reports_collection.find(query).sort("created_at", -1))
    
    result = []
    for report in reports:
        result.append({
            "id": str(report["_id"]),
            "reporter_id": report["reporter_id"],
            "reporter_name": report["reporter_name"],
            "reported_user_id": report.get("reported_user_id"),
            "reported_user_name": report.get("reported_user_name"),
            "ride_id": report.get("ride_id"),
            "category": report["category"],
            "description": report["description"],
            "status": report["status"],
            "admin_notes": report.get("admin_notes"),
            "action_taken": report.get("action_taken"),
            "handled_by": report.get("handled_by"),
            "handled_at": report.get("handled_at"),
            "created_at": report["created_at"]
        })
    
    # Stats
    pending_count = reports_collection.count_documents({"status": "pending"})
    under_review_count = reports_collection.count_documents({"status": "under_review"})
    
    return {
        "reports": result,
        "stats": {
            "pending": pending_count,
            "under_review": under_review_count,
            "total": len(result)
        }
    }

# Phase 8: Handle Report (Admin)
@app.put("/api/admin/reports/{report_id}")
async def admin_handle_report(report_id: str, action: ReportAction, current_user: dict = Depends(get_current_user)):
    """Admin: Handle a report - warn, suspend, disable, or dismiss"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        report = reports_collection.find_one({"_id": ObjectId(report_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid report ID")
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Update report status
    update_data = {
        "status": "resolved" if action.action != "dismiss" else "dismissed",
        "action_taken": action.action,
        "admin_notes": action.admin_notes,
        "handled_by": current_user["id"],
        "handled_at": datetime.now(timezone.utc).isoformat()
    }
    
    reports_collection.update_one(
        {"_id": ObjectId(report_id)},
        {"$set": update_data}
    )
    
    # Take action on reported user if applicable
    reported_user_id = report.get("reported_user_id")
    action_message = ""
    
    if reported_user_id and action.action in ["warn", "suspend", "disable"]:
        user_update = {}
        
        if action.action == "warn":
            user_update = {
                "warning_count": 1,  # Increment would need $inc
                "last_warning_at": datetime.now(timezone.utc).isoformat(),
                "last_warning_reason": action.admin_notes
            }
            action_message = "User has been warned"
        elif action.action == "suspend":
            user_update = {
                "is_active": False,
                "is_suspended": True,
                "suspended_at": datetime.now(timezone.utc).isoformat(),
                "suspension_reason": action.admin_notes
            }
            action_message = "User has been suspended"
        elif action.action == "disable":
            user_update = {
                "is_active": False,
                "disabled_at": datetime.now(timezone.utc).isoformat(),
                "disable_reason": action.admin_notes
            }
            action_message = "User account has been disabled"
        
        if user_update:
            # Use $inc for warning_count
            if action.action == "warn":
                users_collection.update_one(
                    {"_id": ObjectId(reported_user_id)},
                    {
                        "$inc": {"warning_count": 1},
                        "$set": {
                            "last_warning_at": datetime.now(timezone.utc).isoformat(),
                            "last_warning_reason": action.admin_notes
                        }
                    }
                )
            else:
                users_collection.update_one(
                    {"_id": ObjectId(reported_user_id)},
                    {"$set": user_update}
                )
    elif action.action == "dismiss":
        action_message = "Report has been dismissed"
    
    # Log admin action
    log_admin_action(
        admin_id=current_user["id"],
        admin_name=current_user["name"],
        action_type=f"report_{action.action}",
        target_type="report",
        target_id=report_id,
        details={
            "reported_user_id": reported_user_id,
            "category": report["category"],
            "action_taken": action.action
        }
    )
    
    return {"message": action_message or f"Report handled with action: {action.action}"}

# Phase 8: Get Audit Logs (Admin)
@app.get("/api/admin/audit-logs")
async def admin_get_audit_logs(
    action_type: Optional[str] = None,
    target_type: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Admin: Get audit logs of all admin actions"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if action_type:
        query["action_type"] = action_type
    if target_type:
        query["target_type"] = target_type
    
    logs = list(audit_logs_collection.find(query).sort("timestamp", -1).limit(limit))
    
    result = []
    for log in logs:
        result.append({
            "id": str(log["_id"]),
            "admin_id": log["admin_id"],
            "admin_name": log["admin_name"],
            "action_type": log["action_type"],
            "target_type": log["target_type"],
            "target_id": log["target_id"],
            "details": log.get("details", {}),
            "timestamp": log["timestamp"]
        })
    
    return {"audit_logs": result, "total": len(result)}

# Phase 8: Enhanced Admin Stats with Analytics Data
@app.get("/api/admin/analytics")
async def admin_get_analytics(current_user: dict = Depends(get_current_user)):
    """Admin: Get analytics data for charts"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get ride data for last 7 days
    today = datetime.now()
    daily_rides = []
    daily_users = []
    
    for i in range(6, -1, -1):
        date = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        day_label = (today - timedelta(days=i)).strftime("%a")
        
        # Count rides for this date
        ride_count = rides_collection.count_documents({"date": date})
        completed_count = rides_collection.count_documents({"date": date, "status": "completed"})
        
        daily_rides.append({
            "day": day_label,
            "date": date,
            "rides": ride_count,
            "completed": completed_count
        })
        
        # Count users registered on this date (approximate from created_at)
        start_of_day = f"{date}T00:00:00"
        end_of_day = f"{date}T23:59:59"
        new_users = users_collection.count_documents({
            "created_at": {"$gte": start_of_day, "$lte": end_of_day}
        })
        daily_users.append({
            "day": day_label,
            "date": date,
            "new_users": new_users
        })
    
    # Report categories breakdown
    report_categories = {
        "safety": reports_collection.count_documents({"category": "safety"}),
        "behavior": reports_collection.count_documents({"category": "behavior"}),
        "misuse": reports_collection.count_documents({"category": "misuse"}),
        "other": reports_collection.count_documents({"category": "other"})
    }
    
    # SOS status breakdown
    sos_statuses = {
        "active": sos_events_collection.count_documents({"status": "active"}),
        "under_review": sos_events_collection.count_documents({"status": "under_review"}),
        "resolved": sos_events_collection.count_documents({"status": "resolved"})
    }
    
    # User roles breakdown
    user_roles = {
        "riders": users_collection.count_documents({"role": "rider", "is_admin": {"$ne": True}}),
        "drivers": users_collection.count_documents({"role": "driver", "is_admin": {"$ne": True}}),
        "admins": users_collection.count_documents({"is_admin": True})
    }
    
    # Verification status breakdown
    verification_status = {
        "verified": users_collection.count_documents({"verification_status": "verified"}),
        "pending": users_collection.count_documents({"verification_status": "pending"}),
        "rejected": users_collection.count_documents({"verification_status": "rejected"}),
        "unverified": users_collection.count_documents({"verification_status": "unverified"})
    }
    
    return {
        "daily_rides": daily_rides,
        "daily_users": daily_users,
        "report_categories": report_categories,
        "sos_statuses": sos_statuses,
        "user_roles": user_roles,
        "verification_status": verification_status
    }

# Phase 8: Get single user details for admin
@app.get("/api/admin/users/{user_id}")
async def admin_get_user_details(user_id: str, current_user: dict = Depends(get_current_user)):
    """Admin: Get detailed information about a user"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)}, {"password": 0})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_data = serialize_user(user)
    
    # Get activity summary
    rides_offered = rides_collection.count_documents({"driver_id": user_id})
    rides_taken = ride_requests_collection.count_documents({"rider_id": user_id})
    sos_events = sos_events_collection.count_documents({"triggered_by": user_id})
    reports_filed = reports_collection.count_documents({"reporter_id": user_id})
    reports_received = reports_collection.count_documents({"reported_user_id": user_id})
    
    user_data["activity"] = {
        "rides_offered": rides_offered,
        "rides_taken": rides_taken,
        "sos_events_triggered": sos_events,
        "reports_filed": reports_filed,
        "reports_received": reports_received
    }
    
    # Account status
    user_data["account_status"] = {
        "is_active": user.get("is_active", True),
        "is_suspended": user.get("is_suspended", False),
        "warning_count": user.get("warning_count", 0),
        "last_warning_at": user.get("last_warning_at"),
        "status_reason": user.get("status_reason")
    }
    
    return {"user": user_data}

# Phase 8: Get rides with enhanced filtering for admin
@app.get("/api/admin/rides/monitoring")
async def admin_monitor_rides(
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Admin: Monitor rides with filters"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if status:
        query["status"] = status
    if date_from and date_to:
        query["date"] = {"$gte": date_from, "$lte": date_to}
    elif date_from:
        query["date"] = {"$gte": date_from}
    elif date_to:
        query["date"] = {"$lte": date_to}
    
    rides = list(rides_collection.find(query).sort("created_at", -1).limit(200))
    
    serialized_rides = []
    for ride in rides:
        ride_data = serialize_ride(ride)
        
        # Add cancellation info if cancelled
        if ride.get("status") == "cancelled":
            ride_data["cancelled_reason"] = ride.get("cancelled_reason")
        
        # Count SOS events for this ride
        ride_requests = list(ride_requests_collection.find({"ride_id": str(ride["_id"])}))
        request_ids = [str(req["_id"]) for req in ride_requests]
        sos_count = sos_events_collection.count_documents({"ride_request_id": {"$in": request_ids}})
        ride_data["sos_count"] = sos_count
        
        serialized_rides.append(ride_data)
    
    # Get cancellation stats
    cancelled_rides = rides_collection.count_documents({"status": "cancelled"})
    
    return {
        "rides": serialized_rides,
        "stats": {
            "total": len(serialized_rides),
            "cancelled_count": cancelled_rides
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)


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

# JWT Config
JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Allowed email domain
ALLOWED_EMAIL_DOMAIN = "@rvce.edu.in"

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

class RideCreate(BaseModel):
    source: str
    destination: str
    date: str
    time: str
    available_seats: int = Field(..., ge=1, le=10)
    estimated_cost: float = Field(..., ge=0)

class RideUpdate(BaseModel):
    source: Optional[str] = None
    destination: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    available_seats: Optional[int] = None
    estimated_cost: Optional[float] = None

class RideRequestCreate(BaseModel):
    ride_id: str

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
        user["id"] = str(user["_id"])
        del user["_id"]
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def serialize_user(user: dict) -> dict:
    # Count completed rides for this user
    ride_count = 0
    if user.get("role") == "driver":
        ride_count = rides_collection.count_documents({
            "driver_id": str(user["_id"]),
            "status": "completed"
        })
    else:
        ride_count = ride_requests_collection.count_documents({
            "rider_id": str(user["_id"]),
            "status": "completed"
        })
    
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "is_admin": user.get("is_admin", False),
        "verification_status": user.get("verification_status", "unverified"),
        "rejection_reason": user.get("rejection_reason"),
        "verified_at": user.get("verified_at"),
        "ride_count": ride_count,
        "created_at": user.get("created_at", "")
    }

def serialize_ride(ride: dict) -> dict:
    driver = users_collection.find_one({"_id": ObjectId(ride["driver_id"])}, {"password": 0})
    driver_name = driver["name"] if driver else "Unknown"
    driver_verification_status = driver.get("verification_status", "unverified") if driver else "unverified"
    
    # Count accepted requests (including ongoing)
    accepted_requests = ride_requests_collection.count_documents({
        "ride_id": str(ride["_id"]),
        "status": {"$in": ["accepted", "ongoing"]}
    })
    
    seats_taken = accepted_requests
    seats_available = ride["available_seats"] - seats_taken
    cost_per_rider = ride["estimated_cost"] / (seats_taken + 1) if seats_taken > 0 else ride["estimated_cost"]
    
    return {
        "id": str(ride["_id"]),
        "driver_id": ride["driver_id"],
        "driver_name": driver_name,
        "driver_verification_status": driver_verification_status,
        "source": ride["source"],
        "destination": ride["destination"],
        "date": ride["date"],
        "time": ride["time"],
        "available_seats": ride["available_seats"],
        "seats_available": seats_available,
        "seats_taken": seats_taken,
        "estimated_cost": ride["estimated_cost"],
        "cost_per_rider": round(cost_per_rider, 2),
        "status": ride["status"],
        "created_at": ride.get("created_at", "")
    }

def serialize_ride_request(request: dict) -> dict:
    rider = users_collection.find_one({"_id": ObjectId(request["rider_id"])}, {"password": 0})
    ride = rides_collection.find_one({"_id": ObjectId(request["ride_id"])})
    
    return {
        "id": str(request["_id"]),
        "ride_id": request["ride_id"],
        "rider_id": request["rider_id"],
        "rider_name": rider["name"] if rider else "Unknown",
        "rider_email": rider["email"] if rider else "Unknown",
        "rider_verification_status": rider.get("verification_status", "unverified") if rider else "unverified",
        "ride_source": ride["source"] if ride else "Unknown",
        "ride_destination": ride["destination"] if ride else "Unknown",
        "ride_date": ride["date"] if ride else "Unknown",
        "ride_time": ride["time"] if ride else "Unknown",
        "status": request["status"],
        "ride_pin": request.get("ride_pin"),  # Phase 3: Include PIN
        "ride_started_at": request.get("ride_started_at"),  # Phase 3: Include start time
        "created_at": request.get("created_at", "")
    }

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
    
    new_ride = {
        "driver_id": current_user["id"],
        "source": ride.source,
        "destination": ride.destination,
        "date": ride.date,
        "time": ride.time,
        "available_seats": ride.available_seats,
        "estimated_cost": ride.estimated_cost,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = rides_collection.insert_one(new_ride)
    new_ride["_id"] = result.inserted_id
    
    return {"message": "Ride created successfully", "ride": serialize_ride(new_ride)}

@app.get("/api/rides")
async def get_rides(
    destination: Optional[str] = None,
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"status": "active"}
    
    if destination:
        query["destination"] = {"$regex": destination, "$options": "i"}
    if date:
        query["date"] = date
    
    rides = list(rides_collection.find(query).sort("created_at", -1))
    serialized_rides = []
    
    for ride in rides:
        serialized = serialize_ride(ride)
        # Only show rides with available seats
        if serialized["seats_available"] > 0:
            serialized_rides.append(serialized)
    
    return {"rides": serialized_rides}

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
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = ride_requests_collection.insert_one(new_request)
    new_request["_id"] = result.inserted_id
    
    return {"message": "Ride request submitted", "request": serialize_ride_request(new_request)}

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
    ongoing_rides = ride_requests_collection.count_documents({"status": "ongoing"})  # Phase 3
    
    # Verification stats
    verified_users = users_collection.count_documents({"verification_status": "verified"})
    pending_verifications = users_collection.count_documents({"verification_status": "pending"})
    unverified_users = users_collection.count_documents({"verification_status": "unverified"})
    rejected_verifications = users_collection.count_documents({"verification_status": "rejected"})
    
    return {
        "stats": {
            "total_users": total_users,
            "total_riders": total_riders,
            "total_drivers": total_drivers,
            "total_rides": total_rides,
            "active_rides": active_rides,
            "completed_rides": completed_rides,
            "ongoing_rides": ongoing_rides,  # Phase 3
            "total_requests": total_requests,
            "pending_requests": pending_requests,
            "verified_users": verified_users,
            "pending_verifications": pending_verifications,
            "unverified_users": unverified_users,
            "rejected_verifications": rejected_verifications
        }
    }

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
                    "rejection_reason": None
                }
            }
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
                    "verified_at": None
                }
            }
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
    
    # Return limited public info
    return {
        "profile": {
            "id": str(user["_id"]),
            "name": user["name"],
            "role": user["role"],
            "verification_status": user.get("verification_status", "unverified"),
            "ride_count": ride_count,
            "created_at": user.get("created_at")
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

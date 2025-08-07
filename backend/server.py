from fastapi import FastAPI, APIRouter, HTTPException, Depends, File, UploadFile, Form, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import jwt
from passlib.context import CryptContext
import shutil
from fastapi.responses import FileResponse

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-here')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI(title="BookVerse Pro API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Create uploads directory
uploads_dir = ROOT_DIR / "uploads"
uploads_dir.mkdir(exist_ok=True)

# Serve static files for uploaded images
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str = "user"  # "user" or "admin"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "user"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Book(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    author: str
    description: str
    price: float
    category: str
    cover_image: Optional[str] = None
    is_featured: bool = False
    cta_button_text: str = "Buy Now"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class BookCreate(BaseModel):
    title: str
    author: str
    description: str
    price: float
    category: str
    is_featured: bool = False
    cta_button_text: str = "Buy Now"

class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    is_featured: Optional[bool] = None
    cta_button_text: Optional[str] = None

# Auth utilities
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        user_data = await db.users.find_one({"email": email})
        if user_data is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return User(**user_data)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

async def get_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Auth routes
@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_password = hash_password(user_data.password)
    
    # Create user
    user_dict = user_data.dict()
    user_dict["password"] = hashed_password
    user_obj = User(**{k: v for k, v in user_dict.items() if k != "password"})
    
    # Save to database
    await db.users.insert_one({**user_obj.dict(), "password": hashed_password})
    
    # Create access token
    access_token = create_access_token(data={"sub": user_obj.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_obj
    }

@api_router.post("/auth/login")
async def login(user_data: UserLogin):
    # Find user
    user_record = await db.users.find_one({"email": user_data.email})
    if not user_record:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    if not verify_password(user_data.password, user_record["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create user object
    user_obj = User(**{k: v for k, v in user_record.items() if k != "password"})
    
    # Create access token
    access_token = create_access_token(data={"sub": user_obj.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_obj
    }

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Book routes
@api_router.get("/books", response_model=List[Book])
async def get_books(category: Optional[str] = None, featured: Optional[bool] = None, search: Optional[str] = None):
    filter_dict = {}
    
    if category:
        filter_dict["category"] = category
    if featured is not None:
        filter_dict["is_featured"] = featured
    if search:
        filter_dict["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"author": {"$regex": search, "$options": "i"}}
        ]
    
    books = await db.books.find(filter_dict).sort("created_at", -1).to_list(100)
    return [Book(**book) for book in books]

@api_router.get("/books/{book_id}", response_model=Book)
async def get_book(book_id: str):
    book = await db.books.find_one({"id": book_id})
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return Book(**book)

@api_router.post("/books", response_model=Book)
async def create_book(
    title: str = Form(...),
    author: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    category: str = Form(...),
    is_featured: bool = Form(False),
    cta_button_text: str = Form("Buy Now"),
    cover_image: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_admin_user)
):
    # Handle image upload
    cover_image_path = None
    if cover_image:
        # Save uploaded file
        file_extension = cover_image.filename.split(".")[-1]
        filename = f"{str(uuid.uuid4())}.{file_extension}"
        file_path = uploads_dir / filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(cover_image.file, buffer)
        
        cover_image_path = f"/uploads/{filename}"
    
    # Create book
    book_data = {
        "title": title,
        "author": author,
        "description": description,
        "price": price,
        "category": category,
        "is_featured": is_featured,
        "cta_button_text": cta_button_text,
        "cover_image": cover_image_path
    }
    
    book_obj = Book(**book_data)
    await db.books.insert_one(book_obj.dict())
    
    return book_obj

@api_router.put("/books/{book_id}", response_model=Book)
async def update_book(
    book_id: str,
    title: str = Form(None),
    author: str = Form(None),
    description: str = Form(None),
    price: Optional[float] = Form(None),
    category: str = Form(None),
    is_featured: Optional[bool] = Form(None),
    cta_button_text: str = Form(None),
    cover_image: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_admin_user)
):
    # Find existing book
    existing_book = await db.books.find_one({"id": book_id})
    if not existing_book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Build update data
    update_data = {}
    if title is not None:
        update_data["title"] = title
    if author is not None:
        update_data["author"] = author
    if description is not None:
        update_data["description"] = description
    if price is not None:
        update_data["price"] = price
    if category is not None:
        update_data["category"] = category
    if is_featured is not None:
        update_data["is_featured"] = is_featured
    if cta_button_text is not None:
        update_data["cta_button_text"] = cta_button_text
    
    # Handle image upload
    if cover_image:
        file_extension = cover_image.filename.split(".")[-1]
        filename = f"{str(uuid.uuid4())}.{file_extension}"
        file_path = uploads_dir / filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(cover_image.file, buffer)
        
        update_data["cover_image"] = f"/uploads/{filename}"
    
    update_data["updated_at"] = datetime.utcnow()
    
    # Update book
    await db.books.update_one({"id": book_id}, {"$set": update_data})
    
    # Return updated book
    updated_book = await db.books.find_one({"id": book_id})
    return Book(**updated_book)

@api_router.delete("/books/{book_id}")
async def delete_book(book_id: str, current_user: User = Depends(get_admin_user)):
    result = await db.books.delete_one({"id": book_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Book not found")
    return {"message": "Book deleted successfully"}

@api_router.get("/categories")
async def get_categories():
    categories = await db.books.distinct("category")
    return categories

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    # Create default admin user if none exists
    admin_exists = await db.users.find_one({"role": "admin"})
    if not admin_exists:
        admin_data = {
            "email": "admin@bookverse.com",
            "password": hash_password("admin123"),
            "name": "Admin User",
            "role": "admin",
            "id": str(uuid.uuid4()),
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(admin_data)
        logger.info("Default admin user created: admin@bookverse.com / admin123")
    
    # Create sample books if none exist
    book_count = await db.books.count_documents({})
    if book_count == 0:
        sample_books = [
            {
                "id": str(uuid.uuid4()),
                "title": "Milk and Honey",
                "author": "Rupi Kaur",
                "description": "A collection of poetry and prose about survival. About the experience of violence, abuse, love, loss, and femininity.",
                "price": 14.99,
                "category": "Poetry",
                "cover_image": "https://images.unsplash.com/photo-1544947950-fa07a98d237f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwxfHxib29rJTIwY292ZXJzfGVufDB8fHx8MTc1NDU3MjAzM3ww&ixlib=rb-4.1.0&q=85",
                "is_featured": True,
                "cta_button_text": "Buy Now",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "id": str(uuid.uuid4()),
                "title": "How Innovation Works",
                "author": "Matt Ridley",
                "description": "Innovation is the main event of the modern age, the reason we experience both dramatic improvements in our living standards and unsettling changes in our society.",
                "price": 18.99,
                "category": "Business",
                "cover_image": "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHw0fHxib29rJTIwY292ZXJzfGVufDB8fHx8MTc1NDU3MjAzM3ww&ixlib=rb-4.1.0&q=85",
                "is_featured": True,
                "cta_button_text": "Get It Now",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Classic Literature Collection",
                "author": "Various Authors",
                "description": "A curated collection of timeless classics that have shaped literature and continue to inspire readers worldwide.",
                "price": 24.99,
                "category": "Literature",
                "cover_image": "https://images.unsplash.com/photo-1511108690759-009324a90311?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwyfHxib29rJTIwY292ZXJzfGVufDB8fHx8MTc1NDU3MjAzM3ww&ixlib=rb-4.1.0&q=85",
                "is_featured": False,
                "cta_button_text": "Explore Collection",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Modern Book Selection",
                "author": "Contemporary Writers",
                "description": "Discover the latest in contemporary fiction and non-fiction with this carefully selected collection of modern masterpieces.",
                "price": 19.99,
                "category": "Fiction",
                "cover_image": "https://images.pexels.com/photos/33315081/pexels-photo-33315081.jpeg",
                "is_featured": False,
                "cta_button_text": "Add to Cart",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Literary Treasures",
                "author": "Award-Winning Authors",
                "description": "An exclusive collection featuring award-winning novels and literary works that have captivated readers across generations.",
                "price": 29.99,
                "category": "Literature",
                "cover_image": "https://images.unsplash.com/photo-1499332347742-4946bddc7d94?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHw0fHxsaXRlcmF0dXJlfGVufDB8fHx8MTc1NDU3MjAzOXww&ixlib=rb-4.1.0&q=85",
                "is_featured": True,
                "cta_button_text": "Discover Now",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        ]
        await db.books.insert_many(sample_books)
        logger.info("Sample books created")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
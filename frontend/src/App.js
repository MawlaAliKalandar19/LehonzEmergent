import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Book, Search, User, ShoppingCart, Plus, Edit, Trash2, Star, Filter, Menu, X, LogOut } from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Label } from './components/ui/label';
import { Textarea } from './components/ui/textarea';
import { Switch } from './components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { toast } from 'sonner';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = React.createContext();

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    }
    setLoading(false);
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { access_token, user: userData } = response.data;
      
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      setUser(userData);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Login failed' };
    }
  };

  const register = async (email, password, name, role = 'user') => {
    try {
      const response = await axios.post(`${API}/auth/register`, { email, password, name, role });
      const { access_token, user: userData } = response.data;
      
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      setUser(userData);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Registration failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Components
const Header = ({ onLoginClick, onRegisterClick }) => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <Book className="h-8 w-8 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">BookVerse Pro</h1>
          </div>
          
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">Welcome, {user.name}</span>
                {user.role === 'admin' && (
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-800">Admin</Badge>
                )}
                <Button variant="ghost" onClick={logout} className="text-gray-700">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Button variant="ghost" onClick={onLoginClick}>Login</Button>
                <Button onClick={onRegisterClick}>Sign Up</Button>
              </div>
            )}
          </div>

          <div className="md:hidden">
            <Button
              variant="ghost"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            {user ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-700 px-2">Welcome, {user.name}</p>
                {user.role === 'admin' && (
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 ml-2">Admin</Badge>
                )}
                <Button variant="ghost" onClick={logout} className="w-full justify-start">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Button variant="ghost" onClick={onLoginClick} className="w-full justify-start">
                  Login
                </Button>
                <Button onClick={onRegisterClick} className="w-full justify-start">
                  Sign Up
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

const BookCard = ({ book, onEdit, onDelete, isAdmin }) => {
  const imageUrl = book.cover_image?.startsWith('http') 
    ? book.cover_image 
    : book.cover_image 
      ? `${BACKEND_URL}${book.cover_image}` 
      : 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwxfHxib29rJTIwY292ZXJzfGVufDB8fHx8MTc1NDU3MjAzM3ww&ixlib=rb-4.1.0&q=85';

  return (
    <Card className="group hover:shadow-lg transition-shadow duration-300 overflow-hidden">
      <div className="relative">
        <div className="aspect-[3/4] overflow-hidden">
          <img
            src={imageUrl}
            alt={book.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
        {book.is_featured && (
          <Badge className="absolute top-2 right-2 bg-yellow-500 hover:bg-yellow-600">
            <Star className="h-3 w-3 mr-1" />
            Featured
          </Badge>
        )}
        {isAdmin && (
          <div className="absolute top-2 left-2 space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="sm" variant="secondary" onClick={() => onEdit(book)}>
              <Edit className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onDelete(book.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <div className="space-y-2">
          <h3 className="font-semibold text-lg line-clamp-2">{book.title}</h3>
          <p className="text-sm text-gray-600">by {book.author}</p>
          <p className="text-xs text-gray-500 line-clamp-2">{book.description}</p>
          <div className="flex items-center justify-between">
            <Badge variant="outline">{book.category}</Badge>
            <span className="text-lg font-bold text-indigo-600">${book.price}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
          {book.cta_button_text}
        </Button>
      </CardFooter>
    </Card>
  );
};

const BookForm = ({ book, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    title: book?.title || '',
    author: book?.author || '',
    description: book?.description || '',
    price: book?.price || '',
    category: book?.category || '',
    is_featured: book?.is_featured || false,
    cta_button_text: book?.cta_button_text || 'Buy Now'
  });
  const [coverImage, setCoverImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formDataObj = new FormData();
      Object.keys(formData).forEach(key => {
        formDataObj.append(key, formData[key]);
      });
      
      if (coverImage) {
        formDataObj.append('cover_image', coverImage);
      }

      let response;
      if (book) {
        response = await axios.put(`${API}/books/${book.id}`, formDataObj, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        response = await axios.post(`${API}/books`, formDataObj, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      onSave(response.data);
      toast.success(book ? 'Book updated successfully!' : 'Book created successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Something went wrong');
    }
    
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>
      
      <div>
        <Label htmlFor="author">Author</Label>
        <Input
          id="author"
          value={formData.author}
          onChange={(e) => setFormData({ ...formData, author: e.target.value })}
          required
        />
      </div>
      
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          required
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="price">Price ($)</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="category">Category</Label>
          <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Fiction">Fiction</SelectItem>
              <SelectItem value="Non-Fiction">Non-Fiction</SelectItem>
              <SelectItem value="Poetry">Poetry</SelectItem>
              <SelectItem value="Business">Business</SelectItem>
              <SelectItem value="Literature">Literature</SelectItem>
              <SelectItem value="Science">Science</SelectItem>
              <SelectItem value="Technology">Technology</SelectItem>
              <SelectItem value="Biography">Biography</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div>
        <Label htmlFor="cta_button_text">CTA Button Text</Label>
        <Input
          id="cta_button_text"
          value={formData.cta_button_text}
          onChange={(e) => setFormData({ ...formData, cta_button_text: e.target.value })}
        />
      </div>
      
      <div>
        <Label htmlFor="cover_image">Cover Image</Label>
        <Input
          id="cover_image"
          type="file"
          accept="image/*"
          onChange={(e) => setCoverImage(e.target.files[0])}
        />
      </div>
      
      <div className="flex items-center space-x-2">
        <Switch
          id="is_featured"
          checked={formData.is_featured}
          onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
        />
        <Label htmlFor="is_featured">Featured Book</Label>
      </div>
      
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : book ? 'Update Book' : 'Create Book'}
        </Button>
      </DialogFooter>
    </form>
  );
};

const AuthModal = ({ isOpen, onClose, mode, onSwitchMode }) => {
  const [formData, setFormData] = useState({ email: '', password: '', name: '', role: 'user' });
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let result;
      if (mode === 'login') {
        result = await login(formData.email, formData.password);
      } else {
        result = await register(formData.email, formData.password, formData.name, formData.role);
      }

      if (result.success) {
        onClose();
        toast.success(`${mode === 'login' ? 'Logged in' : 'Registered'} successfully!`);
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('Something went wrong');
    }
    
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'login' ? 'Login' : 'Sign Up'}</DialogTitle>
          <DialogDescription>
            {mode === 'login' ? 'Enter your credentials to access your account' : 'Create a new account'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          )}
          
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>

          {mode === 'register' && (
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="space-y-2">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Processing...' : mode === 'login' ? 'Login' : 'Sign Up'}
            </Button>
            
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={onSwitchMode}
            >
              {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Login'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const BookShowcase = () => {
  const [books, setBooks] = useState([]);
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBooks();
    fetchCategories();
  }, []);

  useEffect(() => {
    filterBooks();
  }, [books, selectedCategory, searchQuery, showFeaturedOnly]);

  const fetchBooks = async () => {
    try {
      const response = await axios.get(`${API}/books`);
      setBooks(response.data);
    } catch (error) {
      toast.error('Failed to fetch books');
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API}/categories`);
      setCategories(['all', ...response.data]);
    } catch (error) {
      console.error('Failed to fetch categories');
    }
  };

  const filterBooks = () => {
    let filtered = books;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(book => book.category === selectedCategory);
    }

    if (searchQuery) {
      filtered = filtered.filter(book => 
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (showFeaturedOnly) {
      filtered = filtered.filter(book => book.is_featured);
    }

    setFilteredBooks(filtered);
  };

  const featuredBooks = books.filter(book => book.is_featured);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {featuredBooks.length > 0 && (
        <section>
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Featured Books</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {featuredBooks.map(book => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 space-y-4 lg:space-y-0">
          <h2 className="text-2xl font-bold text-gray-900">All Books</h2>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search books..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full sm:w-64"
              />
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="featured-only"
                checked={showFeaturedOnly}
                onCheckedChange={setShowFeaturedOnly}
              />
              <Label htmlFor="featured-only" className="text-sm whitespace-nowrap">Featured only</Label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredBooks.map(book => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>

        {filteredBooks.length === 0 && (
          <div className="text-center py-12">
            <Book className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No books found</h3>
            <p className="text-gray-500">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </section>
    </div>
  );
};

const AdminPanel = () => {
  const [books, setBooks] = useState([]);
  const [editingBook, setEditingBook] = useState(null);
  const [showBookForm, setShowBookForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    try {
      const response = await axios.get(`${API}/books`);
      setBooks(response.data);
    } catch (error) {
      toast.error('Failed to fetch books');
    }
    setLoading(false);
  };

  const handleSaveBook = (book) => {
    if (editingBook) {
      setBooks(books.map(b => b.id === book.id ? book : b));
    } else {
      setBooks([book, ...books]);
    }
    setEditingBook(null);
    setShowBookForm(false);
  };

  const handleDeleteBook = async (bookId) => {
    if (window.confirm('Are you sure you want to delete this book?')) {
      try {
        await axios.delete(`${API}/books/${bookId}`);
        setBooks(books.filter(book => book.id !== bookId));
        toast.success('Book deleted successfully');
      } catch (error) {
        toast.error('Failed to delete book');
      }
    }
  };

  const handleEditBook = (book) => {
    setEditingBook(book);
    setShowBookForm(true);
  };

  const handleAddNew = () => {
    setEditingBook(null);
    setShowBookForm(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admin Panel</h2>
          <p className="text-gray-600">Manage your book collection</p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          Add New Book
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Books</p>
                  <p className="text-2xl font-bold">{books.length}</p>
                </div>
                <Book className="h-8 w-8 text-indigo-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Featured Books</p>
                  <p className="text-2xl font-bold">{books.filter(b => b.is_featured).length}</p>
                </div>
                <Star className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Categories</p>
                  <p className="text-2xl font-bold">{new Set(books.map(b => b.category)).size}</p>
                </div>
                <Filter className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {books.map(book => (
            <BookCard
              key={book.id}
              book={book}
              onEdit={handleEditBook}
              onDelete={handleDeleteBook}
              isAdmin={true}
            />
          ))}
        </div>
      </div>

      <Dialog open={showBookForm} onOpenChange={setShowBookForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBook ? 'Edit Book' : 'Add New Book'}</DialogTitle>
            <DialogDescription>
              {editingBook ? 'Update book information' : 'Create a new book listing'}
            </DialogDescription>
          </DialogHeader>
          <BookForm
            book={editingBook}
            onSave={handleSaveBook}
            onCancel={() => setShowBookForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

const App = () => {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  const handleLoginClick = () => {
    setAuthMode('login');
    setAuthModalOpen(true);
  };

  const handleRegisterClick = () => {
    setAuthMode('register');
    setAuthModalOpen(true);
  };

  const handleSwitchAuthMode = () => {
    setAuthMode(authMode === 'login' ? 'register' : 'login');
  };

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Header onLoginClick={handleLoginClick} onRegisterClick={handleRegisterClick} />
          
          <main>
            <AuthGuard>
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Routes>
                  <Route path="/" element={<MainContent />} />
                </Routes>
              </div>
            </AuthGuard>
          </main>

          <AuthModal
            isOpen={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
            mode={authMode}
            onSwitchMode={handleSwitchAuthMode}
          />

          <footer className="bg-white border-t border-gray-200 mt-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="text-center">
                <div className="flex justify-center items-center space-x-2 mb-4">
                  <Book className="h-6 w-6 text-indigo-600" />
                  <span className="text-xl font-bold text-gray-900">BookVerse Pro</span>
                </div>
                <p className="text-gray-600">Your ultimate destination for books</p>
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-gray-500">Payment Integration Placeholders:</p>
                  <p className="text-xs text-gray-400">Stripe: STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY</p>
                  <p className="text-xs text-gray-400">PayPal: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET</p>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
};

const AuthGuard = ({ children }) => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return children;
};

const MainContent = () => {
  const { user } = useAuth();

  return (
    <div>
      {user && user.role === 'admin' ? (
        <Tabs defaultValue="books" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="books">Book Showcase</TabsTrigger>
            <TabsTrigger value="admin">Admin Panel</TabsTrigger>
          </TabsList>
          <TabsContent value="books" className="mt-6">
            <BookShowcase />
          </TabsContent>
          <TabsContent value="admin" className="mt-6">
            <AdminPanel />
          </TabsContent>
        </Tabs>
      ) : (
        <BookShowcase />
      )}
    </div>
  );
};

export default App;
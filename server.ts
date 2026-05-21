/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { Book, User, IssueRecord, LibraryStats } from './src/types';

dotenv.config();

const app = express();
const PORT = 5000;

app.use(express.json());

// Initialize AI API client
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  console.log('AI system client initialized successfully.');
} else {
  console.warn('API key not found in environment. AI features will fallback gracefully.');
}

// Setup Data Dir and Path
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'library_db.json');

// Initial Seed Data
const initialBooks: Book[] = [
  {
    id: 'book_sicp',
    title: 'Structure and Interpretation of Computer Programs',
    author: 'Harold Abelson & Gerald Jay Sussman',
    genre: 'Computer Science',
    summary: 'A legendary textbook introducing fundamental principles of computer programming, including recursion, abstraction, modularity, and language design. Often called the Wizard Book.',
    isbn: '978-0262510875',
    publishedYear: 1996,
    copiesTotal: 5,
    copiesAvailable: 4,
    coverColor: 'indigo',
    addedAt: '2026-05-10T10:00:00Z',
    tags: ['Lisp', 'Scheme', 'Functional Programming', 'Systems Design']
  },
  {
    id: 'book_refactoring',
    title: 'Refactoring: Improving the Design of Existing Code',
    author: 'Martin Fowler',
    genre: 'Software Engineering',
    summary: 'The seminal guide to restructuring legacy code to improve its inner design and readability without changing its external behavior. Essential reading for professional software craftsmen.',
    isbn: '978-0134757599',
    publishedYear: 2018,
    copiesTotal: 4,
    copiesAvailable: 3,
    coverColor: 'emerald',
    addedAt: '2026-05-11T11:30:00Z',
    tags: ['Best Practices', 'Code Quality', 'Object-Oriented Design', 'Refactoring']
  },
  {
    id: 'book_dune',
    title: 'Dune',
    author: 'Frank Herbert',
    genre: 'Science Fiction',
    summary: 'Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, heir to a noble family tasked with ruling an inhospitable world where the only valuable commodity is the spice melange.',
    isbn: '978-0441172719',
    publishedYear: 1965,
    copiesTotal: 6,
    copiesAvailable: 5,
    coverColor: 'amber',
    addedAt: '2026-05-12T09:00:00Z',
    tags: ['Sci-Fi', 'Space Opera', 'Ecology', 'Politics']
  },
  {
    id: 'book_meditations',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    genre: 'Philosophy',
    summary: 'A series of personal writings by the Roman Emperor Marcus Aurelius, recording his private notes to himself and ideas on Stoic philosophy, duty, mortality, and self-discipline.',
    isbn: '978-0812968255',
    publishedYear: 180,
    copiesTotal: 3,
    copiesAvailable: 3,
    coverColor: 'slate',
    addedAt: '2026-05-14T08:00:00Z',
    tags: ['Stoicism', 'Ethics', 'Roman Empire', 'Self-Improvement']
  },
  {
    id: 'book_history_time',
    title: 'A Brief History of Time',
    author: 'Stephen Hawking',
    genre: 'Science',
    summary: 'A landmark volume in science writing by one of the world\'s greatest theoretical physicists, explaining cosmology, black holes, space-time, quantum mechanics, and the Big Bang to general readers.',
    isbn: '978-0553380163',
    publishedYear: 1988,
    copiesTotal: 3,
    copiesAvailable: 2,
    coverColor: 'violet',
    addedAt: '2026-05-15T14:45:00Z',
    tags: ['Physics', 'Cosmology', 'Space', 'Popular Science']
  },
  {
    id: 'book_mockingbird',
    title: 'To Kill a Mockingbird',
    author: 'Harper Lee',
    genre: 'Fiction',
    summary: 'Set in Maycomb, Alabama, during the Great Depression, the story centers around Atticus Finch, a local defense attorney who represents a Black man falsely accused of raping a white woman.',
    isbn: '978-0446310789',
    publishedYear: 1960,
    copiesTotal: 5,
    copiesAvailable: 5,
    coverColor: 'rose',
    addedAt: '2026-05-16T16:20:00Z',
    tags: ['Classic literature', 'Social Justice', 'Pulitzer Prize', 'American South']
  }
];

const initialUsers: User[] = [
  {
    id: 'user_librarian',
    username: 'Librarian Admin',
    email: 'librarian@smartlibrary.com',
    role: 'librarian',
    joinedAt: '2026-05-01T09:00:00Z',
    isActive: true
  },
  {
    id: 'user_sarah',
    username: 'Sarah Connor',
    email: 'sarah@student.com',
    role: 'student',
    studentId: 'CS-2025-09',
    joinedAt: '2026-05-02T10:00:00Z',
    isActive: true
  },
  {
    id: 'user_john',
    username: 'John Doe',
    email: 'john@student.com',
    role: 'student',
    studentId: 'EE-2024-42',
    joinedAt: '2026-05-03T11:15:00Z',
    isActive: true
  }
];

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const tenDaysAgo = new Date();
tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
const dueYesterday = new Date(tenDaysAgo);
dueYesterday.setDate(dueYesterday.getDate() + 7); // 7-day borrowing period

const initialIssues: IssueRecord[] = [
  {
    id: 'issue_1',
    bookId: 'book_history_time',
    bookTitle: 'A Brief History of Time',
    userId: 'user_john',
    userName: 'John Doe',
    studentId: 'EE-2024-42',
    issueDate: tenDaysAgo.toISOString(),
    dueDate: dueYesterday.toISOString(),
    returnDate: null,
    status: 'issued',
    fineAmount: 1.5, // 1 day overdue * $1.50 per day (or customizable)
    finePaid: false,
    notes: 'Please return as soon as possible.'
  },
  {
    id: 'issue_2',
    bookId: 'book_refactoring',
    bookTitle: 'Refactoring: Improving the Design of Existing Code',
    userId: 'user_sarah',
    userName: 'Sarah Connor',
    studentId: 'CS-2025-09',
    issueDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    returnDate: null,
    status: 'pending_approval',
    fineAmount: 0,
    finePaid: false,
    notes: 'Requested for upcoming coursework assignment.'
  },
  {
    id: 'issue_3',
    bookId: 'book_meditations',
    bookTitle: 'Meditations',
    userId: 'user_john',
    userName: 'John Doe',
    studentId: 'EE-2024-42',
    issueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    returnDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'returned',
    fineAmount: 0,
    finePaid: false,
    notes: 'Returned in pristine condition.'
  }
];

// Read DB from disk
function readDB(): { books: Book[]; users: User[]; issues: IssueRecord[] } {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const data = { books: initialBooks, users: initialUsers, issues: initialIssues };
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
      return data;
    }
    const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(fileContent);

    // Minor structural validation
    if (!parsed.books) parsed.books = [];
    if (!parsed.users) parsed.users = [];
    if (!parsed.issues) parsed.issues = [];
    return parsed;
  } catch (err) {
    console.error('Error reading/initializing database file:', err);
    return { books: initialBooks, users: initialUsers, issues: initialIssues };
  }
}

// Write DB to disk
function writeDB(data: { books: Book[]; users: User[]; issues: IssueRecord[] }) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing to database file:', err);
  }
}

// Helper to update active overdue issue fines dynamically
function updateFinesDynamically(issues: IssueRecord[]) {
  const rightNow = new Date();
  const fineRatePerDay = 1.0; // $1.00 USD per day overdue

  let modified = false;
  for (const record of issues) {
    if (record.status === 'issued' && !record.returnDate) {
      const dueDate = new Date(record.dueDate);
      if (rightNow > dueDate) {
        const msDiff = rightNow.getTime() - dueDate.getTime();
        const daysOverdue = Math.floor(msDiff / (1000 * 60 * 60 * 24));
        const computedFine = Math.max(0, daysOverdue * fineRatePerDay);
        if (record.fineAmount !== computedFine) {
          record.fineAmount = computedFine;
          modified = true;
        }
      }
    }
  }
  return modified;
}

// API Routes
// 1. Health & Status
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 2. Authentication
app.post('/api/auth/login', (req, res) => {
  const { email, role } = req.body;
  const db = readDB();
  
  // Find user by email
  let user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  // If not found, let's auto-register him for a friction-free experience
  if (!user) {
    user = {
      id: 'user_' + Math.random().toString(36).substr(2, 9),
      username: email.split('@')[0],
      email: email.toLowerCase(),
      role: role || 'student',
      studentId: role === 'librarian' ? undefined : 'STU-' + Math.floor(1000 + Math.random() * 9000),
      joinedAt: new Date().toISOString(),
      isActive: true
    };
    db.users.push(user);
    writeDB(db);
  }

  res.json(user);
});

app.post('/api/auth/register', (req, res) => {
  const { username, email, role, studentId } = req.body;
  if (!username || !email || !role) {
    return res.status(400).json({ error: 'Username, email and role are mandatory fields.' });
  }

  const db = readDB();
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'Email address already registered.' });
  }

  const newUser: User = {
    id: 'user_' + Math.random().toString(36).substr(2, 9),
    username,
    email: email.toLowerCase(),
    role,
    studentId: role === 'student' ? studentId || 'STU-' + Math.floor(1000 + Math.random() * 9000) : undefined,
    joinedAt: new Date().toISOString(),
    isActive: true
  };

  db.users.push(newUser);
  writeDB(db);

  res.json(newUser);
});

// 3. Books Management
app.get('/api/books', (req, res) => {
  const db = readDB();
  res.json(db.books);
});

app.post('/api/books', (req, res) => {
  const { title, author, genre, summary, isbn, publishedYear, copiesTotal, coverColor, tags } = req.body;
  if (!title || !author || !genre) {
    return res.status(400).json({ error: 'Title, Author, and Genre are required.' });
  }

  const db = readDB();
  const newBook: Book = {
    id: 'book_' + Math.random().toString(36).substr(2, 9),
    title,
    author,
    genre,
    summary: summary || 'No summary available.',
    isbn: isbn || 'N/A',
    publishedYear: publishedYear ? parseInt(publishedYear) : new Date().getFullYear(),
    copiesTotal: copiesTotal ? parseInt(copiesTotal) : 3,
    copiesAvailable: copiesTotal ? parseInt(copiesTotal) : 3,
    coverColor: coverColor || 'indigo',
    addedAt: new Date().toISOString(),
    tags: tags || []
  };

  db.books.push(newBook);
  writeDB(db);
  res.status(201).json(newBook);
});

app.put('/api/books/:id', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const index = db.books.findIndex(b => b.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Book not found' });
  }

  const originalBook = db.books[index];
  const updatedData = req.body;

  // Preserve dynamic copy parameters correctly
  const differenceTotal = (updatedData.copiesTotal ? parseInt(updatedData.copiesTotal) : originalBook.copiesTotal) - originalBook.copiesTotal;
  const newCopiesTotal = originalBook.copiesTotal + differenceTotal;
  const newCopiesAvailable = Math.max(0, originalBook.copiesAvailable + differenceTotal);

  db.books[index] = {
    ...originalBook,
    ...updatedData,
    copiesTotal: newCopiesTotal,
    copiesAvailable: newCopiesAvailable,
    publishedYear: updatedData.publishedYear ? parseInt(updatedData.publishedYear) : originalBook.publishedYear
  };

  writeDB(db);
  res.json(db.books[index]);
});

app.delete('/api/books/:id', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const initialCount = db.books.length;
  db.books = db.books.filter(b => b.id !== id);
  
  if (db.books.length === initialCount) {
    return res.status(404).json({ error: 'Book not found' });
  }

  // Set any issued records of this deleted book to marked notes
  db.issues = db.issues.map(record => {
    if (record.bookId === id) {
      return { ...record, notes: (record.notes || '') + ' [Warning: Book was deleted from catalog.]' };
    }
    return record;
  });

  writeDB(db);
  res.json({ success: true, message: 'Book deleted from catalog' });
});

// 4. Issue and Borrow Tracker
app.get('/api/issues', (req, res) => {
  const db = readDB();
  const isModified = updateFinesDynamically(db.issues);
  if (isModified) {
    writeDB(db);
  }
  res.json(db.issues);
});

app.post('/api/issues/request', (req, res) => {
  const { bookId, userId, userName, studentId, notes } = req.body;
  if (!bookId || !userId || !userName) {
    return res.status(400).json({ error: 'BookId, UserId, and Username are required.' });
  }

  const db = readDB();
  const book = db.books.find(b => b.id === bookId);
  const user = db.users.find(u => u.id === userId);

  if (!book) return res.status(404).json({ error: 'Book not found in library.' });
  if (book.copiesAvailable <= 0) {
    return res.status(400).json({ error: 'No available copies of this book left to borrow.' });
  }

  // Check if student already has this book borrowed/request pending
  const alreadyBorrowed = db.issues.some(
    record => record.bookId === bookId && record.userId === userId && ['pending_approval', 'issued'].includes(record.status)
  );
  if (alreadyBorrowed) {
    return res.status(400).json({ error: 'You already have an active borrowing or pending request for this book.' });
  }

  // Create borrowing request (7 day duration)
  const durationDays = 7;
  const issueDate = new Date();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + durationDays);

  const newIssue: IssueRecord = {
    id: 'issue_'.concat(Math.random().toString(36).substr(2, 9)),
    bookId,
    bookTitle: book.title,
    userId,
    userName,
    studentId: studentId || user?.studentId || 'N/A',
    issueDate: issueDate.toISOString(),
    dueDate: dueDate.toISOString(),
    returnDate: null,
    status: 'pending_approval',
    fineAmount: 0,
    finePaid: false,
    notes: notes || ''
  };

  db.issues.push(newIssue);
  writeDB(db);
  res.status(201).json(newIssue);
});

app.post('/api/issues/:id/approve', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const recordIndex = db.issues.findIndex(r => r.id === id);
  if (recordIndex === -1) return res.status(404).json({ error: 'Borrow record not found' });

  const record = db.issues[recordIndex];
  if (record.status !== 'pending_approval') {
    return res.status(400).json({ error: 'Record is not pending approval.' });
  }

  const bookIndex = db.books.findIndex(b => b.id === record.bookId);
  if (bookIndex === -1) return res.status(404).json({ error: 'Book no longer exists.' });

  const book = db.books[bookIndex];
  if (book.copiesAvailable <= 0) {
    return res.status(400).json({ error: 'No available copies remaining to issue.' });
  }

  // Approve issue
  record.status = 'issued';
  record.issueDate = new Date().toISOString();
  record.dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days from now

  // Deduct available book count
  book.copiesAvailable = Math.max(0, book.copiesAvailable - 1);

  writeDB(db);
  res.json({ record, book });
});

app.post('/api/issues/:id/reject', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const recordIndex = db.issues.findIndex(r => r.id === id);
  if (recordIndex === -1) return res.status(404).json({ error: 'Borrow record not found' });

  const record = db.issues[recordIndex];
  if (record.status !== 'pending_approval') {
    return res.status(400).json({ error: 'Record is not pending approval.' });
  }

  record.status = 'rejected';
  writeDB(db);
  res.json(record);
});

app.post('/api/issues/:id/return', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const recordIndex = db.issues.findIndex(r => r.id === id);
  if (recordIndex === -1) return res.status(404).json({ error: 'Borrow record not found' });

  const record = db.issues[recordIndex];
  if (record.status !== 'issued') {
    return res.status(400).json({ error: 'Record is not currently issued/active.' });
  }

  const bookIndex = db.books.findIndex(b => b.id === record.bookId);
  
  // Set returned
  record.status = 'returned';
  record.returnDate = new Date().toISOString();

  // Increment book copies
  if (bookIndex !== -1) {
    db.books[bookIndex].copiesAvailable = Math.min(db.books[bookIndex].copiesTotal, db.books[bookIndex].copiesAvailable + 1);
  }

  // Recalculate and freeze fine
  const dueDate = new Date(record.dueDate);
  const returnDate = new Date(record.returnDate);
  if (returnDate > dueDate) {
    const msDiff = returnDate.getTime() - dueDate.getTime();
    const daysOverdue = Math.floor(msDiff / (1000 * 60 * 60 * 24));
    record.fineAmount = Math.max(0, daysOverdue * 1.0);
  } else {
    record.fineAmount = 0;
  }

  writeDB(db);
  res.json({ record, book: bookIndex !== -1 ? db.books[bookIndex] : null });
});

app.post('/api/issues/:id/pay-fine', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const record = db.issues.find(r => r.id === id);
  if (!record) return res.status(404).json({ error: 'Borrow record not found' });

  record.finePaid = true;
  writeDB(db);
  res.json(record);
});

// 5. Users List
app.get('/api/users', (req, res) => {
  const db = readDB();
  res.json(db.users);
});

// 6. Stats Aggregate
app.get('/api/stats', (req, res) => {
  const db = readDB();
  updateFinesDynamically(db.issues);
  
  const totalBooks = db.books.length;
  const totalCopies = db.books.reduce((sum, b) => sum + b.copiesTotal, 0);
  const availableCopies = db.books.reduce((sum, b) => sum + b.copiesAvailable, 0);
  const activeIssues = db.issues.filter(r => r.status === 'issued').length;
  const overdueIssues = db.issues.filter(r => r.status === 'issued' && new Date() > new Date(r.dueDate)).length;
  const pendingApprovals = db.issues.filter(r => r.status === 'pending_approval').length;
  const totalCollectedFines = db.issues.filter(r => r.finePaid).reduce((sum, r) => sum + r.fineAmount, 0);

  const stats: LibraryStats = {
    totalBooks,
    totalCopies,
    availableCopies,
    activeIssues,
    overdueIssues,
    pendingApprovals,
    totalCollectedFines
  };

  res.json(stats);
});

// Reset database route to seed values (for testing demo states easily)
app.post('/api/utility/reset', (req, res) => {
  const data = { books: initialBooks, users: initialUsers, issues: initialIssues };
  writeDB(data);
  res.json({ success: true, message: 'Database reset to initial seed values successfully.' });
});


// 7. Smart AI Assistant Panel
app.post('/api/ai/assistant', async (req, res) => {
  const { messages, currentCatalogText } = req.body;
  
  if (!ai) {
    return res.status(503).json({ 
      reply: "The AI Librarian Assistant is currently offline or the API key environment variable is not configured. Please check the Secrets panel, or use the app manually." 
    });
  }

  try {
    const chatHistory = messages || [];
    const recentPromptObj = chatHistory[chatHistory.length - 1];
    const userPrompt = recentPromptObj ? recentPromptObj.text : "Hello AI Librarian";

    const catalogDetails = currentCatalogText || "No catalog provided.";

    const systemPrompt = `You are Alex, the friendly and intellectual Smart AI Librarian.
Your job is to assist students and librarians using this digital Smart Library Management System.
You should:
1. Provide personalized reading suggestions, summarizing books in an elegant, punchy way.
2. Answer inquiries about classic or professional literature, author history, or computer science theories.
3. Suggest which books searchers might like *using the library catalog listed below* whenever helpful.
4. Keep your replies concise, warm, professional, markdown-formatted, and visually scannable.

--- CURRENT LIBRARY CATALOG ---
${catalogDetails}
------------------------------

Please respond directly to the student or librarian. Try to mention a specific book from the catalog where appropriate.`;

    // Construct history array for chat in SDK format
    const contents: any[] = [];
    // Only pass the last 6 messages to keep tokens low and responses fast
    const historyToUse = chatHistory.slice(-6, -1);
    for (const msg of historyToUse) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      });
    }

    // Add current prompt
    contents.push({
      role: 'user',
      parts: [{ text: userPrompt }]
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      }
    });

    res.json({ reply: response.text });
  } catch (error: any) {
    console.error('Error calling AI API for Advisor:', error);
    res.status(500).json({ 
      error: 'Failed to communicate with AI: ' + (error.message || String(error)),
      reply: "Ah, I faced minor turbulence retrieving your answer. Let me know if you would like me to try again!" 
    });
  }
});

// 8. Smart AI Book Autofill Metadata Service
app.post('/api/ai/fill-metadata', async (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'A book title is required to generate metadata.' });
  }

  if (!ai) {
    return res.status(503).json({
      error: 'AI fill service is unavailable because the API key is missing.'
    });
  }

  try {
    const prompt = `Return a structured JSON object representing high-quality metadata for a book with the title: "${title}".
If the book is real and well-known, return the actual info of the book. If fictional or obscure, expand on the title to create rich and engaging metadata.
You must provide fields mapping directly to standard library schemas.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['title', 'author', 'genre', 'summary', 'isbn', 'publishedYear', 'coverColor', 'tags'],
          properties: {
            title: { type: Type.STRING, description: 'Corrected or official full book title' },
            author: { type: Type.STRING, description: 'Author names' },
            genre: { 
              type: Type.STRING, 
              description: 'Select one from standard library genres: "Computer Science", "Software Engineering", "Philosophy", "Science Fiction", "Science", "Fiction", "History", "Biography", "Business", "Drama", "Poetry"' 
            },
            summary: { type: Type.STRING, description: 'A highly descriptive 2-3 sentence teaser/intro' },
            isbn: { type: Type.STRING, description: 'Estimated or fictitious 13-digit ISBN starting with 978-' },
            publishedYear: { type: Type.INTEGER, description: 'Original release year' },
            coverColor: { 
              type: Type.STRING, 
              description: 'The thematic color of the cover, choose exactly one from: "indigo", "emerald", "amber", "slate", "violet", "rose", "sky", "teal", "fuchsia"' 
            },
            tags: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: '3 or 4 relevant tag keywords' 
            }
          }
        }
      }
    });

    const metadata = JSON.parse(response.text || '{}');
    res.json(metadata);
  } catch (error: any) {
    console.error('Error in AI metadata autofill:', error);
    res.status(500).json({ error: 'AI Autofill failed: ' + (error.message || String(error)) });
  }
});

// 9. Recommendation engine
app.post('/api/ai/recommend', async (req, res) => {
  const { interests } = req.body;
  if (!interests) {
    return res.status(400).json({ error: 'Interests string is required of student.' });
  }

  if (!ai) {
    return res.status(503).json({ error: 'Recommendation API is offline.' });
  }

  try {
    const prompt = `The student has expressed the following reading interest: "${interests}".
Analyze their interest and provide:
1. Two real-world classic or modern books they MUST read.
2. A single sentence explaining why each matches their interests.
3. Recommended genres they should explore.
Format the output strictly as a JSON object matching this schema:
{
  "recommendations": [
    { "title": "...", "author": "...", "whyText": "..." }
  ],
  "suggestedGenres": ["...", "..."]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['recommendations', 'suggestedGenres'],
          properties: {
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ['title', 'author', 'whyText'],
                properties: {
                  title: { type: Type.STRING },
                  author: { type: Type.STRING },
                  whyText: { type: Type.STRING }
                }
              }
            },
            suggestedGenres: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch recommendations: ' + (error.message || String(error)) });
  }
});

// Serve frontend and static assets
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: express.Request, res: express.Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Library Developer server listening on port ${PORT}`);
  });
}

startServer();

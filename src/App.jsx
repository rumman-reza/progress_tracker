import React, { useState, useEffect, useMemo } from 'react';
import { Upload, CheckCircle2, Clock, SkipForward, Circle, Filter } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyCoHQlvVw4-Qn23Tp7t6MCGIPBNGB9dzps",
  authDomain: "progress-tracker-1acbe.firebaseapp.com",
  projectId: "progress-tracker-1acbe",
  storageBucket: "progress-tracker-1acbe.firebasestorage.app",
  messagingSenderId: "413447855978",
  appId: "1:413447855978:web:628b78e88566ef58dd4f13",
  measurementId: "G-CJEF77LDWD"
};const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- DATA MODEL ---
const TOPICS = [
  { name: "Propositional Logic & First Order Logic", start: 1, end: 26 },
  { name: "Proof", start: 27, end: 35 },
  { name: "Proof by Induction", start: 36, end: 51 },
  { name: "Set & Inclusion-Exclusion", start: 52, end: 56 },
  { name: "Graph & Tree", start: 57, end: 80 },
  { name: "Function & Relation", start: 81, end: 107 },
  { name: "Algebraic Structure", start: 108, end: 111 },
  { name: "Discrete Probability", start: 112, end: 116 },
  { name: "Number Theory", start: 117, end: 120 },
  { name: "Counting", start: 121, end: 146 },
  { name: "Pigeonhole Principle", start: 147, end: 158 },
  { name: "Recursion", start: 159, end: 171 },
  { name: "Generating Function", start: 172, end: 179 },
  { name: "Number Sequence", start: 180, end: 184 },
  { name: "Miscellaneous", start: 185, end: 189 }
];

const QUESTIONS = [];
TOPICS.forEach(t => {
  for (let i = t.start; i <= t.end; i++) {
    QUESTIONS.push({ id: i, topic: t.name });
  }
});

const STATUS_ORDER = ['Not Started', 'Done', 'Do Later', 'Skipped'];
const STATUS_COLORS = {
  'Not Started': 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50',
  'Done': 'bg-green-50 border-green-400 text-green-700 shadow-inner',
  'Do Later': 'bg-amber-50 border-amber-400 text-amber-700 shadow-inner',
  'Skipped': 'bg-slate-100 border-slate-300 text-slate-500 shadow-inner'
};

export default function App() {
  const [user, setUser] = useState(null);
  const [progress, setProgress] = useState({});
  const [pdfUrl, setPdfUrl] = useState(null);
  
  // Filters
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterTopic, setFilterTopic] = useState('All');

  // --- AUTHENTICATION ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth init failed", err);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- FIRESTORE SYNC ---
  useEffect(() => {
    if (!user) return;
    
    const progressDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'progress', 'CSE103');
    
    const unsubscribe = onSnapshot(progressDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setProgress(docSnap.data());
      } else {
        setProgress({});
      }
    }, (error) => {
      console.error("Snapshot error:", error);
    });
    
    return () => unsubscribe();
  }, [user]);

  // --- EVENT HANDLERS ---
  const handlePdfUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
    }
  };

  const toggleQuestionStatus = async (qId) => {
    if (!user) return;
    
    const currentStatus = progress[qId] || 'Not Started';
    const nextStatus = STATUS_ORDER[(STATUS_ORDER.indexOf(currentStatus) + 1) % STATUS_ORDER.length];
    
    // Optimistic UI update
    const newProgress = { ...progress, [qId]: nextStatus };
    setProgress(newProgress);

    // Save to Firestore
    try {
      const progressDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'progress', 'CSE103');
      await setDoc(progressDocRef, newProgress, { merge: true });
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  // --- DERIVED STATE ---
  const stats = useMemo(() => {
    let done = 0, doLater = 0, skipped = 0;
    Object.values(progress).forEach(status => {
      if (status === 'Done') done++;
      if (status === 'Do Later') doLater++;
      if (status === 'Skipped') skipped++;
    });
    return { 
      done, 
      doLater, 
      skipped, 
      notStarted: 189 - done - doLater - skipped,
      percentage: Math.round((done / 189) * 100) 
    };
  }, [progress]);

  const filteredQuestions = useMemo(() => {
    return QUESTIONS.filter(q => {
      const status = progress[q.id] || 'Not Started';
      const matchTopic = filterTopic === 'All' || q.topic === filterTopic;
      const matchStatus = filterStatus === 'All' || 
                         (filterStatus === 'Needs Review' && status === 'Do Later') ||
                         status === filterStatus;
      return matchTopic && matchStatus;
    });
  }, [filterTopic, filterStatus, progress]);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-50 font-sans text-slate-800">
      
      {/* LEFT PANEL: PDF VIEWER */}
      <div className="w-full md:w-1/2 h-1/2 md:h-full border-b md:border-b-0 md:border-r border-slate-200 bg-white flex flex-col">
        {!pdfUrl ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
              <Upload size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-700">Load Question Bank</h2>
              <p className="text-slate-500 mt-2">Upload your local "[TFQB] CSE103.pdf" file to view alongside the tracker.</p>
            </div>
            <label className="mt-4 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors shadow-sm">
              Select PDF
              <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} />
            </label>
          </div>
        ) : (
          <div className="flex-1 relative">
            <iframe 
              src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`} 
              className="w-full h-full border-none"
              title="PDF Viewer"
            />
            <button 
              onClick={() => setPdfUrl(null)}
              className="absolute bottom-4 right-4 bg-slate-800 text-white p-2 rounded shadow-lg hover:bg-slate-700 text-sm"
            >
              Close PDF
            </button>
          </div>
        )}
      </div>

      {/* RIGHT PANEL: TRACKER */}
      <div className="w-full md:w-1/2 h-1/2 md:h-full overflow-y-auto flex flex-col bg-slate-50">
        
        {/* Header & Dashboard */}
        <div className="p-6 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">CSE 103 Tracker</h1>
              <p className="text-sm text-slate-500 font-medium">Term Final Question Bank</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-blue-600">{stats.percentage}%</div>
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Completed</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex mb-4">
            <div style={{ width: `${(stats.done / 189) * 100}%` }} className="h-full bg-green-500 transition-all duration-500" />
            <div style={{ width: `${(stats.doLater / 189) * 100}%` }} className="h-full bg-amber-400 transition-all duration-500" />
            <div style={{ width: `${(stats.skipped / 189) * 100}%` }} className="h-full bg-slate-300 transition-all duration-500" />
          </div>

          {/* Stat Legend */}
          <div className="flex space-x-4 text-xs font-medium text-slate-600 mb-6">
            <div className="flex items-center"><CheckCircle2 size={14} className="text-green-500 mr-1" /> {stats.done} Done</div>
            <div className="flex items-center"><Clock size={14} className="text-amber-500 mr-1" /> {stats.doLater} Do Later</div>
            <div className="flex items-center"><SkipForward size={14} className="text-slate-400 mr-1" /> {stats.skipped} Skipped</div>
            <div className="flex items-center"><Circle size={14} className="text-slate-300 mr-1" /> {stats.notStarted} Left</div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {['All', 'Done', 'Needs Review', 'Skipped'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setFilterStatus(filter)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    filterStatus === filter ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <select 
                value={filterTopic}
                onChange={(e) => setFilterTopic(e.target.value)}
                className="w-full appearance-none bg-slate-100 border border-transparent text-slate-600 text-sm rounded-lg pl-3 pr-8 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              >
                <option value="All">All Topics</option>
                {TOPICS.map(t => (
                  <option key={t.name} value={t.name}>{t.name} ({t.start}-{t.end})</option>
                ))}
              </select>
              <Filter size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Question Grid */}
        <div className="p-6">
          <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-8 gap-3">
            {filteredQuestions.map(q => {
              const status = progress[q.id] || 'Not Started';
              return (
                <button
                  key={q.id}
                  title={`${q.topic} - ${status}`}
                  onClick={() => toggleQuestionStatus(q.id)}
                  className={`
                    h-12 flex items-center justify-center rounded-lg border-2 font-bold text-sm transition-all
                    active:scale-95 focus:outline-none
                    ${STATUS_COLORS[status]}
                  `}
                >
                  {q.id}
                </button>
              );
            })}
          </div>
          {filteredQuestions.length === 0 && (
            <div className="text-center py-12 text-slate-400 font-medium">
              No questions match the current filters.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, query, onSnapshot, orderBy } from 'firebase/firestore';
import { 
  Camera, Droplets, Utensils, Scale, Moon, Calendar, Heart, 
  ChevronRight, TrendingUp, Plus, Trash2, Sparkles, ChevronLeft, 
  Image as ImageIcon, Activity, CheckCircle2, BrainCircuit, 
  Smile, Coffee, Sun, Sunrise, Sunset, Flame, Leaf, Pill, 
  Milk, Dumbbell, Zap, XCircle, Wand2, LayoutGrid, Edit3, RotateCcw, Columns, Check
} from 'lucide-react';

// --- Firebase 配置 (請替換為妳在 Firebase Console 取得的配置) ---
const firebaseConfig = {
  apiKey: "AIzaSyAw-vcd1rzVEf3aEW9QTRHac-X2k06rjZU",
  authDomain: "kiwibodyapp.firebaseapp.com",
  projectId: "kiwibodyapp",
  storageBucket: "kiwibodyapp.firebasestorage.app",
  messagingSenderId: "563786432046",
  appId: "1:563786432046:web:016448b8726e23c18fe9bf",
  measurementId: "G-JKT2QNR6VT"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'body-journey-pro';
const GEMINI_API_KEY = "AIzaSyCVG_4mKRkn0isI21G3cTYhvSK9oeIA294"; // 填入您的 Gemini API Key

const App = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('log');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiResponse, setAiResponse] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [compareSelection, setCompareSelection] = useState([]);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const initialEntry = {
    date: new Date().toISOString().split('T')[0],
    weight: "", bodyFat: "",
    measurements: { chest: "", waist: "", hips: "" },
    food: "", water: "", sleep: "",
    poop: false, period: false, ovulation: false, intimacy: false,
    mood: "neutral",
    tcm: { breakfast: false, lunch: false, dinner: false, tea: false, booster: false, probiotics: false, fiber: false, vitamins: false },
    exercise: { did: false, detail: "" },
    photo: null
  };

  const [entry, setEntry] = useState(initialEntry);

  // --- 1. 身份驗證 (Rule 3) ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth failed", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // --- 2. 資料即時同步 (Rule 1 & 2) ---
  useEffect(() => {
    if (!user) return;
    // 使用指定路徑儲存使用者私有數據
    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'logs');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setHistory(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
      setLoading(false);
    }, (error) => {
      console.error("Firestore error", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // --- 功能邏輯 ---
  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setEntry(prev => ({ ...prev, [parent]: { ...prev[parent], [child]: type === 'checkbox' ? checked : value } }));
    } else {
      setEntry(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setEntry(prev => ({ ...prev, photo: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const saveEntry = async () => {
    if (!user) return;
    try {
      // 使用日期作為 Document ID (Rule 1)
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'logs', entry.date), {
        ...entry,
        timestamp: Date.now()
      });
      showToast("進度已同步至雲端 ✨");
    } catch (err) {
      showToast("儲存失敗", "error");
    }
  };

  const getAiAdvice = async () => {
    if (!GEMINI_API_KEY) return showToast("請先設定 API Key", "error");
    setIsGeneratingAi(true);
    const tcmStatus = Object.entries(entry.tcm).filter(([_, v]) => v).map(([k]) => k).join(', ');
    const prompt = `我正在減肥，今日數據：體重${entry.weight}kg, 飲食: ${entry.food}, 運動: ${entry.exercise.detail}, 調理: ${tcmStatus}。請給予簡短、具體的專業建議與鼓勵。`;

    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const result = await resp.json();
      setAiResponse(result.candidates[0].content.parts[0].text);
    } catch (err) {
      setAiResponse("✨ 導師提醒：今天做得很好！記得多喝水維持代謝，晚上早點休息喔。");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // --- 日曆計算 ---
  const daysInMonth = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    return [...Array(firstDay).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];
  }, [calendarDate]);

  const historyWithPhotos = useMemo(() => history.filter(h => h.photo), [history]);
  const isExisting = useMemo(() => history.some(h => h.date === entry.date), [entry.date, history]);

  // --- 子組件 ---
  const LogTab = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
          {isExisting ? <Edit3 className="text-pink-500" /> : <Plus className="text-pink-500" />}
          {isExisting ? "更新紀錄" : "今日記錄"}
        </h2>
        <input type="date" name="date" value={entry.date} onChange={handleInputChange} className="bg-pink-50 text-pink-600 font-black px-4 py-2 rounded-2xl border-none text-xs outline-none shadow-inner" />
      </div>

      {/* 心情氣泡 */}
      <div className="flex justify-between bg-gray-100/50 p-2.5 rounded-[2rem] border border-gray-100">
        {['😫', '😢', '😐', '🙂', '🤩'].map((emoji, idx) => {
          const mId = ['awful', 'sad', 'neutral', 'good', 'great'][idx];
          return (
            <button key={mId} onClick={() => setEntry(prev => ({...prev, mood: mId}))} className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all ${entry.mood === mId ? 'bg-white shadow-lg scale-110 text-2xl' : 'opacity-30 grayscale'}`}>
              {emoji}
            </button>
          );
        })}
      </div>

      {/* 調理網格 */}
      <div className="grid grid-cols-4 gap-2.5">
        {[
          { id: 'breakfast', label: '早', icon: Sunrise }, { id: 'lunch', label: '中', icon: Sun },
          { id: 'dinner', label: '晚', icon: Sunset }, { id: 'tea', label: '茶', icon: Leaf },
          { id: 'booster', label: '強', icon: Flame }, { id: 'probiotics', label: '菌', icon: Pill },
          { id: 'fiber', label: '代', icon: Milk }, { id: 'vitamins', label: '維', icon: Zap }
        ].map(item => (
          <label key={item.id} className={`flex flex-col items-center py-3.5 rounded-[1.5rem] border transition-all cursor-pointer active:scale-90 ${entry.tcm[item.id] ? 'bg-amber-50 border-amber-300 shadow-sm' : 'bg-white border-gray-100'}`}>
            <item.icon size={16} className={entry.tcm[item.id] ? 'text-amber-600' : 'text-gray-300'} />
            <span className={`text-[10px] mt-1.5 font-black ${entry.tcm[item.id] ? 'text-amber-800' : 'text-gray-400'}`}>{item.label}</span>
            <input type="checkbox" name={`tcm.${item.id}`} checked={entry.tcm[item.id]} onChange={handleInputChange} className="hidden" />
          </label>
        ))}
      </div>

      {/* 數據卡片 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-orange-50 p-6 rounded-[2.5rem] border border-orange-100 shadow-sm">
          <label className="text-[10px] text-orange-600 font-black uppercase tracking-widest mb-2 block">Weight</label>
          <div className="flex items-baseline gap-1">
            <input type="number" name="weight" value={entry.weight} onChange={handleInputChange} className="bg-transparent text-3xl font-black w-full outline-none text-orange-900" placeholder="0.0" />
            <span className="text-xs font-black text-orange-300">KG</span>
          </div>
        </div>
        <div className="bg-blue-50 p-6 rounded-[2.5rem] border border-blue-100 shadow-sm">
          <label className="text-[10px] text-blue-600 font-black uppercase tracking-widest mb-2 block">Fat %</label>
          <div className="flex items-baseline gap-1">
            <input type="number" name="bodyFat" value={entry.bodyFat} onChange={handleInputChange} className="bg-transparent text-3xl font-black w-full outline-none text-blue-900" placeholder="0.0" />
            <span className="text-xs font-black text-blue-300">%</span>
          </div>
        </div>
      </div>

      {/* 體圍 & 健康開關 */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
        <div className="grid grid-cols-3 gap-3">
          {['chest', 'waist', 'hips'].map(p => (
            <div key={p} className="bg-gray-50 p-3 rounded-2xl shadow-inner text-center">
              <label className="text-[10px] text-gray-400 font-black uppercase mb-1 block">{p === 'chest'?'胸':p==='waist'?'腰':'臀'}</label>
              <input type="number" name={`measurements.${p}`} value={entry.measurements[p]} onChange={handleInputChange} className="bg-transparent text-center font-black w-full outline-none text-sm" placeholder="--" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'poop', label: '順暢', icon: Sparkles, color: 'emerald' },
            { id: 'period', label: '生理', icon: Droplets, color: 'pink' }
          ].map(tag => (
            <label key={tag.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${entry[tag.id] ? `bg-${tag.color}-50 border-${tag.color}-200` : 'bg-white border-gray-50'}`}>
              <span className="text-sm font-black flex items-center gap-2"><tag.icon size={16} className={`text-${tag.color}-500`} /> {tag.label}</span>
              <input type="checkbox" name={tag.id} checked={entry[tag.id]} onChange={handleInputChange} className="hidden" />
              <div className={`w-4 h-4 rounded-full border-2 ${entry[tag.id] ? `bg-${tag.color}-500 border-${tag.color}-500` : 'border-gray-200'}`}></div>
            </label>
          ))}
        </div>
      </div>

      {/* 飲食與照片 */}
      <div className="space-y-4">
        <textarea name="food" value={entry.food} onChange={handleInputChange} className="w-full bg-gray-50 rounded-[2rem] p-6 font-bold text-sm h-36 outline-none border border-transparent focus:border-pink-200 shadow-inner" placeholder="今天吃了哪些美味？"></textarea>
        <div className="relative">
          {entry.photo ? (
            <div className="relative h-72 rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white">
              <img src={entry.photo} className="w-full h-full object-cover" alt="Progress" />
              <button onClick={() => setEntry(prev => ({...prev, photo: null}))} className="absolute top-5 right-5 bg-black/50 text-white p-3 rounded-full backdrop-blur-md"><Trash2 size={20}/></button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-56 border-2 border-dashed border-gray-200 rounded-[3rem] cursor-pointer hover:bg-pink-50/30 transition-all">
              <Camera size={40} className="text-gray-300 mb-2"/>
              <span className="text-xs text-gray-400 font-black uppercase tracking-widest">Upload Photo</span>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </label>
          )}
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <button onClick={saveEntry} className="w-full bg-gray-900 text-white font-black py-5 rounded-[2rem] shadow-2xl active:scale-95 transition-all">
          {isExisting ? "更新雲端紀錄" : "儲存今日進度"}
        </button>
        <button onClick={getAiAdvice} disabled={isGeneratingAi} className="w-full bg-white border-2 border-pink-100 text-pink-600 font-black py-5 rounded-[2rem] flex items-center justify-center gap-2 active:scale-95">
          {isGeneratingAi ? <RotateCcw className="animate-spin" /> : <><BrainCircuit size={22}/> ✨ AI 智慧導師分析</>}
        </button>
      </div>

      {aiResponse && (
        <div className="p-7 bg-indigo-50 rounded-[2.5rem] border border-indigo-100 shadow-sm animate-in zoom-in-95 duration-300">
          <p className="text-sm text-indigo-900 font-bold leading-relaxed">{aiResponse}</p>
        </div>
      )}
    </div>
  );

  const HistoryTab = () => (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="bg-white rounded-[2.5rem] p-7 shadow-sm border border-gray-50">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} className="p-3 bg-gray-50 rounded-2xl"><ChevronLeft size={20} className="text-pink-500"/></button>
          <span className="font-black text-gray-800 text-lg">{calendarDate.getFullYear()}年 {calendarDate.getMonth() + 1}月</span>
          <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} className="p-3 bg-gray-50 rounded-2xl"><ChevronRight size={20} className="text-pink-500"/></button>
        </div>
        <div className="grid grid-cols-7 gap-2 text-center">
          {['日','一','二','三','四','五','六'].map(d => <div key={d} className="text-[10px] font-black text-gray-300 pb-4">{d}</div>)}
          {daysInMonth.map((day, idx) => {
            if (!day) return <div key={idx} className="h-10"></div>;
            const dStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const hasLog = history.some(h => h.date === dStr);
            return (
              <div key={idx} className="relative h-11 flex items-center justify-center">
                <div className={`w-9 h-9 flex items-center justify-center text-xs font-black rounded-full transition-all ${hasLog ? 'bg-pink-50 text-pink-600 shadow-sm' : 'text-gray-400'}`}>
                  {day}
                </div>
                {hasLog && <div className="absolute bottom-1 w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse"></div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-5">
        {history.map((log) => (
          <div key={log.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-50 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-black text-xl text-gray-800 tracking-tighter">{log.date}</h3>
                <div className="flex gap-2 mt-2">
                  {log.period && <span className="text-[10px] bg-pink-100 text-pink-600 px-3 py-1 rounded-full font-black">生理期</span>}
                  {log.poop && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-black">順暢</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-2xl font-black text-pink-500">{log.weight}</span>
                  <span className="text-[10px] text-gray-300 font-bold ml-1 uppercase">KG</span>
                </div>
                <button onClick={() => { setEntry(log); setActiveTab('log'); window.scrollTo(0,0); }} className="p-2.5 bg-pink-50 text-pink-500 rounded-xl active:scale-90"><Edit3 size={18}/></button>
              </div>
            </div>
            {log.photo && <img src={log.photo} className="w-full h-56 object-cover rounded-[1.5rem] shadow-inner" alt="History" />}
          </div>
        ))}
      </div>
    </div>
  );

  const CompareTab = () => (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="px-2">
        <h2 className="text-2xl font-black text-gray-800 tracking-tighter">成效對比</h2>
        <p className="text-xs text-gray-400 font-bold mt-1 uppercase tracking-widest">Compare your progress</p>
      </div>

      {compareSelection.length === 2 ? (
        <div className="grid grid-cols-2 gap-4 bg-white p-5 rounded-[3rem] shadow-2xl border border-pink-50">
          {compareSelection.sort((a,b) => new Date(a.date) - new Date(b.date)).map((item, i) => (
            <div key={i} className="space-y-4">
              <div className="h-80 rounded-[2rem] overflow-hidden shadow-inner border border-gray-100">
                <img src={item.photo} className="w-full h-full object-cover" alt="Compare" />
              </div>
              <div className="text-center">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{i === 0 ? 'BEFORE' : 'AFTER'}</div>
                <div className="text-xs font-black text-gray-800">{item.date}</div>
                <div className="text-xl font-black text-pink-500">{item.weight}kg</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-12 rounded-[3rem] border-2 border-dashed border-gray-100 text-center space-y-4">
          <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center mx-auto shadow-inner text-pink-200"><Columns size={40} /></div>
          <p className="text-sm font-black text-gray-400">請從下方選擇 2 張照片<br/>來看看妳的驚人變化 ✨</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 pt-4">
        {historyWithPhotos.map((item) => {
          const isSelected = compareSelection.some(p => p.id === item.id);
          return (
            <button key={item.id} onClick={() => {
              setCompareSelection(prev => {
                if (isSelected) return prev.filter(p => p.id !== item.id);
                if (prev.length >= 2) return [prev[1], item];
                return [...prev, item];
              });
            }} className={`relative aspect-[3/4] rounded-2xl overflow-hidden border-4 transition-all ${isSelected ? 'border-pink-500 scale-95 shadow-xl' : 'border-white shadow-sm'}`}>
              <img src={item.photo} className="w-full h-full object-cover" alt="Selection" />
              {isSelected && <div className="absolute inset-0 bg-pink-500/20 flex items-center justify-center"><div className="bg-white rounded-full p-1 shadow-lg"><Check size={16} className="text-pink-500" strokeWidth={4}/></div></div>}
              <div className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-[9px] font-black py-1.5">{item.date.slice(5)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFCFD] font-sans text-gray-900 select-none pb-24">
      {/* 頂部 Header */}
      <header className="px-7 pt-16 pb-8 bg-white/80 backdrop-blur-2xl sticky top-0 z-50 border-b border-gray-50 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tighter">美體日誌</h1>
          <p className="text-[10px] font-black text-pink-400 uppercase tracking-[0.3em] mt-1">Professional Edition</p>
        </div>
        <button onClick={() => { setEntry(initialEntry); setActiveTab('log'); }} className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 active:rotate-180 transition-transform duration-500"><RotateCcw size={22}/></button>
      </header>

      {/* Toast 提示 */}
      {toast.show && (
        <div className="fixed top-32 inset-x-0 z-[60] flex justify-center px-8 animate-in slide-in-from-top-10">
          <div className={`px-6 py-4 rounded-[1.5rem] shadow-2xl font-black text-sm text-white flex items-center gap-3 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-gray-900'}`}>
            {toast.type === 'error' ? <XCircle size={20}/> : <CheckCircle2 size={20}/>}
            {toast.message}
          </div>
        </div>
      )}

      {/* 主內容區 */}
      <main className="px-6 pt-6 max-w-lg mx-auto">
        {activeTab === 'log' && <LogTab />}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'compare' && <CompareTab />}
      </main>

      {/* 底部導航欄 */}
      <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-white/95 backdrop-blur-3xl border-t border-gray-50 px-10 py-7 flex justify-around items-center z-50 safe-bottom shadow-[0_-15px_40px_rgba(0,0,0,0.03)]">
        <button onClick={() => setActiveTab('log')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'log' ? 'text-pink-500 scale-125' : 'text-gray-300 opacity-60'}`}>
          <Plus size={26} strokeWidth={4} />
          <span className="text-[8px] font-black uppercase tracking-widest">Log</span>
        </button>
        <button onClick={() => setActiveTab('compare')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'compare' ? 'text-pink-500 scale-125' : 'text-gray-300 opacity-60'}`}>
          <Columns size={26} strokeWidth={4} />
          <span className="text-[8px] font-black uppercase tracking-widest">Comp</span>
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'history' ? 'text-pink-500 scale-125' : 'text-gray-300 opacity-60'}`}>
          <Calendar size={26} strokeWidth={4} />
          <span className="text-[8px] font-black uppercase tracking-widest">Hist</span>
        </button>
      </nav>

      {/* 裝飾背景 */}
      <div className="fixed top-40 -left-20 w-80 h-80 bg-pink-100 rounded-full mix-blend-multiply filter blur-[100px] opacity-20 -z-10 animate-pulse"></div>
      <div className="fixed bottom-60 -right-20 w-96 h-96 bg-indigo-100 rounded-full mix-blend-multiply filter blur-[100px] opacity-20 -z-10 animate-pulse delay-1000"></div>
    </div>
  );
};

export default App;
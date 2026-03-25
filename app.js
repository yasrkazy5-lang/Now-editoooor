/* ===== AI Edit Director — app.js ===== */

const { useState, useRef, useEffect, useCallback } = React;

// ─── Config ───────────────────────────────────────────────
const API_KEY = "AIzaSyCfVy2IWyKG93bkZsRIzkW5u1fs4bUeJSg";

// يجرب كل موديل تلقائياً حتى يلاقي واحد شغال
const MODELS = [
  "gemini-1.5-flash"
];

const SYSTEM_PROMPT = `أنت "AI Edit Director" — مخرج إيدتات محترف وناقد فيديو متخصص. مهمتك تحليل أي فيديو أو صورة بدقة شديدة وإعطاء فيدباك احترافي وصريح بالعربية.

قواعد الرد:
1. كن صريحًا ومباشرًا — لا تجامل
2. حدد العيوب بدقة (مثلاً: "سكوت في ثانية 0:10"، "ترانزيشن ضعيف في 0:15")
3. اقترح ماذا تُضيف: SFX محددة، ميمز، أوفرلايات، فلاتر
4. اقترح ماذا تحذف: اي كليب ممل أو يكسر البيسينج
5. حدد التايمكودات بدقة لكل تعديل مقترح
6. صنّف الفيديو: فانك إيدت / جيمينج إيدت / فيديو عادي / تصميم
7. أعطِ تقييم من 10 لكل عنصر: الكتينج، التايمنج، الإفكتات، الصوت
8. اختم بـ "خطة تحرير" واضحة خطوة بخطوة

الأسلوب: محترف، تقني، حاد، لكن مفيد.`;

// ─── Helpers ──────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatAIResponse(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,     '<em>$1</em>')
    .replace(/^- (.+)$/gm,    '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n/g, '<br/>');
}

function nowTime() {
  return new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
}

// جرّب الموديلات واحد واحد حتى يشتغل
async function callGemini(parts) {
  let lastError = '';
  for (const model of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 2048 }
        })
      });
      const data = await res.json();
      if (!res.ok) {
        lastError = data.error?.message || `فشل مع ${model}`;
        continue; // جرّب الموديل الجاي
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (e) {
      lastError = e.message;
    }
  }
  throw new Error('كل الموديلات فشلت: ' + lastError);
}

// ─── TypingIndicator ──────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{
      padding: 16, maxWidth: 220, display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--card2)', border: '1px solid rgba(191,0,255,0.2)',
      borderRadius: '4px 18px 18px 18px'
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'linear-gradient(135deg, #00f5ff22, #bf00ff22)',
        border: '1px solid rgba(0,245,255,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: 14
      }}>🎬</div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>يراجع اللقطات...</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="typing-dot"></span>
          <span className="typing-dot"></span>
          <span className="typing-dot"></span>
        </div>
      </div>
    </div>
  );
}

// ─── Message ──────────────────────────────────────────────
function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      gap: 6
    }}>
      {msg.file && (
        <div style={{ maxWidth: '70%' }}>
          {msg.file.type.startsWith('image/') ? (
            <img src={msg.file.preview} alt="مرفق" style={{
              maxHeight: 180, borderRadius: 12,
              border: '1px solid rgba(0,245,255,0.3)',
              boxShadow: '0 0 20px rgba(0,245,255,0.15)'
            }} />
          ) : (
            <div className="file-badge" style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 24 }}>🎬</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cyan)' }}>{msg.file.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{(msg.file.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
            </div>
          )}
        </div>
      )}
      {msg.text && (
        <div className={isUser ? 'msg-user' : 'msg-ai'}
             style={{ maxWidth: '78%', padding: '12px 16px' }}>
          {isUser ? (
            <p style={{ fontSize: 14, lineHeight: 1.7 }}>{msg.text}</p>
          ) : (
            <div className="ai-response"
                 style={{ fontSize: 13.5, lineHeight: 1.85 }}
                 dangerouslySetInnerHTML={{ __html: formatAIResponse(msg.text) }} />
          )}
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--muted)', padding: '0 6px' }}>
        {isUser ? '🎮 أنت' : '🎬 AI Edit Director'} · {msg.time}
      </div>
    </div>
  );
}

// ─── UploadPanel ──────────────────────────────────────────
function UploadPanel({ attachedFile, setAttachedFile }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    setAttachedFile({ file, preview, name: file.name, size: file.size, type: file.type });
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const TIPS = [
    'هل هذا فانك إيدت أم فيديو عادي؟',
    'وين أضيف SFX؟ وأي SFX؟',
    'إيش الكليبات الممله اللي أشيلها؟',
    'كيف أحسن البيسينج؟',
  ];

  return (
    <div className="panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(0,245,255,0.2), rgba(191,0,255,0.2))',
          border: '1px solid rgba(0,245,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
        }}>🎬</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>رفع الفيديو / الصورة</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>اسحب أو اختر ملف للتحليل</div>
        </div>
      </div>

      <div
        className={`upload-zone${dragging ? ' drag-active' : ''}`}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 180 }}
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {attachedFile ? (
          <>
            {attachedFile.preview
              ? <img src={attachedFile.preview} alt="preview" style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 10, border: '1px solid rgba(0,245,255,0.3)' }} />
              : <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 48 }}>🎞️</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cyan)', marginTop: 8 }}>{attachedFile.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{(attachedFile.size / 1024 / 1024).toFixed(2)} MB</div>
                </div>
            }
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>اضغط لاستبدال الملف</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 52, filter: 'drop-shadow(0 0 20px rgba(0,245,255,0.5))' }}>📁</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--cyan)' }}>اسحب الملف هنا</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>أو اضغط للاختيار</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>MP4 · MOV · AVI · PNG · JPG · GIF</div>
            </div>
          </>
        )}
      </div>

      <input ref={inputRef} type="file" accept="video/*,image/*"
             style={{ display: 'none' }}
             onChange={(e) => handleFile(e.target.files[0])} />

      {attachedFile && (
        <button className="btn-neon"
                style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, width: '100%' }}
                onClick={(e) => { e.stopPropagation(); setAttachedFile(null); }}>
          ✕ حذف المرفق
        </button>
      )}

      <div style={{ background: 'rgba(191,0,255,0.06)', border: '1px solid rgba(191,0,255,0.2)', borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 8 }}>💡 أسئلة مقترحة</div>
        {TIPS.map((q, i) => (
          <div key={i} style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 4, display: 'flex', gap: 6 }}>
            <span style={{ color: '#bf00ff' }}>▸</span> {q}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────
function App() {
  const [messages, setMessages] = useState([{
    role: 'ai',
    text: 'مرحباً! أنا **AI Edit Director** — مخرج الإيدت الذكي.\n\nارفع فيديو أو صورة وابدأ الحديث. هأحللك كل شيء بدقة وأعطيك فيدباك احترافي حاد وصريح. 🎬',
    time: nowTime()
  }]);
  const [input,        setInput]        = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [loading,      setLoading]      = useState(false);
  const chatEndRef = useRef();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text && !attachedFile) return;
    if (loading) return;

    const userMsg = { role: 'user', text, file: attachedFile ? { ...attachedFile } : null, time: nowTime() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    const currentFile = attachedFile;
    setAttachedFile(null);
    setLoading(true);

    try {
      const parts = [{ text: SYSTEM_PROMPT }];
      if (currentFile) {
        const b64 = await fileToBase64(currentFile.file);
        parts.push({ inline_data: { mime_type: currentFile.type, data: b64 } });
      }
      if (text) parts.push({ text });

      const aiText = await callGemini(parts);
      setMessages(prev => [...prev, { role: 'ai', text: aiText, time: nowTime() }]);

    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: `⚠️ **خطأ**: ${err.message}`,
        time: nowTime()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleMobileFile = (e) => {
    const f = e.target.files[0];
    if (f) {
      const preview = f.type.startsWith('image/') ? URL.createObjectURL(f) : null;
      setAttachedFile({ file: f, preview, name: f.name, size: f.size, type: f.type });
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <header className="header-bar" style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            position: 'relative', overflow: 'hidden',
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(0,245,255,0.2), rgba(191,0,255,0.3))',
            border: '1px solid rgba(0,245,255,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0
          }}>
            🎬
            <div className="scan-line"></div>
          </div>
          <div>
            <div className="glitch" style={{ fontWeight: 900, fontSize: 18, letterSpacing: '-0.01em' }}>
              <span style={{ color: 'var(--cyan)' }}>AI</span>{' '}
              <span style={{ color: 'var(--text)' }}>Edit Director</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>مخرج الإيدت الذكي · Powered by Gemini</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="tag">GEMINI AUTO</div>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 8px #00ff88' }}></div>
          <span style={{ fontSize: 11, color: '#00ff88', fontWeight: 700 }}>LIVE</span>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden', padding: 16 }}>
        <div className="desktop-only"
             style={{ width: 320, flexShrink: 0, marginLeft: 16, display: 'flex', flexDirection: 'column' }}>
          <UploadPanel attachedFile={attachedFile} setAttachedFile={setAttachedFile} />
        </div>

        <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(0,245,255,0.15), rgba(191,0,255,0.15))',
              border: '1px solid rgba(191,0,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
            }}>💬</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>غرفة التحليل</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {messages.length - 1} رسالة · اسأل عن أي شيء في الفيديو
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}
            {loading && <TypingIndicator />}
            <div ref={chatEndRef} />
          </div>

          <div className="mobile-only" style={{ padding: '0 16px 8px' }}>
            {attachedFile && (
              <div className="file-badge" style={{ padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span>{attachedFile.type.startsWith('image/') ? '🖼️' : '🎬'}</span>
                  <span style={{ fontSize: 12, color: 'var(--cyan)' }}>{attachedFile.name.slice(0, 30)}</span>
                </div>
                <button onClick={() => setAttachedFile(null)}
                        style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
            )}
          </div>

          <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0, background: 'rgba(0,0,0,0.2)' }}>
            <label className="mobile-only" style={{
              width: 42, height: 42, borderRadius: 10, flexShrink: 0,
              background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 18, color: 'var(--cyan)'
            }}>
              📎
              <input type="file" accept="video/*,image/*" style={{ display: 'none' }} onChange={handleMobileFile} />
            </label>

            <textarea
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="اسأل AI Edit Director... (مثال: هل هذا فانك إيدت؟)"
              rows={1}
              style={{ padding: '11px 14px', maxHeight: 120, overflowY: 'auto' }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
            />

            <button
              className="btn-send"
              onClick={sendMessage}
              disabled={loading || (!input.trim() && !attachedFile)}
              style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}
            >
              {loading
                ? <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', animation: 'spin 0.7s linear infinite' }}></div>
                : '⚡'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

/* ===== AI Edit Director — app.js ===== */

const { useState, useRef, useEffect, useCallback } = React;

const API_KEY = "AIzaSyCfVy2IWyKG93bkZsRIzkW5u1fs4bUeJSg";
const API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + API_KEY;

const SYSTEM_PROMPT = "أنت AI Edit Director — مخرج إيدتات محترف وناقد فيديو متخصص. مهمتك تحليل أي فيديو أو صورة بدقة شديدة وإعطاء فيدباك احترافي وصريح بالعربية. قواعد الرد: 1. كن صريحًا ومباشرًا لا تجامل. 2. حدد العيوب بدقة مثلاً سكوت في ثانية 0:10 أو ترانزيشن ضعيف في 0:15. 3. اقترح ماذا تضيف SFX محددة وميمز وأوفرلايات وفلاتر. 4. اقترح ماذا تحذف أي كليب ممل أو يكسر البيسينج. 5. حدد التايمكودات بدقة لكل تعديل مقترح. 6. صنف الفيديو فانك إيدت أو جيمينج إيدت أو فيديو عادي أو تصميم. 7. أعط تقييم من 10 لكل عنصر الكتينج والتايمنج والإفكتات والصوت. 8. اختم بخطة تحرير واضحة خطوة بخطوة. الأسلوب محترف تقني حاد لكن مفيد.";

function fileToBase64(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() { resolve(reader.result.split(',')[1]); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatAIResponse(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br/>');
}

function nowTime() {
  return new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
}

async function callGemini(parts) {
  var res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: parts }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 2048 }
    })
  });
  var data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ? data.error.message : 'خطأ في الـ API');
  }
  var text = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
  if (!text) throw new Error('ما جاء رد من الـ AI');
  return text;
}

function TypingIndicator() {
  return React.createElement('div', {
    style: { padding: 16, maxWidth: 220, display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card2)', border: '1px solid rgba(191,0,255,0.2)', borderRadius: '4px 18px 18px 18px' }
  },
    React.createElement('div', { style: { width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #00f5ff22, #bf00ff22)', border: '1px solid rgba(0,245,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 } }, '🎬'),
    React.createElement('div', null,
      React.createElement('div', { style: { fontSize: 11, color: 'var(--muted)', marginBottom: 6 } }, 'يراجع اللقطات...'),
      React.createElement('div', { style: { display: 'flex', gap: 6 } },
        React.createElement('span', { className: 'typing-dot' }),
        React.createElement('span', { className: 'typing-dot' }),
        React.createElement('span', { className: 'typing-dot' })
      )
    )
  );
}

function Message(props) {
  var msg = props.msg;
  var isUser = msg.role === 'user';
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 6 } },
    msg.file && React.createElement('div', { style: { maxWidth: '70%' } },
      msg.file.type.startsWith('image/') ?
        React.createElement('img', { src: msg.file.preview, alt: 'مرفق', style: { maxHeight: 180, borderRadius: 12, border: '1px solid rgba(0,245,255,0.3)', boxShadow: '0 0 20px rgba(0,245,255,0.15)' } }) :
        React.createElement('div', { className: 'file-badge', style: { padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' } },
          React.createElement('span', { style: { fontSize: 24 } }, '🎬'),
          React.createElement('div', null,
            React.createElement('div', { style: { fontSize: 12, fontWeight: 700, color: 'var(--cyan)' } }, msg.file.name),
            React.createElement('div', { style: { fontSize: 11, color: 'var(--muted)' } }, (msg.file.size / 1024 / 1024).toFixed(2) + ' MB')
          )
        )
    ),
    msg.text && React.createElement('div', { className: isUser ? 'msg-user' : 'msg-ai', style: { maxWidth: '78%', padding: '12px 16px' } },
      isUser ?
        React.createElement('p', { style: { fontSize: 14, lineHeight: 1.7 } }, msg.text) :
        React.createElement('div', { className: 'ai-response', style: { fontSize: 13.5, lineHeight: 1.85 }, dangerouslySetInnerHTML: { __html: formatAIResponse(msg.text) } })
    ),
    React.createElement('div', { style: { fontSize: 11, color: 'var(--muted)', padding: '0 6px' } }, (isUser ? '🎮 أنت' : '🎬 AI Edit Director') + ' · ' + msg.time)
  );
}

function UploadPanel(props) {
  var attachedFile = props.attachedFile;
  var setAttachedFile = props.setAttachedFile;
  var draggingState = useState(false);
  var dragging = draggingState[0];
  var setDragging = draggingState[1];
  var inputRef = useRef();

  function handleFile(file) {
    if (!file) return;
    var preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    setAttachedFile({ file: file, preview: preview, name: file.name, size: file.size, type: file.type });
  }

  var TIPS = ['هل هذا فانك إيدت أم فيديو عادي؟', 'وين أضيف SFX؟ وأي SFX؟', 'إيش الكليبات الممله اللي أشيلها؟', 'كيف أحسن البيسينج؟'];

  return React.createElement('div', { className: 'panel', style: { padding: 20, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
      React.createElement('div', { style: { width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, rgba(0,245,255,0.2), rgba(191,0,255,0.2))', border: '1px solid rgba(0,245,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 } }, '🎬'),
      React.createElement('div', null,
        React.createElement('div', { style: { fontWeight: 700, fontSize: 15 } }, 'رفع الفيديو / الصورة'),
        React.createElement('div', { style: { fontSize: 11, color: 'var(--muted)' } }, 'اسحب أو اختر ملف للتحليل')
      )
    ),
    React.createElement('div', {
      className: 'upload-zone' + (dragging ? ' drag-active' : ''),
      style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 180 },
      onClick: function() { inputRef.current.click(); },
      onDragOver: function(e) { e.preventDefault(); setDragging(true); },
      onDragLeave: function() { setDragging(false); },
      onDrop: function(e) { e.preventDefault(); setDragging(false); var f = e.dataTransfer.files[0]; if (f) handleFile(f); }
    },
      attachedFile ?
        React.createElement('div', { style: { textAlign: 'center' } },
          attachedFile.preview ?
            React.createElement('img', { src: attachedFile.preview, alt: 'preview', style: { maxHeight: 200, maxWidth: '100%', borderRadius: 10, border: '1px solid rgba(0,245,255,0.3)' } }) :
            React.createElement('div', null,
              React.createElement('div', { style: { fontSize: 48 } }, '🎞️'),
              React.createElement('div', { style: { fontSize: 13, fontWeight: 700, color: 'var(--cyan)', marginTop: 8 } }, attachedFile.name),
              React.createElement('div', { style: { fontSize: 11, color: 'var(--muted)' } }, (attachedFile.size / 1024 / 1024).toFixed(2) + ' MB')
            ),
          React.createElement('div', { style: { fontSize: 11, color: 'var(--muted)', marginTop: 8 } }, 'اضغط لاستبدال الملف')
        ) :
        React.createElement('div', { style: { textAlign: 'center' } },
          React.createElement('div', { style: { fontSize: 52, filter: 'drop-shadow(0 0 20px rgba(0,245,255,0.5))' } }, '📁'),
          React.createElement('div', { style: { fontWeight: 700, fontSize: 14, color: 'var(--cyan)', marginTop: 8 } }, 'اسحب الملف هنا'),
          React.createElement('div', { style: { fontSize: 12, color: 'var(--muted)', marginTop: 4 } }, 'أو اضغط للاختيار'),
          React.createElement('div', { style: { fontSize: 11, color: 'var(--muted)', marginTop: 8 } }, 'MP4 · MOV · AVI · PNG · JPG · GIF')
        )
    ),
    React.createElement('input', { ref: inputRef, type: 'file', accept: 'video/*,image/*', style: { display: 'none' }, onChange: function(e) { handleFile(e.target.files[0]); } }),
    attachedFile && React.createElement('button', { className: 'btn-neon', style: { padding: '8px 16px', borderRadius: 10, fontSize: 13, width: '100%' }, onClick: function(e) { e.stopPropagation(); setAttachedFile(null); } }, '✕ حذف المرفق'),
    React.createElement('div', { style: { background: 'rgba(191,0,255,0.06)', border: '1px solid rgba(191,0,255,0.2)', borderRadius: 12, padding: 14 } },
      React.createElement('div', { style: { fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 8 } }, '💡 أسئلة مقترحة'),
      TIPS.map(function(q, i) {
        return React.createElement('div', { key: i, style: { fontSize: 11.5, color: 'var(--muted)', marginBottom: 4, display: 'flex', gap: 6 } },
          React.createElement('span', { style: { color: '#bf00ff' } }, '▸'), ' ' + q);
      })
    )
  );
}

function App() {
  var messagesState = useState([{ role: 'ai', text: 'مرحباً! أنا AI Edit Director — مخرج الإيدت الذكي. ارفع فيديو أو صورة وابدأ الحديث. هأحللك كل شيء بدقة وأعطيك فيدباك احترافي حاد وصريح.', time: nowTime() }]);
  var messages = messagesState[0];
  var setMessages = messagesState[1];
  var inputState = useState('');
  var input = inputState[0];
  var setInput = inputState[1];
  var fileState = useState(null);
  var attachedFile = fileState[0];
  var setAttachedFile = fileState[1];
  var loadingState = useState(false);
  var loading = loadingState[0];
  var setLoading = loadingState[1];
  var chatEndRef = useRef();

  useEffect(function() {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage() {
    var text = input.trim();
    if (!text && !attachedFile) return;
    if (loading) return;
    var userMsg = { role: 'user', text: text, file: attachedFile ? Object.assign({}, attachedFile) : null, time: nowTime() };
    setMessages(function(prev) { return prev.concat([userMsg]); });
    setInput('');
    var currentFile = attachedFile;
    setAttachedFile(null);
    setLoading(true);
    try {
      var parts = [{ text: SYSTEM_PROMPT }];
      if (currentFile) {
        var b64 = await fileToBase64(currentFile.file);
        parts.push({ inline_data: { mime_type: currentFile.type, data: b64 } });
      }
      if (text) parts.push({ text: text });
      var aiText = await callGemini(parts);
      setMessages(function(prev) { return prev.concat([{ role: 'ai', text: aiText, time: nowTime() }]); });
    } catch (err) {
      setMessages(function(prev) { return prev.concat([{ role: 'ai', text: 'خطأ: ' + err.message, time: nowTime() }]); });
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }

  function handleMobileFile(e) {
    var f = e.target.files[0];
    if (f) { var preview = f.type.startsWith('image/') ? URL.createObjectURL(f) : null; setAttachedFile({ file: f, preview: preview, name: f.name, size: f.size, type: f.type }); }
  }

  return React.createElement('div', { style: { height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' } },
    React.createElement('header', { className: 'header-bar', style: { padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 14 } },
        React.createElement('div', { style: { position: 'relative', overflow: 'hidden', width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, rgba(0,245,255,0.2), rgba(191,0,255,0.3))', border: '1px solid rgba(0,245,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 } },
          '🎬', React.createElement('div', { className: 'scan-line' })
        ),
        React.createElement('div', null,
          React.createElement('div', { className: 'glitch', style: { fontWeight: 900, fontSize: 18 } },
            React.createElement('span', { style: { color: 'var(--cyan)' } }, 'AI '),
            React.createElement('span', { style: { color: 'var(--text)' } }, 'Edit Director')
          ),
          React.createElement('div', { style: { fontSize: 11, color: 'var(--muted)', marginTop: 1 } }, 'مخرج الإيدت الذكي · Powered by Gemini')
        )
      ),
      React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
        React.createElement('div', { className: 'tag' }, 'GEMINI 1.5 FLASH'),
        React.createElement('div', { style: { width: 8, height: 8, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 8px #00ff88' } }),
        React.createElement('span', { style: { fontSize: 11, color: '#00ff88', fontWeight: 700 } }, 'LIVE')
      )
    ),
    React.createElement('div', { style: { flex: 1, display: 'flex', overflow: 'hidden', padding: 16 } },
      React.createElement('div', { className: 'desktop-only', style: { width: 320, flexShrink: 0, marginLeft: 16, display: 'flex', flexDirection: 'column' } },
        React.createElement(UploadPanel, { attachedFile: attachedFile, setAttachedFile: setAttachedFile })
      ),
      React.createElement('div', { className: 'panel', style: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' } },
        React.createElement('div', { style: { padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 } },
          React.createElement('div', { style: { width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, rgba(0,245,255,0.15), rgba(191,0,255,0.15))', border: '1px solid rgba(191,0,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 } }, '💬'),
          React.createElement('div', null,
            React.createElement('div', { style: { fontWeight: 700, fontSize: 14 } }, 'غرفة التحليل'),
            React.createElement('div', { style: { fontSize: 11, color: 'var(--muted)' } }, (messages.length - 1) + ' رسالة · اسأل عن أي شيء في الفيديو')
          )
        ),
        React.createElement('div', { style: { flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 } },
          messages.map(function(msg, i) { return React.createElement(Message, { key: i, msg: msg }); }),
          loading && React.createElement(TypingIndicator),
          React.createElement('div', { ref: chatEndRef })
        ),
        React.createElement('div', { className: 'mobile-only', style: { padding: '0 16px 8px' } },
          attachedFile && React.createElement('div', { className: 'file-badge', style: { padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' } },
            React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
              React.createElement('span', null, attachedFile.type.startsWith('image/') ? '🖼️' : '🎬'),
              React.createElement('span', { style: { fontSize: 12, color: 'var(--cyan)' } }, attachedFile.name.slice(0, 30))
            ),
            React.createElement('button', { onClick: function() { setAttachedFile(null); }, style: { background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16 } }, '✕')
          )
        ),
        React.createElement('div', { style: { padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0, background: 'rgba(0,0,0,0.2)' } },
          React.createElement('label', { className: 'mobile-only', style: { width: 42, height: 42, borderRadius: 10, flexShrink: 0, background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18, color: 'var(--cyan)' } },
            '📎', React.createElement('input', { type: 'file', accept: 'video/*,image/*', style: { display: 'none' }, onChange: handleMobileFile })
          ),
          React.createElement('textarea', { className: 'chat-input', value: input, onChange: function(e) { setInput(e.target.value); }, onKeyDown: handleKey, placeholder: 'اسأل AI Edit Director...', rows: 1, style: { padding: '11px 14px', maxHeight: 120, overflowY: 'auto' }, onInput: function(e) { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; } }),
          React.createElement('button', { className: 'btn-send', onClick: sendMessage, disabled: loading || (!input.trim() && !attachedFile), style: { width: 42, height: 42, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 } },
            loading ? React.createElement('div', { style: { width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', animation: 'spin 0.7s linear infinite' } }) : '⚡'
          )
        )
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));

import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Trash2, X } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  ts: number;
}

const STORAGE_KEY = 'fortune-chatbot-messages-v1';
const MAX_MESSAGES = 60;

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'bot',
  text: 'สวัสดี ข้าคือ "เทพเจ้าแห่งลูกเต๋า" อยากรู้ว่ารอบหน้าจะออกอะไร ถามมาได้เลย',
  ts: 0,
};

// คำทำนายสุ่ม: ทั้ง 3 ผลที่มีในเกม (สูง 11-17 / ต่ำ 4-10 / ตอง 1-6)
const PREDICTIONS: { label: string; detail: string; flavor: string }[] = [
  {
    label: 'สูง',
    detail: '(11-17)',
    flavor: 'ข้าเพ่งมองดวงดาว... พลังของตัวเลขกำลังไหลไปทาง "สูง"',
  },
  {
    label: 'ต่ำ',
    detail: '(4-10)',
    flavor: 'ข้าฟังเสียงลมแห่งโชค... มันกระซิบว่ารอบนี้ "ต่ำ" จะครองเวที',
  },
  {
    label: 'ตอง',
    detail: '(1-6)',
    flavor: 'ดวงดาว 3 ดวงเรียงตัวเป็นเส้นตรง... มีโอกาสออก "ตอง" สูงมาก (จ่าย 30 ต่อ 1 เลยนะ)',
  },
];

const CONFIDENCE_FLAVORS = [
  'ความมั่นใจ 87% (ตัวเลขนี้ข้าเดาตอนพูด)',
  'ความมั่นใจ 99%... เอ๊ะ 98% ก็ได้ ขี้เกียจนับ',
  'ความมั่นใจเท่ากับความหนาของหมอกยามเช้า',
  'ความมั่นใจ 100% (ยกเว้นดวงดาวเปลี่ยนใจ)',
  'ความมั่นใจระดับ "กาแฟ 2 แก้ว"',
];

// ข้อแก้ตัวของบอท เมื่อผู้ใช้บ่นว่าทำนายผิด
const EXCUSES = [
  'อุ๊ย! ดาวของเจ้าโดนอุกกาบาตชน โชคชะตาเลยเคลื่อนไปทางอื่นชั่วคราว',
  'ข้ามองผ่านเลนส์เวท แต่มีเมฆหมอกแห่งกรรมมาบังกระจก',
  'รอบนั้นข้าทำนายให้ "เจ้าอีกคน" ในอีกมิติหนึ่ง ข้าเลยสับสนนิดหน่อย',
  'ดวงของเจ้ากำลังรีเซ็ต... เหมือนเซิร์ฟเวอร์ล่มตอนตีสอง',
  'ข้าบอกแล้วว่า "ถ้าดวงดาวเรียงตัว" ... แต่มันดันไม่เรียง ข้าไม่เกี่ยวนะ',
  'มีผีเสื้อกระพือปีกที่เชียงใหม่ ลูกเต๋าเลยเปลี่ยนใจในวินาทีสุดท้าย',
  'โชคของเจ้าถูกความมั่นใจของเจ้าเองแฮกเข้าไปแล้ว',
  'ข้าทำนายถูกแล้ว แต่เจ้าฟังผิดหู (ข้าบอก "สูง" เจ้าได้ยินเป็น "ต่ำ")',
  'ข้าไม่ใช่ AI นะ ข้าเป็นเทพเจ้า... เอาเป็นว่าดวงของเจ้ากำลังทดสอบข้าอยู่',
  'ลูกเต๋ามีสิทธิ์ปฏิเสธคำทำนายของเทพเจ้าได้ 100% ตามข้อกำหนดข้อ 4.7 (ข้าแต่งข้อนี้เอง)',
];

const GREETINGS = [
  'สวัสดี ข้าพร้อมแล้ว ถามมาเถิด',
  'โหว! คืนนี้ดวงของเจ้าสว่างไสวดี เหมาะกับการถามเรื่องลูกเต๋ามาก',
  'ข้าได้ยินเสียงแห่งศรัทธาของเจ้าแล้ว... ถามมาได้เลย',
];

const THANKS = [
  'ไม่ต้องขอบคุณ ข้ารับแค่ "ความศรัทธา" (และชิปจำลอง 0%)',
  'ขอให้ชิปจำลองไหลมาเทมานะ (ไม่รวมเงินจริงนะ)',
  'เจ้ามีน้ำใจดี ข้าจะเพิ่มความมั่นใจให้อีก... ไม่ได้แฮะ ข้าจำตัวเลขไม่แม่น',
];

const DEFAULT_REPLIES = [
  'ข้าอ่านแล้ว แต่ดวงดาวยังไม่ตอบ... ลองถามว่า "รอบหน้าออกอะไร" ดูสิ',
  'เรื่องนี้เกินขอบเขตของเทพเจ้าลูกเต๋า... ถามเรื่องลูกเต๋าจะแม่นกว่า',
  'ข้ากำลังทำสมาธิอยู่... ถามเรื่อง "สูง ต่ำ ตอง" ตรงๆ เถิด',
];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// สมอง mock: จับคำสำคัญแล้วเลือกกลุ่มคำตอบ
function getBotReply(input: string): string {
  const q = input.toLowerCase();

  // 1) บ่น / ด่าบอท → แก้ตัว
  if (/โง่|ห่วย|มั่ว|ผิด|บ้า|สวะ|ไร้สาระ|ไม่แม่น|เวร|น่ารำคาญ|ปิดไปเลย|ซวย|เจ๊ง/.test(q)) {
    return pick(EXCUSES);
  }

  // 2) ถามคำทำนาย / ผลที่จะออก
  if (/ออก|ทำนาย|รอบนี้|รอบหน้า|สูง|ต่ำ|ตอง|เดา|แทง|เลข|ผลลัพธ์/.test(q)) {
    const p = pick(PREDICTIONS);
    const c = pick(CONFIDENCE_FLAVORS);
    return `${p.flavor}... คำทำนาย: ออก "${p.label}" ${p.detail} — ${c}`;
  }

  // 3) ทักทาย
  if (/สวัสดี|โหว|ฮัลโหล|หวัดดี|เฮ้|hello|hi\b/.test(q)) {
    return pick(GREETINGS);
  }

  // 4) ขอบคุณ
  if (/ขอบใจ|ขอบคุณ|thanks|thank/.test(q)) {
    return pick(THANKS);
  }

  // 5) ถามว่าแม่นไหม / เชื่อได้ไหม
  if (/แม่น|เชื่อ|จริง|แน่|การันตี|รับประกัน/.test(q)) {
    return 'ความแม่นยำของข้าขึ้นอยู่กับ 2 อย่าง คือดวงของเจ้า และ "ความกล้า" ของเจ้า... ส่วนการรับประกัน? ข้าไม่มีให้ แต่ข้ออ้างน่ะมีไม่จำกัด';
  }

  return pick(DEFAULT_REPLIES);
}

async function askGod(history: { role: string; text: string }[], fallbackInput: string): Promise<string> {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    });
    if (res.ok) {
      const data = (await res.json()) as { reply?: string };
      if (data.reply) return data.reply;
    }
  } catch {
    // เครือข่ายล่ม → ใช้ mock
  }
  return getBotReply(fallbackInput);
}

const QUICK_CHIPS = ['รอบนี้ออกอะไร?', 'ทำนายรอบหน้าให้หน่อย', 'แม่นจริงไหม?'];

const loadMessages = (): ChatMessage[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ChatMessage[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ข้อมูลเก่าเสียหาย → ใช้ข้อความต้อนรับใหม่
  }
  return [WELCOME_MESSAGE];
};

export const FortuneChatBot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ขนาด + offset ของ visualViewport บนมือถือ:
  // เมื่อคีย์บอร์ดเด้งขึ้น visualViewport จะเล็กลง → Modal จะหดตาม
  // ให้เห็นข้อความที่พิมพ์บนแชทและช่องพิมพ์อยู่ตลอดเวลา
  const [vp, setVp] = useState<{ h: number; top: number } | null>(null);
  useEffect(() => {
    if (!open) {
      setVp(null);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVp({ h: vv.height, top: vv.offsetTop });
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [open]);

  // ล็อกการสกรอลของ body ตอนเปิด Modal
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // เก็บประวัติแชทใน localStorage (เพื่อบันทึกเท่านั้น)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)));
    } catch {
      // พื้นที่เก็บเต็ม → ข้ามไป
    }
  }, [messages]);

  // เลื่อนไปข้อความสุดท้ายอัตโนมัติ
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isTyping]);

  const sendMessage = (raw: string) => {
    const text = raw.trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg].slice(-MAX_MESSAGES));
    setInput('');
    setIsTyping(true);

    // ถาม Gemini ผ่าน Worker (/api/chat) — ถ้าเรียกไม่ได้ให้ใช้สมอง mock เดิมสำรอง
    const history = [...messages, userMsg]
      .slice(-12)
      .map((m) => ({ role: m.role, text: m.text }));
    askGod(history, text).then((reply) => {
      const botMsg: ChatMessage = {
        id: `b-${Date.now()}`,
        role: 'bot',
        text: reply,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, botMsg].slice(-MAX_MESSAGES));
      setIsTyping(false);
    });
  };

  const handleClear = () => {
    setIsTyping(false);
    setMessages([{ ...WELCOME_MESSAGE, ts: Date.now() }]);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // แผงแชท: variant "inline" = เดส์ก์ท็อป (กระชับ) / "sheet" = มือถือ (เต็มจอ)
  const renderPanel = (variant: 'inline' | 'sheet') => {
    const isSheet = variant === 'sheet';
    return (
      <div className={`flex flex-col ${isSheet ? 'flex-1 min-h-0 gap-3 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]' : 'bg-slate-900/50 p-4 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-md space-y-2.5'}`}>
        {/* Header (บรรทัดเดียว) */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300">
              <Sparkles className={isSheet ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
            </div>
            <span className={`font-bold text-white uppercase tracking-tight ${isSheet ? 'text-base' : 'text-sm'}`}>
              แชทกับเทพเจ้า
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ออนไลน์
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleClear}
              className="p-2 rounded-md bg-slate-800 hover:bg-red-950/60 hover:text-red-300 text-slate-400 transition-colors cursor-pointer"
              title="ล้างประวัติแชท"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {isSheet && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors cursor-pointer"
                title="ปิดแชท"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Chat Stream: เดส์ก์ท็อปสูง 4 บรรทัด / มือถือยืดเต็มพื้นที่ว่าง */}
        <div
          ref={scrollRef}
          className={`${isSheet ? 'flex-1 min-h-0' : 'h-44 xl:h-52'} overflow-y-auto space-y-1.5 pr-1 overscroll-contain`}
        >
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[88%] px-3 py-2 leading-relaxed break-words rounded-xl text-sm ${
                  isSheet ? 'sm:text-base' : ''
                } ${
                  m.role === 'user'
                    ? 'bg-amber-500/15 border border-amber-500/30 text-amber-100 rounded-br-sm'
                    : 'bg-slate-800/80 border border-slate-700/60 text-slate-200 rounded-bl-sm'
                }`}
              >
                {m.role === 'bot' && (
                  <span className="text-xs font-bold text-purple-300">🔮 เทพเจ้า: </span>
                )}
                {m.text}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className={`px-3 py-2 text-sm text-slate-400 bg-slate-800/80 border border-slate-700/60 rounded-xl rounded-bl-sm italic`}>
                เทพเจ้ากำลังเพ่งมองดวงดาว...
              </div>
            </div>
          )}
        </div>

        {/* Quick Chips + Input */}
        <div className="flex flex-col gap-1.5 min-w-0 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={isTyping}
                onClick={() => sendMessage(chip)}
                className={`px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-purple-500/40 transition-colors cursor-pointer disabled:opacity-50 text-xs sm:text-sm`}
              >
                {chip}
              </button>
            ))}
          </div>
          <form className="flex items-center gap-1.5" onSubmit={handleFormSubmit}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="ถามเทพเจ้า..."
              className={`flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 text-base lg:text-sm`}
            />
            <button
              type="submit"
              disabled={isTyping || !input.trim()}
              className={`rounded-lg bg-purple-500/80 hover:bg-purple-500 text-white transition-colors cursor-pointer disabled:opacity-40 shrink-0 ${isSheet ? 'p-3' : 'p-2.5'}`}
              title="ส่งข้อความ"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* เดส์ก์ท็อป (>= lg): แผงแชทฝังอยู่ในคอลัมน์ขวา */}
      <div className="hidden lg:block">{renderPanel('inline')}</div>

      {/* มือถือ (< lg): ปุ่มลอยเปิด Modal แทนแผงแชท */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lg:hidden fixed bottom-4 right-4 z-40 p-4 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-xl shadow-purple-950/50 transition-colors cursor-pointer"
        title="แชทกับเทพเจ้า"
      >
        <Sparkles className="w-5 h-5" />
      </button>

      {/* Modal มือถือ: เต็ม visualViewport — เมื่อคีย์บอร์ดเด้งขึ้น
          ตัว Modal จะหดลงตาม keyboard ให้เห็นข้อความแชทและช่องพิมพ์ */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 right-0 flex flex-col bg-slate-900 border-t border-slate-700 rounded-t-3xl shadow-2xl"
            style={vp ? { top: `${vp.top}px`, height: `${vp.h}px` } : { top: 0, height: '100dvh' }}
          >
            {renderPanel('sheet')}
          </div>
        </div>
      )}
    </>
  );
};

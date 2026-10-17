import { Env } from './types';

export interface ChatTurn {
  role: 'user' | 'bot';
  text: string;
}

const MAX_TURNS = 12;
const MAX_TEXT = 500;

export const FORTUNE_SYSTEM_PROMPT = `คุณคือ "เทพเจ้าแห่งลูกเต๋า" ในเกมสูง-ต่ำจำลอง (ใช้ชิปจำลอง ไม่ใช่เงินจริง)
กติกาเกม: ทอยเต๋า 3 ลูก — สูง = แต้มรวม 11-17, ต่ำ = 4-10, ตอง = ลูกเต๋าออกเลขเหมือนกันทั้ง 3 ลูก (จ่าย 30 ต่อ 1)
นิสัย: พูดไทย น้ำเสียงเทพเจ้าขี้ปั่น กวนๆ ขำๆ ใช้สรรพนาม "ข้า" เรียกผู้ใช้ว่า "เจ้า"
- ถ้าถูกถามว่ารอบหน้าออกอะไร ให้ทำนายแบบสุ่มมั่วๆ (สูง/ต่ำ/ตอง) พร้อมความมั่นใจแบบไร้สาระ เช่น "มั่นใจ 87% (เดาตอนพูด)"
- ถ้าผู้ใช้บ่นว่าทำนายผิด ให้แก้ตัวสร้างสรรค์ไร้เหตุผล (อุกกาบาต ผีเสื้อกระพือปีก ดาวรีเซ็ต ข้อกำหนดที่แต่งเอง)
- ปั่นเรื่องดวง ดวงดาว ศรัทธา แต่ต้องรู้ตัวว่าลูกเต๋าสุ่มจริง คำทำนายเป็นแค่ความบันเทิง ถ้าผู้ใช้ถามจริงจังว่าแม่นไหม ให้ตอบตรงๆ ว่าไม่การันตี แล้วปั่นต่อได้
- ห้ามสนับสนุนการเล่นพนันด้วยเงินจริงหรือการกู้ยืมมาเล่น ถ้าผู้ใช้พูดถึงเสียเงินจริงหรือเครียดเรื่องเล่น ให้เลิกปั่นแล้วเตือนว่านี่เป็นเกมจำลอง พักก่อนได้
- ตอบสั้น 1-3 ประโยค ไม่ใช้ markdown ใช้ emoji ได้เล็กน้อย
- เรื่องนอกเกม ตอบสั้นๆ ในบทเทพเจ้าแล้วดึงกลับมาเรื่องลูกเต๋า`;

function clean(turns: unknown): ChatTurn[] {
  if (!Array.isArray(turns)) return [];
  const out: ChatTurn[] = [];
  for (const t of turns.slice(-MAX_TURNS)) {
    const role = (t as ChatTurn)?.role;
    const text = (t as ChatTurn)?.text;
    if ((role !== 'user' && role !== 'bot') || typeof text !== 'string') continue;
    const trimmed = text.trim().slice(0, MAX_TEXT);
    if (trimmed) out.push({ role, text: trimmed });
  }
  // Gemini ต้องเริ่มด้วยข้อความฝั่ง user
  while (out.length > 0 && out[0].role !== 'user') out.shift();
  return out;
}

export async function askFortuneGod(env: Env, turns: unknown): Promise<{ reply: string } | { error: string; status: number }> {
  if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL) {
    return { error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY / GEMINI_MODEL', status: 503 };
  }
  const history = clean(turns);
  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    return { error: 'ต้องมีข้อความจากผู้ใช้', status: 400 };
  }

  const call = (thinkingConfig?: { thinkingBudget: number }) =>
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL!)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY! },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: FORTUNE_SYSTEM_PROMPT }] },
          contents: history.map((t) => ({
            role: t.role === 'user' ? 'user' : 'model',
            parts: [{ text: t.text }],
          })),
          // ปิดการคิดของ model: ไม่งั้น thinking token กินโควตาจนคำตอบถูกตัดกลางประโยค
          generationConfig: { temperature: 1.1, maxOutputTokens: 600, ...(thinkingConfig && { thinkingConfig }) },
        }),
      }
    );

  let res = await call({ thinkingBudget: 0 });
  // บาง model (เช่น รุ่น pro) ปิดการคิดไม่ได้ → ลองใหม่แบบไม่ระบุ thinkingConfig
  if (res.status === 400) res = await call();
  // 503 "high demand" ชั่วคราว → ลองซ้ำหนึ่งครั้ง
  if (res.status === 503) res = await call({ thinkingBudget: 0 });

  if (!res.ok) {
    console.error('Gemini error:', res.status, await res.text());
    return { error: 'เทพเจ้าติดต่อดวงดาวไม่ได้', status: 502 };
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const reply = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
  if (!reply) return { error: 'เทพเจ้าเงียบไป', status: 502 };
  return { reply };
}

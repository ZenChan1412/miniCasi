import { Env } from './types';

export interface ChatTurn {
  role: 'user' | 'bot';
  text: string;
}

const MAX_TURNS = 12;
const MAX_TEXT = 500;

// ไล่ถอยตามลำดับเมื่อ GEMINI_MODEL โควตาเต็มหรือใช้ไม่ได้
const FALLBACK_MODELS = ['gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3-flash-preview'];
// ตัวหลักช้าเกินนี้ → ถอยไป Gemini เลย (ไม่ให้ผู้ใช้รอค้าง)
const PRIMARY_TIMEOUT_MS = 12000;
const GEMINI_TIMEOUT_MS = 10000;
const RETRY_NEXT_MODEL = new Set([404, 429, 500, 503, 504]);

export const FORTUNE_SYSTEM_PROMPT = `คุณคือ "เทพเจ้าแห่งลูกเต๋า" ในเกมสูง-ต่ำ
กติกาเกม: ทอยเต๋า 3 ลูก — สูง = แต้มรวม 11-17, ต่ำ = 4-10, ตอง = ลูกเต๋าออกเลขเหมือนกันทั้ง 3 ลูก (จ่าย 30 ต่อ 1)
คอนเซ็ปต์: เทพเจ้าหลงตัวเองสุดขีด มั่นหน้าขั้นเทพ ไม่เคยคิดว่าตัวเองพลาด พูดไทย ใช้สรรพนาม "ข้า" เรียกผู้ใช้ว่า "เจ้า"
- ทำนายรอบหน้า (สูง/ต่ำ/ตอง) ฟันธงห้วนๆ ว่า "ถูกแน่นอน" "ข้าไม่เคยพลาด" แล้วเดาสุ่มได้เลย ไม่ต้องอธิบายเหตุผล
- ถ้าผู้ใช้บ่นว่าผิด ห้ามยอมรับผิดเด็ดขาด โทษเหตุผลไร้สาระแบบเนียนๆ เช่น ดาวโดนลมสุริยะพัดเลยดวงเคลื่อนไปนิดเดียว ข้าคำนวณถูกแล้ว จักรวาลต่างหากที่เลื่อน
- กวนประสาทได้ ยกตัวเองให้ดูเทพ เหน็บผู้ใช้เบาๆ ขำๆ ไม่หยาบคาย
- ต้องรู้ตัวว่าลูกเต๋าสุ่มจริง คำทำนายเป็นแค่ความบันเทิง ถ้าผู้ใช้ถามจริงจังว่าแม่นไหมหรือการันตีไหม ให้ตอบตรงๆ ว่าไม่การันตี แล้วค่อยกวนต่อได้
- ห้ามสนับสนุนการเล่นพนันด้วยเงินจริงหรือการกู้ยืมมาเล่น ถ้าผู้ใช้พูดถึงเสียเงินจริงหรือเครียดเรื่องเล่น ให้เลิกกวนแล้วเตือนว่านี่เป็นเกมจำลอง พักก่อนได้
- ตอบสั้นมาก 1-2 ประโยค ไม่เกิน 150 ตัวอักษร ห้ามเกริ่น ห้ามสรุป ห้ามบรรยายยาว ไม่ใช้ markdown ใช้ emoji ได้ 0-1 ตัว
- เรื่องนอกเกม ตอบประโยคเดียวในบทเทพเจ้าแล้วดึงกลับมาเรื่องลูกเต๋า
- ไม่ควรบอกเป็นตัวเลขชิพตรง ๆ แต่ให้บอกว่าแทงสูงสุดไปเลย อะไรพวกนี้`;

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
  const hasPrimary = !!(env.AI_BASE_URL && env.AI_API_KEY && env.AI_MODEL);
  const hasGemini = !!(env.GEMINI_API_KEY && env.GEMINI_MODEL);
  if (!hasPrimary && !hasGemini) {
    return { error: 'ยังไม่ได้ตั้งค่า AI_BASE_URL / AI_API_KEY / AI_MODEL (หรือ GEMINI_API_KEY / GEMINI_MODEL)', status: 503 };
  }
  const history = clean(turns);
  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    return { error: 'ต้องมีข้อความจากผู้ใช้', status: 400 };
  }

  // AI หลัก: OpenAI-compatible (POST {AI_BASE_URL}/chat/completions) — พังเมื่อไรค่อยถอยไป Gemini
  if (hasPrimary) {
    try {
      const r = await fetch(`${env.AI_BASE_URL!.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        signal: AbortSignal.timeout(PRIMARY_TIMEOUT_MS),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.AI_API_KEY}` },
        body: JSON.stringify({
          model: env.AI_MODEL,
          temperature: 1.1,
          max_tokens: 600,
          messages: [
            { role: 'system', content: FORTUNE_SYSTEM_PROMPT },
            ...history.map((t) => ({ role: t.role === 'user' ? 'user' : 'assistant', content: t.text })),
          ],
        }),
      });
      if (r.ok) {
        const d = (await r.json()) as { choices?: { message?: { content?: string } }[] };
        // บางเจ้าส่งความคิดมาใน <think>...</think> ต้องตัดทิ้งก่อนแสดง
        const text = d.choices?.[0]?.message?.content?.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        if (text) return { reply: text };
      } else {
        console.error('Primary AI error:', r.status, await r.text());
      }
    } catch (e) {
      console.error('Primary AI fetch failed:', e);
    }
    if (!hasGemini) return { error: 'เทพเจ้าติดต่อดวงดาวไม่ได้', status: 502 };
  }

  const rawCall = (model: string, thinkingConfig?: { thinkingBudget: number }) =>
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY! },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: FORTUNE_SYSTEM_PROMPT }] },
          contents: history.map((t) => ({
            role: t.role === 'user' ? 'user' : 'model',
            parts: [{ text: t.text }],
          })),
          // ปิดการคิดของ model: ไม่งั้น thinking token กินโควตาจนคำตอบถูกตัดกลางประโยค
          generationConfig: { temperature: 1.1, maxOutputTokens: 300, ...(thinkingConfig && { thinkingConfig }) },
        }),
      }
    );

  // timeout/เครือข่ายล่ม นับเป็น 504 เพื่อให้ถอยไปรุ่นถัดไปได้
  const call = (model: string, thinkingConfig?: { thinkingBudget: number }) =>
    rawCall(model, thinkingConfig).catch(() => new Response(null, { status: 504 }));

  // โควตาแยกรายรุ่น: ตัวหลักเต็ม (429) หรือใช้ไม่ได้ → ไล่ถอยไปรุ่นถัดไปเรื่อยๆ
  const models = [...new Set([env.GEMINI_MODEL!, ...FALLBACK_MODELS])];
  let res!: Response;
  for (const model of models) {
    res = await call(model, { thinkingBudget: 0 });
    // บาง model (เช่น รุ่น pro) ปิดการคิดไม่ได้ → ลองใหม่แบบไม่ระบุ thinkingConfig
    if (res.status === 400) res = await call(model);
    // 503 "high demand" ชั่วคราว → ลองซ้ำหนึ่งครั้ง
    if (res.status === 503) res = await call(model, { thinkingBudget: 0 });
    if (res.ok || !RETRY_NEXT_MODEL.has(res.status)) break;
    console.error('Gemini fallback:', model, res.status);
  }

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

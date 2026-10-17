# ทำไมทิมเลกควรใช Cloudflare Workers แทน VPS

## บทนำ

ทิมพฒนาขนาดเลกมกเจอปญหาเดิม ๆ: งบจำกด คนนอย ไมม DevOps โดยเฉพาะ แตตองการระบบท่ีเรว เสถียร และขยายไดเมอมมผใชเพิ่่่มขึ้่่น ทางเลือกท่ีเหนก่นบ่อยคิอเชา VPS ตัวเล็ก ๆ มา deploy เอง เพราะดูถูกและควบคุมไดทุกอยาง แตทางเลือกอยาง Cloudflare Workers กำลงเปลี่ยนสมการนไปอยางสิ้่่่นเชิง บทความนจะพาไปดูวาทำไมทิมเล็กจิงควรพิจาณา Workers แทน VPS และในกรณีไหนท่ี VPS ยังเป็็นคำตอบท่ีถูกกว่า

## Workers คืออะไร

Cloudflare Workers เป็็นแพลตฟอรม serverless ท่ีรันโค้ด JavaScript, TypeScript หรืิอ WASM บน edge network ของ Cloudflare ทังโลก แทนท่ีจะรันโค้ดบนเซิรฟเวอรเครื่่่งเดียว โค้ดของคณจะถูกกระจายไปรันบน data center หลายร้อยแห่่งทังโลก ผู้ใชแต่ละคนจะถูก route ไปยัง data center ท่ีใกลท่ีสุด

ความแตกตางหลักจาก VPS คือ:

- **ไมมเซิรฟเวอรใหดูลำ** — ไมตองตดตัง OS ไมตองอัปเดต package ไมม SSH ใหล็อกเขาไปแก
- **จายตามการใชงานจริง** — รันกี่ครง จายตามครง ไมไดจายรายเดือนทังเดือนแมระบบจะวาง
- **scale อตโนมัต** — 100 คนหรืิอ 1 ล้านคน เขา มารวมก่น ระบบจัดการเองหมด

## เปรียบเทียบคาใชจาย

ลองดตวตาวเลขคราว ๆ สำหรบโปรเจกตเล็ก:

| รายการ | VPS | Workers |
|---|---|---|
| คาเช่าพื้่่นฐาน | $5–20/เดือน (จายตลอด) | $0 (free tier) หรืิอ $5/เดือน (paid) |
| SSL certificate | ฟร (Let's Encrypt) แตตองตอ renewal เอง | ฟรทุก domain |
| CDN | ตองจายแยกหรืิอตัง cache เอง | มในตัว |
| DDoS protection | ไมม ตองซื้่่อเพิ่่่ม | มในตัว |
| คาแรงงานดูลำ | เวลาจริง ๆ แลวแพงกว่าคาเช่า | แทบเป็็็นศูนย |

Free tier ของ Workers ใหอัตรารการใชงานครบมากสำหรบทิมเล็ก: 100,000 request/วัน, CPU time 10 ms/request, KV 10,000 reads/วัน, D1 และ R2 ก่อมมีสัดสวนฟรีดวย โปรเจกต side project, landing page, API เล็ก ๆ, หรืิอ webhook processor มกอย่ใน free tier ไดตลอด

## ไมตองดูลำเซิรฟเวอร

ข้อไดเปรียบท่ีใหญท่ีสุดสำหรบทิมเล็กคิอ **เวลา** การดูลำ VPS เครื่่่งหนึ่่งกืนเวลาไปมาก:

- อัปเดต security patch เม่อมม advisory ออกมา
- ตอ Let's Encrypt certificate ให renew อตโนมัต
- ตัง log rotation ไม่งั่่ง disk เต็ม
- ตดตังและอัปเดต runtime (Node, PHP, Python)
- ตัง firewall, fail2ban, monitoring
- backup ฐานขอมูลและ restore เมื่่อทำพัง

แต่ละอยางใชเวลาไมมาก แตรวมก่นแลวกืนเวลาทิมไปเป็็็นวันตอเดือน Workers ตัดรายการเหล่านีทิ้่งหมด คณเขียนโค้ด deploy แลวจบ Cloudflare จัดการ security patch, DDoS, TLS, และ uptime ให

## ความเรวจาก edge network

VPS ท่ีเรวท่ีสุดก้อยู่แคจุดเดียว ถาเซิรฟเวอรอย่ซิงคโปร ผู้ใชกรุงเทพฯ ได latency ประมาณ 30–60 ms แตถาผู้ใชในยุโรปก 150 ms ขึ้่งไป Workers รันบน edge network ทังโลก latency จากผู้ใชสวนใหญทังโลกจะตำ่กว่า 50 ms เสมอ เพราะโค้ดถูกกระจายไปยัง data center ใกลอัตรโนมัต

สำหรบเว็บท่ีเน้น API หรืิอ real-time feature ความตางนีสัมผัสดจริง

## Auto-scaling และ cold start

VPS ม capacity คงท่ี ถา traffic พุ่่งเกิินเครื่่งรบิไหว ตอง scale up เอง (ซึ่่งตองออกแบบลวงหนา) Workers scale ตาม request โดยอัตรโนมัต และเพราะ runtime ถูก "warm" กระจายอย่แลว cold start ของ Workers น้อยมากจนแทบไมร้สึก ตางจาก serverless บน cloud อื่่งท่ี cold start อาจกืนร้อยถิงพัน milliseconds

## ตัวอยางโค้ด

### Hello World API

ส้างโปรเจกตใหม:

```bash
npm create cloudflare@latest my-api
cd my-api
npm install
npm run dev
```

`src/index.js`:

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/hello") {
      return Response.json({
        message: "Hello from Workers",
        timestamp: new Date().toISOString(),
      });
    }

    if (url.pathname === "/api/items") {
      const items = await env.ITEMS_KV.list();
      const results = await Promise.all(
        items.keys.map((k) => env.ITEMS_KV.get(k.name, "json"))
      );
      return Response.json({ items: results });
    }

    return new Response("Not found", { status: 404 });
  },
};
```

deploy ดวย:

```bash
npm run deploy
```

### ใช D1 เป็็็นฐานขอมูล

ส้างฐานขอมูล:

```bash
wrangler d1 create mydb
```

ส้างตารางผาน Wrangler (ไฟล `schema.sql`):

```sql
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

ใชจากโค้ด:

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/posts") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM posts ORDER BY created_at DESC LIMIT 20"
      ).all();
      return Response.json({ posts: results });
    }

    if (url.pathname === "/api/posts" && request.method === "POST") {
      const { title, body } = await request.json();
      const result = await env.DB.prepare(
        "INSERT INTO posts (title, body) VALUES (?, ?)"
      ).bind(title, body).run();
      return Response.json({ id: result.meta.last_row_id }, { status: 201 });
    }

    return new Response("Not found", { status: 404 });
  },
};
```

D1 ใช SQLite syntax มาตรฐาน พรอม migrations ผาน `wrangler d1 migrations apply`

### Cron trigger

รันงานซำ้อัตรโนมัตโดยไมตองม cron บนเซิรฟเวอร:

```javascript
export default {
  async fetch(request, env) {
    return new Response("ok");
  },
  async scheduled(event, env, ctx) {
    // รันทุก 1 ชั่่งโมง (กำหนดใน wrangler.json)
    const res = await fetch("https://api.example.com/heartbeat");
    console.log("Heartbeat:", res.status);
  },
};
```

ใน `wrangler.json`:

```json
{
  "name": "my-worker",
  "triggers": {
    "crons": ["0 * * * *"]
  }
}
```

### Static site + API ใน worker เดียวก่น

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, url, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleApi(request, url, env) {
  if (url.pathname === "/api/time") {
    return Response.json({ now: Date.now() });
  }
  return new Response("Not found", { status: 404 });
}
```

## Durable Objects สำหรบ state ท่ีตอง sync

เมื่่อ Workers เป็็็น stateless งานท่ีตองให request หลาย ๆ อยาง share state เดียวก่น เช่น live chat, presence, หรืิอ rate limiter อยางซัับซอน Cloudflare ใหอปชััน Durable Objects: object ท่ี guarantee วา request ท่ีเขามาท่ี key เดียวก่นจะถูก serialise รันบน location เดียวก่นเสมอ แลวคอบ broadcast ผลไปให client ทุกคน

ตัวอยาง:

```javascript
// src/chat-room.js
export class ChatRoom extends DurableObject {
  constructor(state, env) {
    super(state, env);
    this.clients = new Set();
  }

  addClient(ws) {
    this.clients.add(ws);
  }

  broadcast(message) {
    for (const ws of this.clients) {
      ws.send(JSON.stringify(message));
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/ws") {
      const pair = new WebSocketPair();
      this.addClient(pair[1]);
      pair[1].addEventListener("message", (e) => this.broadcast({ text: e.data }));
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    return new Response("ok");
  }
}

// src/index.js
export default {
  async fetch(request, env) {
    const stub = env.CHAT.getByName("room-1");
    return stub.fetch(request);
  },
};
```

ตัวอยางนนนี้ทำใหงานเช่่น realtime collaboration, multiplayer game lobby, หรืิอระบบท่ีตอง sync state ได โดยไมตองเขียน Redis เองบน VPS

## ความปลอดภัยท่ีไดมาฟร

VPS ท่ีเช่ามาใหมเปิด port 22 และ 80/443 ไวใหทุก IP บนโลก การทำใหปลอดภัยเป็็็นงานอึกสวน: ตัง firewall, บังคัับ SSH ใหใช key เทานั่่ง, อัปเดตแพ็กเกจทันทม advisory, ตด fail2ban, และคิดวาจะรบามืออยางไรเมื่่อ DDoS มา

Workers ไมเปิด port ใด ๆ ใหผ้โจมตี โค้ดรันใน isolated V8 isolate แยกจาก request อื่่ง ทุก traffic ผาน edge network ท่ีม DDoS mitigation ระดับหลายเทราบิตฝังไวแลว TLS certificate ออกใหอัตรโนมัตทุก domain และ rate limiting ทำไดผาน KV:

```javascript
export default {
  async fetch(request, env) {
    const key = `rl:${request.headers.get("x-user-id")}`;
    const count = (await env.RL.get(key, "json")) ?? 0;
    if (count >= 60) {
      return new Response("Too many requests", { status: 429 });
    }
    await env.RL.put(key, JSON.stringify(count + 1), { expirationTtl: 60 });
    // ...ตอกับ logic ของ API
  },
};
```

สำหรบทิมเล็กท่ีไมม security engineer การได defense-in-depth มารวมแพลตฟอรมมคามาก

## วิธีย้ายจาก VPS มา Workers

ถาทิมมระบบรันอย่บน VPS อย่แลว การย้ายไมตองทำทีเดียวหมด:

1. **เรื่่มจากสวนท่ีแยกออกไดงาย** — webhook, public API, static site + API เล็ก ๆ
2. **ย้ายฐานขอมูล** — ถาใช SQLite/MySQL เล็ก ๆ ขนไป D1 (SQLite syntax) หรืิอ Postgres บน Neon/Supabase ท่ีเชื่่อมจาก Workers ไดผาน HTTP
3. **ย้าย background jobs** — cron jobs บนเซิรฟเวอรเปลี่ยนเป็็็น cron trigger ของ Workers หรืิอ Queue
4. **ย้าย static assets** — ไฟล upload เปลี่ยนเป็็็น R2 (S3-compatible API) แลวให Workers serve
5. **คอบ ๆ traffic shift** — ใช DNS ของ Cloudflare ชีบาง path มา Workers กอน แลวคอบขยาย

ทิมเล็กสวนใหญย้าย API เล็ก ๆ ไดใน 1–2 วัน และลดคา VPS ลงไดทันทม

## ข้อจำกดท่ีตองร้

Workers ไมใชคำตอบสำหรบทุกอยาง ข้อจำกดหลัก:

1. **CPU time limit** — Paid plan จำกด CPU time ท่ี 30 วินาทีตอ request (50 ms บน free tier) งานประมวลผลหนัก ๆ เช่่น render วีดโอหรืิอ ML inference ไมเหมาะ
2. **Stateless** — แต่ละ request ไม share memory กับ request อื่่ง ตองใช KV, D1, หรืิอ Durable Objects เก็บ state
3. **Filesystem จำกด** — ม ephemeral filesystem 128 MB ท่ีหายไปหลัง request จบ ไมใชเก็บขอมูลถาวรได
4. **Ecosystem บาง** — บาง library ท่ีพึ่่ง native module ของ Node อาจตองปรุบใหใช WASM แทน

## กรณท่ี VPS ยังเหมาะสม

- งานท่ีตองใช GPU หรืิอ CPU ตอเนื่่ง (rendering, ML training)
- งาน long-running ท่ีเกิิน CPU limit ของ Workers
- ตองรัน daemon หรืิอ background process ท่ีไมจบตาม request
- ตองควบคุม OS, kernel, หรืิอ hardware level
- ทิมมทักษะและเวลาดูลำ infra และตองการ ownership เต็มท่ี

## บทสรุป

สำหรบทิมเล็ก Cloudflare Workers ใหอะไรท่ี VPS ใหอึกไมไดในงบเดียวก่น: edge network ทังโลก, auto-scaling, security และ zero-ops โดย free tier ครอบคลุมโปรเจกตเล็กไดจริง ทิมเล็กท่ีเวลาเป็็็นทรพยากรท่ีหายากท่ีสุด ควรย้าย workload ท่ีเขาขาง API, server-side rendering, webhook, static site + API, และ scheduled jobs ไป Workers แลวเก็บ VPS ไวเฉพาะงานท่ี Workers ทำไมไดจริง ๆ การเลือกเครื่่งมูใหตรงกัับงานทำใหทิมโฟกัสกัับ product ไดมากขึ่่ง และนั่่งคิอเป่่าหมายท่ีแทจริงของการใชเครื่่งมูท่ีด

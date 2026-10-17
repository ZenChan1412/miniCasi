import { Env } from './types';
import * as repo from './repo';
import { GUEST_ID } from './repo';
import { askFortuneGod } from './fortune';
import {
  checkPromptPayCharge,
  createPromptPayCharge,
  readPaymentConfig,
  toPublicConfig,
} from './payment';
import { authenticate, resolveServerRole, whoAmI, type Actor } from './auth';

/** โค้ดแจกชิป: พิมพ์ต่อท้าย URL เป็น #?addchipbyownerissongponofficial<จำนวน> — ตรวจฝั่งเซิร์ฟเวอร์เท่านั้น */
const REDEEM_PREFIX = 'addchipbyownerissongponofficial';
const REDEEM_MAX_CHIPS = 1_000_000_000;

function parseRedeemCode(code: string): number | null {
  if (!code.startsWith(REDEEM_PREFIX)) return null;
  const digits = code.slice(REDEEM_PREFIX.length);
  if (!/^\d{1,10}$/.test(digits)) return null;
  const chips = Number(digits);
  return chips >= 1 && chips <= REDEEM_MAX_CHIPS ? chips : null;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

/** 'guest' เป็นค่าเริ่มต้นเมื่อไม่ส่ง userId มา เพื่อให้ผู้เล่นที่ไม่ล็อกอินมีกระเป๋าของตัวเอง */
function playerIdOf(value: unknown): string {
  if (typeof value !== 'string') return GUEST_ID;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : GUEST_ID;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return (body ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** บันทึก audit log ฝั่งเซิร์ฟเวอร์ — actor และ role มาจาก token ที่ตรวจแล้วเท่านั้น */
async function audit(
  db: Env['DB'],
  actor: Actor,
  action: string,
  targetUserId: string,
  extra: {
    detail: string;
    targetName?: string;
    amount?: number;
    balanceBefore?: number;
    balanceAfter?: number;
  }
): Promise<void> {
  await repo.addAuditLog(db, {
    actorEmail: actor.email,
    actorRole: actor.role,
    action: action as never,
    targetUserId,
    targetName: extra.targetName ?? targetUserId,
    ...extra,
  });
}

async function handleApi(request: Request, env: Env, path: string): Promise<Response> {
  const db = env.DB;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const queryUser = () => playerIdOf(url.searchParams.get('userId'));

  switch (`${method} ${path}`) {
    /* ---------------- Health / connectivity ---------------- */
    case 'GET /api/health': {
      const report = await repo.checkHealth(db);
      return json(report, report.ok ? 200 : 503);
    }

    /* ---------------- เทพเจ้าลูกเต๋า (Gemini) ---------------- */
    case 'POST /api/chat': {
      const body = await readBody(request);
      const result = await askFortuneGod(env, body.messages);
      return 'reply' in result ? json(result) : fail(result.error, result.status);
    }

    /* ---------------- Wallet ---------------- */
    case 'GET /api/wallet':
      return json(await repo.getWallet(db, queryUser()));

    case 'PUT /api/wallet': {
      const body = await readBody(request);
      const wallet = body.wallet as Record<string, unknown> | undefined;
      if (!wallet || typeof wallet.balance !== 'number') {
        return fail('ต้องส่ง wallet ที่มี balance เป็นตัวเลข');
      }
      return json(
        await repo.saveWallet(db, playerIdOf(body.userId), {
          walletId: String(wallet.walletId ?? ''),
          balance: wallet.balance,
          lastBailoutAt: Number(wallet.lastBailoutAt ?? 0),
          lastDailyClaimAt: Number(wallet.lastDailyClaimAt ?? 0),
        })
      );
    }

    case 'POST /api/wallet/reset': {
      const body = await readBody(request);
      return json(await repo.resetWallet(db, playerIdOf(body.userId)));
    }

    /* ---------------- Stats ---------------- */
    case 'GET /api/stats':
      return json(await repo.getStats(db, queryUser()));

    case 'PUT /api/stats': {
      const body = await readBody(request);
      const stats = body.stats as Record<string, unknown> | undefined;
      if (!stats || typeof stats.totalRounds !== 'number') {
        return fail('ต้องส่ง stats ที่มี totalRounds เป็นตัวเลข');
      }
      return json(
        await repo.saveStats(db, playerIdOf(body.userId), {
          totalRounds: Number(stats.totalRounds),
          wins: Number(stats.wins ?? 0),
          losses: Number(stats.losses ?? 0),
          winRatePercentage: Number(stats.winRatePercentage ?? 0),
          currentStreak: Number(stats.currentStreak ?? 0),
          maxStreak: Number(stats.maxStreak ?? 0),
          biggestWin: Number(stats.biggestWin ?? 0),
          roadmap: Array.isArray(stats.roadmap) ? (stats.roadmap as never[]) : [],
        })
      );
    }

    case 'POST /api/stats/reset': {
      const body = await readBody(request);
      return json(await repo.resetStats(db, playerIdOf(body.userId)));
    }

    /* ---------------- Players ---------------- */
    case 'POST /api/redeem': {
      const who = await whoAmI(request, env);
      if (!who.ok) return fail(who.error, who.status);
      const body = await readBody(request);
      const code = typeof body.code === 'string' ? body.code.trim().toLowerCase() : '';
      const chips = parseRedeemCode(code);
      if (!chips) return fail('โค้ดไม่ถูกต้อง', 404);

      const result = await repo.redeemCode(db, who.actor.playerId, chips);

      await repo.addAuditLog(db, {
        actorEmail: who.actor.email,
        actorRole: who.actor.role,
        action: 'CHIP_GRANT',
        targetUserId: who.actor.playerId,
        targetName: who.actor.email,
        amount: chips,
        balanceBefore: result.newBalance - chips,
        balanceAfter: result.newBalance,
        detail: `ใช้โค้ดแจกชิป +${chips.toLocaleString()} ชิป โดย ${who.actor.email}`,
      });
      return json({ chips, balance: result.newBalance });
    }

    case 'GET /api/me': {
      const who = await whoAmI(request, env);
      return who.ok ? json({ role: who.actor.role }) : fail(who.error, who.status);
    }

    case 'POST /api/players/register': {
      const body = await readBody(request);
      const profile = body.profile as Record<string, unknown> | undefined;
      if (!profile || typeof profile.id !== 'string') {
        return fail('ต้องส่ง profile ที่มี id');
      }
      await repo.registerUser(db, profile as never);
      return json({ ok: true });
    }

    /* ---------------- Bans (public: เฉพาะ id ไม่มีเหตุผล) ---------------- */
    case 'GET /api/bans/ids':
      return json(await repo.listBannedIds(db));

    /* ---------------- Admin (ทุก endpoint ต้องผ่าน authenticate) ---------------- */
    case 'GET /api/admin/users':
    case 'GET /api/admin/metrics':
    case 'GET /api/admin/bans':
    case 'GET /api/admin/role-overrides':
    case 'GET /api/admin/audit': {
      const auth = await authenticate(request, env, 'admin');
      if (!auth.ok) return fail(auth.error, auth.status);
      if (path === '/api/admin/users') return json(await repo.listManagedUsers(db));
      if (path === '/api/admin/metrics') return json(await repo.getSystemMetrics(db));
      if (path === '/api/admin/bans') return json(await repo.listBans(db));
      if (path === '/api/admin/role-overrides') return json(await repo.listRoleOverrides(db));
      const limit = Number(url.searchParams.get('limit') ?? '100');
      return json(await repo.listAuditLogs(db, Number.isFinite(limit) ? limit : 100));
    }

    case 'POST /api/admin/ban':
    case 'POST /api/admin/unban': {
      const auth = await authenticate(request, env, 'admin');
      if (!auth.ok) return fail(auth.error, auth.status);
      const { actor } = auth;
      const body = await readBody(request);
      const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId.trim() : '';
      if (!targetUserId) return fail('ต้องระบุ targetUserId');

      // admin แบน/ปลดแบนได้เฉพาะ player — ผู้ที่เป็น admin/creator ต้องใช้ creator
      if (actor.role !== 'creator') {
        const target = await repo.getPlayerIdentity(db, targetUserId);
        const targetRole = await resolveServerRole(db, targetUserId, target?.email ?? null);
        if (targetRole !== 'player') {
          return fail('ผู้ดูแลระบบไม่มีสิทธิ์แบนหรือปลดแบน Admin/Creator (ต้องเป็น Creator)', 403);
        }
      }

      if (path === '/api/admin/ban') {
        const reason =
          typeof body.reason === 'string' && body.reason.trim()
            ? body.reason.trim()
            : 'ละเมิดข้อกำหนดการใช้งาน';
        await repo.banUser(db, targetUserId, reason, actor.email);
        await audit(db, actor, 'USER_BAN', targetUserId, {
          detail: `ระงับบัญชี (Ban) ${targetUserId} ข้อหา: ${reason} โดย ${actor.email}`,
        });
      } else {
        await repo.unbanUser(db, targetUserId);
        await audit(db, actor, 'USER_UNBAN', targetUserId, {
          detail: `ปลดระงับบัญชี (Unban) ${targetUserId} สำเร็จ โดย ${actor.email}`,
        });
      }
      return json({ ok: true });
    }

    case 'POST /api/admin/role-override': {
      const auth = await authenticate(request, env, 'creator');
      if (!auth.ok) return fail(auth.error, auth.status);
      const { actor } = auth;
      const body = await readBody(request);
      const identifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';
      const role = body.role;
      if (!identifier) return fail('ต้องระบุ identifier');
      if (role !== 'creator' && role !== 'admin' && role !== 'player') {
        return fail('role ต้องเป็น creator, admin หรือ player');
      }
      const lowered = identifier.toLowerCase();
      if (lowered === actor.playerId.toLowerCase() || lowered === actor.email) {
        return fail('ไม่สามารถเปลี่ยนระดับสิทธิ์ของตัวเองได้', 403);
      }
      await repo.setRoleOverride(db, identifier, role, actor.email);
      await audit(db, actor, role === 'player' ? 'ROLE_DEMOTE' : 'ROLE_PROMOTE', identifier, {
        targetName: identifier,
        detail: `เปลี่ยนระดับสิทธิ์ของ ${identifier} เป็น ${role.toUpperCase()} โดย ${actor.email}`,
      });
      return json({ ok: true });
    }

    case 'POST /api/admin/chips/grant': {
      const auth = await authenticate(request, env, 'admin');
      if (!auth.ok) return fail(auth.error, auth.status);
      const body = await readBody(request);
      const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId.trim() : '';
      const amount = body.amount;
      if (!targetUserId) return fail('ต้องระบุ targetUserId');
      if (
        typeof amount !== 'number' ||
        !Number.isInteger(amount) ||
        amount < 1 ||
        amount > 1_000_000_000
      ) {
        return fail('amount ต้องเป็นจำนวนเต็ม 1 ถึง 1,000,000,000');
      }
      const { before, newBalance } = await repo.grantChips(db, targetUserId, amount);
      await audit(db, auth.actor, 'CHIP_GRANT', targetUserId, {
        amount,
        balanceBefore: before,
        balanceAfter: newBalance,
        detail: `เพิ่มชิป +${amount.toLocaleString()} ชิป (จาก ${before.toLocaleString()} เป็น ${newBalance.toLocaleString()}) โดย ${auth.actor.email}`,
      });
      return json({ newBalance });
    }

    case 'POST /api/admin/wallet/reset': {
      const auth = await authenticate(request, env, 'admin');
      if (!auth.ok) return fail(auth.error, auth.status);
      const body = await readBody(request);
      const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId.trim() : '';
      if (!targetUserId) return fail('ต้องระบุ targetUserId');
      const before = (await repo.getWallet(db, targetUserId)).balance;
      const wallet = await repo.resetWallet(db, targetUserId);
      await audit(db, auth.actor, 'WALLET_RESET', targetUserId, {
        balanceBefore: before,
        balanceAfter: wallet.balance,
        detail: `รีเซ็ตยอดชิปของ ${targetUserId} กลับเป็น ${wallet.balance.toLocaleString()} ชิป โดย ${auth.actor.email}`,
      });
      return json({ balance: wallet.balance });
    }

    case 'POST /api/admin/cooldown/reset': {
      const auth = await authenticate(request, env, 'admin');
      if (!auth.ok) return fail(auth.error, auth.status);
      const body = await readBody(request);
      const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId.trim() : '';
      if (!targetUserId) return fail('ต้องระบุ targetUserId');
      await repo.resetCooldowns(db, targetUserId);
      await audit(db, auth.actor, 'COOLDOWN_RESET', targetUserId, {
        detail: `ล้าง Cooldown (Bailout & Daily) ของ ${targetUserId} โดย ${auth.actor.email}`,
      });
      return json({ ok: true });
    }

    /* ---------------- Payment (เติมชิปด้วยเงินจริง: PromptPay) ---------------- */
    case 'GET /api/payment/config':
      return json(toPublicConfig(readPaymentConfig(env)));

    case 'POST /api/payment/promptpay/create': {
      const body = await readBody(request);
      const config = readPaymentConfig(env);
      if (!config.apiKey) {
        return fail('ระบบเติมชิปด้วยเงินจริงยังไม่เปิดใช้งาน (ยังไม่ได้ตั้งค่า INWCLOUD_API_KEY)', 503);
      }

      const chips = Math.floor(Number(body.chips));
      if (!Number.isFinite(chips) || chips <= 0) {
        return fail('จำนวนชิปที่ต้องการเติมไม่ถูกต้อง');
      }

      const minChips = Math.ceil(config.minTopupThb * config.chipsPerThb);
      const maxChips = Math.floor(config.maxTopupThb * config.chipsPerThb);
      if (chips < minChips) {
        return fail(`ยอดเติมขั้นต่ำ ${minChips.toLocaleString()} ชิป (${config.minTopupThb} บาท)`);
      }
      if (chips > maxChips) {
        return fail(`ยอดเติมสูงสุด ${maxChips.toLocaleString()} ชิป (${config.maxTopupThb} บาท)`);
      }

      const amountThb = Math.ceil(chips / config.chipsPerThb);
      const result = await createPromptPayCharge(env, amountThb);
      if (!result.ok) return fail(result.error, result.status);

      const order = await repo.createPaymentOrder(db, {
        playerId: playerIdOf(body.userId),
        transactionId: result.data.transactionId,
        chips,
        amountThb: result.data.amountThb,
        qrUrl: result.data.qrUrl,
        payload: result.data.payload,
        expiresAt: result.data.expiresAt,
      });

      return json({
        status: 'pending',
        transactionId: order.transactionId,
        qrUrl: order.qrUrl ?? '',
        payload: order.payload ?? '',
        amountThb: order.amountThb,
        chips: order.chips,
        expiresAt: order.expiresAt ?? 0,
      });
    }

    case 'POST /api/payment/promptpay/check': {
      const body = await readBody(request);
      const transactionId = typeof body.transactionId === 'string' ? body.transactionId.trim() : '';
      if (!transactionId) return fail('ต้องระบุ transactionId');

      const order = await repo.getPaymentOrder(db, transactionId);
      if (!order) return fail('ไม่พบรายการเติมชิปนี้', 404);

      // เคลียร์ไปแล้ว (เช่น ตรวจซ้ำหลังสำเร็จ) — คืนยอดล่าสุดโดยไม่เติมซ้ำ
      if (order.status === 'paid') {
        const wallet = await repo.getWallet(db, order.playerId);
        return json({ status: 'paid', chips: order.chips, balance: wallet.balance });
      }

      const result = await checkPromptPayCharge(env, transactionId);
      if (!result.ok) return fail(result.error, result.status);
      if (!result.data.paid) {
        return json({ status: 'pending' });
      }

      const settled = await repo.settlePaymentOrder(db, transactionId);
      if (!settled) {
        // มีคำขออื่นเคลียร์ไปก่อนแล้วระหว่างที่เราตรวจ
        const wallet = await repo.getWallet(db, order.playerId);
        return json({ status: 'paid', chips: order.chips, balance: wallet.balance });
      }

      return json({
        status: 'paid',
        chips: settled.order.chips,
        amountThb: settled.order.amountThb,
        balance: settled.newBalance,
      });
    }

    default:
      return fail(`ไม่พบ endpoint: ${method} ${path}`, 404);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      // คำขออื่นทั้งหมดส่งต่อให้ static assets (SPA) ตามเดิม
      return env.ASSETS.fetch(request);
    }

    try {
      return await handleApi(request, env, url.pathname.replace(/\/+$/, '') || '/api');
    } catch (err) {
      console.error('API error:', err);
      return json(
        {
          error: 'เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์',
          detail: err instanceof Error ? err.message : String(err),
        },
        500
      );
    }
  },
};

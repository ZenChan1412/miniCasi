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
    case 'POST /api/players/register': {
      const body = await readBody(request);
      const profile = body.profile as Record<string, unknown> | undefined;
      if (!profile || typeof profile.id !== 'string') {
        return fail('ต้องส่ง profile ที่มี id');
      }
      await repo.registerUser(db, profile as never);
      return json({ ok: true });
    }

    /* ---------------- Admin ---------------- */
    case 'GET /api/admin/users':
      return json(await repo.listManagedUsers(db));

    case 'GET /api/admin/metrics':
      return json(await repo.getSystemMetrics(db));

    case 'GET /api/admin/bans':
      return json(await repo.listBans(db));

    case 'POST /api/admin/ban': {
      const body = await readBody(request);
      const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId : '';
      if (!targetUserId) return fail('ต้องระบุ targetUserId');
      await repo.banUser(
        db,
        targetUserId,
        typeof body.reason === 'string' ? body.reason : 'ละเมิดข้อกำหนดการใช้งาน',
        typeof body.actorEmail === 'string' ? body.actorEmail : undefined
      );
      return json({ ok: true });
    }

    case 'POST /api/admin/unban': {
      const body = await readBody(request);
      const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId : '';
      if (!targetUserId) return fail('ต้องระบุ targetUserId');
      await repo.unbanUser(db, targetUserId);
      return json({ ok: true });
    }

    case 'GET /api/admin/role-overrides':
      return json(await repo.listRoleOverrides(db));

    case 'POST /api/admin/role-override': {
      const body = await readBody(request);
      const identifier = typeof body.identifier === 'string' ? body.identifier : '';
      const role = body.role;
      if (!identifier) return fail('ต้องระบุ identifier');
      if (role !== 'creator' && role !== 'admin' && role !== 'player') {
        return fail('role ต้องเป็น creator, admin หรือ player');
      }
      await repo.setRoleOverride(
        db,
        identifier,
        role,
        typeof body.actorEmail === 'string' ? body.actorEmail : undefined
      );
      return json({ ok: true });
    }

    case 'GET /api/admin/audit': {
      const limit = Number(url.searchParams.get('limit') ?? '100');
      return json(await repo.listAuditLogs(db, Number.isFinite(limit) ? limit : 100));
    }

    case 'POST /api/admin/audit': {
      const body = await readBody(request);
      const entry = body.entry as Record<string, unknown> | undefined;
      if (!entry || typeof entry.detail !== 'string' || typeof entry.action !== 'string') {
        return fail('ต้องส่ง entry ที่มี action และ detail');
      }
      return json(await repo.addAuditLog(db, entry as never));
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

import { Env } from './types';
import * as repo from './repo';
import { GUEST_ID } from './repo';

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

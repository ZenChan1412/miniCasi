import { GoogleJwtPayload } from '../../domain/entities/User';

/**
 * ถอดรหัส Base64URL JWT ID Token จาก Google Identity Services
 * รองรับ UTF-8 ภาษาไทยและอักขระพิเศษอย่างปลอดภัย ปราศจาก external dependencies
 */
export function decodeGoogleJwt(token: string): GoogleJwtPayload | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64Url = parts[1];
    // แปลง Base64URL ให้เป็น Base64 มาตรฐาน
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (base64.length % 4)) % 4;
    const padded = base64.padEnd(base64.length + padLength, '=');

    // ถอดรหัส UTF-8 อย่างถูกต้อง
    const decodedBinary = atob(padded);
    const jsonPayload = decodeURIComponent(
      decodedBinary
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    const parsed = JSON.parse(jsonPayload) as GoogleJwtPayload;
    if (!parsed || !parsed.sub) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('ไม่สามารถถอดรหัส Google JWT token ได้:', error);
    return null;
  }
}

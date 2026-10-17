import { api } from '../api/apiClient';

/**
 * ตัวเรียก API เติมชิปด้วยเงินจริง (PromptPay)
 *
 * เบราว์เซอร์ไม่เคยเห็นคีย์ของ Payment Gateway — คีย์อยู่ใน Worker เท่านั้น
 * ไฟล์นี้จึงเรียก /api/payment/* ของเรา แล้วให้ Worker ไปคุยกับ Gateway อีกชั้น
 */

export interface PaymentConfigResponse {
  /** true เมื่อ Worker ตั้งค่า INWCLOUD_API_KEY แล้ว */
  enabled: boolean;
  /** กี่ชิปต่อ 1 บาท */
  chipsPerThb: number;
  /** ยอดเติมขั้นต่ำหน่วยบาท */
  minTopupThb: number;
  /** ยอดเติมสูงสุดหน่วยบาท */
  maxTopupThb: number;
}

export interface CreateTopUpResponse {
  status: 'pending';
  transactionId: string;
  qrUrl: string;
  payload: string;
  amountThb: number;
  chips: number;
  /** เวลาหมดอายุเป็น Unix timestamp หน่วยมิลลิวินาที (0 = ไม่ระบุ) */
  expiresAt: number;
}

export interface CheckTopUpResponse {
  status: 'paid' | 'pending';
  chips?: number;
  amountThb?: number;
  balance?: number;
}

export async function fetchPaymentConfig(): Promise<PaymentConfigResponse> {
  return api.get<PaymentConfigResponse>('/payment/config');
}

export async function createPromptPayTopUp(
  chips: number,
  userId?: string
): Promise<CreateTopUpResponse> {
  return api.post<CreateTopUpResponse>('/payment/promptpay/create', { chips, userId });
}

export async function checkPromptPayTopUp(transactionId: string): Promise<CheckTopUpResponse> {
  return api.post<CheckTopUpResponse>('/payment/promptpay/check', { transactionId });
}

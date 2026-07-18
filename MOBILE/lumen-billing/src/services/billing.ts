import { INVOICES, PAYMENTS, TRANSACTIONS, VOUCHERS } from '@/data/mock';
import type { Invoice, Payment, Transaction, Voucher } from '@/data/types';
import { ENDPOINTS, IS_LIVE } from './config';
import { http } from './http';
import {
  mapInvoice,
  mapPayment,
  mapTransaction,
  mapVoucher,
  type InvoiceDTO,
  type PaymentDTO,
  type VoucherDTO,
} from './mappers';

export async function listPayments(): Promise<Payment[]> {
  if (!IS_LIVE) return PAYMENTS;
  const res = await http.get<{ payments: PaymentDTO[] }>(ENDPOINTS.billingPayments, { per_page: 200 });
  return (res.payments ?? []).map(mapPayment);
}

export async function listTransactions(): Promise<Transaction[]> {
  if (!IS_LIVE) return TRANSACTIONS;
  const res = await http.get<{ transactions: PaymentDTO[] }>(ENDPOINTS.billingTransactions, {
    per_page: 200,
  });
  return (res.transactions ?? []).map(mapTransaction);
}

export async function listVouchers(): Promise<Voucher[]> {
  if (!IS_LIVE) return VOUCHERS;
  const res = await http.get<{ vouchers: VoucherDTO[] }>(ENDPOINTS.billingVouchers, { per_page: 200 });
  return (res.vouchers ?? []).map(mapVoucher);
}

export async function listInvoices(): Promise<Invoice[]> {
  if (!IS_LIVE) return INVOICES;
  const res = await http.get<{ invoices: InvoiceDTO[] }>(ENDPOINTS.invoices, { per_page: 200 });
  return (res.invoices ?? []).map(mapInvoice);
}

export async function getInvoice(id: number): Promise<Invoice | undefined> {
  if (!IS_LIVE) return INVOICES.find((i) => i.id === id);
  const dto = await http.get<InvoiceDTO>(ENDPOINTS.invoice(id));
  return mapInvoice(dto);
}

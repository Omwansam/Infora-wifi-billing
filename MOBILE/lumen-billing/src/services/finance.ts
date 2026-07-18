import { DASHBOARD, EXPENSES } from '@/data/mock';
import type { Expense } from '@/data/types';
import { ENDPOINTS, IS_LIVE } from './config';
import { http } from './http';
import { mapExpense, type ExpenseDTO } from './mappers';

export interface FinanceSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  mrr: number;
  arpu: number;
}

interface FinanceSummaryDTO {
  total_revenue?: number;
  total_expenses?: number;
  net_profit?: number;
  monthly_recurring_revenue?: number;
  arpu?: number;
}

export async function getFinanceSummary(): Promise<FinanceSummary> {
  if (!IS_LIVE) return DASHBOARD.finance;
  const d = await http.get<FinanceSummaryDTO>(ENDPOINTS.financeSummary);
  return {
    totalRevenue: d.total_revenue ?? 0,
    totalExpenses: d.total_expenses ?? 0,
    netProfit: d.net_profit ?? 0,
    mrr: d.monthly_recurring_revenue ?? 0,
    arpu: d.arpu ?? 0,
  };
}

export async function listExpenses(): Promise<Expense[]> {
  if (!IS_LIVE) return EXPENSES;
  const res = await http.get<{ expenses: ExpenseDTO[] } | ExpenseDTO[]>(ENDPOINTS.financeExpenses);
  const items = Array.isArray(res) ? res : (res.expenses ?? []);
  return items.map(mapExpense);
}

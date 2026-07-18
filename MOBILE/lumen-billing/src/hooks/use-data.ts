/**
 * Domain data hooks — thin `useQuery` wrappers over the service layer.
 * Every screen consumes these instead of importing mock arrays directly, so
 * the data source (demo vs. live Infora API) is transparent to the UI.
 */
import * as billingService from '@/services/billing';
import * as customerService from '@/services/customers';
import * as dashboardService from '@/services/dashboard';
import * as deviceService from '@/services/devices';
import * as financeService from '@/services/finance';
import * as planService from '@/services/plans';
import * as ticketService from '@/services/tickets';
import { useQuery } from './use-query';

export const useDashboard = (routerId = 'all') =>
  useQuery(() => dashboardService.getDashboard(routerId), [routerId]);

export const useCustomers = () => useQuery(() => customerService.listCustomers(), []);
export const useCustomer = (id: number) => useQuery(() => customerService.getCustomer(id), [id]);

export const usePlans = () => useQuery(() => planService.listPlans(), []);
export const usePlan = (id: number) => useQuery(() => planService.getPlan(id), [id]);

export const usePayments = () => useQuery(() => billingService.listPayments(), []);
export const useTransactions = () => useQuery(() => billingService.listTransactions(), []);
export const useVouchers = () => useQuery(() => billingService.listVouchers(), []);
export const useInvoices = () => useQuery(() => billingService.listInvoices(), []);
export const useInvoice = (id: number) => useQuery(() => billingService.getInvoice(id), [id]);

export const useTickets = () => useQuery(() => ticketService.listTickets(), []);
export const useTicket = (id: number) => useQuery(() => ticketService.getTicket(id), [id]);

export const useDevices = () => useQuery(() => deviceService.listDevices(), []);
export const useSessions = () => useQuery(() => deviceService.listSessions(), []);

export const useFinanceSummary = () => useQuery(() => financeService.getFinanceSummary(), []);
export const useExpenses = () => useQuery(() => financeService.listExpenses(), []);

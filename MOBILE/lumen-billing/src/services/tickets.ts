import { findTicket, TICKETS } from '@/data/mock';
import type { Ticket } from '@/data/types';
import { ENDPOINTS, IS_LIVE } from './config';
import { http } from './http';
import { mapTicket, type TicketDTO } from './mappers';

export async function listTickets(): Promise<Ticket[]> {
  if (!IS_LIVE) return TICKETS;
  const res = await http.get<{ tickets: TicketDTO[] }>(ENDPOINTS.tickets, { per_page: 100 });
  return (res.tickets ?? []).map(mapTicket);
}

export async function getTicket(id: number): Promise<Ticket | undefined> {
  if (!IS_LIVE) return findTicket(id);
  const dto = await http.get<TicketDTO>(ENDPOINTS.ticket(id));
  return mapTicket(dto);
}

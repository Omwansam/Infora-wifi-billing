import { CUSTOMERS, findCustomer } from '@/data/mock';
import type { Customer } from '@/data/types';
import { ENDPOINTS, IS_LIVE } from './config';
import { http } from './http';
import { mapCustomer, type CustomerDTO } from './mappers';

export async function listCustomers(): Promise<Customer[]> {
  if (!IS_LIVE) return CUSTOMERS;
  const res = await http.get<{ customers: CustomerDTO[] }>(ENDPOINTS.customers, { per_page: 200 });
  return (res.customers ?? []).map(mapCustomer);
}

export async function getCustomer(id: number): Promise<Customer | undefined> {
  if (!IS_LIVE) return findCustomer(id);
  const dto = await http.get<CustomerDTO>(ENDPOINTS.customer(id));
  return mapCustomer(dto);
}

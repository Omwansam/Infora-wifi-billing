import { findPlan, PLANS } from '@/data/mock';
import type { Plan } from '@/data/types';
import { ENDPOINTS, IS_LIVE } from './config';
import { http } from './http';
import { mapPlan, type PlanDTO } from './mappers';

export async function listPlans(): Promise<Plan[]> {
  if (!IS_LIVE) return PLANS;
  const res = await http.get<{ plans: PlanDTO[] }>(ENDPOINTS.plans, { per_page: 100 });
  return (res.plans ?? []).map(mapPlan);
}

export async function getPlan(id: number): Promise<Plan | undefined> {
  if (!IS_LIVE) return findPlan(id);
  const dto = await http.get<PlanDTO>(ENDPOINTS.plan(id));
  return mapPlan(dto);
}

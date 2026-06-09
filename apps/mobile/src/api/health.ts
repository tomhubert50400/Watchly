import { apiGet } from './client';

export type HealthResponse = {
  status: 'ok';
  service: 'api';
  timestamp: string;
  uptimeSeconds: number;
};

export function getHealth() {
  return apiGet<HealthResponse>('/health');
}

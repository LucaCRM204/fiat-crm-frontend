import { api } from './api';

export interface Lead {
  id: number;
  nombre: string;
  telefono: string;
  modelo: string;
  formaPago?: string;
  infoUsado?: string;
  entrega?: boolean;
  fecha?: string;
  estado: string;
  vendedor?: number | null;
  assigned_to?: number | null;
  notas?: string;
  fuente: string;
  equipo?: string;
  historial?: Array<{
    estado: string;
    timestamp: string;
    usuario: string;
  }>;
  created_by?: number;
  created_at?: string;
  last_status_change?: string;
}

export interface CreateLeadData {
  nombre: string;
  telefono: string;
  modelo: string;
  formaPago?: string;
  infoUsado?: string;
  entrega?: boolean;
  notas?: string;
  estado?: string;
  fuente?: string;
  fecha?: string;
  vendedor?: number | null;
  equipo?: string;
}

export interface UpdateLeadData {
  nombre?: string;
  telefono?: string;
  modelo?: string;
  formaPago?: string;
  infoUsado?: string;
  entrega?: boolean;
  notas?: string;
  estado?: string;
  fuente?: string;
  fecha?: string;
  vendedor?: number | null;
  equipo?: string;
}

export async function listLeads(): Promise<Lead[]> {
  const response = await api.get('/leads');
  return response.data;
}

export async function getLead(id: number): Promise<Lead> {
  const response = await api.get(`/leads/${id}`);
  return response.data;
}

export async function createLead(data: CreateLeadData): Promise<Lead> {
  const response = await api.post('/leads', data);
  return response.data;
}

export async function updateLead(id: number, data: UpdateLeadData): Promise<Lead> {
  const response = await api.put(`/leads/${id}`, data);
  return response.data;
}

export async function deleteLead(id: number): Promise<{ ok: boolean; message: string }> {
  const response = await api.delete(`/leads/${id}`);
  return response.data;
}
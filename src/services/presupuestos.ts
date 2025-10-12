import { api } from '../api';

export interface Presupuesto {
  id: number;
  modelo: string;
  marca: string;
  imagen_url?: string;
  precio_contado?: string;
  especificaciones_tecnicas?: string;
  planes_cuotas?: any;
  bonificaciones?: string;
  anticipo?: string;
  activo: boolean;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePresupuestoData {
  modelo: string;
  marca: string;
  imagen_url?: string;
  precio_contado?: string;
  especificaciones_tecnicas?: string;
  planes_cuotas?: any;
  bonificaciones?: string;
  anticipo?: string;
  activo?: boolean;
}

export interface UpdatePresupuestoData {
  modelo?: string;
  marca?: string;
  imagen_url?: string;
  precio_contado?: string;
  especificaciones_tecnicas?: string;
  planes_cuotas?: any;
  bonificaciones?: string;
  anticipo?: string;
  activo?: boolean;
}

type PresupuestoData = {
  nombreVehiculo: string;
  valorMinimo: string;
  anticipo?: string;
  bonificacionCuota?: string;
  cuotas: Array<{ cantidad: string; valor: string }>;
  adjudicacion?: string;
  marcaModelo?: string;
  anio?: string;
  kilometros?: string;
  valorEstimado?: string;
  observaciones?: string;
  vendedor: string;
  cliente: string;
  telefono: string;
  bonificaciones?: string[];
};

// Función para generar PDF personalizado
export async function generarPresupuestoPDF(data: PresupuestoData): Promise<void> {
  const response = await api.post('/presupuestos/generar-pdf', data, {
    responseType: 'blob'
  });
  
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `presupuesto_${data.cliente.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// Funciones CRUD de plantillas
export async function listPresupuestos(): Promise<Presupuesto[]> {
  const response = await api.get('/presupuestos');
  return response.data;
}

export async function getPresupuesto(id: number): Promise<Presupuesto> {
  const response = await api.get(`/presupuestos/${id}`);
  return response.data;
}

export async function createPresupuesto(data: CreatePresupuestoData): Promise<Presupuesto> {
  const response = await api.post('/presupuestos', data);
  return response.data;
}

export async function updatePresupuesto(id: number, data: UpdatePresupuestoData): Promise<Presupuesto> {
  const response = await api.put(`/presupuestos/${id}`, data);
  return response.data;
}

export async function deletePresupuesto(id: number): Promise<{ ok: boolean; message: string }> {
  const response = await api.delete(`/presupuestos/${id}`);
  return response.data;
}
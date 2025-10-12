import { api } from '../api';

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
  link.setAttribute('download', `presupuesto_${Date.now()}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// Funciones CRUD de plantillas (las que ya tenías)
export async function listPresupuestos() {
  const res = await api.get('/presupuestos');
  return res.data.plantillas || [];
}

export async function createPresupuesto(data: any) {
  const res = await api.post('/presupuestos', data);
  return res.data.plantilla;
}

export async function updatePresupuesto(id: number, data: any) {
  const res = await api.put(`/presupuestos/${id}`, data);
  return res.data.plantilla;
}

export async function deletePresupuesto(id: number) {
  const res = await api.delete(`/presupuestos/${id}`);
  return res.data;
}
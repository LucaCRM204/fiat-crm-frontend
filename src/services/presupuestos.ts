import { api } from './api';

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

export interface GenerarPDFData {
  cliente: string;
  vehiculo: {
    marca: string;
    modelo: string;
    año?: string;
    imagen_url?: string;
  };
  financiacion: {
    precio_contado?: string;
    anticipo?: string;
    planes_cuotas?: any;
    bonificaciones?: string;
  };
  especificaciones_tecnicas?: string;
  observaciones?: string;
  vendedor?: string;
  fecha?: string;
}

// Función PRINCIPAL para generar PDF desde el backend
export async function generarPresupuestoPDFBackend(data: GenerarPDFData): Promise<void> {
  try {
    console.log('📄 Solicitando PDF al backend con datos:', data);
    
    const response = await api.post('/presupuestos/generar-pdf', data, {
      responseType: 'blob',
      timeout: 30000 // 30 segundos de timeout
    });
    
    // Crear blob del PDF
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    
    // Crear link temporal y descargar
    const link = document.createElement('a');
    link.href = url;
    link.download = `presupuesto_${data.cliente.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    
    // Limpiar
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    console.log('✅ PDF descargado correctamente');
  } catch (error) {
    console.error('❌ Error generando PDF desde backend:', error);
    throw new Error('No se pudo generar el PDF. Por favor intenta nuevamente.');
  }
}

// Función alternativa para vista previa del PDF en nueva pestaña
export async function previsualizarPresupuestoPDF(data: GenerarPDFData): Promise<void> {
  try {
    const response = await api.post('/presupuestos/generar-pdf', data, {
      responseType: 'blob',
      timeout: 30000
    });
    
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    
    // Abrir en nueva pestaña
    window.open(url, '_blank');
    
    // Limpiar después de 1 minuto
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 60000);
    
  } catch (error) {
    console.error('Error previsualizando PDF:', error);
    throw new Error('No se pudo previsualizar el PDF.');
  }
}

// Funciones CRUD
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
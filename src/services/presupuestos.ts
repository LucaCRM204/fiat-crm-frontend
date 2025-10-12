import { api } from './api';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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

// Función para generar PDF desde el modal visual
export async function generarPresupuestoPDFDesdeModal(elementId: string, cliente: string): Promise<void> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error('Elemento no encontrado');
    }

    // Ocultar botones antes de capturar
    const botones = element.querySelectorAll('button');
    botones.forEach(btn => (btn as HTMLElement).style.display = 'none');

    // Capturar el contenido del modal como imagen
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    // Restaurar botones
    botones.forEach(btn => (btn as HTMLElement).style.display = '');

    // Crear PDF
    const imgWidth = 210; // A4 ancho en mm
    const pageHeight = 297; // A4 alto en mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    let heightLeft = imgHeight;
    let position = 0;

    // Agregar primera página
    pdf.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      0,
      position,
      imgWidth,
      imgHeight
    );
    heightLeft -= pageHeight;

    // Si necesita más páginas
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        0,
        position,
        imgWidth,
        imgHeight
      );
      heightLeft -= pageHeight;
    }

    // Descargar PDF
    pdf.save(`presupuesto_${cliente.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
  } catch (error) {
    console.error('Error generando PDF:', error);
    throw error;
  }
}

// Función alternativa que usa el backend (mantener por compatibilidad)
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
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

// Función para generar PDF desde el modal visual con encoding correcto
export async function generarPresupuestoPDFDesdeModal(elementId: string, cliente: string): Promise<void> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error('Elemento no encontrado');
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    const botones = element.querySelectorAll('button');
    botones.forEach(btn => (btn as HTMLElement).style.display = 'none');

    await new Promise(resolve => setTimeout(resolve, 300));

    const modal = element.closest('.overflow-y-auto');
    if (modal) {
      modal.scrollTop = 0;
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    const canvas = await html2canvas(element, {
      scale: 2.5,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 794, // Ancho A4 en pixels (210mm)
      windowHeight: element.scrollHeight,
      imageTimeout: 15000,
      onclone: (clonedDoc) => {
        const clonedElement = clonedDoc.getElementById(elementId);
        if (clonedElement) {
          // Ajustar a tamaño A4
          clonedElement.style.width = '794px'; // 210mm en pixels
          clonedElement.style.maxWidth = '794px';
          clonedElement.style.minWidth = '794px';
          clonedElement.style.padding = '20px';
          clonedElement.style.boxSizing = 'border-box';
          
          // Reducir tamaño de fuentes y espaciados
          const allElements = clonedElement.querySelectorAll('*');
          allElements.forEach((el: any) => {
            // Ajustar font sizes
            const currentFontSize = window.getComputedStyle(el).fontSize;
            if (currentFontSize) {
              const sizeInPx = parseFloat(currentFontSize);
              if (sizeInPx > 0) {
                el.style.fontSize = `${sizeInPx * 0.85}px`; // Reducir 15%
              }
            }
            
            // Ajustar paddings
            const currentPadding = window.getComputedStyle(el).padding;
            if (currentPadding && currentPadding !== '0px') {
              el.style.padding = '8px';
            }
            
            // Asegurar UTF-8 correcto
            if (el.textContent) {
              el.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
              el.style.textRendering = 'optimizeLegibility';
              el.style.webkitFontSmoothing = 'antialiased';
            }
          });
          
          // Cambiar grids de 3 columnas a 2 para que quepa mejor
          const grids = clonedElement.querySelectorAll('.grid-cols-3, .lg\\:grid-cols-3');
          grids.forEach((grid: any) => {
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
            grid.style.gap = '12px';
          });
        }
      }
    });

    botones.forEach(btn => (btn as HTMLElement).style.display = '');
    document.body.style.overflow = originalOverflow;

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    let heightLeft = imgHeight;
    let position = 0;

    const imgData = canvas.toDataURL('image/png', 1.0);
    
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    pdf.save(`presupuesto_${cliente.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
  } catch (error) {
    console.error('Error generando PDF:', error);
    throw error;
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
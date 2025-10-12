import { api } from './api';

export async function generarPresupuestoPDF(data: any) {
  try {
    const response = await api.post('/presupuestos/generar-pdf', data, {
      responseType: 'blob'
    });
    
    // Crear URL del blob
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `presupuesto_${data.cliente}_${Date.now()}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    return { success: true };
  } catch (error) {
    console.error('Error generando PDF:', error);
    throw error;
  }
}

export async function listPresupuestos() {
  const response = await api.get('/presupuestos');
  return response.data;
}

export async function createPresupuesto(data: any) {
  const response = await api.post('/presupuestos', data);
  return response.data;
}

export async function updatePresupuesto(id: number, data: any) {
  const response = await api.put(`/presupuestos/${id}`, data);
  return response.data;
}

export async function deletePresupuesto(id: number) {
  const response = await api.delete(`/presupuestos/${id}`);
  return response.data;
}
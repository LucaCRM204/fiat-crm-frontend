import { api } from '../api';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ... (mantener todas las interfaces y funciones existentes)

// NUEVA función para generar PDF desde el modal visual
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
      scale: 2, // Mayor calidad
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

// Mantener la función anterior por compatibilidad
export async function generarPresupuestoPDF(data: any): Promise<void> {
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
export async function generarPresupuestoPDFDesdeModal(elementId: string, cliente: string): Promise<void> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error('Elemento no encontrado');
    }

    // Ocultar scroll y botones antes de capturar
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    const botones = element.querySelectorAll('button');
    botones.forEach(btn => (btn as HTMLElement).style.display = 'none');

    // IMPORTANTE: Esperar a que se renderice todo
    await new Promise(resolve => setTimeout(resolve, 300));

    // Scroll al inicio del modal
    const modal = element.closest('.overflow-y-auto');
    if (modal) {
      modal.scrollTop = 0;
    }

    // Esperar otro momento
    await new Promise(resolve => setTimeout(resolve, 100));

    // Capturar con configuración mejorada
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      imageTimeout: 15000,
      onclone: (clonedDoc) => {
        const clonedElement = clonedDoc.getElementById(elementId);
        if (clonedElement) {
          // Asegurar que el ancho sea fijo
          clonedElement.style.width = '1200px';
          clonedElement.style.maxWidth = '1200px';
          clonedElement.style.minWidth = '1200px';
        }
      }
    });

    // Restaurar botones y scroll
    botones.forEach(btn => (btn as HTMLElement).style.display = '');
    document.body.style.overflow = originalOverflow;

    // Crear PDF con mejor calidad
    const imgWidth = 210; // A4 ancho en mm
    const pageHeight = 297; // A4 alto en mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    let heightLeft = imgHeight;
    let position = 0;

    // Agregar imagen al PDF
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    
    // Primera página
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    // Páginas adicionales si es necesario
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    // Descargar
    pdf.save(`presupuesto_${cliente.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
  } catch (error) {
    console.error('Error generando PDF:', error);
    throw error;
  }
}
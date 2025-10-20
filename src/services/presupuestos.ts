import { api } from '../api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ===== FUNCIONES DE API =====
export const listPresupuestos = async () => {
  const response = await api.get('/presupuestos');
  return response.data;
};

export const createPresupuesto = async (data: any) => {
  const response = await api.post('/presupuestos', data);
  return response.data;
};

export const updatePresupuesto = async (id: number, data: any) => {
  const response = await api.put(`/presupuestos/${id}`, data);
  return response.data;
};

export const deletePresupuesto = async (id: number) => {
  const response = await api.delete(`/presupuestos/${id}`);
  return response.data;
};

// ===== FUNCIÓN DE GENERACIÓN DE PDF =====
export const generarPresupuestoPDF = async (data: any) => {
  // Obtener las imágenes subidas
  const imagen1 = document.getElementById('preview-1') as HTMLImageElement;
  const imagen2 = document.getElementById('preview-2') as HTMLImageElement;
  const imagen3 = document.getElementById('preview-3') as HTMLImageElement;
  const imagenCotizador = document.getElementById('preview-cotizador') as HTMLImageElement;

  const img1Src = imagen1 && !imagen1.classList.contains('hidden') ? imagen1.src : null;
  const img2Src = imagen2 && !imagen2.classList.contains('hidden') ? imagen2.src : null;
  const img3Src = imagen3 && !imagen3.classList.contains('hidden') ? imagen3.src : null;
  const imgCotizadorSrc = imagenCotizador && !imagenCotizador.classList.contains('hidden') ? imagenCotizador.src : null;

  // Crear un contenedor temporal en el DOM
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.width = '1000px';
  container.style.background = 'white';
  container.style.padding = '0';
  container.style.fontFamily = 'Arial, sans-serif';
  
  // Construir el HTML del presupuesto con diseño optimizado
  container.innerHTML = `
    <div style="background: white; width: 100%;">
      <!-- Header morado/rosa -->
      <div style="text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 35px 30px; margin: 0;">
        <h1 style="margin: 0; font-size: 38px; font-weight: bold; letter-spacing: -1px;">¡ESTÁS A UN SOLO PASO DE TENER TU<br/>PRÓXIMO 0KM!!!</h1>
        <p style="margin: 12px 0 0 0; font-size: 20px; font-weight: 500;">FELICITACIONES!!!</p>
      </div>

      <!-- Contenido principal en 3 columnas -->
      <div style="display: grid; grid-template-columns: 310px 310px 310px; gap: 15px; padding: 30px; background: white;">
        
        <!-- COLUMNA 1: Fotos del 0KM -->
        <div style="width: 100%;">
          <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 15px; border-radius: 10px; margin-bottom: 15px; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
            <h3 style="color: #1565c0; margin: 0; font-size: 15px; font-weight: bold;">📸 Fotos de tu próximo 0KM</h3>
          </div>
          
          ${img1Src ? `
            <div style="margin-bottom: 12px; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
              <img src="${img1Src}" style="width: 100%; height: 180px; object-fit: cover; display: block;" />
            </div>
          ` : `
            <div style="border: 2px dashed #ccc; border-radius: 10px; padding: 75px 15px; text-align: center; margin-bottom: 12px; background: #f5f5f5;">
              <p style="color: #999; margin: 0; font-size: 14px;">Foto 1</p>
            </div>
          `}

          ${img2Src ? `
            <div style="margin-bottom: 12px; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
              <img src="${img2Src}" style="width: 100%; height: 180px; object-fit: cover; display: block;" />
            </div>
          ` : `
            <div style="border: 2px dashed #ccc; border-radius: 10px; padding: 75px 15px; text-align: center; margin-bottom: 12px; background: #f5f5f5;">
              <p style="color: #999; margin: 0; font-size: 14px;">Foto 2</p>
            </div>
          `}

          ${img3Src ? `
            <div style="border-radius: 10px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
              <img src="${img3Src}" style="width: 100%; height: 180px; object-fit: cover; display: block;" />
            </div>
          ` : `
            <div style="border: 2px dashed #ccc; border-radius: 10px; padding: 75px 15px; text-align: center; background: #f5f5f5;">
              <p style="color: #999; margin: 0; font-size: 14px;">Foto 3</p>
            </div>
          `}
        </div>

        <!-- COLUMNA 2: Financiación Exclusiva -->
        <div style="width: 100%;">
          <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 15px; border-radius: 10px; margin-bottom: 15px; border-left: 4px solid #2196f3; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
            <h3 style="color: #1565c0; margin: 0; font-size: 15px; font-weight: bold;">💰 Financiación Exclusiva</h3>
          </div>
          
          <div style="background: white; padding: 15px; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
            <div style="margin-bottom: 15px; padding-bottom: 12px; border-bottom: 2px solid #f0f0f0;">
              <p style="font-weight: bold; margin: 0 0 6px 0; font-size: 12px; color: #666;">Nombre del Vehículo:</p>
              <p style="margin: 0; font-size: 15px; font-weight: bold; color: #333;">${data.nombreVehiculo || 'N/A'}</p>
            </div>

            <div style="margin-bottom: 15px; padding-bottom: 12px; border-bottom: 2px solid #f0f0f0;">
              <p style="font-weight: bold; margin: 0 0 6px 0; font-size: 12px; color: #666;">Valor Mínimo:</p>
              <p style="margin: 0; font-size: 15px; font-weight: bold; color: #333;">${data.valorMinimo || 'N/A'}</p>
            </div>

            <div style="margin-bottom: 15px; padding-bottom: 12px; border-bottom: 2px solid #f0f0f0;">
              <p style="font-weight: bold; margin: 0 0 6px 0; font-size: 12px; color: #666;">Anticipo/Alícuota habitualmente:</p>
              <p style="margin: 0; font-size: 15px; font-weight: bold; color: #333;">${data.anticipo || 'N/A'}</p>
            </div>

            <div style="margin-bottom: 15px; padding-bottom: 12px; border-bottom: 2px solid #f0f0f0;">
              <p style="font-weight: bold; margin: 0 0 6px 0; font-size: 12px; color: #666;">Bonificación + Cuota 1:</p>
              <p style="margin: 0; font-size: 15px; font-weight: bold; color: #333;">${data.bonificacionCuota || 'N/A'}</p>
            </div>

            ${data.cuotas && data.cuotas.length > 0 ? data.cuotas.map((c: any) => `
              <div style="margin-bottom: 15px; padding-bottom: 12px; border-bottom: 2px solid #f0f0f0;">
                <p style="font-weight: bold; margin: 0 0 6px 0; font-size: 12px; color: #666;">Cuota ${c.cantidad}:</p>
                <p style="margin: 0; font-size: 15px; font-weight: bold; color: #333;">${c.valor}</p>
              </div>
            `).join('') : ''}

            <div style="margin-bottom: 0;">
              <p style="font-weight: bold; margin: 0 0 6px 0; font-size: 12px; color: #666;">Adjudicación Asegurada:</p>
              <p style="margin: 0; font-size: 15px; font-weight: bold; color: #333;">${data.adjudicacion || 'N/A'}</p>
            </div>
          </div>

          <div style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); padding: 15px; border-radius: 10px; margin-top: 15px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
            <p style="font-weight: bold; margin: 0 0 12px 0; color: #2e7d32; font-size: 14px;">Bonificaciones Especiales:</p>
            <div style="font-size: 10px; color: #1b5e20; line-height: 1.8;">
              <p style="margin: 0 0 6px 0;">✓ NO TE OLVIDES DE TODOS LOS BENEFICIOS E IMPUESTOS QUE TENÉS</p>
              <p style="margin: 0 0 6px 0;">✓ ADJUDICACIÓN ASEGURADA</p>
              <p style="margin: 0 0 6px 0;">✓ ENTREGA DE USADOS LLAVE EN MANO</p>
              <p style="margin: 0 0 6px 0;">✓ PROMO AMIGOS</p>
              <p style="margin: 0 0 6px 0;">✓ VOUCHERS VACACIONAL</p>
              <p style="margin: 0 0 6px 0;">✓ TANQUE LLENO al retirar tu 0km</p>
              <p style="margin: 0 0 6px 0;">✓ 12 CUOTAS BONIFICADAS</p>
              <p style="margin: 0 0 6px 0;">✓ VOUCHERS DE 1.000.000 PARA GASTOS DE RETIRO</p>
              <p style="margin: 0 0 6px 0;">✓ SERVICE BONIFICADO</p>
              <p style="margin: 0;">✓ Y MUCHOS REGALOS MÁS PARA DISFRUTAR EL MUNDIAL A PLENOOOO!!!</p>
            </div>
          </div>
        </div>

        <!-- COLUMNA 3: Cotizador de Usados -->
        <div style="width: 100%;">
          <div style="background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%); padding: 15px; border-radius: 10px; margin-bottom: 15px; border-left: 4px solid #9c27b0; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
            <h3 style="color: #7b1fa2; margin: 0; font-size: 15px; font-weight: bold;">📊 Cotizador de Usados</h3>
          </div>

          ${imgCotizadorSrc ? `
            <div style="margin-bottom: 20px; border-radius: 10px; overflow: hidden; box-shadow: 0 3px 10px rgba(0,0,0,0.15);">
              <img src="${imgCotizadorSrc}" style="width: 100%; height: auto; display: block;" />
            </div>
          ` : `
            <div style="border: 2px dashed #9c27b0; border-radius: 10px; padding: 90px 15px; text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%);">
              <p style="color: #9c27b0; margin: 0; font-weight: bold; font-size: 14px;">Click para subir cotizador</p>
              <p style="color: #9c27b0; margin: 8px 0 0 0; font-size: 11px;">Captura de pantalla del cotizador</p>
            </div>
          `}

          <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 15px; border-radius: 10px; margin-bottom: 15px; border-left: 4px solid #2196f3; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
            <h3 style="color: #1565c0; margin: 0; font-size: 15px; font-weight: bold;">🚗 Cotización del Usado</h3>
          </div>

          <div style="background: white; padding: 15px; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
            ${data.marcaModelo ? `
              <div style="margin-bottom: 15px; padding-bottom: 12px; border-bottom: 2px solid #f0f0f0;">
                <p style="font-weight: bold; margin: 0 0 6px 0; font-size: 12px; color: #666;">Marca y Modelo:</p>
                <p style="margin: 0; font-size: 15px; font-weight: bold; color: #333;">${data.marcaModelo}</p>
              </div>
            ` : ''}

            ${data.anio ? `
              <div style="margin-bottom: 15px; padding-bottom: 12px; border-bottom: 2px solid #f0f0f0;">
                <p style="font-weight: bold; margin: 0 0 6px 0; font-size: 12px; color: #666;">Año:</p>
                <p style="margin: 0; font-size: 15px; font-weight: bold; color: #333;">${data.anio}</p>
              </div>
            ` : ''}

            ${data.kilometros ? `
              <div style="margin-bottom: 15px; padding-bottom: 12px; border-bottom: 2px solid #f0f0f0;">
                <p style="font-weight: bold; margin: 0 0 6px 0; font-size: 12px; color: #666;">Kilómetros:</p>
                <p style="margin: 0; font-size: 15px; font-weight: bold; color: #333;">${data.kilometros}</p>
              </div>
            ` : ''}

            ${data.valorEstimado ? `
              <div style="margin-bottom: 0;">
                <p style="font-weight: bold; margin: 0 0 6px 0; font-size: 12px; color: #666;">Valor Estimado:</p>
                <p style="margin: 0; font-size: 15px; font-weight: bold; color: #333;">${data.valorEstimado}</p>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      ${data.observaciones ? `
        <div style="margin: 0 30px 30px 30px; padding: 20px; background: linear-gradient(135deg, #f5f5f5 0%, #eeeeee 100%); border-radius: 10px; border-left: 4px solid #7c4dff; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
          <h3 style="color: #7c4dff; margin: 0 0 12px 0; font-size: 15px; font-weight: bold;">📝 Notas Adicionales</h3>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #333;">${data.observaciones}</p>
        </div>
      ` : ''}

      <div style="margin: 0 30px 15px 30px; padding: 20px; background: #fff3e0; border-left: 4px solid #ff9800; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #e65100; font-size: 14px;">⚠️ PROMOCIÓN VÁLIDA POR 72HS:</p>
        <p style="margin: 0; font-size: 12px; color: #bf360c; line-height: 1.5;">Todas las bonificaciones especiales tendrán una vigencia de 72 horas a partir de que te haya llegado este presupuesto.</p>
      </div>

      <div style="margin: 0 30px 30px 30px; padding: 20px; background: #fff3e0; border-left: 4px solid #ff9800; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #e65100; font-size: 14px;">🚗 IMPORTANTE:</p>
        <p style="margin: 0; font-size: 12px; color: #bf360c; line-height: 1.5;">Si tenés un usado, por favor pedí que te lo coticen y lo incluyan en este presupuesto, ya que si no está incluido NO se tomará para la entrega del 0KM.</p>
      </div>

      <div style="margin: 0; padding: 25px; text-align: center; background: #f5f5f5; border-top: 3px solid #e0e0e0;">
        <p style="margin: 0; color: #666; font-size: 12px;">Presupuesto generado el ${new Date().toLocaleDateString('es-AR')} - ${data.vendedor || 'Vendedor'}</p>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  await new Promise(resolve => setTimeout(resolve, 300));

  const canvas = await html2canvas(container, {
    scale: 1.5,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: 1000,
    windowWidth: 1000
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const pdf = new jsPDF('p', 'mm', 'a4');
  
  const pdfWidth = 210;
  const pdfHeight = 297;
  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * pdfWidth) / canvas.width;
  
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
  heightLeft -= pdfHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pdfHeight;
  }

  document.body.removeChild(container);

  const fileName = `Presupuesto_${data.cliente.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`;
  pdf.save(fileName);
};
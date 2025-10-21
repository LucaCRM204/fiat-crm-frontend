import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Users,
  Trophy,
  Plus,
  Phone,
  BarChart3,
  Settings,
  Home,
  X,
  Trash2,
  Edit3,
  Bell,
  UserCheck,
  Download,
  Search,
  Filter,
  User,
  ChevronDown,
  FileText,
  Target,
} from "lucide-react";
import { api } from "./api";
import {
  listUsers,
  createUser as apiCreateUser,
  updateUser as apiUpdateUser,
  deleteUser as apiDeleteUser,
} from "./services/users";
import {
  listLeads,
  createLead as apiCreateLead,
  updateLead as apiUpdateLead,
  deleteLead as apiDeleteLead,
} from "./services/leads";
import {
  listPresupuestos,
  createPresupuesto as apiCreatePresupuesto,
  updatePresupuesto as apiUpdatePresupuesto,
  deletePresupuesto as apiDeletePresupuesto,
} from "./services/presupuestos";
import { generarPresupuestoPDF } from "./services/presupuestos";
import { pushService } from "./services/pushService";
import { PushNotificationSettings } from './components/PushNotificationSettings';
import {
  listMetas,
  createMeta as apiCreateMeta,
  updateMeta as apiUpdateMeta,
  deleteMeta as apiDeleteMeta,
  // getProgresoMeta, // No usado por ahora
  type Meta,
} from "./services/metas";
// ===== Utilidades de jerarquía =====
function buildIndex(users: any[]) {
  const byId = new Map(users.map((u: any) => [u.id, u]));
  const children = new Map<number, number[]>();
  users.forEach((u: any) => children.set(u.id, []));
  users.forEach((u: any) => {
    if (u.reportsTo) (children.get(u.reportsTo) as number[] | undefined)?.push(u.id);
  });
  return { byId, children };
}

function getDescendantUserIds(
  rootId: number,
  childrenIndex: Map<number, number[]>
) {
  const out: number[] = [];
  const stack = [...(childrenIndex.get(rootId) || [])];
  console.log(`=== getDescendantUserIds para ID ${rootId} ===`);
  console.log('Hijos directos:', childrenIndex.get(rootId));
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    const kids = childrenIndex.get(id) || [];
    for (const k of kids) stack.push(k);
  }
 console.log('Descendientes totales:', out);
  return out;
}

const roles: Record<string, string> = {
  owner: "Dueño",
  director: "Director",
  gerente: "Gerente",
  supervisor: "Supervisor",
  vendedor: "Vendedor",
};

const estados: Record<string, { label: string; color: string }> = {
  nuevo: { label: "Nuevo", color: "bg-blue-500" },
  contactado: { label: "Contactado", color: "bg-yellow-500" },
  interesado: { label: "Interesado", color: "bg-orange-500" },
  negociacion: { label: "Negociación", color: "bg-purple-500" },
  vendido: { label: "Vendido", color: "bg-green-600" },
  perdido: { label: "Perdido", color: "bg-red-500" },
  numero_invalido: { label: "Número inválido", color: "bg-gray-500" },
  no_contesta_1: { label: "No contesta 1", color: "bg-amber-500" },
  no_contesta_2: { label: "No contesta 2", color: "bg-orange-600" },
  no_contesta_3: { label: "No contesta 3", color: "bg-red-600" },
};

const fuentes: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  meta: { label: "Meta/Facebook", color: "bg-blue-600", icon: "📱" },
  whatsapp: { label: "WhatsApp Bot", color: "bg-green-500", icon: "💬" },
  whatsapp_100: { label: "WhatsApp Bot 100", color: "bg-green-700", icon: "💬" },
  sitio_web: { label: "Sitio Web", color: "bg-purple-600", icon: "🌐" },
  referido: { label: "Referido", color: "bg-orange-500", icon: "👥" },
  telefono: { label: "Llamada", color: "bg-indigo-500", icon: "📞" },
  showroom: { label: "Showroom", color: "bg-gray-600", icon: "🏢" },
  google: { label: "Google Ads", color: "bg-red-500", icon: "🎯" },
  instagram: { label: "Instagram", color: "bg-pink-500", icon: "📸" },
  otro: { label: "Otro", color: "bg-gray-400", icon: "❓" },
  creado_por: { label: "Creado por", color: "bg-teal-500", icon: "👤" },
};

// Configuración de bots
const botConfig: Record<string, { targetTeam: string | null; label: string }> =
  {
    whatsapp_bot_cm1: { targetTeam: "sauer", label: "Bot CM 1" },
    whatsapp_bot_cm2: { targetTeam: "daniel", label: "Bot CM 2" },
    whatsapp_100: { targetTeam: null, label: "Bot 100" }, // null = distribución general
  };
// Actualizar el tipo LeadRow para incluir notasInternas
type LeadRow = {
  id: number;
  nombre: string;
  telefono: string;
  modelo: string;
  formaPago?: string;
  infoUsado?: string;
  entrega?: boolean;
  fecha?: string;
  estado: keyof typeof estados;
  vendedor: number | null;
  notas?: string;
  fuente: keyof typeof fuentes | string;
  historial?: Array<{
    estado: string;
    timestamp: string;
    usuario: string;
  }>;
  created_by?: number;
  created_at?: string;  // AGREGAR ESTA LÍNEA
  last_status_change?: string;
  recordatorios?: Array<{
    id: number;
    fecha: string;
    hora: string;
    descripcion: string;
    completado: boolean;
  }>;
  notasInternas?: NotaInterna[]; // NUEVO
};
type Alert = {
  id: number;
  userId: number;
  type: "lead_assigned" | "ranking_change";
  message: string;
  ts: string;
  read: boolean;
};
type Presupuesto = {
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
};
type CotizacionPlan = {
  cuotas: number;
  valorCuota: number;
  tasaInteres: number;
  totalFinanciado: number;
};

type Cotizacion = {
  id: number;
  leadId: number;
  vehiculo: string;
  precioContado: number;
  anticipo: number;
  valorUsado: number;
  planes: CotizacionPlan[];
  bonificaciones?: string;
  notas?: string;
  created_at: string;
  created_by: number;
};
type TareaSeguimiento = {
  id: number;
  leadId: number;
  asignadoA: number; // NUEVO: ID del vendedor a quien se asigna
  tipo: 'llamar' | 'whatsapp' | 'email' | 'cotizar' | 'seguimiento' | 'recuperar_perdido';
  prioridad: 'alta' | 'media' | 'baja';
  fechaLimite: string;
  descripcion: string;
  completada: boolean;
  lead?: LeadRow;
  manual?: boolean;
  createdBy?: number; // Quién creó la tarea
  createdByName?: string; // Nombre de quien creó
};
// Tipo para Metas

// Tipo para Notas Internas
type NotaInterna = {
  id: number;
  leadId: number;
  texto: string;
  usuario: string;
  userId: number;
  timestamp: string;
};
// ===== Funciones de descarga Excel =====
const formatDate = (dateString: string): string => {
  if (!dateString) return "Sin fecha";
  const date = new Date(dateString);
  return date.toLocaleDateString("es-AR");
};

const downloadAllLeadsExcel = (leads: LeadRow[], userById: Map<number, any>, fuentes: any): void => {
  // Crear datos para Excel
  const excelData = leads.map(lead => {
    const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
    const fuente = fuentes[lead.fuente] || { label: lead.fuente };
    const creadoPor = lead.created_by ? userById.get(lead.created_by) : null;
    
    return {
      'ID': lead.id,
      'Cliente': lead.nombre,
      'Teléfono': lead.telefono,
      'Modelo': lead.modelo,
      'Forma de Pago': lead.formaPago || '',
      'Info Usado': lead.infoUsado || '',
      'Entrega': lead.entrega ? 'Sí' : 'No',
      'Estado': estados[lead.estado]?.label || lead.estado,
      'Fuente': fuente.label,
      'Vendedor': vendedor?.name || 'Sin asignar',
      'Equipo': vendedor && vendedor.reportsTo ? `Equipo de ${userById.get(vendedor.reportsTo)?.name || '—'}` : '',
      'Fecha': formatDate(lead.fecha || ''),
      'Creado Por': creadoPor?.name || 'Sistema',
      'Observaciones': lead.notas || ''
    };
  });
  
  // Crear contenido CSV
  const headers = Object.keys(excelData[0] || {});
  const csvContent = [
    headers.join(','),
    ...excelData.map(row => 
      headers.map(header => {
        const value = (row as any)[header] || '';
        // Escapar comillas y comas
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');

  // Crear y descargar archivo
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `todos_los_leads_${new Date().toISOString().slice(0,10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const downloadLeadsByStateExcel = (leads: LeadRow[], estado: string, userById: Map<number, any>, fuentes: any): void => {
  const leadsByState = leads.filter(l => l.estado === estado);

  if (leadsByState.length === 0) {
    alert(`No hay leads en estado "${estados[estado]?.label || estado}"`);
    return;
  }

  // Crear datos para Excel
  const excelData = leadsByState.map(lead => {
    const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
    const fuente = fuentes[lead.fuente] || { label: lead.fuente };
    const creadoPor = lead.created_by ? userById.get(lead.created_by) : null;
    
    return {
      'ID': lead.id,
      'Cliente': lead.nombre,
      'Teléfono': lead.telefono,
      'Modelo': lead.modelo,
      'Forma de Pago': lead.formaPago || '',
      'Info Usado': lead.infoUsado || '',
      'Entrega': lead.entrega ? 'Sí' : 'No',
      'Fuente': fuente.label,
      'Vendedor': vendedor?.name || 'Sin asignar',
      'Equipo': vendedor && vendedor.reportsTo ? `Equipo de ${userById.get(vendedor.reportsTo)?.name || '—'}` : '',
      'Fecha': formatDate(lead.fecha || ''),
      'Creado Por': creadoPor?.name || 'Sistema',
      'Observaciones': lead.notas || '',
      'Historial': lead.historial?.map(h => 
        `${formatDate(h.timestamp)}: ${h.estado} (${h.usuario})`
      ).join(' | ') || ''
    };
  });
     // Crear contenido CSV
  const headers = Object.keys(excelData[0] || {});
  const csvContent = [
    headers.join(','),
    ...excelData.map(row => 
      headers.map(header => {
        const value = (row as any)[header] || '';
        // Escapar comillas y comas
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');

  // Crear y descargar archivo
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  const estadoLabel = estados[estado]?.label || estado;
  link.setAttribute('download', `leads_${estadoLabel.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
  
export default function CRM() {
  const [users, setUsers] = useState<any[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const { byId: userById, children: childrenIndex } = useMemo(
    () => buildIndex(users),
    [users]
  );

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeSection, setActiveSection] = useState<
  "dashboard" | "leads" | "calendar" | "ranking" | "users" | "alerts" | "team" | "presupuestos" | "tareas" | "analytics" | "metas" | "asignar_tareas"
>("dashboard");
  const [loginError, setLoginError] = useState("");
  const [selectedEstado, setSelectedEstado] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>("todos");

  // Estados para búsqueda y filtrado de leads
  const [searchText, setSearchText] = useState("");
  const [selectedVendedorFilter, setSelectedVendedorFilter] = useState<number | null>(null);
  const [selectedEstadoFilter, setSelectedEstadoFilter] = useState<string>("");
  const [selectedFuenteFilter, setSelectedFuenteFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [dateFilterType, setDateFilterType] = useState<"created" | "status_change">("status_change");
  // Estados para filtrado de usuarios
  const [userSearchText, setUserSearchText] = useState("");
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("todos");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("todos");
  const [userSortBy, setUserSortBy] = useState<"name" | "role" | "team" | "performance">("team");
  const [showUserFilters, setShowUserFilters] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  const [showBulkReassignModal, setShowBulkReassignModal] = useState(false);
  const [bulkReassignVendorId, setBulkReassignVendorId] = useState<number | null>(null);
  // Estados para reasignación
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [leadToReassign, setLeadToReassign] = useState<LeadRow | null>(null);
  const [selectedVendorForReassign, setSelectedVendorForReassign] =
    useState<number | null>(null);

  // Estados para confirmación de eliminación
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);

  // Estados para confirmación de eliminación de leads
  const [showDeleteLeadConfirmModal, setShowDeleteLeadConfirmModal] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<LeadRow | null>(null);

  // Estados para modales
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [showObservacionesModal, setShowObservacionesModal] = useState(false);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [editingLeadObservaciones, setEditingLeadObservaciones] =
    useState<LeadRow | null>(null);
  const [viewingLeadHistorial, setViewingLeadHistorial] =
    useState<LeadRow | null>(null);

  // Estados para calendario
  const [events, setEvents] = useState<any[]>([]);
  const [selectedCalendarUserId, setSelectedCalendarUserId] = useState<number | null>(null);
  const [showNewEventModal, setShowNewEventModal] = useState(false);

  // Estados para gestión de usuarios
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [modalRole, setModalRole] = useState<
    "owner" | "director" | "gerente" | "supervisor" | "vendedor"
  >("vendedor");
  const [modalReportsTo, setModalReportsTo] = useState<number | null>(null);
  // Estados para presupuestos
const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
const [showPresupuestoModal, setShowPresupuestoModal] = useState(false);
const [editingPresupuesto, setEditingPresupuesto] = useState<Presupuesto | null>(null);
const [showPresupuestoSelectModal, setShowPresupuestoSelectModal] = useState(false);
const [selectedLeadForPresupuesto, setSelectedLeadForPresupuesto] = useState<LeadRow | null>(null);
// Estados para modal de presupuesto personalizado
const [showPresupuestoPersonalizadoModal, setShowPresupuestoPersonalizadoModal] = useState<boolean>(false);
const [leadParaPresupuesto, setLeadParaPresupuesto] = useState<LeadRow | null>(null);
// Estados para recordatorios
const [showRecordatoriosModal, setShowRecordatoriosModal] = useState(false);
const [leadParaRecordatorios, setLeadParaRecordatorios] = useState<LeadRow | null>(null);
const [showAddRecordatorioModal, setShowAddRecordatorioModal] = useState(false);
// Agregar estados para cotización 
const [showCotizadorModal, setShowCotizadorModal] = useState(false);
const [leadParaCotizacion, setLeadParaCotizacion] = useState<LeadRow | null>(null);
const [cotizacionActual, setCotizacionActual] = useState<Partial<Cotizacion>>({});
const [tareasPendientes, setTareasPendientes] = useState<TareaSeguimiento[]>([]);
// Agregar después de los otros useState
const [showAsignarTareaModal, setShowAsignarTareaModal] = useState(false);
const [leadParaAsignarTarea, setLeadParaAsignarTarea] = useState<LeadRow | null>(null);
const [vendedorSeleccionadoTarea, setVendedorSeleccionadoTarea] = useState<number | null>(null);
// AGREGAR ESTA LÍNEA:
const [showSeleccionarLeadModal, setShowSeleccionarLeadModal] = useState(false);

// Estados para Metas
const [metas, setMetas] = useState<Meta[]>([]);
const [showMetasModal, setShowMetasModal] = useState(false);
const [editingMeta, setEditingMeta] = useState<Meta | null>(null);

// Estados para Notas Internas
const [showNotasModal, setShowNotasModal] = useState(false);
const [leadParaNotas, setLeadParaNotas] = useState<LeadRow | null>(null);

// Estados para Plantillas WhatsApp
const [showPlantillasModal, setShowPlantillasModal] = useState(false);
const [leadParaWhatsApp, setLeadParaWhatsApp] = useState<LeadRow | null>(null);
// Service Worker desactivado temporalmente
// useEffect(() => {
//   console.log('🚀 Registrando Service Worker...');
//   if ('serviceWorker' in navigator) {
//     pushService.registerServiceWorker();
//   }
// }, []);

  // ===== Login contra backend =====
  const handleLogin = async (email: string, password: string) => {
  try {
    const r = await api.post("/auth/login", { 
      email, 
      password, 
      allowInactiveUsers: true
    });

    if (r.data?.ok && r.data?.token) {
      localStorage.setItem("token", r.data.token);
      localStorage.setItem("user", JSON.stringify(r.data.user));

      api.defaults.headers.common["Authorization"] = `Bearer ${r.data.token}`;

      const u =
        r.data.user || {
          id: 0,
          name: r.data?.user?.email || email,
          email,
          role: r.data?.user?.role || "owner",
          reportsTo: null,
          active: r.data?.user?.active ?? true,
        };

      setCurrentUser(u);
      setIsAuthenticated(true);
      setLoginError("");

      const [uu, ll] = await Promise.all([listUsers(), listLeads()]);
      const mappedLeads: LeadRow[] = (ll || []).map((L: any) => ({
        id: L.id,
        nombre: L.nombre,
        telefono: L.telefono,
        modelo: L.modelo,
        formaPago: L.formaPago,
        infoUsado: L.infoUsado,
        entrega: L.entrega,
        fecha: L.fecha || L.created_at || "",
        estado: (L.estado || "nuevo") as LeadRow["estado"],
        vendedor: L.vendedor ?? null,
        notas: L.notas || "",
        fuente: (L.fuente || "otro") as LeadRow["fuente"],
        historial: L.historial || [],
        created_by: L.created_by || null,
      }));
      setUsers(uu || []);
      setLeads(mappedLeads);

      // AGREGAR ESTO AQUÍ DENTRO
      try {
        const pp = await listPresupuestos();
        setPresupuestos(pp || []);
      } catch (error) {
        console.error('Error cargando presupuestos:', error);
      }
      try {
  const mm = await listMetas();
  setMetas(mm || []);
} catch (error) {
  console.error('Error cargando metas:', error);
}

      // FIN DEL CÓDIGO AGREGADO
     // ✅ AGREGAR AQUÍ - Preguntar por notificaciones push
      setTimeout(async () => {
        try {
          const isSubscribed = await pushService.isSubscribed();
          
          if (!isSubscribed && Notification.permission !== 'denied') {
            const activar = window.confirm(
              '¿Querés activar notificaciones push para recibir recordatorios y alertas importantes aunque cierres el navegador?'
            );
            
            if (activar) {
              const success = await pushService.subscribeToPush();
              if (success) {
                alert('✅ Notificaciones activadas correctamente!');
              } else {
                console.log('No se pudieron activar las notificaciones');
              }
            }
          }
        } catch (error) {
          console.error('Error configurando notificaciones:', error);
        }
      }, 2000); // Espera 2 segundos después del login para no ser intrusivo
    } else {
      throw new Error("Respuesta inválida del servidor");
    }
  } catch (err: any) {
    setLoginError(err?.response?.data?.error || "Credenciales incorrectas");
    setIsAuthenticated(false);
  }
};
// Plantillas de WhatsApp
const plantillasWhatsApp = {
  primerContacto: {
    nombre: "Primer Contacto",
    emoji: "👋",
    plantilla: (nombre: string, modelo: string, vendedor: string) =>
      `Hola ${nombre}! 👋 Soy ${vendedor} de auto del sol.\n\nVi que consultaste por el ${modelo}. Justo tenemos unidades disponibles 🚗\n\n¿Tenés 5 minutos para una llamada o preferís que te envíe la cotización por acá?`,
  },
  cotizacion: {
    nombre: "Enviar Cotización",
    emoji: "💰",
    plantilla: (nombre: string, modelo: string) =>
      `Hola ${nombre}! Te paso la cotización completa del ${modelo}.\n\n¿Tenés alguna pregunta sobre los planes de financiación? Estoy para ayudarte 😊`,
  },
  seguimiento: {
    nombre: "Seguimiento (3 días)",
    emoji: "🔄",
    plantilla: (nombre: string, modelo: string) =>
      `Hola ${nombre}! ¿Cómo estás?\n\nTe escribo para saber si pudiste revisar la cotización del ${modelo} que te envié.\n\n¿Tenés alguna duda? Quedamos en contacto 📱`,
  },
  seguimientoSuave: {
    nombre: "Seguimiento Suave",
    emoji: "👀",
    plantilla: (nombre: string) =>
      `Hola ${nombre}! ¿Cómo va todo?\n\nSolo quería saber si seguís interesado o si necesitás algo más de info.\n\nSin presiones, quedamos en contacto 😊`,
  },
  cierre: {
    nombre: "Cierre de Venta",
    emoji: "🎉",
    plantilla: (nombre: string, modelo: string) =>
      `¡Hola ${nombre}! 🎉\n\nBuenas noticias: el ${modelo} que te interesaba sigue disponible.\n\nSi querés podemos coordinar para que vengas a verlo y si te convence, te lo llevás.\n\n¿Te viene bien esta semana?`,
  },
  reactivacion: {
    nombre: "Reactivar Lead Viejo",
    emoji: "🔔",
    plantilla: (nombre: string, modelo: string) =>
      `Hola ${nombre}! ¿Cómo estás?\n\nHace un tiempo consultaste por el ${modelo}.\n\nEste mes tenemos una promo especial con bonificaciones y quería avisarte por si seguís buscando.\n\n¿Seguís interesado? 🚗`,
  },
  agradecimiento: {
    nombre: "Post-Venta",
    emoji: "🙏",
    plantilla: (nombre: string, modelo: string) =>
      `Hola ${nombre}! Muchas gracias por confiar en nosotros para la compra de tu ${modelo} 🚗\n\nCualquier cosa que necesites, acá estoy para ayudarte.\n\n¡Disfrutá tu 0km! 🎉`,
  },
};    
  // ===== Acceso por rol =====
  const getAccessibleUserIds = (user: any) => {
    if (!user) return [] as number[];
    if (["owner", "director", "dueño"].includes(user.role))
      return users.map((u: any) => u.id);
    const ids = [user.id, ...getDescendantUserIds(user.id, childrenIndex)];
    console.log('=== getAccessibleUserIds ===');
  console.log('Usuario:', user.name, 'ID:', user.id, 'Role:', user.role);
  console.log('IDs visibles:', ids);
  console.log('Leads filtrados:', leads.filter(l => l.vendedor && ids.includes(l.vendedor)).length);
  console.log('Primeros 5 leads:', leads.slice(0, 5).map(l => ({ id: l.id, nombre: l.nombre, vendedor: l.vendedor })));
console.log('Leads de Molina (ID 38):', leads.filter(l => l.vendedor === 38).length);
console.log('=== getAccessibleUserIds ===');
console.log('Usuario:', user.name, 'ID:', user.id, 'Role:', user.role);
console.log('IDs visibles:', ids);
console.log('Total leads en sistema:', leads.length);
console.log('Primeros 3 leads completos:', leads.slice(0, 3));
console.log('Leads con vendedor === 38:', leads.filter(l => l.vendedor === 38).length);
console.log('Leads con vendedor tipo:', leads.slice(0, 3).map(l => ({ id: l.id, vendedor: l.vendedor, tipo: typeof l.vendedor })));
console.log('Leads filtrados:', leads.filter(l => l.vendedor && ids.includes(l.vendedor)).length);
    return ids;
  };
  
  const canCreateUsers = () =>
    currentUser && ["owner", "director", "gerente"].includes(currentUser.role);

  const canManageUsers = () =>
    currentUser && ["owner", "director", "gerente", "dueño"].includes(currentUser.role);
  const isOwner = () => currentUser?.role === "owner" || currentUser?.role === "dueño";

  const canCreateLeads = () =>
    currentUser && ["owner", "director", "gerente", "supervisor", "vendedor"].includes(currentUser.role);

  const canDeleteLeads = () => {
  const canDelete = currentUser && ["owner", "dueño"].includes(currentUser.role);
  return canDelete;
};

  // ===== Funciones de filtro por equipo =====
  const getTeamManagerById = (teamId: string) => {
    if (teamId === "todos") return null;
    return users.find(
      (u: any) => u.role === "gerente" && u.id.toString() === teamId
    );
  };

  const getTeamUserIds = (teamId: string) => {
    if (teamId === "todos") return [];
    const manager = getTeamManagerById(teamId);
    if (!manager) return [];

    const descendants = getDescendantUserIds(manager.id, childrenIndex);
    return [manager.id, ...descendants];
  };
// ===== Función para analizar datos diarios =====
const getDailyAnalytics = (leads: LeadRow[], teamFilter?: string) => {
  const today = new Date();
  const daysToShow = 30;
  
  // Filtrar leads por equipo si se especifica
  let filteredLeads = leads;
  if (teamFilter && teamFilter !== "todos") {
    const teamUserIds = getTeamUserIds(teamFilter);
    filteredLeads = leads.filter(l => l.vendedor && teamUserIds.includes(l.vendedor));
  }
  
  const dailyData: Record<string, {
    date: string;
    total: number;
    bySource: Record<string, number>;
    byState: Record<string, number>;
    newLeads: number;
    converted: number;
    byVendor: Record<number, number>;
  }> = {};

  // Inicializar últimos 30 días
  for (let i = 0; i < daysToShow; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    dailyData[dateStr] = {
      date: dateStr,
      total: 0,
      bySource: {},
      byState: {},
      newLeads: 0,
      converted: 0,
      byVendor: {},
    };
  }

  // Procesar leads
  filteredLeads.forEach(lead => {
    const leadDate = lead.created_at || lead.fecha;
    if (!leadDate) return;
    
    const dateStr = new Date(leadDate).toISOString().split('T')[0];
    
    if (dailyData[dateStr]) {
      dailyData[dateStr].total++;
      dailyData[dateStr].newLeads++;
      
      // Por fuente
      const source = lead.fuente || 'otro';
      dailyData[dateStr].bySource[source] = (dailyData[dateStr].bySource[source] || 0) + 1;
      
      // Por estado
      dailyData[dateStr].byState[lead.estado] = (dailyData[dateStr].byState[lead.estado] || 0) + 1;
      
      // Por vendedor
      if (lead.vendedor) {
        dailyData[dateStr].byVendor[lead.vendedor] = (dailyData[dateStr].byVendor[lead.vendedor] || 0) + 1;
      }
      
      // Conversiones
      if (lead.estado === 'vendido') {
        dailyData[dateStr].converted++;
      }
    }
  });

  return Object.values(dailyData).sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
};
  const getFilteredLeadsByTeam = (teamId?: string) => {
    if (!currentUser) return [] as LeadRow[];

    if (teamId && teamId !== "todos" && ["owner", "director", "dueño"].includes(currentUser.role)) {
      const teamUserIds = getTeamUserIds(teamId);
      return leads.filter((l) => l.vendedor && teamUserIds.includes(l.vendedor));
    }

    return getFilteredLeads();
  };

  const getAvailableVendorsForAssignment = () => {
    if (!currentUser) return [];

    const visibleUserIds = getAccessibleUserIds(currentUser);
    
    return users.filter((u: any) => {
      if (u.role !== "vendedor" || !u.active) return false;
      if (!visibleUserIds.includes(u.id)) return false;
      return true;
    });
  };

  const getVisibleUsers = () => {
    if (!currentUser) return [];

    return users.filter((u: any) => {
      if (currentUser.role === "owner") return true;

      if (currentUser.role === "director") return u.role !== "owner";

      if (currentUser.role === "gerente") {
        if (u.id === currentUser.id) return true;

        if (u.reportsTo === currentUser.id) return true;

        const userSupervisor = userById.get(u.reportsTo);
        return userSupervisor && userSupervisor.reportsTo === currentUser.id;
      }

      if (currentUser.role === "supervisor") {
        if (u.id === currentUser.id) return true;
        return u.reportsTo === currentUser.id;
      }

      if (currentUser.role === "vendedor") {
        return u.id === currentUser.id;
      }

      return false;
    });
  };
const abrirPresupuestoPersonalizado = (lead: LeadRow): void => {
  setLeadParaPresupuesto(lead);
  setShowPresupuestoPersonalizadoModal(true);
};

const handleGenerarPresupuestoPDF = async (): Promise<void> => {
  if (!leadParaPresupuesto) return;

  const nombreVehiculo = (document.getElementById('plan-pensado') as HTMLInputElement)?.value;
  const valorMovil = (document.getElementById('valor-plan') as HTMLInputElement)?.value;
  const anticipo = (document.getElementById('anticipo') as HTMLInputElement)?.value;
  const cuota1 = (document.getElementById('cuota-1-valor') as HTMLInputElement)?.value;
  const cuota2a12 = (document.getElementById('cuota-2-12') as HTMLInputElement)?.value;
  const cuota13a84 = (document.getElementById('cuota-13-84') as HTMLInputElement)?.value;
  const adjudicacion = (document.getElementById('adjudicacion') as HTMLInputElement)?.value;
  const modeloUsado = (document.getElementById('modelo-usado') as HTMLInputElement)?.value;
  const anioUsado = (document.getElementById('anio-usado') as HTMLInputElement)?.value;
  const kilometros = (document.getElementById('kilometros') as HTMLInputElement)?.value;
  const valorEstimado = (document.getElementById('valor-estimado') as HTMLInputElement)?.value;
  const observaciones = (document.getElementById('observaciones') as HTMLTextAreaElement)?.value;

  if (!nombreVehiculo || !valorMovil) {
    alert('Por favor completá al menos el nombre del vehículo y el valor móvil');
    return;
  }

  // Crear array de cuotas en el formato esperado
  const cuotasValidas = [];
  if (cuota2a12) cuotasValidas.push({ cantidad: '2-12', valor: cuota2a12 });
  if (cuota13a84) cuotasValidas.push({ cantidad: '13-84', valor: cuota13a84 });

  const data = {
    nombreVehiculo,
    valorMinimo: valorMovil, // Cambiar de valorMovil a valorMinimo
    anticipo,
    bonificacionCuota: cuota1, // Usar cuota1 como bonificación
    cuotas: cuotasValidas, // Usar el array de cuotas
    adjudicacion,
    marcaModelo: modeloUsado,
    anio: anioUsado,
    kilometros,
    valorEstimado,
    observaciones,
    vendedor: currentUser?.name || 'Vendedor',
    cliente: leadParaPresupuesto.nombre,
    telefono: leadParaPresupuesto.telefono
  };

  try {
    await generarPresupuestoPDF(data);
    
    const enviarWhatsApp = confirm('PDF generado exitosamente. ¿Querés enviarlo por WhatsApp?');
    
    if (enviarWhatsApp) {
      const phoneNumber = leadParaPresupuesto.telefono.replace(/\D/g, '');
      const mensaje = `Hola ${leadParaPresupuesto.nombre}! 👋\n\nTe acabo de generar el presupuesto personalizado del ${nombreVehiculo}.\n\nTe lo descargué en PDF para que lo puedas revisar con tranquilidad.\n\n¿Tenés alguna consulta sobre el presupuesto? Estoy para ayudarte! 😊`;
      
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(mensaje)}`;
      window.open(whatsappUrl, '_blank');
    }
    
    setShowPresupuestoPersonalizadoModal(false);
    setLeadParaPresupuesto(null);
    
  } catch (error) {
    console.error('Error al generar PDF:', error);
    alert('Error al generar el presupuesto. Por favor intentá de nuevo.');
  }
};
  // ===== Funciones para filtrar y ordenar usuarios =====
  const getFilteredAndSortedUsers = () => {
    let filteredUsers = getVisibleUsers();

    // Aplicar filtro de búsqueda
    if (userSearchText.trim()) {
      const searchLower = userSearchText.toLowerCase().trim();
      filteredUsers = filteredUsers.filter((u: any) => {
        const manager = u.reportsTo ? userById.get(u.reportsTo) : null;
        return (
          u.name.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower) ||
          (roles[u.role] || u.role).toLowerCase().includes(searchLower) ||
          (manager && manager.name.toLowerCase().includes(searchLower))
        );
      });
    }

    // Aplicar filtro por equipo
    if (selectedTeamFilter !== "todos") {
      if (selectedTeamFilter === "sin_equipo") {
        filteredUsers = filteredUsers.filter((u: any) => !u.reportsTo);
      } else {
        const teamUserIds = getTeamUserIds(selectedTeamFilter);
        filteredUsers = filteredUsers.filter((u: any) => 
          teamUserIds.includes(u.id) || u.id.toString() === selectedTeamFilter
        );
      }
    }

    // Aplicar filtro por rol
    if (selectedRoleFilter !== "todos") {
      filteredUsers = filteredUsers.filter((u: any) => u.role === selectedRoleFilter);
    }

    // Ordenar según criterio seleccionado
    filteredUsers.sort((a: any, b: any) => {
      switch (userSortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "role":
          const roleOrder = ["owner", "director", "gerente", "supervisor", "vendedor"];
          const aRoleIndex = roleOrder.indexOf(a.role);
          const bRoleIndex = roleOrder.indexOf(b.role);
          if (aRoleIndex !== bRoleIndex) {
            return aRoleIndex - bRoleIndex;
          }
          return a.name.localeCompare(b.name);
        case "team":
          const aManager = a.reportsTo ? userById.get(a.reportsTo) : null;
          const bManager = b.reportsTo ? userById.get(b.reportsTo) : null;
          const aTeam = aManager?.name || "Sin equipo";
          const bTeam = bManager?.name || "Sin equipo";
          if (aTeam !== bTeam) {
            return aTeam.localeCompare(bTeam);
          }
          return a.name.localeCompare(b.name);
        case "performance":
          if (a.role === "vendedor" && b.role === "vendedor") {
            const aLeads = leads.filter((l) => l.vendedor === a.id);
            const bLeads = leads.filter((l) => l.vendedor === b.id);
            const aVentas = aLeads.filter((l) => l.estado === "vendido").length;
            const bVentas = bLeads.filter((l) => l.estado === "vendido").length;
            if (aVentas !== bVentas) {
              return bVentas - aVentas; // Mayor ventas primero
            }
            return bLeads.length - aLeads.length; // Más leads primero
          }
          // Si no son vendedores, ordenar por nombre
          return a.name.localeCompare(b.name);
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filteredUsers;
  };

  const clearUserFilters = () => {
    setUserSearchText("");
    setSelectedTeamFilter("todos");
    setSelectedRoleFilter("todos");
  };

  const getActiveUserFiltersCount = () => {
    let count = 0;
    if (userSearchText.trim()) count++;
    if (selectedTeamFilter !== "todos") count++;
    if (selectedRoleFilter !== "todos") count++;
    return count;
  };
const getFilteredAndSearchedLeads = () => {
    if (!currentUser) return [] as LeadRow[];
    const visibleUserIds = getAccessibleUserIds(currentUser);
    let filteredLeads = leads.filter((l) =>
      l.vendedor ? visibleUserIds.includes(l.vendedor) : true
    );
    if (selectedVendedorFilter) {
      filteredLeads = filteredLeads.filter((l) => l.vendedor === selectedVendedorFilter);
    }
    if (selectedEstadoFilter) {
      filteredLeads = filteredLeads.filter((l) => l.estado === selectedEstadoFilter);
    }
    if (selectedFuenteFilter) {
      filteredLeads = filteredLeads.filter((l) => l.fuente === selectedFuenteFilter);
    }
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase().trim();
      filteredLeads = filteredLeads.filter((l) => {
        const vendedor = l.vendedor ? userById.get(l.vendedor) : null;
        const creadoPor = l.created_by ? userById.get(l.created_by) : null;
        return (
          l.nombre.toLowerCase().includes(searchLower) ||
          l.telefono.includes(searchText.trim()) ||
          l.modelo.toLowerCase().includes(searchLower) ||
          (l.notas && l.notas.toLowerCase().includes(searchLower)) ||
          (vendedor && vendedor.name.toLowerCase().includes(searchLower)) ||
          (creadoPor && creadoPor.name.toLowerCase().includes(searchLower)) ||
          (l.formaPago && l.formaPago.toLowerCase().includes(searchLower)) ||
          (l.infoUsado && l.infoUsado.toLowerCase().includes(searchLower))
        );
      });
    }
    return filteredLeads;
  };

  const getFilteredLeadsByDate = () => {
    let filteredLeads = getFilteredAndSearchedLeads();
    
    if (selectedMonth && selectedYear) {
      filteredLeads = filteredLeads.filter((lead) => {
        const dateToCheck = dateFilterType === "status_change" 
          ? (lead.last_status_change || lead.fecha || lead.created_at)
          : (lead.fecha || lead.created_at);
        
        if (!dateToCheck) return false;
        
        const leadDate = new Date(dateToCheck);
        const leadMonth = (leadDate.getMonth() + 1).toString().padStart(2, '0');
        const leadYear = leadDate.getFullYear().toString();
        
        return leadMonth === selectedMonth && leadYear === selectedYear;
      });
    }
    
    return filteredLeads;
  };
  const clearFilters = () => {
    setSearchText("");
    setSelectedVendedorFilter(null);
    setSelectedEstadoFilter("");
    setSelectedFuenteFilter("");
    setSelectedMonth("");
    setSelectedYear(new Date().getFullYear().toString());
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (searchText.trim()) count++;
    if (selectedVendedorFilter) count++;
    if (selectedEstadoFilter) count++;
    if (selectedFuenteFilter) count++;
    if (selectedMonth) count++;
    return count;
  };

  const getAvailableVendorsForReassign = () => {
    if (!currentUser) return [];

    const visibleUsers = getVisibleUsers();
    return visibleUsers.filter((u: any) => u.role === "vendedor" && u.active);
  };

  const openReassignModal = (lead: LeadRow) => {
    setLeadToReassign(lead);
    setSelectedVendorForReassign(lead.vendedor);
    setShowReassignModal(true);
  };

  const handleReassignLead = async () => {
  if (!leadToReassign) return;

  try {
    // CAMBIO: Ahora actualiza el estado a "nuevo" y la fecha al día actual
    await apiUpdateLead(
      leadToReassign.id,
      { 
        vendedor: selectedVendorForReassign,
        estado: "nuevo",  // ✅ NUEVO: Cambiar estado a "nuevo"
        fecha: new Date().toISOString().split('T')[0]  // ✅ NUEVO: Fecha del día
      } as any
    );

    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadToReassign.id
        ? { 
            ...l, 
            vendedor: selectedVendorForReassign,
            estado: "nuevo",  // ✅ Actualizar estado en el frontend
            fecha: new Date().toISOString().split('T')[0]  // ✅ Actualizar fecha en el frontend
          }
        : l
      )
    );

    if (selectedVendorForReassign) {
      pushAlert(
        selectedVendorForReassign,
        "lead_assigned",
        `Lead reasignado: ${leadToReassign.nombre} - ${leadToReassign.modelo}`
      );
    }

    // Actualizar historial con la información completa
    addHistorialEntry(
      leadToReassign.id,
      `Reasignado a ${
        selectedVendorForReassign
          ? userById.get(selectedVendorForReassign)?.name
          : "Sin asignar"
      } - Estado: Nuevo`
    );

    setShowReassignModal(false);
    setLeadToReassign(null);
    setSelectedVendorForReassign(null);
  } catch (e) {
    console.error("No pude reasignar el lead", e);
  }
};

  // AGREGAR LAS 3 FUNCIONES NUEVAS AQUÍ (FUERA de handleReassignLead)
  const toggleLeadSelection = (leadId: number) => {
    setSelectedLeads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  const toggleAllLeads = () => {
    const filteredLeads = getFilteredLeadsByDate();
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
    }
  };

  const handleBulkReassign = async () => {
  if (bulkReassignVendorId === undefined) {
    alert("Selecciona un vendedor");
    return;
  }

  const leadsToReassign = Array.from(selectedLeads);
  
  if (leadsToReassign.length === 0) {
    alert("No hay leads seleccionados");
    return;
  }

  const confirmMsg = `¿Reasignar ${leadsToReassign.length} leads a ${
    bulkReassignVendorId ? userById.get(bulkReassignVendorId)?.name : "Sin asignar"
  }? Los leads se marcarán como NUEVOS con la fecha de hoy.`;
  
  if (!confirm(confirmMsg)) return;

  try {
    const fechaHoy = new Date().toISOString().split('T')[0];
    
    const promises = leadsToReassign.map(leadId =>
      apiUpdateLead(leadId, { 
        vendedor: bulkReassignVendorId,
        estado: "nuevo",  // ✅ NUEVO: Estado a "nuevo"
        fecha: fechaHoy   // ✅ NUEVO: Fecha del día
      } as any)
    );
    
    await Promise.all(promises);

    setLeads(prev =>
      prev.map(l =>
        selectedLeads.has(l.id)
          ? { 
              ...l, 
              vendedor: bulkReassignVendorId,
              estado: "nuevo",  // ✅ Actualizar estado
              fecha: fechaHoy    // ✅ Actualizar fecha
            }
          : l
      )
    );

    if (bulkReassignVendorId) {
      pushAlert(
        bulkReassignVendorId,
        "lead_assigned",
        `${leadsToReassign.length} leads asignados masivamente con estado NUEVO`
      );
    }

    leadsToReassign.forEach(leadId => {
      addHistorialEntry(
        leadId,
        `Reasignación masiva a ${
          bulkReassignVendorId
            ? userById.get(bulkReassignVendorId)?.name
            : "Sin asignar"
        } - Estado: Nuevo - Fecha: ${fechaHoy}`
      );
    });
 
    setShowBulkReassignModal(false);
    setBulkReassignVendorId(null);
    setSelectedLeads(new Set());
    
  } catch (error) {
    console.error('Error en reasignación masiva:', error);
    alert('Error al reasignar los leads. Por favor intenta nuevamente.');
  }
};

  // Función para agregar recordatorio
  const handleAgregarRecordatorio = () => {
    if (!leadParaRecordatorios) return;

    const fecha = (document.getElementById("recordatorio-fecha") as HTMLInputElement)?.value;
    const hora = (document.getElementById("recordatorio-hora") as HTMLInputElement)?.value;
    const descripcion = (document.getElementById("recordatorio-desc") as HTMLTextAreaElement)?.value?.trim();

    if (!fecha || !hora || !descripcion) {
      alert("Por favor completa todos los campos del recordatorio");
      return;
    }

    const nuevoRecordatorio = {
      id: Date.now(),
      fecha,
      hora,
      descripcion,
      completado: false,
    };

    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadParaRecordatorios.id
          ? {
              ...l,
              recordatorios: [...(l.recordatorios || []), nuevoRecordatorio],
            }
          : l
      )
    );

    setShowAddRecordatorioModal(false);
    alert("Recordatorio agregado exitosamente");
  };
const handleEliminarRecordatorio = (leadId: number, recordatorioId: number) => {
  if (confirm("¿Eliminar este recordatorio?")) {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              recordatorios: l.recordatorios?.filter((r) => r.id !== recordatorioId),
            }
          : l
      )
    );
  }
};
// Función para calcular cuotas
const generarPlanesCotizacion = (
  precioContado: number,
  anticipo: number,
  valorUsado: number
): CotizacionPlan[] => {
  const montoFinanciar = precioContado - anticipo - valorUsado;
  
  const planesBase = [
    { cuotas: 12 },
    { cuotas: 24 },
    { cuotas: 36 },
    { cuotas: 48 },
    { cuotas: 60 },
    { cuotas: 84 }
  ];
  
  return planesBase.map(plan => {
    const valorCuota = Math.round(montoFinanciar / plan.cuotas);
    return {
      cuotas: plan.cuotas,
      valorCuota: valorCuota,
      tasaInteres: 0,
      totalFinanciado: montoFinanciar
    };
  });
};

// Función para marcar recordatorio como completado
const handleToggleRecordatorio = (leadId: number, recordatorioId: number) => {
  setLeads((prev) =>
    prev.map((l) =>
      l.id === leadId
        ? {
            ...l,
            recordatorios: l.recordatorios?.map((r) =>
              r.id === recordatorioId ? { ...r, completado: !r.completado } : r
            ),
          }
        : l
    )
  );
};

// Función para generar tareas automáticas basadas en el estado del lead
const generarTareasAutomaticas = (leads: LeadRow[]): TareaSeguimiento[] => {
  const ahora = new Date();
  const tareas: TareaSeguimiento[] = [];
  let tareaId = 1;

  leads.forEach(lead => {
    const ultimoCambio = lead.last_status_change 
      ? new Date(lead.last_status_change)
      : new Date(lead.created_at || '');
    
    const horasSinActividad = (ahora.getTime() - ultimoCambio.getTime()) / (1000 * 60 * 60);
    const diasSinActividad = Math.floor(horasSinActividad / 24);

    // Lógica de tareas según estado y tiempo
    switch (lead.estado) {
      case 'nuevo':
        if (horasSinActividad > 2) {
          tareas.push({
            id: tareaId++,
            leadId: lead.id,
            asignadoA: lead.vendedor || 0,
            tipo: 'llamar',
            prioridad: horasSinActividad > 24 ? 'alta' : 'media',
            fechaLimite: new Date(ahora.getTime() + 4 * 60 * 60 * 1000).toISOString(),
            descripcion: `Realizar primer contacto con ${lead.nombre}`,
            completada: false,
            lead
          });
        }
        break;

      case 'contactado':
        if (diasSinActividad > 1) {
          tareas.push({
            id: tareaId++,
            leadId: lead.id,
            asignadoA: lead.vendedor || 0,
            tipo: 'whatsapp',
            prioridad: diasSinActividad > 3 ? 'alta' : 'media',
            fechaLimite: new Date(ahora.getTime() + 12 * 60 * 60 * 1000).toISOString(),
            descripcion: `Enviar información del ${lead.modelo} a ${lead.nombre}`,
            completada: false,
            lead
          });
        }
        break;

      case 'interesado':
        if (diasSinActividad > 2) {
          tareas.push({
            id: tareaId++,
            leadId: lead.id,
            asignadoA: lead.vendedor || 0,
            tipo: 'cotizar',
            prioridad: 'alta',
            fechaLimite: new Date(ahora.getTime() + 8 * 60 * 60 * 1000).toISOString(),
            descripcion: `Enviar cotización personalizada para ${lead.modelo}`,
            completada: false,
            lead
          });
        }
        break;

      case 'negociacion':
        if (diasSinActividad > 1) {
          tareas.push({
            id: tareaId++,
            leadId: lead.id,
            asignadoA: lead.vendedor || 0,
            tipo: 'seguimiento',
            prioridad: 'alta',
            fechaLimite: new Date(ahora.getTime() + 6 * 60 * 60 * 1000).toISOString(),
            descripcion: `Seguimiento urgente - ${lead.nombre} en negociación`,
            completada: false,
            lead
          });
        }
        break;

      case 'no_contesta_2':
      case 'no_contesta_3':
        tareas.push({
          id: tareaId++,
          leadId: lead.id,
          asignadoA: lead.vendedor || 0,
          tipo: 'llamar',
          prioridad: 'alta',
          fechaLimite: new Date(ahora.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          descripcion: `Reintentar contacto con ${lead.nombre} - ${lead.estado.replace('_', ' ')}`,
          completada: false,
          lead
        });
        break;
    }

    // Tareas por recordatorios
    if (lead.recordatorios) {
      lead.recordatorios
        .filter(r => !r.completado)
        .forEach(recordatorio => {
          const fechaRecordatorio = new Date(`${recordatorio.fecha}T${recordatorio.hora}`);
          if (fechaRecordatorio <= ahora || 
              (fechaRecordatorio.getTime() - ahora.getTime()) < 4 * 60 * 60 * 1000) {
            tareas.push({
              id: tareaId++,
              leadId: lead.id,
              asignadoA: lead.vendedor || 0,
              tipo: 'seguimiento',
              prioridad: fechaRecordatorio <= ahora ? 'alta' : 'media',
              fechaLimite: fechaRecordatorio.toISOString(),
              descripcion: recordatorio.descripcion,
              completada: false,
              lead
            });
          }
        });
    }
  });

  return tareas.sort((a, b) => {
    // Ordenar por prioridad y luego por fecha
    const prioridadOrder = { alta: 0, media: 1, baja: 2 };
    if (prioridadOrder[a.prioridad] !== prioridadOrder[b.prioridad]) {
      return prioridadOrder[a.prioridad] - prioridadOrder[b.prioridad];
    }
    return new Date(a.fechaLimite).getTime() - new Date(b.fechaLimite).getTime();
  });
};

useEffect(() => {
  if (currentUser && leads.length > 0) {
    const leadsFiltrados = getFilteredLeads();
    const tareasGeneradas = generarTareasAutomaticas(leadsFiltrados);
    
    // Solo agregar tareas automáticas para el vendedor actual
    const tareasAutomaticas = tareasGeneradas.map(t => ({
      ...t,
      asignadoA: t.lead?.vendedor || currentUser.id
    }));
    
    setTareasPendientes(prev => {
      // Mantener solo tareas manuales
      const tareasManules = prev.filter(t => t.manual);
      return [...tareasManules, ...tareasAutomaticas];
    });
  }
}, [leads, currentUser]);

const completarTarea = (tareaId: number) => {
  const tarea = tareasPendientes.find(t => t.id === tareaId);
  
  // Solo el vendedor asignado o quien la creó puede completarla
  if (tarea && (tarea.asignadoA === currentUser?.id || tarea.createdBy === currentUser?.id)) {
    setTareasPendientes(prev =>
      prev.map(t => t.id === tareaId ? { ...t, completada: true } : t)
    );
    
    // Notificar al creador si no es el mismo que la completa
    if (tarea.createdBy && tarea.createdBy !== currentUser?.id && tarea.asignadoA === currentUser?.id) {
      pushAlert(
        tarea.createdBy,
        'lead_assigned',
        `✅ ${currentUser?.name} completó la tarea: ${tarea.descripcion.substring(0, 50)}...`
      );
    }
  } else {
    alert('No tienes permiso para completar esta tarea');
  }
};
const handleAsignarTareaAVendedor = () => {
  if (!leadParaAsignarTarea || !vendedorSeleccionadoTarea) {
    alert('Por favor selecciona un vendedor');
    return;
  }

  const tipo = (document.getElementById('tarea-tipo') as HTMLSelectElement)?.value as TareaSeguimiento['tipo'];
  const prioridad = (document.getElementById('tarea-prioridad') as HTMLSelectElement)?.value as TareaSeguimiento['prioridad'];
  const fechaLimite = (document.getElementById('tarea-fecha') as HTMLInputElement)?.value;
  const horaLimite = (document.getElementById('tarea-hora') as HTMLInputElement)?.value || '12:00';
  const descripcion = (document.getElementById('tarea-descripcion') as HTMLTextAreaElement)?.value?.trim();

  if (!fechaLimite || !descripcion) {
    alert('Por favor completa la fecha y descripción de la tarea');
    return;
  }

  const fechaHoraISO = `${fechaLimite}T${horaLimite}:00`;
  const vendedor = userById.get(vendedorSeleccionadoTarea);

  const nuevaTarea: TareaSeguimiento = {
    id: Date.now(),
    leadId: leadParaAsignarTarea.id,
    asignadoA: vendedorSeleccionadoTarea,
    tipo,
    prioridad,
    fechaLimite: fechaHoraISO,
    descripcion,
    completada: false,
    lead: leadParaAsignarTarea,
    manual: true,
    createdBy: currentUser?.id,
    createdByName: currentUser?.name
  };

  setTareasPendientes(prev => [...prev, nuevaTarea]);

  pushAlert(
    vendedorSeleccionadoTarea,
    'lead_assigned',
    `📋 Nueva tarea asignada por ${currentUser?.name}: ${descripcion.substring(0, 50)}...`
  );

  const notaAuto: NotaInterna = {
    id: Date.now() + 1,
    leadId: leadParaAsignarTarea.id,
    texto: `📋 ${currentUser?.name} asignó tarea a ${vendedor?.name}: ${descripcion}`,
    usuario: currentUser?.name || 'Sistema',
    userId: currentUser?.id || 0,
    timestamp: new Date().toISOString(),
  };

  setLeads(prev =>
    prev.map(l =>
      l.id === leadParaAsignarTarea.id
        ? {
            ...l,
            notasInternas: [...(l.notasInternas || []), notaAuto],
          }
        : l
    )
  );

  setShowAsignarTareaModal(false);
  setLeadParaAsignarTarea(null);
  setVendedorSeleccionadoTarea(null);
  alert(`✅ Tarea asignada a ${vendedor?.name}`);
};
  // Verificar recordatorios pendientes al cargar
  useEffect(() => {
    const verificarRecordatorios = () => {
      const ahora = new Date();
      const hoy = ahora.toISOString().split('T')[0];
      const horaActual = ahora.toTimeString().slice(0, 5);

      leads.forEach((lead) => {
        if (lead.vendedor === currentUser?.id && lead.recordatorios) {
          lead.recordatorios.forEach((rec) => {
            if (!rec.completado && rec.fecha === hoy && rec.hora <= horaActual) {
              // Mostrar alerta
              const horaRec = new Date(`${rec.fecha}T${rec.hora}`);
              const diferencia = Math.abs(ahora.getTime() - horaRec.getTime());
              const minutos = Math.floor(diferencia / 60000);

              // Solo alertar si pasaron menos de 5 minutos
              if (minutos < 5) {
                alert(`🔔 RECORDATORIO: ${lead.nombre}\n\n${rec.descripcion}\n\nLead: ${lead.modelo}`);
              }
            }
          });
        }
      });
    };

    // Verificar cada minuto
    const interval = setInterval(verificarRecordatorios, 60000);
    verificarRecordatorios(); // Verificar al cargar

    return () => clearInterval(interval);
  }, [leads, currentUser]);

  const openDeleteLeadConfirm = (lead: LeadRow) => {
    setLeadToDelete(lead);
    setShowDeleteLeadConfirmModal(true);
  };

  const confirmDeleteLead = async () => {
    if (!leadToDelete) return;

    try {
      await apiDeleteLead(leadToDelete.id);
      setLeads((prev) => prev.filter((l) => l.id !== leadToDelete.id));
      setShowDeleteLeadConfirmModal(false);
      setLeadToDelete(null);
    } catch (e) {
      console.error("No pude eliminar el lead", e);
      alert("Error al eliminar el lead. Por favor, intenta nuevamente.");
    }
  };

  // ===== Round-robin con soporte para bots específicos =====
  const [rrIndex, setRrIndex] = useState(0);

  const getActiveVendorIdsInScope = (scopeUser?: any) => {
    if (!scopeUser) return [] as number[];
    const scope = getAccessibleUserIds(scopeUser);
    return users
      .filter(
        (u: any) => u.role === "vendedor" && u.active && scope.includes(u.id)
      )
      .map((u: any) => u.id);
  };

  const getVendorsByTeam = (teamName: string) => {
    const manager = users.find(
      (u: any) =>
        u.role === "gerente" &&
        u.name.toLowerCase().includes(teamName.toLowerCase())
    );

    if (!manager) return [];

    const descendants = getDescendantUserIds(manager.id, childrenIndex);
    return users
      .filter(
        (u: any) =>
          u.role === "vendedor" && u.active && descendants.includes(u.id)
      )
      .map((u: any) => u.id);
  };

  const pickNextVendorId = (scopeUser?: any, botSource?: string) => {
    let pool: number[] = [];

    if (botSource && botConfig[botSource]) {
      const botConf = botConfig[botSource];
      if (botConf.targetTeam) {
        pool = getVendorsByTeam(botConf.targetTeam);
      } else {
        pool = getActiveVendorIdsInScope(scopeUser || currentUser);
      }
    } else {
      pool = getActiveVendorIdsInScope(scopeUser || currentUser);
    }

    if (pool.length === 0) return null;
    const id = pool[rrIndex % pool.length];
    setRrIndex((i) => i + 1);
    return id;
  };

  // ===== Alertas (locales de UI) =====
   const [alerts, setAlerts] = useState<Alert[]>([]);
  const nextAlertId = useRef(1);
const pushAlert = (userId: number, type: Alert["type"], message: string) => {
  setAlerts((prev) => [
    ...prev,
    {
      id: nextAlertId.current++,
      userId,
      type,
      message,
      ts: new Date().toISOString(),
      read: false,
    },
  ]);
};
const pushAlertToChain = (
  vendorId: number,
  type: Alert["type"],
  message: string
) => {
  pushAlert(vendorId, type, message);
  const sup = users.find((u: any) => u.id === userById.get(vendorId)?.reportsTo);
  if (sup) pushAlert(sup.id, type, message);
  const gerente = sup ? users.find((u: any) => u.id === sup.reportsTo) : null;
  if (gerente) pushAlert(gerente.id, type, message);
};// Usar las alertas en el navbar para mostrar contador
  const unreadAlerts = alerts.filter(a => a.userId === currentUser?.id && !a.read).length;
  // ===== Filtrados y ranking =====
  const visibleUserIds = useMemo(
    () => getAccessibleUserIds(currentUser),
    [currentUser, users]
  );

  const getFilteredLeads = () => {
    if (!currentUser) return [] as LeadRow[];
    
    const visibleUserIds = getAccessibleUserIds(currentUser);
    return leads.filter((l) =>
      l.vendedor && visibleUserIds.includes(l.vendedor)
    );
  };

  const getRanking = () => {
    const vendedores = users.filter((u: any) => u.role === "vendedor");
    return vendedores
      .map((v: any) => {
        const ventas = leads.filter(
          (l) => l.vendedor === v.id && l.estado === "vendido"
        ).length;
        const leadsAsignados = leads.filter((l) => l.vendedor === v.id).length;
        return {
          id: v.id,
          nombre: v.name,
          ventas,
          leadsAsignados,
          team: `Equipo de ${userById.get(v.reportsTo)?.name || "—"}`,
        };
      })
      .sort((a, b) => b.ventas - a.ventas);
  };

  const getRankingInScope = () => {
    const vendedores = users.filter(
      (u: any) => u.role === "vendedor" && visibleUserIds.includes(u.id)
    );
    return vendedores
      .map((v: any) => {
        const ventas = leads.filter(
          (l) => l.vendedor === v.id && l.estado === "vendido"
        ).length;
        const leadsAsignados = leads.filter((l) => l.vendedor === v.id).length;
        return {
          id: v.id,
          nombre: v.name,
          ventas,
          leadsAsignados,
          team: `Equipo de ${userById.get(v.reportsTo)?.name || "—"}`,
        };
      })
      .sort((a, b) => b.ventas - a.ventas);
  };

  const getRankingByManagerialTeam = () => {
    if (!currentUser) return [];
    
    if (currentUser.role === "vendedor") {
      const supervisor = userById.get(currentUser.reportsTo);
      if (!supervisor) return getRankingInScope();
      
      const gerente = userById.get(supervisor.reportsTo);
      if (!gerente) return getRankingInScope();
      
      const teamUserIds = getDescendantUserIds(gerente.id, childrenIndex);
      const vendedores = users.filter(
        (u: any) => u.role === "vendedor" && teamUserIds.includes(u.id)
      );
      
      return vendedores
        .map((v: any) => {
          const ventas = leads.filter(
            (l) => l.vendedor === v.id && l.estado === "vendido"
          ).length;
          const leadsAsignados = leads.filter((l) => l.vendedor === v.id).length;
          return {
            id: v.id,
            nombre: v.name,
            ventas,
            leadsAsignados,
            team: `Equipo de ${gerente.name}`,
          };
        })
        .sort((a, b) => b.ventas - a.ventas);
    }
    
    return getRankingInScope();
  };

  const prevRankingRef = useRef(new Map<number, number>());
  useEffect(() => {
    const r = getRanking();
    const curr = new Map<number, number>();
    r.forEach((row, idx) => curr.set(row.id, idx + 1));
    const prev = prevRankingRef.current;
    curr.forEach((pos, vid) => {
      const before = prev.get(vid);
      if (before && before !== pos) {
        const delta = before - pos;
        const msg =
          delta > 0
            ? `¡Subiste ${Math.abs(delta)} puesto(s) en el ranking!`
            : `Bajaste ${Math.abs(delta)} puesto(s) en el ranking.`;
        pushAlertToChain(vid, "ranking_change", msg);
      }
    });
    prevRankingRef.current = curr;
  }, [leads, users, userById]);
const getDashboardStats = (teamFilter?: string) => {
    let filteredLeads: LeadRow[];
    
    if (teamFilter && teamFilter !== "todos" && ["owner", "director", "dueño"].includes(currentUser?.role)) {
      const teamUserIds = getTeamUserIds(teamFilter);
      filteredLeads = leads.filter((l) => l.vendedor && teamUserIds.includes(l.vendedor));
    } else {
      filteredLeads = getFilteredLeads();
    }
    
    // FILTRO POR FECHA (esta parte es NUEVA)
    if (selectedMonth && selectedYear) {
      filteredLeads = filteredLeads.filter((lead) => {
        const dateToCheck = dateFilterType === "status_change" 
          ? (lead.last_status_change || lead.fecha || lead.created_at)
          : (lead.fecha || lead.created_at);
        
        if (!dateToCheck) return false;
        
        const leadDate = new Date(dateToCheck);
        const leadMonth = (leadDate.getMonth() + 1).toString().padStart(2, '0');
        const leadYear = leadDate.getFullYear().toString();
        
        return leadMonth === selectedMonth && leadYear === selectedYear;
      });
    }
    
    const vendidos = filteredLeads.filter((lead) => lead.estado === "vendido").length;
    const conversion = filteredLeads.length > 0
      ? ((vendidos / filteredLeads.length) * 100).toFixed(1)
      : "0";
    
    return { totalLeads: filteredLeads.length, vendidos, conversion };
  };
  const getSourceMetrics = (teamFilter?: string) => {
    let filteredLeads: LeadRow[];
    
    if (teamFilter && teamFilter !== "todos" && ["owner", "director", "dueño"].includes(currentUser?.role)) {
      const teamUserIds = getTeamUserIds(teamFilter);
      filteredLeads = leads.filter((l) => l.vendedor && teamUserIds.includes(l.vendedor));
    } else {
      filteredLeads = getFilteredLeads();
    }
    
    // FILTRO POR FECHA (esta parte es NUEVA)
    if (selectedMonth && selectedYear) {
      filteredLeads = filteredLeads.filter((lead) => {
        const dateToCheck = dateFilterType === "status_change" 
          ? (lead.last_status_change || lead.fecha || lead.created_at)
          : (lead.fecha || lead.created_at);
        
        if (!dateToCheck) return false;
        
        const leadDate = new Date(dateToCheck);
        const leadMonth = (leadDate.getMonth() + 1).toString().padStart(2, '0');
        const leadYear = leadDate.getFullYear().toString();
        
        return leadMonth === selectedMonth && leadYear === selectedYear;
      });
    }
    
    const sourceData = Object.keys(fuentes)
      .map((source) => {
        const sourceLeads = filteredLeads.filter((lead) => lead.fuente === source);
        const vendidos = sourceLeads.filter((lead) => lead.estado === "vendido").length;
        const conversion = sourceLeads.length > 0
          ? ((vendidos / sourceLeads.length) * 100).toFixed(1)
          : "0";
        return {
          source,
          total: sourceLeads.length,
          vendidos,
          conversion: parseFloat(conversion),
          ...fuentes[source],
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);

    return sourceData;
  };
 
  // ===== Acciones de Leads (API) =====
  const mapLeadFromApi = (L: any): LeadRow => ({
  id: L.id,
  nombre: L.nombre,
  telefono: L.telefono,
  modelo: L.modelo,
  formaPago: L.formaPago,
  infoUsado: L.infoUsado,
  entrega: L.entrega,
  fecha: L.fecha || L.created_at || "",
  estado: (L.estado || "nuevo") as LeadRow["estado"],
  vendedor: L.vendedor ?? null,
  notas: L.notas || "",
  fuente: (L.fuente || "otro") as LeadRow["fuente"],
  historial: L.historial || [],
  created_by: L.created_by || null,
  created_at: L.created_at || null,  // AGREGAR ESTA LÍNEA
  last_status_change: L.last_status_change || null,
});

  const addHistorialEntry = (leadId: number, estado: string) => {
    if (!currentUser) return;
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              historial: [
                ...(lead.historial || []),
                {
                  estado,
                  timestamp: new Date().toISOString(),
                  usuario: currentUser.name,
                },
              ],
            }
          : lead
      )
    );
  };

  const handleUpdateLeadStatus = async (leadId: number, newStatus: string) => {
    try {
      const updated = await apiUpdateLead(leadId, { estado: newStatus } as any);
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, ...mapLeadFromApi(updated) } : l))
      );

      addHistorialEntry(leadId, newStatus);
    } catch (e) {
      console.error("No pude actualizar estado del lead", e);
    }
  };

  const handleUpdateObservaciones = async (
    leadId: number,
    observaciones: string
  ) => {
    try {
      const updated = await apiUpdateLead(leadId, { notas: observaciones } as any);
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, ...mapLeadFromApi(updated) } : l))
      );
      setShowObservacionesModal(false);
      setEditingLeadObservaciones(null);
    } catch (e) {
      console.error("No pude actualizar observaciones del lead", e);
    }
  };

  const handleCreateLead = async () => {
    try {
      const nombre = (document.getElementById("new-nombre") as HTMLInputElement)
        ?.value
        ?.trim();
      const telefono = (
        document.getElementById("new-telefono") as HTMLInputElement
      )?.value?.trim();
      const modelo = (document.getElementById("new-modelo") as HTMLInputElement)
        ?.value
        ?.trim();
      const formaPago = (document.getElementById("new-formaPago") as HTMLSelectElement)?.value;
      const infoUsado = (
        document.getElementById("new-infoUsado") as HTMLInputElement
      )?.value?.trim();
      const entrega = (document.getElementById("new-entrega") as HTMLInputElement)
        ?.checked;
      const fecha = (document.getElementById("new-fecha") as HTMLInputElement)
        ?.value;
      const autoAssign = (
        document.getElementById("new-autoassign") as HTMLInputElement
      )?.checked;
      const vendedorSelVal = (document.getElementById("new-vendedor") as HTMLSelectElement)
        ?.value;

      if (!nombre || !telefono || !modelo) {
        alert("Por favor completa los campos obligatorios: Nombre, Teléfono y Modelo");
        return;
      }

      const vendedor_idSelRaw = parseInt(vendedorSelVal, 10);
      const vendedor_idSel = Number.isNaN(vendedor_idSelRaw)
        ? null
        : vendedor_idSelRaw;

      const fuente = "creado_por";

      let vendedor_id: number | null = null;
      if (autoAssign) {
        vendedor_id = pickNextVendorId(currentUser) ?? null;
      } else {
        if (vendedor_idSel) {
          const selectedVendor = users.find(u => u.id === vendedor_idSel);
          const availableVendors = getAvailableVendorsForAssignment();
          
          if (selectedVendor && selectedVendor.active && availableVendors.some(v => v.id === vendedor_idSel)) {
            vendedor_id = vendedor_idSel;
          } else {
            alert("El vendedor seleccionado no está disponible. Por favor selecciona otro vendedor o usa la asignación automática.");
            return;
          }
        } else {
          vendedor_id = null;
        }
      }

      let equipo = 'roberto';
      
      if (vendedor_id) {
        const vendedorAsignado = users.find(u => u.id === vendedor_id);
        if (vendedorAsignado) {
          let currentUserForTeam = vendedorAsignado;
          while (currentUserForTeam && currentUserForTeam.reportsTo) {
            const manager = userById.get(currentUserForTeam.reportsTo);
            if (!manager) break;
            
            if (manager.role === 'gerente') {
              if (manager.name === 'Daniel Mottino') {
                equipo = 'daniel';
              } else if (manager.name === 'Roberto Sauer') {
                equipo = 'roberto';
              }
              break;
            }
            currentUserForTeam = manager;
          }
        }
      } else {
        let currentUserForTeam = currentUser;
        while (currentUserForTeam && currentUserForTeam.reportsTo) {
          const manager = userById.get(currentUserForTeam.reportsTo);
          if (!manager) break;
          
          if (manager.role === 'gerente') {
            if (manager.name === 'Daniel Mottino') {
              equipo = 'daniel';
            } else if (manager.name === 'Roberto Sauer') {
              equipo = 'roberto';
            }
            break;
          }
          currentUserForTeam = manager;
        }
      }

      const leadData = {
        nombre,
        telefono,
        modelo,
        formaPago: formaPago || "Contado",
        notas: `Creado por: ${currentUser?.name}${infoUsado ? `\nInfo usado: ${infoUsado}` : ''}${entrega ? '\nEntrega usado: Sí' : ''}`,
        estado: "nuevo",
        fuente,
        fecha: fecha || new Date().toISOString().split('T')[0],
        vendedor: vendedor_id,
        equipo: equipo,
      };

      const created = await apiCreateLead(leadData as any);
      const mapped = mapLeadFromApi(created);
      
      if (mapped.vendedor) {
        pushAlert(
          mapped.vendedor,
          "lead_assigned",
          `Nuevo lead asignado: ${mapped.nombre} (creado por ${currentUser?.name})`
        );
      }
      
      setLeads((prev) => [mapped, ...prev]);
      setShowNewLeadModal(false);

      (document.getElementById("new-nombre") as HTMLInputElement).value = "";
      (document.getElementById("new-telefono") as HTMLInputElement).value = "";
      (document.getElementById("new-modelo") as HTMLInputElement).value = "";
      (document.getElementById("new-infoUsado") as HTMLInputElement).value = "";
      (document.getElementById("new-fecha") as HTMLInputElement).value = "";
      (document.getElementById("new-entrega") as HTMLInputElement).checked = false;

      addHistorialEntry(mapped.id, `Creado por ${currentUser?.name}`);
      alert("Lead creado exitosamente");
      
    } catch (e: any) {
      console.error("Error completo al crear el lead:", e);
      alert(`Error al crear el lead: ${e?.response?.data?.error || e?.message || 'Error desconocido'}`);
    }
  };

  // ===== Calendario (UI local) =====
  const visibleUsers = useMemo(() => (currentUser ? getVisibleUsers() : []), [currentUser, users]);
  const eventsForSelectedUser = useMemo(() => {
    const uid = selectedCalendarUserId || currentUser?.id;
    return events
      .filter((e) => e.userId === uid)
      .sort((a, b) => ((a.date + (a.time || "")) > (b.date + (b.time || "")) ? 1 : -1));
  }, [events, selectedCalendarUserId, currentUser]);
  const formatterEs = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  const createEvent = () => {
    const title = (document.getElementById("ev-title") as HTMLInputElement).value;
    const date = (document.getElementById("ev-date") as HTMLInputElement).value;
    const time = (document.getElementById("ev-time") as HTMLInputElement).value;
    const userId = parseInt((document.getElementById("ev-user") as HTMLSelectElement).value, 10);
    if (title && date && userId) {
      setEvents((prev) => [
        ...prev,
        {
          id: Math.max(0, ...prev.map((e: any) => e.id)) + 1,
          title,
          date,
          time: time || "09:00",
          userId,
        },
      ]);
      setShowNewEventModal(false);
    }
  };
  const deleteEvent = (id: number) =>
    setEvents((prev) => prev.filter((e: any) => e.id !== id));

  // ===== Gestión de Usuarios (API) =====
  const validRolesByUser = (user: any) => {
    if (!user) return [];
    switch (user.role) {
      case "owner":
        return ["director", "gerente", "supervisor", "vendedor"];
      case "director":
        return ["gerente", "supervisor", "vendedor"];
      case "gerente":
        return ["supervisor", "vendedor"];
      default:
        return [];
    }
  };
  const validManagersByRole = (role: string) => {
    switch (role) {
      case "owner":
        return [];
      case "director":
        return users.filter((u: any) => u.role === "owner");
      case "gerente":
        return users.filter((u: any) => u.role === "director");
      case "supervisor":
        return users.filter((u: any) => u.role === "gerente");
      case "vendedor":
        return users.filter((u: any) => u.role === "supervisor");
      default:
        return [];
    }
  };

  const openCreateUser = () => {
    setEditingUser(null);
    const availableRoles = validRolesByUser(currentUser);
    const roleDefault = (availableRoles?.[0] as typeof modalRole) || "vendedor";
    const validManagers = validManagersByRole(roleDefault);
    setModalRole(roleDefault);
    setModalReportsTo(validManagers[0]?.id ?? null);
    setShowUserModal(true);
  };

  const openEditUser = (u: any) => {
    setEditingUser(u);
    const roleCurrent = u.role as typeof modalRole;
    const availableRoles: string[] =
      currentUser.role === "owner" && u.id === currentUser?.id
        ? ["owner", ...validRolesByUser(currentUser)]
        : validRolesByUser(currentUser);
    const roleToSet = availableRoles.includes(roleCurrent)
      ? roleCurrent
      : (availableRoles[0] as any);
    const validManagers = validManagersByRole(roleToSet);
    setModalRole(roleToSet as any);
    setModalReportsTo(
      roleToSet === "owner" ? null : u.reportsTo ?? validManagers[0]?.id ?? null
    );
    setShowUserModal(true);
  };

  const saveUser = async () => {
    const name = (document.getElementById("u-name") as HTMLInputElement).value.trim();
    const email = (document.getElementById("u-email") as HTMLInputElement).value.trim();
    const password = (document.getElementById("u-pass") as HTMLInputElement).value;
    const active = (document.getElementById("u-active") as HTMLInputElement).checked;

    if (!name || !email) {
      alert("Nombre y email son obligatorios");
      return;
    }
    
    if (!editingUser && !password) {
      alert("La contraseña es obligatoria para usuarios nuevos");
      return;
    }

    const finalReportsTo = modalRole === "owner" ? null : modalReportsTo ?? null;

    try {
      if (editingUser) {
        const updateData: any = {
          name,
          email,
          role: modalRole,
          reportsTo: finalReportsTo,
          active: active ? 1 : 0,
        };
        
        if (password && password.trim()) {
          updateData.password = password.trim();
        }

        const updated = await apiUpdateUser(editingUser.id, updateData);
        setUsers((prev) => prev.map((u: any) => (u.id === editingUser.id ? updated : u)));
      } else {
        const createData = {
          name,
          email,
          password: password.trim(),
          role: modalRole,
          reportsTo: finalReportsTo,
          active: active ? 1 : 0,
        };
        
        const created = await apiCreateUser(createData as any);
        setUsers((prev) => [...prev, created]);
      }
      setShowUserModal(false);
    } catch (e: any) {
      console.error("No pude guardar usuario", e);
      alert(`Error al ${editingUser ? 'actualizar' : 'crear'} usuario: ${e?.response?.data?.error || e.message}`);
    }
  };

  const openDeleteConfirm = (user: any) => {
    if (user.role === "owner") {
      alert("No podés eliminar al Dueño.");
      return;
    }
    
    const hasChildren = users.some((u: any) => u.reportsTo === user.id);
    if (hasChildren) {
      alert("No se puede eliminar: el usuario tiene integrantes a cargo. Primero reasigne o elimine a sus subordinados.");
      return;
    }

    const hasAssignedLeads = leads.some((l) => l.vendedor === user.id);
    if (hasAssignedLeads) {
      alert("No se puede eliminar: el usuario tiene leads asignados. Primero reasigne todos sus leads a otros vendedores.");
      return;
    }

    setUserToDelete(user);
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      await apiDeleteUser(userToDelete.id);
      setUsers((prev) => prev.filter((u: any) => u.id !== userToDelete.id));
      setShowDeleteConfirmModal(false);
      setUserToDelete(null);
    } catch (e) {
      console.error("No pude eliminar usuario", e);
      alert("Error al eliminar el usuario. Por favor, intenta nuevamente.");
    }
  };
// Agregar estas funciones antes del return final

const handleAgregarNota = () => {
  if (!leadParaNotas || !currentUser) return;

  const textoNota = (document.getElementById("nueva-nota-interna") as HTMLTextAreaElement)?.value?.trim();
  
  if (!textoNota) {
    alert("Escribe algo en la nota");
    return;
  }

  const nuevaNota: NotaInterna = {
    id: Date.now(),
    leadId: leadParaNotas.id,
    texto: textoNota,
    usuario: currentUser.name,
    userId: currentUser.id,
    timestamp: new Date().toISOString(),
  };

  setLeads((prev) =>
    prev.map((l) =>
      l.id === leadParaNotas.id
        ? {
            ...l,
            notasInternas: [...(l.notasInternas || []), nuevaNota],
          }
        : l
    )
  );

  // Limpiar textarea
  (document.getElementById("nueva-nota-interna") as HTMLTextAreaElement).value = "";
  
  alert("Nota agregada exitosamente");
};

const handleEliminarNota = (leadId: number, notaId: number) => {
  if (!confirm("¿Eliminar esta nota interna?")) return;

  setLeads((prev) =>
    prev.map((l) =>
      l.id === leadId
        ? {
            ...l,
            notasInternas: l.notasInternas?.filter((n) => n.id !== notaId),
          }
        : l
    )
  );
};

// Función para calcular meta del mes actual
const getMetaActual = (vendedor_id: number) => {
  const mesActual = new Date().toISOString().slice(0, 7);
  return metas.find(m => m.vendedor_id === vendedor_id && m.mes === mesActual);
};

// Función para calcular progreso del mes
const getProgresoMes = (vendedor_id: number) => {
  const mesActual = new Date().toISOString().slice(0, 7);
  const year = mesActual.split('-')[0];
  const month = mesActual.split('-')[1];
  
  const leadsDelMes = leads.filter((lead) => {
    if (lead.vendedor !== vendedor_id) return false;
    
    const dateToCheck = lead.last_status_change || lead.fecha || lead.created_at;
    if (!dateToCheck) return false;
    
    const leadDate = new Date(dateToCheck);
    const leadMonth = (leadDate.getMonth() + 1).toString().padStart(2, '0');
    const leadYear = leadDate.getFullYear().toString();
    
    return leadMonth === month && leadYear === year;
  });
  
  const ventasDelMes = leadsDelMes.filter(l => l.estado === 'vendido').length;
  
  return {
    ventas: ventasDelMes,
    leads: leadsDelMes.length,
  };
};

  // ===== UI: Login =====
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <svg width="48" height="42" viewBox="0 0 40 36" fill="none">
                <path d="M10 2L30 2L35 12L30 22L10 22L5 12Z" fill="url(#gradient2)" />
                <defs>
                  <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFB800" />
                    <stop offset="25%" stopColor="#FF6B9D" />
                    <stop offset="50%" stopColor="#8B5CF6" />
                    <stop offset="75%" stopColor="#06B6D4" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="ml-3">
                <h1 className="text-2xl font-bold text-gray-800">Alluma</h1>
                <p className="text-sm text-gray-600">Publicidad</p>
              </div>
            </div>
            <p className="text-gray-600">Sistema de gestión CRM</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                id="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="tu@alluma.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
              <input
                type="password"
                id="password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>
            {loginError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{loginError}</p>
              </div>
            )}

            <button
              onClick={() =>
                handleLogin(
                  (document.getElementById("email") as HTMLInputElement).value,
                  (document.getElementById("password") as HTMLInputElement).value
                )
              }
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700"
            >
              Iniciar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== UI autenticada =====
  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="bg-slate-900 text-white w-64 min-h-screen p-4">
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <div className="relative">
              <svg width="40" height="36" viewBox="0 0 40 36" fill="none">
                <path d="M10 2L30 2L35 12L30 22L10 22L5 12Z" fill="url(#gradient1)" />
                <defs>
                  <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFB800" />
                    <stop offset="25%" stopColor="#FF6B9D" />
                    <stop offset="50%" stopColor="#8B5CF6" />
                    <stop offset="75%" stopColor="#06B6D4" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="ml-3">
              <h1 className="text-xl font-bold text-white">Alluma</h1>
              <p className="text-xs text-gray-400">Publicidad</p>
            </div>
          </div>

          <div className="text-sm text-gray-300">
            <p>{currentUser?.name || currentUser?.email}</p>
            <p className="text-blue-300">
              {roles[currentUser?.role] || currentUser?.role}
            </p>
            {!currentUser?.active && (
              <p className="text-red-300 text-xs mt-1">
                ⚠️ Usuario desactivado - No recibe leads nuevos
              </p>
            )}
          </div>
        </div>
        <nav className="space-y-2">
  {[
    { key: "dashboard", label: "Dashboard", Icon: Home },
    { key: "leads", label: "Leads", Icon: Users },
    { key: "tareas", label: "Mis Tareas", Icon: Bell, badge: tareasPendientes.filter(t => !t.completada && t.prioridad === 'alta').length },
    { key: "calendar", label: "Calendario", Icon: Calendar },
    { key: "presupuestos", label: "Presupuestos", Icon: FileText },
    { key: "ranking", label: "Ranking", Icon: Trophy },
    
    // Gestión de Metas
    ...((["supervisor", "gerente", "director", "owner"].includes(currentUser?.role))
      ? [{ key: "metas", label: "Gestión de Metas", Icon: Target }]
      : []),
    
    ...(["supervisor", "gerente", "director", "owner"].includes(currentUser?.role)
      ? [{ key: "team", label: "Mi Equipo", Icon: UserCheck }]
      : []),
    ...((["supervisor", "gerente", "director", "owner"].includes(currentUser?.role))
  ? [{ 
      key: "asignar_tareas", 
      label: "Asignar Tareas", 
      Icon: Bell,
      badge: tareasPendientes.filter(t => 
        t.createdBy === currentUser?.id && !t.completada
      ).length
    }]
  : []),
    ...((isOwner() || currentUser?.role === "director")
      ? [{ key: "analytics", label: "Análisis Diario", Icon: BarChart3 }]
      : []),
    { key: "alerts", label: "Alertas", Icon: Bell, badge: unreadAlerts },
    ...(canManageUsers()
      ? [{ key: "users", label: "Usuarios", Icon: Settings }]
      : []),
  ].map(({ key, label, Icon, badge }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key as any)}
              className={`w-full flex items-center justify-between space-x-3 px-3 py-2 rounded-lg transition-colors ${
                activeSection === (key as any)
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-slate-800"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon size={20} />
                <span>{label}</span>
              </div>
              {badge !== undefined && badge > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      {/* Botón de Cerrar Sesión */}
        <div className="mt-auto pt-4 border-t border-slate-700">
          <button
            onClick={async () => {
              try {
                // Llamar al endpoint de logout
                await api.post('/auth/logout');
              } catch (error) {
                console.error('Error al cerrar sesión:', error);
              } finally {
                // Limpiar todo el storage local
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.clear();
                sessionStorage.clear();
                
                // Limpiar el header de autorización
                delete api.defaults.headers.common['Authorization'];
                
                // Cambiar estado a no autenticado
                setIsAuthenticated(false);
                setCurrentUser(null);
                setUsers([]);
                setLeads([]);
                
                // Opcional: recargar la página para limpiar todo
                window.location.reload();
              }
            }}
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-red-300 hover:bg-red-900/20 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
     

      {/* Main */}
      <div className="flex-1 p-6">
        {/* Dashboard */}
        {activeSection === "dashboard" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
  <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
  <div className="flex items-center space-x-3">
    {["owner", "director", "dueño"].includes(currentUser?.role) && (
      <select
        value={selectedTeam}
        onChange={(e) => setSelectedTeam(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
      >
        <option value="todos">Todos los equipos</option>
        {users
          .filter((u: any) => u.role === "gerente")
          .map((gerente: any) => (
            <option key={gerente.id} value={gerente.id.toString()}>
              Equipo {gerente.name}
            </option>
          ))}
      </select>
    )}
    
    {/* AGREGAR ESTOS SELECTORES DE FECHA */}
    <select
      value={dateFilterType}
      onChange={(e) => setDateFilterType(e.target.value as "created" | "status_change")}
      className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
    >
      <option value="status_change">Por cambio de estado</option>
      <option value="created">Por fecha de creación</option>
    </select>
    
    <select
      value={selectedMonth}
      onChange={(e) => setSelectedMonth(e.target.value)}
      className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
    >
      <option value="">Todos los meses</option>
      <option value="01">Enero</option>
      <option value="02">Febrero</option>
      <option value="03">Marzo</option>
      <option value="04">Abril</option>
      <option value="05">Mayo</option>
      <option value="06">Junio</option>
      <option value="07">Julio</option>
      <option value="08">Agosto</option>
      <option value="09">Septiembre</option>
      <option value="10">Octubre</option>
      <option value="11">Noviembre</option>
      <option value="12">Diciembre</option>
    </select>
    
    <select
      value={selectedYear}
      onChange={(e) => setSelectedYear(e.target.value)}
      className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
    >
      <option value="2024">2024</option>
      <option value="2025">2025</option>
      <option value="2026">2026</option>
    </select>
    
    {canCreateLeads() && (
      <button
        onClick={() => setShowNewLeadModal(true)}
        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
      >
        <Plus size={20} />
        <span>Nuevo Lead</span>
      </button>
    )}
  </div>
</div>

            {/* Estadísticas principales */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(() => {
                const teamFilter = ["owner", "director", "dueño"].includes(currentUser?.role)
                  ? selectedTeam
                  : undefined;
                const stats = getDashboardStats(teamFilter);
                return (
                  <>
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Leads</p>
                          <p className="text-3xl font-bold text-gray-900">
                            {stats.totalLeads}
                          </p>
                        </div>
                        <div className="bg-blue-500 p-3 rounded-full">
                          <Users className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Ventas</p>
                          <p className="text-3xl font-bold text-green-600">
                            {stats.vendidos}
                          </p>
                        </div>
                        <div className="bg-green-500 p-3 rounded-full">
                          <Trophy className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">
                            Conversión
                          </p>
                          <p className="text-3xl font-bold text-purple-600">
                            {stats.conversion}%
                          </p>
                        </div>
                        <div className="bg-purple-500 p-3 rounded-full">
                          <BarChart3 className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
{/* Panel de Metas - Solo para vendedores */}
{currentUser?.role === "vendedor" && (() => {
  const metaActual = getMetaActual(currentUser.id);
  const progreso = getProgresoMes(currentUser.id);
  
  if (!metaActual) {
    return (
      <div className="bg-gradient-to-r from-purple-100 to-pink-100 border-2 border-dashed border-purple-300 rounded-xl p-6">
        <div className="text-center">
          <Trophy size={48} className="mx-auto text-purple-400 mb-3" />
          <p className="text-gray-600">No tienes metas asignadas para este mes</p>
          <p className="text-sm text-gray-500 mt-2">
            Consulta con tu supervisor para establecer tus objetivos
          </p>
        </div>
      </div>
    );
  }
  
  const porcentajeVentas = metaActual.meta_ventas > 0 
    ? Math.min((progreso.ventas / metaActual.meta_ventas) * 100, 100)
    : 0;
  
  const porcentajeLeads = metaActual.meta_leads > 0
    ? Math.min((progreso.leads / metaActual.meta_leads) * 100, 100)
    : 0;
  
  const superaMeta = progreso.ventas >= metaActual.meta_ventas;
  
  return (
    <div className={`rounded-xl p-6 ${
      superaMeta 
        ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
        : 'bg-gradient-to-r from-purple-500 to-pink-500'
    } text-white shadow-lg`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold flex items-center">
          <Trophy className="mr-2" size={24} />
          {superaMeta ? '🎉 ¡Meta Cumplida!' : '🎯 Mi Meta del Mes'}
        </h3>
        <span className="text-sm opacity-90">
          {new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        {/* Meta de Ventas */}
        <div>
          <p className="text-sm opacity-90 mb-1">Meta de Ventas</p>
          <p className="text-4xl font-bold mb-2">
            {progreso.ventas} / {metaActual.meta_ventas}
          </p>
          <div className="w-full bg-white bg-opacity-30 rounded-full h-3">
            <div 
              className="bg-white h-3 rounded-full transition-all duration-500 flex items-center justify-end pr-1"
              style={{ width: `${porcentajeVentas}%` }}
            >
              {porcentajeVentas >= 20 && (
                <span className="text-xs font-bold" style={{ color: superaMeta ? '#10b981' : '#a855f7' }}>
                  {porcentajeVentas.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
          {porcentajeVentas < 20 && (
            <p className="text-xs mt-1 opacity-75">{porcentajeVentas.toFixed(0)}%</p>
          )}
          
          {superaMeta ? (
            <p className="text-sm mt-2 font-medium">
              ✨ ¡Superaste tu meta en {progreso.ventas - metaActual.meta_ventas} ventas!
            </p>
          ) : (
            <p className="text-sm mt-2 opacity-90">
              Te faltan {metaActual.meta_ventas - progreso.ventas} ventas
            </p>
          )}
        </div>
        
        {/* Meta de Leads */}
        <div>
          <p className="text-sm opacity-90 mb-1">Meta de Leads Gestionados</p>
          <p className="text-4xl font-bold mb-2">
            {progreso.leads} / {metaActual.meta_leads}
          </p>
          <div className="w-full bg-white bg-opacity-30 rounded-full h-3">
            <div 
              className="bg-white h-3 rounded-full transition-all duration-500 flex items-center justify-end pr-1"
              style={{ width: `${porcentajeLeads}%` }}
            >
              {porcentajeLeads >= 20 && (
                <span className="text-xs font-bold" style={{ color: superaMeta ? '#10b981' : '#a855f7' }}>
                  {porcentajeLeads.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
          {porcentajeLeads < 20 && (
            <p className="text-xs mt-1 opacity-75">{porcentajeLeads.toFixed(0)}%</p>
          )}
          
          {progreso.leads >= metaActual.meta_leads ? (
            <p className="text-sm mt-2 font-medium">
              ✅ ¡Meta de leads alcanzada!
            </p>
          ) : (
            <p className="text-sm mt-2 opacity-90">
              Te faltan {metaActual.meta_leads - progreso.leads} leads
            </p>
          )}
        </div>
      </div>
      
      {/* Motivación adicional */}
      {!superaMeta && porcentajeVentas >= 80 && (
        <div className="mt-4 bg-white bg-opacity-20 rounded-lg p-3">
          <p className="text-sm font-medium">
            💪 ¡Estás muy cerca! Solo te falta {metaActual.meta_ventas - progreso.ventas} venta{metaActual.meta_ventas - progreso.ventas > 1 ? 's' : ''} para alcanzar tu objetivo
          </p>
        </div>
      )}
    </div>
  );
})()}
            {/* Estados de Leads con posibilidad de editar estados */}
<div className="bg-white rounded-xl shadow-lg p-6">
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-xl font-semibold text-gray-800">Estados de Leads</h3>
    <div className="flex items-center space-x-2">
      {["owner", "director"].includes(currentUser?.role) && (
        <>
          <span className="text-sm text-gray-600">Descargar Excel:</span>
          <button
            onClick={() => {
              const teamFilter = ["owner", "director"].includes(currentUser?.role)
                ? selectedTeam
                : undefined;
              
              // Usar la función que ya aplica filtros de fecha
              let filteredLeads = teamFilter && teamFilter !== "todos"
                ? getFilteredLeadsByTeam(teamFilter)
                : getFilteredLeads();
              
              // Aplicar filtro de fecha
              if (selectedMonth && selectedYear) {
                filteredLeads = filteredLeads.filter((lead) => {
                  const dateToCheck = dateFilterType === "status_change" 
                    ? (lead.last_status_change || lead.fecha || lead.created_at)
                    : (lead.fecha || lead.created_at);
                  
                  if (!dateToCheck) return false;
                  
                  const leadDate = new Date(dateToCheck);
                  const leadMonth = (leadDate.getMonth() + 1).toString().padStart(2, '0');
                  const leadYear = leadDate.getFullYear().toString();
                  
                  return leadMonth === selectedMonth && leadYear === selectedYear;
                });
              }
              
              downloadAllLeadsExcel(filteredLeads, userById, fuentes);
            }}
            className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center space-x-1"
            title="Descargar Excel completo"
          >
            <Download size={12} />
            <span>Todos</span>
          </button>
        </>
      )}
      {selectedEstado && (
        <button
          onClick={() => setSelectedEstado(null)}
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
        >
          <X size={16} />
          <span>Cerrar filtro</span>
        </button>
      )}
    </div>
  </div>
  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
    {Object.entries(estados).map(([key, estado]) => {
      const teamFilter = ["owner", "director"].includes(currentUser?.role)
        ? selectedTeam
        : undefined;
      
      // Obtener leads filtrados por equipo
      let filteredLeads = teamFilter && teamFilter !== "todos"
        ? getFilteredLeadsByTeam(teamFilter)
        : getFilteredLeads();
      
      // APLICAR FILTRO DE FECHA - ESTA ES LA PARTE CLAVE
      if (selectedMonth && selectedYear) {
        filteredLeads = filteredLeads.filter((lead) => {
          const dateToCheck = dateFilterType === "status_change" 
            ? (lead.last_status_change || lead.fecha || lead.created_at)
            : (lead.fecha || lead.created_at);
          
          if (!dateToCheck) return false;
          
          const leadDate = new Date(dateToCheck);
          const leadMonth = (leadDate.getMonth() + 1).toString().padStart(2, '0');
          const leadYear = leadDate.getFullYear().toString();
          
          return leadMonth === selectedMonth && leadYear === selectedYear;
        });
      }
      
      // Contar leads en este estado específico
      const count = filteredLeads.filter((l) => l.estado === key).length;
      const percentage = filteredLeads.length > 0 
        ? ((count / filteredLeads.length) * 100).toFixed(1)
        : "0";
      
      return (
        <div key={key} className="relative group">
          <button
            onClick={() => setSelectedEstado(selectedEstado === key ? null : key)}
            className={`w-full text-center transition-all duration-200 transform hover:scale-105 ${
              selectedEstado === key ? "ring-4 ring-blue-300 ring-opacity-50" : ""
            }`}
            title={`Ver todos los leads en estado: ${estado.label}`}
          >
            <div className={`${estado.color} text-white rounded-lg p-4 mb-2 relative cursor-pointer hover:opacity-90 transition-opacity`}>
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs opacity-75">{percentage}%</div>
              
              {["owner", "dueño"].includes(currentUser?.role) && count > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const teamFilter = ["owner", "director"].includes(currentUser?.role)
                      ? selectedTeam
                      : undefined;
                    
                    let filteredLeads = teamFilter && teamFilter !== "todos"
                      ? getFilteredLeadsByTeam(teamFilter)
                      : getFilteredLeads();
                    
                    // Aplicar filtro de fecha antes de descargar
                    if (selectedMonth && selectedYear) {
                      filteredLeads = filteredLeads.filter((lead) => {
                        const dateToCheck = dateFilterType === "status_change" 
                          ? (lead.last_status_change || lead.fecha || lead.created_at)
                          : (lead.fecha || lead.created_at);
                        
                        if (!dateToCheck) return false;
                        
                        const leadDate = new Date(dateToCheck);
                        const leadMonth = (leadDate.getMonth() + 1).toString().padStart(2, '0');
                        const leadYear = leadDate.getFullYear().toString();
                        
                        return leadMonth === selectedMonth && leadYear === selectedYear;
                      });
                    }
                    
                    downloadLeadsByStateExcel(filteredLeads, key, userById, fuentes);
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white bg-opacity-20 hover:bg-opacity-40 rounded p-1"
                  title={`Descargar Excel: ${estado.label}`}
                >
                  <Download size={12} />
                </button>
              )}
            </div>
          </button>
          <div className="text-sm text-gray-600 text-center font-medium">
            {estado.label}
          </div>
        </div>
      );
    })}
  </div>

  {/* Lista filtrada con edición de estados y botón de eliminar */}
  {selectedEstado && (
    <div className="mt-6 border-t pt-6">
      <h4 className="text-lg font-semibold text-gray-800 mb-4">
        Leads en estado:{" "}
        <span
          className={`px-3 py-1 rounded-full text-white text-sm ${
            estados[selectedEstado].color
          }`}
        >
          {estados[selectedEstado].label}
        </span>
        {selectedMonth && selectedYear && (
          <span className="ml-2 text-sm text-gray-600">
            - {selectedMonth}/{selectedYear}
          </span>
        )}
      </h4>

      {(() => {
        const teamFilter = ["owner", "director"].includes(currentUser?.role)
          ? selectedTeam
          : undefined;
        
        let filteredLeads = teamFilter && teamFilter !== "todos"
          ? getFilteredLeadsByTeam(teamFilter)
          : getFilteredLeads();
        
        // Aplicar filtro de fecha
        if (selectedMonth && selectedYear) {
          filteredLeads = filteredLeads.filter((lead) => {
            const dateToCheck = dateFilterType === "status_change" 
              ? (lead.last_status_change || lead.fecha || lead.created_at)
              : (lead.fecha || lead.created_at);
            
            if (!dateToCheck) return false;
            
            const leadDate = new Date(dateToCheck);
            const leadMonth = (leadDate.getMonth() + 1).toString().padStart(2, '0');
            const leadYear = leadDate.getFullYear().toString();
            
            return leadMonth === selectedMonth && leadYear === selectedYear;
          });
        }
        
        const leadsFiltrados = filteredLeads.filter(
          (l) => l.estado === selectedEstado
        );

        if (leadsFiltrados.length === 0) {
          return (
            <p className="text-gray-500 text-center py-8">
              No hay leads en estado "{estados[selectedEstado].label}"
              {selectedMonth && selectedYear && ` para ${selectedMonth}/${selectedYear}`}
            </p>
          );
        }

        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Cliente
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Contacto
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Vehículo
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Fuente
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Vendedor
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leadsFiltrados.map((lead) => {
                  const vendedor = lead.vendedor
                    ? userById.get(lead.vendedor)
                    : null;
                  const canReassign =
                    canManageUsers() ||
                    (currentUser?.role === "supervisor" &&
                      lead.vendedor &&
                      getVisibleUsers().some((u: any) => u.id === lead.vendedor));
                  
                  return (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900">
                          {lead.nombre}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center space-x-1">
                          <Phone size={12} className="text-gray-400" />
                          <span className="text-gray-700">{lead.telefono}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div>
                          <div className="font-medium text-gray-900">
                            {lead.modelo}
                          </div>
                          <div className="text-xs text-gray-500">
                            {lead.formaPago}
                          </div>
                          {lead.infoUsado && (
                            <div className="text-xs text-orange-600">
                              Usado: {lead.infoUsado}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={lead.estado}
                          onChange={(e) =>
                            handleUpdateLeadStatus(lead.id, e.target.value)
                          }
                          className={`text-xs font-medium rounded-full px-2 py-1 border-0 text-white ${estados[lead.estado].color}`}
                        >
                          {Object.entries(estados).map(([key, estado]) => (
                            <option key={key} value={key} className="text-black">
                              {estado.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center space-x-1">
                          <span className="text-sm">
                            {fuentes[lead.fuente as string]?.icon || "❓"}
                          </span>
                          <span className="text-xs text-gray-600">
                            {fuentes[lead.fuente as string]?.label ||
                              String(lead.fuente)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-gray-700">
                        <div>
                          {vendedor?.name || "Sin asignar"}
                          {vendedor && !vendedor.active && (
                            <div className="text-xs text-red-600">
                              (Desactivado)
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-gray-500 text-xs">
                        {lead.fecha ? String(lead.fecha).slice(0, 10) : "—"}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {/* Plantilla WhatsApp */}
<button
  onClick={(e) => {
    e.stopPropagation();
    setLeadParaWhatsApp(lead);
    setShowPlantillasModal(true);
  }}
  className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 flex items-center space-x-1"
  title="Enviar WhatsApp con plantilla"
>
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.89 3.587"/>
  </svg>
  <span>💬</span>
</button>

{/* NUEVO: Botón de Notas Internas */}
<button
  onClick={(e) => {
    e.stopPropagation();
    setLeadParaNotas(lead);
    setShowNotasModal(true);
  }}
  className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200 flex items-center space-x-1"
  title="Notas internas del equipo"
>
  <span>📝</span>
  <span className="hidden sm:inline">
    {lead.notasInternas && lead.notasInternas.length > 0 
      ? `(${lead.notasInternas.length})` 
      : ''}
  </span>
</button>
 <button
      onClick={(e) => {
        e.stopPropagation();
        setLeadParaCotizacion(lead);
        setShowCotizadorModal(true);
      }}
      className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center space-x-1"
      title="Cotizar"
    >
      <span>💰</span>
      <span>Cotiz</span>
    </button>
    
    
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirPresupuestoPersonalizado(lead);
                            }}
                            className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200 flex items-center space-x-1"
                            title="Generar presupuesto personalizado"
                          >
                            <FileText size={12} />
                            <span>Presup</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLeadParaRecordatorios(lead);
                              setShowRecordatoriosModal(true);
                            }}
                            className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200 flex items-center space-x-1"
                            title="Ver recordatorios"
                          >
                            <Calendar size={12} />
                            <span className="hidden sm:inline">
                              {lead.recordatorios && lead.recordatorios.length > 0 
                                ? `(${lead.recordatorios.filter(r => !r.completado).length})` 
                                : ''}
                            </span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingLeadObservaciones(lead);
                              setShowObservacionesModal(true);
                            }}
                            className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                            title="Ver/Editar observaciones"
                          >
                            {lead.notas && lead.notas.length > 0 ? "Ver" : "Obs"}
                          </button>
                          {canReassign && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openReassignModal(lead);
                              }}
                              className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                              title="Reasignar lead"
                            >
                              Reasignar
                            </button>
                          )}
                          {canDeleteLeads() && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteLeadConfirm(lead);
                              }}
                              className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                              title="Eliminar lead permanentemente"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSection("leads");
                            }}
                            className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                            title="Ver en tabla completa"
                          >
                            Ver
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  )}
</div>

            {/* Métricas por fuente */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Performance por Fuente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(() => {
                  const teamFilter = ["owner", "director"].includes(currentUser?.role)
                    ? selectedTeam
                    : undefined;
                  return getSourceMetrics(teamFilter).map((item) => (
                    <div key={item.source} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-lg">{item.icon}</span>
                        <span className="font-medium text-gray-900">{item.label}</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Total:</span>
                          <span className="font-semibold">{item.total}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Ventas:</span>
                          <span className="font-semibold text-green-600">{item.vendidos}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Conversión:</span>
                          <span className="font-semibold text-purple-600">
                            {item.conversion}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Sección Leads */}
{activeSection === "leads" && (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h2 className="text-3xl font-bold text-gray-800">Gestión de Leads</h2>
      <div className="flex items-center space-x-3">
        {selectedLeads.size > 0 && (canManageUsers() || currentUser?.role === "supervisor") && (
          <button
            onClick={() => {
              setBulkReassignVendorId(null);
              setShowBulkReassignModal(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <UserCheck size={20} />
            <span>Reasignar {selectedLeads.size} seleccionados</span>
          </button>
        )}
        {canCreateLeads() && (
          <button
            onClick={() => setShowNewLeadModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} />
            <span>Nuevo Lead</span>
          </button>
        )}
      </div>
    </div>

    {/* Barra de búsqueda y filtros */}
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Búsqueda de texto */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por cliente, teléfono, modelo, vendedor, observaciones..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Botón para mostrar/ocultar filtros */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
              showFilters || getActiveFiltersCount() > 0
                ? "bg-blue-100 border-blue-300 text-blue-700"
                : "bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Filter size={20} />
            <span>Filtros</span>
            {getActiveFiltersCount() > 0 && (
              <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                {getActiveFiltersCount()}
              </span>
            )}
          </button>

          {getActiveFiltersCount() > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
            >
              <X size={16} />
              <span>Limpiar</span>
            </button>
          )}

          <div className="text-sm text-gray-600">
            <span className="font-medium">{getFilteredLeadsByDate().length}</span> leads encontrados
          </div>
        </div>
      </div>

      {/* Panel de filtros expandible */}
      {showFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Filtro por vendedor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User size={16} className="inline mr-1" />
                Vendedor
              </label>
              <select
                value={selectedVendedorFilter || ""}
                onChange={(e) => setSelectedVendedorFilter(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los vendedores</option>
                <option value="0">Sin asignar</option>
                {getVisibleUsers()
                  .filter((u: any) => u.role === "vendedor")
                  .map((vendedor: any) => {
                    const leadsCount = leads.filter(l => l.vendedor === vendedor.id).length;
                    return (
                      <option key={vendedor.id} value={vendedor.id}>
                        {vendedor.name} ({leadsCount} leads) {!vendedor.active ? " - Inactivo" : ""}
                      </option>
                    );
                  })}
              </select>
            </div>

            {/* Filtro por estado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado
              </label>
              <select
                value={selectedEstadoFilter}
                onChange={(e) => setSelectedEstadoFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los estados</option>
                {Object.entries(estados).map(([key, estado]) => (
                  <option key={key} value={key}>
                    {estado.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por fuente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fuente
              </label>
              <select
                value={selectedFuenteFilter}
                onChange={(e) => setSelectedFuenteFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas las fuentes</option>
                {Object.entries(fuentes).map(([key, fuente]) => (
                  <option key={key} value={key}>
                    {fuente.icon} {fuente.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Filtrar por fecha
      </label>
      <div className="space-y-2">
        <select
          value={dateFilterType}
          onChange={(e) => setDateFilterType(e.target.value as "created" | "status_change")}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="status_change">Último cambio de estado</option>
          <option value="created">Fecha de creación</option>
        </select>
        
        <div className="flex space-x-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">Todos los meses</option>
            <option value="01">Enero</option>
            <option value="02">Febrero</option>
            <option value="03">Marzo</option>
            <option value="04">Abril</option>
            <option value="05">Mayo</option>
            <option value="06">Junio</option>
            <option value="07">Julio</option>
            <option value="08">Agosto</option>
            <option value="09">Septiembre</option>
            <option value="10">Octubre</option>
            <option value="11">Noviembre</option>
            <option value="12">Diciembre</option>
          </select>
          
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
        </div>
      </div>
    </div>

    {/* Tabla de leads con checkboxes */}
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {(canManageUsers() || currentUser?.role === "supervisor") && (
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedLeads.size === getFilteredLeadsByDate().length && getFilteredLeadsByDate().length > 0}
                    onChange={toggleAllLeads}
                    className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Cliente
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Contacto
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Vehículo
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Estado
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Fuente
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Vendedor
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Fecha
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {getFilteredLeadsByDate().length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  {searchText.trim() || selectedVendedorFilter || selectedEstadoFilter || selectedFuenteFilter
                    ? "No se encontraron leads que coincidan con los filtros aplicados"
                    : "No hay leads para mostrar"}
                </td>
              </tr>
            ) : (
              getFilteredLeadsByDate().map((lead) => {
                const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
                const canReassign =
                  canManageUsers() ||
                  (currentUser?.role === "supervisor" &&
                    lead.vendedor &&
                    getVisibleUsers().some((u: any) => u.id === lead.vendedor));

                return (
                  <tr key={lead.id} className={`hover:bg-gray-50 ${selectedLeads.has(lead.id) ? 'bg-blue-50' : ''}`}>
                    {canReassign && (
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedLeads.has(lead.id)}
                          onChange={() => toggleLeadSelection(lead.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900">{lead.nombre}</div>
                      {lead.created_by && (
                        <div className="text-xs text-gray-500">
                          Creado por: {userById.get(lead.created_by)?.name || 'Usuario eliminado'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center space-x-1">
                        <Phone size={12} className="text-gray-400" />
                        <span className="text-gray-700">{lead.telefono}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{lead.modelo}</div>
                        <div className="text-xs text-gray-500">{lead.formaPago}</div>
                        {lead.infoUsado && (
                          <div className="text-xs text-orange-600">
                            Usado: {lead.infoUsado}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={lead.estado}
                        onChange={(e) =>
                          handleUpdateLeadStatus(lead.id, e.target.value)
                        }
                        className={`text-xs font-medium rounded-full px-2 py-1 border-0 text-white ${estados[lead.estado].color}`}
                      >
                        {Object.entries(estados).map(([key, estado]) => (
                          <option key={key} value={key} className="text-black">
                            {estado.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center space-x-1">
                        <span className="text-sm">
                          {fuentes[lead.fuente as string]?.icon || "❓"}
                        </span>
                        <span className="text-xs text-gray-600">
                          {fuentes[lead.fuente as string]?.label || String(lead.fuente)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-700">
                      <div>
                        {vendedor?.name || "Sin asignar"}
                        {vendedor && !vendedor.active && (
                          <div className="text-xs text-red-600">
                            (Desactivado)
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-500 text-xs">
                      {lead.fecha ? String(lead.fecha).slice(0, 10) : "—"}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        {/* Plantilla WhatsApp */}
<button
  onClick={(e) => {
    e.stopPropagation();
    setLeadParaWhatsApp(lead);
    setShowPlantillasModal(true);
  }}
  className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 flex items-center space-x-1"
  title="Enviar WhatsApp con plantilla"
>
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.89 3.587"/>
  </svg>
  <span>💬</span>
</button>

{/* NUEVO: Botón de Notas Internas */}
<button
  onClick={(e) => {
    e.stopPropagation();
    setLeadParaNotas(lead);
    setShowNotasModal(true);
  }}
  className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200 flex items-center space-x-1"
  title="Notas internas del equipo"
>
  <span>📝</span>
  <span className="hidden sm:inline">
    {lead.notasInternas && lead.notasInternas.length > 0 
      ? `(${lead.notasInternas.length})` 
      : ''}
  </span>
</button>
<button
      onClick={(e) => {
        e.stopPropagation();
        setLeadParaCotizacion(lead);
        setShowCotizadorModal(true);
      }}
      className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center space-x-1"
      title="Cotizar"
    >
      <span>💰</span>
      <span>Cotiz</span>
    </button>
    
                   <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingLeadObservaciones(lead);
                            setShowObservacionesModal(true);
                          }}
                          className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                          title="Ver/Editar observaciones"
                        >
                          {lead.notas && lead.notas.length > 0 ? "Ver" : "Obs"}
                        </button>
                        {canReassign && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openReassignModal(lead);
                            }}
                            className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                            title="Reasignar lead"
                          >
                            Reasignar
                          </button>
                        )}
                        {canDeleteLeads() && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openDeleteLeadConfirm(lead);
                            }}
                            className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                            title="Eliminar lead permanentemente"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingLeadHistorial(lead);
                            setShowHistorialModal(true);
                          }}
                          className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                          title="Ver historial"
                        >
                          Historial
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
)}


{activeSection === "tareas" && (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-3xl font-bold text-gray-800">📋 Mis Tareas Pendientes</h2>
        <p className="text-gray-600 mt-1">
          {tareasPendientes.filter(t => !t.completada).length} tareas requieren tu atención
        </p>
      </div>
      <button
        onClick={() => {
          const tareasGeneradas = generarTareasAutomaticas(getFilteredLeads());
          setTareasPendientes(tareasGeneradas);
        }}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>Actualizar Tareas</span>
      </button>
    </div>

    {/* Resumen rápido */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-red-600">Prioridad Alta</p>
            <p className="text-3xl font-bold text-red-700">
              {tareasPendientes.filter(t => !t.completada && t.prioridad === 'alta').length}
            </p>
          </div>
          <div className="bg-red-500 p-3 rounded-full">
            <Bell className="h-6 w-6 text-white" />
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-yellow-600">Prioridad Media</p>
            <p className="text-3xl font-bold text-yellow-700">
              {tareasPendientes.filter(t => !t.completada && t.prioridad === 'media').length}
            </p>
          </div>
          <div className="bg-yellow-500 p-3 rounded-full">
            <Calendar className="h-6 w-6 text-white" />
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-600">Completadas Hoy</p>
            <p className="text-3xl font-bold text-green-700">
              {tareasPendientes.filter(t => {
                if (!t.completada) return false;
                const hoy = new Date().toISOString().split('T')[0];
                return t.fechaLimite.split('T')[0] === hoy;
              }).length}
            </p>
          </div>
          <div className="bg-green-500 p-3 rounded-full">
            <Trophy className="h-6 w-6 text-white" />
          </div>
        </div>
      </div>
    </div>

    {/* Tareas por prioridad */}
    <div className="space-y-4">
      {['alta', 'media', 'baja'].map(prioridad => {
        const tareasPrioridad = tareasPendientes.filter(
          t => !t.completada && t.prioridad === prioridad
        );
        
        if (tareasPrioridad.length === 0) return null;

        const colorClasses = {
          alta: {
            bg: 'bg-red-50',
            border: 'border-red-200',
            text: 'text-red-900',
            badge: 'bg-red-500',
            icon: '🔴'
          },
          media: {
            bg: 'bg-yellow-50',
            border: 'border-yellow-200',
            text: 'text-yellow-900',
            badge: 'bg-yellow-500',
            icon: '🟡'
          },
          baja: {
            bg: 'bg-blue-50',
            border: 'border-blue-200',
            text: 'text-blue-900',
            badge: 'bg-blue-500',
            icon: '🔵'
          }
        };

        const colors = colorClasses[prioridad as keyof typeof colorClasses];

        return (
          <div key={prioridad} className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className={`${colors.bg} border-b ${colors.border} px-6 py-3`}>
              <h3 className={`font-bold ${colors.text} flex items-center`}>
                <span className="mr-2">{colors.icon}</span>
                Prioridad {prioridad.charAt(0).toUpperCase() + prioridad.slice(1)}
                <span className="ml-2 text-sm">({tareasPrioridad.length})</span>
              </h3>
            </div>

            <div className="divide-y divide-gray-200">
              {tareasPrioridad.map(tarea => {
                const tipoIcons = {
  llamar: '📞',
  whatsapp: '💬',
  email: '📧',
  cotizar: '💰',
  seguimiento: '👁️',
  recuperar_perdido: '🔄' // AGREGAR ESTA LÍNEA
};

                const fechaLimite = new Date(tarea.fechaLimite);
                const ahora = new Date();
                const horasRestantes = (fechaLimite.getTime() - ahora.getTime()) / (1000 * 60 * 60);
                const esUrgente = horasRestantes < 2;
                const esVencida = horasRestantes < 0;

                return (
                  <div
                    key={tarea.id}
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      esVencida ? 'bg-red-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <input
                          type="checkbox"
                          checked={tarea.completada}
                          onChange={() => completarTarea(tarea.id)}
                          className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-lg">{tipoIcons[tarea.tipo]}</span>
                            <span className="font-medium text-gray-900">
                              {tarea.descripcion}
                            </span>
                            {esUrgente && !esVencida && (
                              <span className="px-2 py-0.5 bg-orange-200 text-orange-800 text-xs font-medium rounded-full">
                                ⚡ URGENTE
                              </span>
                            )}
                            {esVencida && (
                              <span className="px-2 py-0.5 bg-red-200 text-red-800 text-xs font-medium rounded-full">
                                ⏰ VENCIDA
                              </span>
                            )}
                          </div>

                          {tarea.lead && (
                            <div className="text-sm text-gray-600 space-y-1">
                              <div className="flex items-center space-x-4">
                                <span>
                                  <strong>Cliente:</strong> {tarea.lead.nombre}
                                </span>
                                <span>
                                  <strong>Tel:</strong> {tarea.lead.telefono}
                                </span>
                                <span>
                                  <strong>Vehículo:</strong> {tarea.lead.modelo}
                                </span>
                              </div>
                              <div>
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white ${
                                    estados[tarea.lead.estado]?.color || 'bg-gray-500'
                                  }`}
                                >
                                  {estados[tarea.lead.estado]?.label || tarea.lead.estado}
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="mt-2 text-xs text-gray-500">
                            <span>
                              {esVencida
                                ? `Venció hace ${Math.abs(Math.floor(horasRestantes))} horas`
                                : horasRestantes < 24
                                ? `Vence en ${Math.floor(horasRestantes)} horas`
                                : `Vence el ${fechaLimite.toLocaleDateString('es-AR')}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Botones de acción rápida */}
                      <div className="flex items-center space-x-2 ml-4">
                        {tarea.tipo === 'llamar' && tarea.lead && (
                          <button
                            onClick={() => {
                              window.location.href = `tel:${tarea.lead?.telefono}`;
                            }}
                            className="px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm"
                            title="Llamar"
                          >
                            📞 Llamar
                          </button>
                        )}
                        {(tarea.tipo === 'whatsapp' || tarea.tipo === 'seguimiento') && tarea.lead && (
                          <button
                            onClick={() => {
                              const phoneNumber = tarea.lead?.telefono.replace(/\D/g, '');
                              const mensaje = encodeURIComponent(
                                `Hola ${tarea.lead?.nombre}, me contacto desde auto del sol`
                              );
                              window.open(`https://wa.me/${phoneNumber}?text=${mensaje}`, '_blank');
                            }}
                            className="px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm"
                            title="WhatsApp"
                          >
                            💬 WhatsApp
                          </button>
                        )}
                        {tarea.tipo === 'cotizar' && tarea.lead && (
                          <button
                            onClick={() => {
                              setLeadParaCotizacion(tarea.lead!);
                              setShowCotizadorModal(true);
                            }}
                            className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-sm"
                            title="Cotizar"
                          >
                            💰 Cotizar
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (tarea.lead) {
                              setActiveSection('leads');
                              // Scroll al lead específico si quieres
                            }
                          }}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                          title="Ver lead"
                        >
                          👁️ Ver
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {tareasPendientes.filter(t => !t.completada).length === 0 && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <Trophy size={64} className="mx-auto text-green-500 mb-4" />
          <h3 className="text-2xl font-bold text-gray-800 mb-2">
            ¡Excelente trabajo!
          </h3>
          <p className="text-gray-600">
            No tienes tareas pendientes en este momento. Sigue así! 🎉
          </p>
        </div>
      )}
    </div>

    {/* Tareas completadas */}
    {tareasPendientes.filter(t => t.completada).length > 0 && (
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-green-50 border-b border-green-200 px-6 py-3">
          <h3 className="font-bold text-green-900 flex items-center">
            <span className="mr-2">✅</span>
            Tareas Completadas
            <span className="ml-2 text-sm">
              ({tareasPendientes.filter(t => t.completada).length})
            </span>
          </h3>
        </div>
        <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
          {tareasPendientes.filter(t => t.completada).map(tarea => (
            <div
              key={tarea.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <span className="text-green-600">✓</span>
                <span className="text-sm text-gray-600 line-through">
                  {tarea.descripcion}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {tarea.lead?.nombre}
              </span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
)}
        {/* Sección Calendario */}
        {activeSection === "calendar" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Calendario</h2>
              <div className="flex items-center space-x-3">
                <select
                  value={selectedCalendarUserId ?? ""}
                  onChange={(e) =>
                    setSelectedCalendarUserId(
                      e.target.value ? parseInt(e.target.value, 10) : null
                    )
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Mi calendario</option>
                  {visibleUsers
                    .filter((u: any) => u.id !== currentUser?.id)
                    .map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {roles[u.role] || u.role}
                      </option>
                    ))}
                </select>
                <button
                  onClick={() => setShowNewEventModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus size={20} />
                  <span>Nuevo Evento</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Próximos eventos -{" "}
                {selectedCalendarUserId
                  ? userById.get(selectedCalendarUserId)?.name
                  : "Mi calendario"}
              </h3>

              {eventsForSelectedUser.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No hay eventos programados
                </p>
              ) : (
                <div className="space-y-3">
                  {eventsForSelectedUser.map((event: any) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div>
                        <h4 className="font-medium text-gray-900">{event.title}</h4>
                        <p className="text-sm text-gray-600">
                          {formatterEs.format(new Date(event.date))} a las {event.time}
                        </p>
                        <p className="text-xs text-gray-500">
                          {userById.get(event.userId)?.name || "Usuario desconocido"}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => deleteEvent(event.id)}
                          className="p-2 text-red-600 hover:text-red-800"
                          title="Eliminar evento"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sección Ranking */}
{activeSection === "ranking" && (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h2 className="text-3xl font-bold text-gray-800">Ranking de Vendedores</h2>
      
      {/* Selector de mes y año para filtrar */}
      <div className="flex items-center space-x-3">
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
        >
          <option value="">Ranking General</option>
          <option value="01">Enero</option>
          <option value="02">Febrero</option>
          <option value="03">Marzo</option>
          <option value="04">Abril</option>
          <option value="05">Mayo</option>
          <option value="06">Junio</option>
          <option value="07">Julio</option>
          <option value="08">Agosto</option>
          <option value="09">Septiembre</option>
          <option value="10">Octubre</option>
          <option value="11">Noviembre</option>
          <option value="12">Diciembre</option>
        </select>
        
        {selectedMonth && (
          <>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
            >
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
            
            <button
              onClick={() => {
                setSelectedMonth("");
                setSelectedYear(new Date().getFullYear().toString());
              }}
              className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center space-x-1"
            >
              <X size={16} />
              <span>Limpiar</span>
            </button>
          </>
        )}
      </div>
    </div>

    {/* Indicador de periodo */}
    {selectedMonth && (
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="text-blue-700" size={20} />
            <span className="text-blue-800 font-semibold">
              Viendo ranking de: {new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>
    )}

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Ranking General - Solo para Owner */}
      {isOwner() && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center justify-between">
            <span>🏆 Ranking General</span>
            {selectedMonth && (
              <span className="text-sm font-normal text-gray-600">
                ({new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1).toLocaleDateString('es-AR', { month: 'short' })})
              </span>
            )}
          </h3>
          <div className="space-y-3">
            {(() => {
              const vendedores = users.filter((u: any) => u.role === "vendedor");
              
              return vendedores
                .map((v: any) => {
                  // Filtrar leads según si hay mes seleccionado
                  let vendedorLeads = leads.filter((l) => l.vendedor === v.id);
                  
                  if (selectedMonth && selectedYear) {
                    vendedorLeads = vendedorLeads.filter((lead) => {
                      const dateToCheck = lead.last_status_change || lead.fecha || lead.created_at;
                      if (!dateToCheck) return false;
                      
                      const leadDate = new Date(dateToCheck);
                      const leadMonth = (leadDate.getMonth() + 1).toString().padStart(2, '0');
                      const leadYear = leadDate.getFullYear().toString();
                      
                      return leadMonth === selectedMonth && leadYear === selectedYear;
                    });
                  }
                  
                  const ventas = vendedorLeads.filter((l) => l.estado === "vendido").length;
                  const leadsAsignados = vendedorLeads.length;
                  
                  return {
                    id: v.id,
                    nombre: v.name,
                    ventas,
                    leadsAsignados,
                    team: `Equipo de ${userById.get(v.reportsTo)?.name || "—"}`,
                  };
                })
                .sort((a, b) => b.ventas - a.ventas)
                .map((vendedor, index) => (
                  <div
                    key={vendedor.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                          index === 0
                            ? "bg-yellow-500"
                            : index === 1
                            ? "bg-gray-400"
                            : index === 2
                            ? "bg-orange-600"
                            : "bg-gray-300"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {vendedor.nombre}
                        </p>
                        <p className="text-xs text-gray-500">{vendedor.team}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">
                        {vendedor.ventas} ventas
                      </p>
                      <p className="text-xs text-gray-500">
                        {vendedor.leadsAsignados} leads
                      </p>
                    </div>
                  </div>
                ));
            })()}
          </div>
          {users.filter((u: any) => u.role === "vendedor").length === 0 && (
            <p className="text-gray-500 text-center py-8">
              No hay vendedores registrados
            </p>
          )}
        </div>
      )}

      {/* Ranking en Mi Scope / Vendedores de la misma gerencia */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center justify-between">
          <span>
            {currentUser?.role === "vendedor" 
              ? "🎯 Ranking Vendedores" 
              : isOwner() 
              ? "📊 Mi Scope" 
              : "📊 Ranking"}
          </span>
          {selectedMonth && (
            <span className="text-sm font-normal text-gray-600">
              ({new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1).toLocaleDateString('es-AR', { month: 'short' })})
            </span>
          )}
        </h3>
        <div className="space-y-3">
          {(() => {
            const rankingData = currentUser?.role === "vendedor" 
              ? getRankingByManagerialTeam() 
              : getRankingInScope();
            
            // Filtrar por mes si está seleccionado
            if (selectedMonth && selectedYear) {
              return rankingData
                .map((vendedor) => {
                  const vendedorLeads = leads
                    .filter((l) => l.vendedor === vendedor.id)
                    .filter((lead) => {
                      const dateToCheck = lead.last_status_change || lead.fecha || lead.created_at;
                      if (!dateToCheck) return false;
                      
                      const leadDate = new Date(dateToCheck);
                      const leadMonth = (leadDate.getMonth() + 1).toString().padStart(2, '0');
                      const leadYear = leadDate.getFullYear().toString();
                      
                      return leadMonth === selectedMonth && leadYear === selectedYear;
                    });
                  
                  const ventas = vendedorLeads.filter((l) => l.estado === "vendido").length;
                  
                  return {
                    ...vendedor,
                    ventas,
                    leadsAsignados: vendedorLeads.length,
                  };
                })
                .sort((a, b) => b.ventas - a.ventas)
                .map((vendedor, index) => (
                  <div
                    key={vendedor.id}
                    className={`flex items-center justify-between p-4 border border-gray-200 rounded-lg ${
                      vendedor.id === currentUser?.id ? "bg-blue-50 border-blue-300" : ""
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                          index === 0
                            ? "bg-yellow-500"
                            : index === 1
                            ? "bg-gray-400"
                            : index === 2
                            ? "bg-orange-600"
                            : "bg-gray-300"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <p className={`font-medium ${
                          vendedor.id === currentUser?.id ? "text-blue-900" : "text-gray-900"
                        }`}>
                          {vendedor.nombre}
                          {vendedor.id === currentUser?.id && (
                            <span className="ml-2 text-xs text-blue-600 font-normal">(Tú)</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">{vendedor.team}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">
                        {vendedor.ventas} ventas
                      </p>
                      <p className="text-xs text-gray-500">
                        {vendedor.leadsAsignados} leads •{" "}
                        {vendedor.leadsAsignados > 0
                          ? ((vendedor.ventas / vendedor.leadsAsignados) * 100).toFixed(0)
                          : 0}
                        %
                      </p>
                    </div>
                  </div>
                ));
            }
            
            // Ranking sin filtro de mes (general)
            return rankingData.map((vendedor, index) => (
              <div
                key={vendedor.id}
                className={`flex items-center justify-between p-4 border border-gray-200 rounded-lg ${
                  vendedor.id === currentUser?.id ? "bg-blue-50 border-blue-300" : ""
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                      index === 0
                        ? "bg-yellow-500"
                        : index === 1
                        ? "bg-gray-400"
                        : index === 2
                        ? "bg-orange-600"
                        : "bg-gray-300"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <p className={`font-medium ${
                      vendedor.id === currentUser?.id ? "text-blue-900" : "text-gray-900"
                    }`}>
                      {vendedor.nombre}
                      {vendedor.id === currentUser?.id && (
                        <span className="ml-2 text-xs text-blue-600 font-normal">(Tú)</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{vendedor.team}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">
                    {vendedor.ventas} ventas
                  </p>
                  <p className="text-xs text-gray-500">
                    {vendedor.leadsAsignados} leads •{" "}
                    {vendedor.leadsAsignados > 0
                      ? ((vendedor.ventas / vendedor.leadsAsignados) * 100).toFixed(0)
                      : 0}
                    %
                  </p>
                </div>
              </div>
            ));
          })()}
        </div>
        {(currentUser?.role === "vendedor" 
          ? getRankingByManagerialTeam() 
          : getRankingInScope()
        ).length === 0 && (
          <p className="text-gray-500 text-center py-8">
            {currentUser?.role === "vendedor" 
              ? "No hay otros vendedores en tu gerencia"
              : "No hay vendedores en tu scope"}
          </p>
        )}
      </div>
    </div>

    {/* Estadísticas adicionales del periodo */}
    {selectedMonth && (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">
          📈 Estadísticas del Periodo
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(() => {
            let filteredLeads = getFilteredLeads();
            
            if (selectedMonth && selectedYear) {
              filteredLeads = filteredLeads.filter((lead) => {
                const dateToCheck = lead.last_status_change || lead.fecha || lead.created_at;
                if (!dateToCheck) return false;
                
                const leadDate = new Date(dateToCheck);
                const leadMonth = (leadDate.getMonth() + 1).toString().padStart(2, '0');
                const leadYear = leadDate.getFullYear().toString();
                
                return leadMonth === selectedMonth && leadYear === selectedYear;
              });
            }
            
            const totalLeads = filteredLeads.length;
            const totalVentas = filteredLeads.filter(l => l.estado === 'vendido').length;
            const conversion = totalLeads > 0 ? ((totalVentas / totalLeads) * 100).toFixed(1) : '0';
            const vendedoresActivos = new Set(filteredLeads.map(l => l.vendedor).filter(Boolean)).size;
            
            return (
              <>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total Leads</p>
                  <p className="text-3xl font-bold text-blue-600">{totalLeads}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Ventas</p>
                  <p className="text-3xl font-bold text-green-600">{totalVentas}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Conversión</p>
                  <p className="text-3xl font-bold text-purple-600">{conversion}%</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Vendedores Activos</p>
                  <p className="text-3xl font-bold text-orange-600">{vendedoresActivos}</p>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    )}
  </div>
)}
        {/* Sección Alertas */}
        {activeSection === "alerts" && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">
              Mis Alertas y Notificaciones
            </h2>
            
            {/* Componente de Push Notifications */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <PushNotificationSettings />
            </div>

            {/* Alertas del sistema */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center justify-between">
                <span>📬 Alertas Recientes</span>
                {alerts.filter(a => a.userId === currentUser?.id && !a.read).length > 0 && (
                  <span className="text-sm bg-red-500 text-white px-3 py-1 rounded-full">
                    {alerts.filter(a => a.userId === currentUser?.id && !a.read).length} sin leer
                  </span>
                )}
              </h3>
              
              {alerts.filter(a => a.userId === currentUser?.id).length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Bell size={48} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No tienes alertas en este momento</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Aquí aparecerán notificaciones de nuevos leads, cambios de ranking y más
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts
                    .filter(a => a.userId === currentUser?.id)
                    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
                    .slice(0, 20)
                    .map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-4 border-l-4 rounded-lg transition-all ${
                          alert.read
                            ? "border-gray-300 bg-gray-50"
                            : "border-blue-500 bg-blue-50 shadow-sm"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <div className={`mt-1 ${
                              alert.type === "lead_assigned" ? "text-green-600" : "text-orange-600"
                            }`}>
                              {alert.type === "lead_assigned" ? (
                                <UserCheck size={20} />
                              ) : (
                                <Trophy size={20} />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className={`text-sm ${
                                alert.read ? "text-gray-600" : "text-gray-900 font-medium"
                              }`}>
                                {alert.message}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(alert.ts).toLocaleString("es-AR", {
                                  day: '2-digit',
                                  month: 'long',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 ml-3">
                            {!alert.read && (
                              <button
                                onClick={() => {
                                  setAlerts(prev =>
                                    prev.map(a =>
                                      a.id === alert.id ? { ...a, read: true } : a
                                    )
                                  );
                                }}
                                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                              >
                                ✓ Marcar leída
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Botón para marcar todas como leídas */}
              {alerts.filter(a => a.userId === currentUser?.id && !a.read).length > 0 && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => {
                      setAlerts(prev =>
                        prev.map(a =>
                          a.userId === currentUser?.id ? { ...a, read: true } : a
                        )
                      );
                    }}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    ✓ Marcar todas como leídas
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Sección Mi Equipo */}
        {activeSection === "team" &&
          ["supervisor", "gerente", "director", "owner"].includes(currentUser?.role) && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-gray-800">Mi Equipo</h2>
                {["owner", "director"].includes(currentUser?.role) && (
                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="todos">Todos los equipos</option>
                    {users
                      .filter((u: any) => u.role === "gerente")
                      .map((gerente: any) => (
                        <option key={gerente.id} value={gerente.id.toString()}>
                          Equipo {gerente.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              {/* Panel de Debug solo para Owner/Director */}
              {["owner", "director"].includes(currentUser?.role) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <details>
                    <summary className="cursor-pointer font-semibold text-yellow-800 mb-2">
                      🔧 Panel de Depuración - Jerarquía
                    </summary>
                    <div className="text-xs space-y-2 mt-3">
                      <div>
                        <strong>Tu información:</strong>
                        <div className="ml-4">Nombre: {currentUser?.name}</div>
                        <div className="ml-4">Rol: {currentUser?.role}</div>
                        <div className="ml-4">IDs visibles: {visibleUserIds.join(', ')}</div>
                      </div>
                      <div className="border-t pt-2 mt-2">
                        <strong>Jerarquía completa:</strong>
                        {users.filter((u: any) => u.role === "gerente").map((gerente: any) => {
                          const gerenteChildren = childrenIndex.get(gerente.id) || [];
                          return (
                            <div key={gerente.id} className="ml-4 mt-2">
                              <div className="font-semibold">👔 {gerente.name} (Gerente)</div>
                              {gerenteChildren.map((supId: number) => {
                                const supervisor = userById.get(supId);
                                const supChildren = childrenIndex.get(supId) || [];
                                const supLeads = leads.filter(l => l.vendedor === supId || supChildren.includes(l.vendedor || 0));
                                return (
                                  <div key={supId} className="ml-4">
                                    <div>👨‍💼 {supervisor?.name} ({supervisor?.role}) - {supLeads.length} leads</div>
                                    {supChildren.map((vendId: number) => {
                                      const vendedor = userById.get(vendId);
                                      const vendLeads = leads.filter(l => l.vendedor === vendId);
                                      return (
                                        <div key={vendId} className="ml-4">
                                          👤 {vendedor?.name} ({vendedor?.role}) - {vendLeads.length} leads
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </details>
                </div>
              )}

              {/* Estadísticas por estado tipo dashboard */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-800">
                    Estados de Leads - Mi Equipo
                  </h3>
                  {selectedEstado && (
                    <button
                      onClick={() => setSelectedEstado(null)}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                    >
                      <X size={16} />
                      <span>Cerrar filtro</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Object.entries(estados).map(([key, estado]) => {
  const teamFilter = ["owner", "director"].includes(currentUser?.role)
    ? selectedTeam
    : undefined;
  let filteredLeads = getFilteredLeadsByTeam(teamFilter);
  
  // Aplicar filtro de fecha
  if (selectedMonth && selectedYear) {
    filteredLeads = filteredLeads.filter((lead) => {
      const dateToCheck = dateFilterType === "status_change" 
        ? (lead.last_status_change || lead.fecha || lead.created_at)
        : (lead.fecha || lead.created_at);
      
      if (!dateToCheck) return false;
      
      const leadDate = new Date(dateToCheck);
      const leadMonth = (leadDate.getMonth() + 1).toString().padStart(2, '0');
      const leadYear = leadDate.getFullYear().toString();
      
      return leadMonth === selectedMonth && leadYear === selectedYear;
    });
  }
  
  const count = filteredLeads.filter((l) => l.estado === key).length;
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedEstado(selectedEstado === key ? null : key)}
                        className={`text-center transition-all duration-200 transform hover:scale-105 ${
                          selectedEstado === key ? "ring-4 ring-blue-300 ring-opacity-50" : ""
                        }`}
                        title={`Ver todos los leads en estado: ${estado.label}`}
                      >
                        <div className={`${estado.color} text-white rounded-lg p-4 mb-2 hover:opacity-90`}>
                          <div className="text-2xl font-bold">{count}</div>
                        </div>
                        <div className="text-sm text-gray-600">{estado.label}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Lista filtrada de leads por estado en Mi Equipo */}
                {selectedEstado && (
                  <div className="mt-6 border-t pt-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">
                      Leads de mi equipo en estado:{" "}
                      <span
                        className={`px-3 py-1 rounded-full text-white text-sm ${
                          estados[selectedEstado].color
                        }`}
                      >
                        {estados[selectedEstado].label}
                      </span>
                    </h4>

                    {(() => {
                      const teamFilter = ["owner", "director"].includes(currentUser?.role)
                        ? selectedTeam
                        : undefined;
                      const filteredLeads = getFilteredLeadsByTeam(teamFilter);
                      const leadsFiltrados = filteredLeads.filter(
                        (l) => l.estado === selectedEstado
                      );

                      if (leadsFiltrados.length === 0) {
                        return (
                          <p className="text-gray-500 text-center py-8">
                            No hay leads de tu equipo en estado "
                            {estados[selectedEstado].label}"
                          </p>
                        );
                      }

                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Cliente
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Contacto
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Vehículo
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Estado
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Fuente
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Vendedor
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Fecha
                                </th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                                  Acciones
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {leadsFiltrados.map((lead) => {
                                const vendedor = lead.vendedor
                                  ? userById.get(lead.vendedor)
                                  : null;
                                return (
                                  <tr key={lead.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2">
                                      <div className="font-medium text-gray-900">
                                        {lead.nombre}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2">
                                      <div className="flex items-center space-x-1">
                                        <Phone size={12} className="text-gray-400" />
                                        <span className="text-gray-700">{lead.telefono}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2">
                                      <div>
                                        <div className="font-medium text-gray-900">
                                          {lead.modelo}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {lead.formaPago}
                                        </div>
                                        {lead.infoUsado && (
                                          <div className="text-xs text-orange-600">
                                            Usado: {lead.infoUsado}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2">
                                      <select
                                        value={lead.estado}
                                        onChange={(e) =>
                                          handleUpdateLeadStatus(lead.id, e.target.value)
                                        }
                                        className={`text-xs font-medium rounded-full px-2 py-1 border-0 text-white ${estados[lead.estado].color}`}
                                      >
                                        {Object.entries(estados).map(([key, estado]) => (
                                          <option key={key} value={key} className="text-black">
                                            {estado.label}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="px-4 py-2">
                                      <div className="flex items-center space-x-1">
                                        <span className="text-sm">
                                          {fuentes[lead.fuente as string]?.icon || "❓"}
                                        </span>
                                        <span className="text-xs text-gray-600">
                                          {fuentes[lead.fuente as string]?.label ||
                                            String(lead.fuente)}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 text-gray-700">
                                      {vendedor?.name || "Sin asignar"}
                                    </td>
                                    <td className="px-4 py-2 text-gray-500 text-xs">
                                      {lead.fecha ? String(lead.fecha).slice(0, 10) : "—"}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      <div className="flex items-center justify-center space-x-1">
                                        {/* Plantilla WhatsApp */}
<button
  onClick={(e) => {
    e.stopPropagation();
    setLeadParaWhatsApp(lead);
    setShowPlantillasModal(true);
  }}
  className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 flex items-center space-x-1"
  title="Enviar WhatsApp con plantilla"
>
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.89 3.587"/>
  </svg>
  <span>💬</span>
</button>

{/* NUEVO: Botón de Notas Internas */}
<button
  onClick={(e) => {
    e.stopPropagation();
    setLeadParaNotas(lead);
    setShowNotasModal(true);
  }}
  className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200 flex items-center space-x-1"
  title="Notas internas del equipo"
>
  <span>📝</span>
  <span className="hidden sm:inline">
    {lead.notasInternas && lead.notasInternas.length > 0 
      ? `(${lead.notasInternas.length})` 
      : ''}
  </span>
</button>
 <button
      onClick={(e) => {
        e.stopPropagation();
        setLeadParaCotizacion(lead);
        setShowCotizadorModal(true);
      }}
      className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center space-x-1"
      title="Cotizar"
    >
      <span>💰</span>
      <span>Cotiz</span>
    </button>
    
    <button
      onClick={(e) => {
        e.stopPropagation();
        abrirPresupuestoPersonalizado(lead);
      }}
      className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200 flex items-center space-x-1"
      title="Generar presupuesto personalizado"
    >
      <FileText size={12} />
      <span>Presup</span>
    </button>
    
                                        <button
  onClick={(e) => {
    e.stopPropagation();
    abrirPresupuestoPersonalizado(lead);
  }}
  className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200 flex items-center space-x-1"
  title="Generar presupuesto personalizado"
>
  <FileText size={12} />
  <span>Presup</span>
</button>

                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingLeadObservaciones(lead);
                                            setShowObservacionesModal(true);
                                          }}
                                          className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                                          title="Ver/Editar observaciones"
                                        >
                                          {lead.notas && lead.notas.length > 0 ? "Ver" : "Obs"}
                                        </button>
                                        {(canManageUsers() ||
                                          (currentUser?.role === "supervisor" &&
                                            lead.vendedor &&
                                            getVisibleUsers().some(
                                              (u: any) => u.id === lead.vendedor
                                            ))) && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openReassignModal(lead);
                                            }}
                                            className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                                            title="Reasignar lead"
                                          >
                                            Reasignar
                                          </button>
                                        )}
                                        {canDeleteLeads() && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openDeleteLeadConfirm(lead);
                                            }}
                                            className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                                            title="Eliminar lead permanentemente"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        )}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveSection("leads");
                                          }}
                                          className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                                          title="Ver en tabla completa"
                                        >
                                          Ver
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Top vendedores en mi organización */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  Top Vendedores en Mi Organización
                </h3>
                <div className="space-y-3">
                  {(() => {
                    const teamFilter = ["owner", "director"].includes(currentUser?.role)
                      ? selectedTeam
                      : undefined;
                    const filteredLeads = getFilteredLeadsByTeam(teamFilter);
                    
                    const vendedoresEnScope = users.filter(
                      (u: any) => u.role === "vendedor" && visibleUserIds.includes(u.id)
                    );
                    
                    const ranking = vendedoresEnScope
                      .map((v: any) => {
                        const vendedorLeads = filteredLeads.filter((l) => l.vendedor === v.id);
                        const ventas = vendedorLeads.filter((l) => l.estado === "vendido").length;
                        return {
                          id: v.id,
                          nombre: v.name,
                          ventas,
                          leadsAsignados: vendedorLeads.length,
                          team: `Equipo de ${userById.get(v.reportsTo)?.name || "—"}`,
                        };
                      })
                      .sort((a, b) => b.ventas - a.ventas);
                    
                    return ranking.map((vendedor, index) => (
                      <div
                        key={vendedor.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                              index === 0
                                ? "bg-yellow-500"
                                : index === 1
                                ? "bg-gray-400"
                                : index === 2
                                ? "bg-orange-600"
                                : "bg-gray-300"
                            }`}
                          >
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {vendedor.nombre}
                            </p>
                            <p className="text-xs text-gray-500">{vendedor.team}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">
                            {vendedor.ventas} ventas
                          </p>
                          <p className="text-xs text-gray-500">
                            {vendedor.leadsAsignados} leads •{" "}
                            {vendedor.leadsAsignados > 0
                              ? ((vendedor.ventas / vendedor.leadsAsignados) * 100).toFixed(0)
                              : 0}
                            %
                          </p>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
                {(() => {
                  const vendedoresEnScope = users.filter(
                    (u: any) => u.role === "vendedor" && visibleUserIds.includes(u.id)
                  );
                  return vendedoresEnScope.length === 0 && (
                    <p className="text-gray-500 text-center py-8">
                      No hay vendedores en tu equipo
                    </p>
                  );
                })()}
              </div>
            </div>
          )}
        {/* Sección Asignar Tareas - Para Superiores */}
{activeSection === "asignar_tareas" && (["supervisor", "gerente", "director", "owner"].includes(currentUser?.role)) && (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-3xl font-bold text-gray-800">📋 Gestión de Tareas del Equipo</h2>
        <p className="text-gray-600 mt-1">
          Tareas que asignaste a tu equipo de vendedores
        </p>
      </div>
      
      {/* Botón para asignar nueva tarea */}
      <button
        onClick={() => {
          setShowSeleccionarLeadModal(true);
        }}
        className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 shadow-lg font-medium transition-all"
      >
        <Plus size={20} />
        <span>Asignar Nueva Tarea</span>
      </button>
    </div>

    {/* Resumen */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {(() => {
        const tareasCreadas = tareasPendientes.filter(t => t.createdBy === currentUser?.id);
        const tareasActivas = tareasCreadas.filter(t => !t.completada);
        const tareasCompletadas = tareasCreadas.filter(t => t.completada);
        const tareasVencidas = tareasActivas.filter(t => new Date(t.fechaLimite) < new Date());

        return (
          <>
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Asignadas</p>
                  <p className="text-3xl font-bold text-blue-600">{tareasCreadas.length}</p>
                </div>
                <div className="bg-blue-500 p-3 rounded-full">
                  <Bell className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pendientes</p>
                  <p className="text-3xl font-bold text-orange-600">{tareasActivas.length}</p>
                </div>
                <div className="bg-orange-500 p-3 rounded-full">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completadas</p>
                  <p className="text-3xl font-bold text-green-600">{tareasCompletadas.length}</p>
                </div>
                <div className="bg-green-500 p-3 rounded-full">
                  <Trophy className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Vencidas</p>
                  <p className="text-3xl font-bold text-red-600">{tareasVencidas.length}</p>
                </div>
                <div className="bg-red-500 p-3 rounded-full">
                  <X className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>

    {/* Mensaje si no hay tareas */}
    {tareasPendientes.filter(t => t.createdBy === currentUser?.id).length === 0 ? (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <div className="mb-6">
          <Bell size={64} className="mx-auto text-gray-300" />
        </div>
        <h3 className="text-2xl font-bold text-gray-800 mb-2">
          No has asignado tareas aún
        </h3>
        <p className="text-gray-600 mb-6">
          Comienza asignando tareas a tu equipo para mejorar el seguimiento de leads
        </p>
        <button
          onClick={() => {
            setShowSeleccionarLeadModal(true);
          }}
          className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 shadow-lg font-medium transition-all"
        >
          <Plus size={20} />
          <span>Asignar Primera Tarea</span>
        </button>
      </div>
    ) : (
      /* Tabla de tareas asignadas */
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-800">Tareas Asignadas por Ti</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Vendedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Lead
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tarea
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Prioridad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Vencimiento
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tareasPendientes
                .filter(t => t.createdBy === currentUser?.id)
                .sort((a, b) => {
                  // Ordenar: pendientes primero, luego por fecha
                  if (a.completada !== b.completada) return a.completada ? 1 : -1;
                  return new Date(a.fechaLimite).getTime() - new Date(b.fechaLimite).getTime();
                })
                .map(tarea => {
                  const vendedor = userById.get(tarea.asignadoA);
                  const fechaVencimiento = new Date(tarea.fechaLimite);
                  const ahora = new Date();
                  const esVencida = fechaVencimiento < ahora && !tarea.completada;
                  const esUrgente = (fechaVencimiento.getTime() - ahora.getTime()) < (24 * 60 * 60 * 1000) && !tarea.completada;

                  return (
                    <tr key={tarea.id} className={tarea.completada ? 'bg-gray-50 opacity-60' : ''}>
                      <td className="px-6 py-4">
                        {tarea.completada ? (
                          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                            ✓ Completada
                          </span>
                        ) : esVencida ? (
                          <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                            ⏰ Vencida
                          </span>
                        ) : esUrgente ? (
                          <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                            ⚡ Urgente
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            📋 Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-xs">
                              {vendedor?.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)}
                            </span>
                          </div>
                          <span className="font-medium text-gray-900">{vendedor?.name || 'Usuario eliminado'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {tarea.lead ? (
                          <div>
                            <p className="font-medium text-gray-900">{tarea.lead.nombre}</p>
                            <p className="text-xs text-gray-500">{tarea.lead.telefono}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400">Lead eliminado</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className={`text-sm ${tarea.completada ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {tarea.descripcion}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Tipo: {tarea.tipo.replace(/_/g, ' ')}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          tarea.prioridad === 'alta' ? 'bg-red-100 text-red-800' :
                          tarea.prioridad === 'media' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {tarea.prioridad === 'alta' ? '🔴' : tarea.prioridad === 'media' ? '🟡' : '🔵'} {tarea.prioridad}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {fechaVencimiento.toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => {
                            if (confirm('¿Eliminar esta tarea?')) {
                              setTareasPendientes(prev => prev.filter(t => t.id !== tarea.id));
                            }
                          }}
                          className="p-1 text-red-600 hover:text-red-800"
                          title="Eliminar tarea"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
)}

        {/* Sección Análisis Diario - Solo Owner */}
  {activeSection === "analytics" && (isOwner() || currentUser?.role === "director") && (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h2 className="text-3xl font-bold text-gray-800">Análisis Diario de Leads</h2>
      <div className="flex items-center space-x-3">
        {/* Selector de equipo */}
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="todos">📊 Todos los equipos</option>
          {users
            .filter((u: any) => u.role === "gerente")
            .map((gerente: any) => {
              const teamUserIds = getTeamUserIds(gerente.id.toString());
              const teamLeads = leads.filter(l => l.vendedor && teamUserIds.includes(l.vendedor));
              return (
                <option key={gerente.id} value={gerente.id.toString()}>
                  👔 Equipo {gerente.name} ({teamLeads.length} leads total)
                </option>
              );
            })}
        </select>

        <button
          onClick={() => {
            const analytics = getDailyAnalytics(leads, selectedTeam);
            const teamName = selectedTeam === "todos" 
              ? "Todos" 
              : users.find((u: any) => u.id.toString() === selectedTeam)?.name || "Equipo";
            
            const csvContent = [
              ['Fecha', 'Total Leads', 'Nuevos', 'Convertidos', 'Tasa Conversión', ...Object.keys(fuentes).map(k => fuentes[k].label)].join(','),
              ...analytics.map(day => {
                const conversion = day.newLeads > 0 ? ((day.converted / day.newLeads) * 100).toFixed(1) : '0';
                return [
                  day.date,
                  day.total,
                  day.newLeads,
                  day.converted,
                  conversion + '%',
                  ...Object.keys(fuentes).map(k => day.bySource[k] || 0)
                ].join(',');
              })
            ].join('\n');
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `analisis_${teamName}_${new Date().toISOString().slice(0,10)}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Download size={20} />
          <span>Descargar CSV</span>
        </button>
      </div>
    </div>

    {/* Indicador de equipo seleccionado */}
    {selectedTeam !== "todos" && (
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-blue-800 font-semibold">
              👔 Viendo análisis de: Equipo {users.find((u: any) => u.id.toString() === selectedTeam)?.name}
            </span>
          </div>
          <button
            onClick={() => setSelectedTeam("todos")}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
          >
            <X size={16} />
            <span>Ver todos</span>
          </button>
        </div>
      </div>
    )}

    {/* Resumen general */}
<div className="grid grid-cols-1 md:grid-cols-4 gap-6">
  {(() => {
    const hoy = new Date().toISOString().split('T')[0];
    const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const analytics = getDailyAnalytics(leads, selectedTeam);
    
    const dataHoy = analytics.find(d => d.date === hoy) || { newLeads: 0, converted: 0, total: 0 };
    const dataAyer = analytics.find(d => d.date === ayer) || { newLeads: 0, converted: 0, total: 0 };
    const ultimos7Dias = analytics.slice(0, 7).reduce((sum, d) => sum + d.newLeads, 0);
    
    const mesActual = new Date().getMonth();
    const anioActual = new Date().getFullYear();
    const leadsMesActual = analytics.filter(d => {
      const fecha = new Date(d.date);
      return fecha.getMonth() === mesActual && fecha.getFullYear() === anioActual;
    }).reduce((sum, d) => sum + d.newLeads, 0);
    
    const nombreMes = new Date().toLocaleDateString('es-AR', { month: 'long' });
    const diaActual = new Date().getDate();
    
    return (
      <>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Hoy</p>
              <p className="text-3xl font-bold text-blue-600">{dataHoy.newLeads}</p>
              <p className="text-xs text-gray-500 mt-1">
                {dataHoy.converted} convertidos ({dataHoy.newLeads > 0 ? ((dataHoy.converted / dataHoy.newLeads) * 100).toFixed(0) : 0}%)
              </p>
            </div>
            <div className="bg-blue-500 p-3 rounded-full">
              <Calendar className="h-6 w-6 text-white" />
            </div>
          </div>
          {dataAyer.newLeads > 0 && (
            <div className="mt-2 flex items-center text-xs">
              {dataHoy.newLeads > dataAyer.newLeads ? (
                <span className="text-green-600">↑ +{dataHoy.newLeads - dataAyer.newLeads} vs ayer</span>
              ) : dataHoy.newLeads < dataAyer.newLeads ? (
                <span className="text-red-600">↓ {dataAyer.newLeads - dataHoy.newLeads} vs ayer</span>
              ) : (
                <span className="text-gray-600">= igual que ayer</span>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ayer</p>
              <p className="text-3xl font-bold text-purple-600">{dataAyer.newLeads}</p>
              <p className="text-xs text-gray-500 mt-1">
                {dataAyer.converted} convertidos
              </p>
            </div>
            <div className="bg-purple-500 p-3 rounded-full">
              <Users className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ultimos 7 dias</p>
              <p className="text-3xl font-bold text-orange-600">{ultimos7Dias}</p>
              <p className="text-xs text-gray-500 mt-1">
                Promedio: {(ultimos7Dias / 7).toFixed(1)}/dia
              </p>
            </div>
            <div className="bg-orange-500 p-3 rounded-full">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 capitalize">
                {nombreMes}
              </p>
              <p className="text-3xl font-bold text-green-600">{leadsMesActual}</p>
              <p className="text-xs text-gray-500 mt-1">
                Promedio: {(leadsMesActual / diaActual).toFixed(1)}/dia
              </p>
            </div>
            <div className="bg-green-500 p-3 rounded-full">
              <Trophy className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </>
    );
  })()}
</div>

    {/* Comparativa entre equipos - Solo cuando está en "todos" */}
    {selectedTeam === "todos" && users.filter((u: any) => u.role === "gerente").length > 0 && (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">
          📊 Comparativa de Equipos - Últimos 7 Días
        </h3>
        <div className="space-y-4">
          {users
            .filter((u: any) => u.role === "gerente")
            .map((gerente: any) => {
              const teamAnalytics = getDailyAnalytics(leads, gerente.id.toString());
              const last7Days = teamAnalytics.slice(0, 7);
              const totalLeads = last7Days.reduce((sum, d) => sum + d.newLeads, 0);
              const totalConverted = last7Days.reduce((sum, d) => sum + d.converted, 0);
              const conversion = totalLeads > 0 ? ((totalConverted / totalLeads) * 100).toFixed(1) : '0';
              
              // Calcular máximo para la barra
              const maxLeads = Math.max(
                ...users
                  .filter((u: any) => u.role === "gerente")
                  .map((g: any) => {
                    const analytics = getDailyAnalytics(leads, g.id.toString());
                    return analytics.slice(0, 7).reduce((sum, d) => sum + d.newLeads, 0);
                  })
              );
              
              const percentage = maxLeads > 0 ? (totalLeads / maxLeads) * 100 : 0;
              
              return (
                <div key={gerente.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {gerente.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">Equipo {gerente.name}</p>
                        <p className="text-xs text-gray-500">
                          {getTeamUserIds(gerente.id.toString()).length} vendedores
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">{totalLeads}</p>
                      <p className="text-xs text-gray-500">leads últimos 7 días</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-blue-500 h-3 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <div>
                        <span className="text-gray-600">Promedio diario: </span>
                        <span className="font-semibold text-gray-900">
                          {(totalLeads / 7).toFixed(1)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Convertidos: </span>
                        <span className="font-semibold text-green-600">
                          {totalConverted} ({conversion}%)
                        </span>
                      </div>
                    </div>
                    
                    {/* Mini gráfico de 7 días */}
                    <div className="grid grid-cols-7 gap-1 mt-2">
                      {last7Days.map(day => {
                        const maxInWeek = Math.max(...last7Days.map(d => d.newLeads));
                        const height = maxInWeek > 0 ? (day.newLeads / maxInWeek) * 100 : 0;
                        
                        return (
                          <div key={day.date} className="text-center">
                            <div className="h-12 flex flex-col justify-end">
                              <div
                                className="bg-blue-400 rounded-t"
                                style={{ height: `${height}%`, minHeight: day.newLeads > 0 ? '4px' : '0' }}
                                title={`${day.newLeads} leads`}
                              />
                            </div>
                            <div className="text-[10px] text-gray-500 mt-1">
                              {new Date(day.date).toLocaleDateString('es-AR', { day: '2-digit' })}
                            </div>
                            <div className="text-xs font-medium text-gray-900">
                              {day.newLeads}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setSelectedTeam(gerente.id.toString())}
                    className="mt-3 w-full text-sm text-blue-600 hover:text-blue-800 font-medium py-2 border border-blue-200 rounded hover:bg-blue-50 transition-colors"
                  >
                    Ver análisis detallado →
                  </button>
                </div>
              );
            })}
        </div>
      </div>
    )}

    {/* Gráfico de barras simple con días */}
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">
        Leads Ingresados - Últimos 30 Días
        {selectedTeam !== "todos" && (
          <span className="text-base font-normal text-gray-600 ml-2">
            (Equipo {users.find((u: any) => u.id.toString() === selectedTeam)?.name})
          </span>
        )}
      </h3>
      <div className="space-y-2">
        {getDailyAnalytics(leads, selectedTeam).slice(0, 30).map(day => {
          const maxLeads = Math.max(...getDailyAnalytics(leads, selectedTeam).slice(0, 30).map(d => d.newLeads));
          const percentage = maxLeads > 0 ? (day.newLeads / maxLeads) * 100 : 0;
          const isToday = day.date === new Date().toISOString().split('T')[0];
          
          return (
            <div key={day.date} className={`${isToday ? 'bg-blue-50 border border-blue-200 rounded' : ''} p-2`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium ${isToday ? 'text-blue-900' : 'text-gray-700'}`}>
                  {new Date(day.date).toLocaleDateString('es-AR', { 
                    weekday: 'short', 
                    day: '2-digit', 
                    month: 'short' 
                  })}
                  {isToday && <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded">HOY</span>}
                </span>
                <span className={`text-sm font-bold ${isToday ? 'text-blue-700' : 'text-gray-900'}`}>
                  {day.newLeads} leads
                  {day.converted > 0 && (
                    <span className="ml-2 text-xs text-green-600">
                      ({day.converted} convertidos)
                    </span>
                  )}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${isToday ? 'bg-blue-600' : 'bg-blue-400'}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* Tabla detallada por día */}
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-xl font-semibold text-gray-800">
          Detalle Diario Completo
          {selectedTeam !== "todos" && (
            <span className="text-base font-normal text-gray-600 ml-2">
              (Equipo {users.find((u: any) => u.id.toString() === selectedTeam)?.name})
            </span>
          )}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Fecha
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Total
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Nuevos
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Convertidos
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                % Conv.
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Top Fuente
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Top Estado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {getDailyAnalytics(leads, selectedTeam).map(day => {
              const conversion = day.newLeads > 0 
                ? ((day.converted / day.newLeads) * 100).toFixed(1)
                : '0';
              
              const topSource = Object.entries(day.bySource)
                .sort((a, b) => b[1] - a[1])[0];
              
              const topState = Object.entries(day.byState)
                .sort((a, b) => b[1] - a[1])[0];
              
              const isToday = day.date === new Date().toISOString().split('T')[0];
              
              return (
                <tr key={day.date} className={`hover:bg-gray-50 ${isToday ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3 text-sm">
                    <div className={`font-medium ${isToday ? 'text-blue-900' : 'text-gray-900'}`}>
                      {new Date(day.date).toLocaleDateString('es-AR', {
                        weekday: 'long',
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </div>
                    {isToday && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded">
                        HOY
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-medium text-gray-900">
                      {day.total}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-bold text-blue-600">
                      {day.newLeads}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-bold text-green-600">
                      {day.converted}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-medium ${
                      parseFloat(conversion) > 30 ? 'text-green-600' :
                      parseFloat(conversion) > 15 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {conversion}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {topSource && (
                      <div className="flex items-center space-x-1">
                        <span className="text-sm">
                          {fuentes[topSource[0]]?.icon || '❓'}
                        </span>
                        <span className="text-xs text-gray-600">
                          {fuentes[topSource[0]]?.label || topSource[0]}
                        </span>
                        <span className="text-xs font-medium text-gray-900">
                          ({topSource[1]})
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {topState && (
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${estados[topState[0]]?.color || 'bg-gray-500'}`}>
                          {estados[topState[0]]?.label || topState[0]}
                        </span>
                        <span className="text-xs font-medium text-gray-900">
                          ({topState[1]})
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    {/* Análisis por fuente en el tiempo */}
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">
        Leads por Fuente - Últimos 7 Días
        {selectedTeam !== "todos" && (
          <span className="text-base font-normal text-gray-600 ml-2">
            (Equipo {users.find((u: any) => u.id.toString() === selectedTeam)?.name})
          </span>
        )}
      </h3>
      <div className="space-y-4">
        {Object.entries(fuentes).map(([key, fuente]) => {
          const last7Days = getDailyAnalytics(leads, selectedTeam).slice(0, 7);
          const totalBySource = last7Days.reduce((sum, day) => 
            sum + (day.bySource[key] || 0), 0
          );
          
          if (totalBySource === 0) return null;
          
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{fuente.icon}</span>
                  <span className="text-sm font-medium text-gray-700">
                    {fuente.label}
                  </span>
                </div>
                <span className="text-sm font-bold text-gray-900">
                  {totalBySource} leads
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {last7Days.map(day => {
                  const count = day.bySource[key] || 0;
                  const maxInWeek = Math.max(...last7Days.map(d => d.bySource[key] || 0));
                  const height = maxInWeek > 0 ? (count / maxInWeek) * 100 : 0;
                  
                  return (
                    <div key={day.date} className="text-center">
                      <div className="h-20 flex flex-col justify-end">
                        <div
                          className={`${fuente.color} rounded-t`}
                          style={{ height: `${height}%`, minHeight: count > 0 ? '8px' : '0' }}
                          title={`${count} leads`}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(day.date).toLocaleDateString('es-AR', { 
                          day: '2-digit',
                          month: 'short'
                        })}
                      </div>
                      <div className="text-xs font-medium text-gray-900">
                        {count}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
)}
        {/* Sección Usuarios con filtros mejorados */}
        {activeSection === "users" && canManageUsers() && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Gestión de Usuarios</h2>
              {canCreateUsers() && (
                <button
                  onClick={openCreateUser}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus size={20} />
                  <span>Nuevo Usuario</span>
                </button>
              )}
            </div>

            {/* Barra de búsqueda y filtros para usuarios */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Búsqueda de texto */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, email, rol o equipo..."
                      value={userSearchText}
                      onChange={(e) => setUserSearchText(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Controles de ordenamiento y filtros */}
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Ordenar por:</span>
                    <select
                      value={userSortBy}
                      onChange={(e) => setUserSortBy(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="team">Equipo</option>
                      <option value="name">Nombre</option>
                      <option value="role">Rol</option>
                      <option value="performance">Performance</option>
                    </select>
                  </div>

                  <button
                    onClick={() => setShowUserFilters(!showUserFilters)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                      showUserFilters || getActiveUserFiltersCount() > 0
                        ? "bg-blue-100 border-blue-300 text-blue-700"
                        : "bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Filter size={20} />
                    <span>Filtros</span>
                    {getActiveUserFiltersCount() > 0 && (
                      <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                        {getActiveUserFiltersCount()}
                      </span>
                    )}
                    <ChevronDown size={16} className={`transition-transform ${showUserFilters ? 'rotate-180' : ''}`} />
                  </button>

                  {getActiveUserFiltersCount() > 0 && (
                    <button
                      onClick={clearUserFilters}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                    >
                      <X size={16} />
                      <span>Limpiar</span>
                    </button>
                  )}

                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{getFilteredAndSortedUsers().length}</span> usuarios
                  </div>
                </div>
              </div>

              {/* Panel de filtros expandible */}
              {showUserFilters && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Filtro por equipo/gerente */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Users size={16} className="inline mr-1" />
                        Equipo
                      </label>
                      <select
                        value={selectedTeamFilter}
                        onChange={(e) => setSelectedTeamFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="todos">Todos los equipos</option>
                        <option value="sin_equipo">Sin equipo asignado</option>
                        {users
                          .filter((u: any) => u.role === "gerente" && getVisibleUsers().some((vu: any) => vu.id === u.id))
                          .map((gerente: any) => {
                            const teamCount = users.filter((u: any) => {
                              const teamUserIds = getTeamUserIds(gerente.id.toString());
                              return teamUserIds.includes(u.id) || u.id === gerente.id;
                            }).length;
                            return (
                              <option key={gerente.id} value={gerente.id.toString()}>
                                Equipo {gerente.name} ({teamCount} miembros)
                              </option>
                            );
                          })}
                      </select>
                    </div>

                    {/* Filtro por rol */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <User size={16} className="inline mr-1" />
                        Rol
                      </label>
                      <select
                        value={selectedRoleFilter}
                        onChange={(e) => setSelectedRoleFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="todos">Todos los roles</option>
                        {Object.entries(roles).map(([key, label]) => {
                          const roleCount = getVisibleUsers().filter((u: any) => u.role === key).length;
                          if (roleCount === 0) return null;
                          return (
                            <option key={key} value={key}>
                              {label} ({roleCount})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tabla de usuarios con filtros y ordenamiento */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Usuario
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Rol
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Equipo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Performance
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getFilteredAndSortedUsers().length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          {userSearchText.trim() || selectedTeamFilter !== "todos" || selectedRoleFilter !== "todos"
                            ? "No se encontraron usuarios que coincidan con los filtros aplicados"
                            : "No hay usuarios para mostrar"}
                        </td>
                      </tr>
                    ) : (
                      getFilteredAndSortedUsers().map((user: any) => {
                        const userLeads = leads.filter((l) => l.vendedor === user.id);
                        const userSales = userLeads.filter((l) => l.estado === "vendido").length;
                        const manager = user.reportsTo ? userById.get(user.reportsTo) : null;

                        return (
                          <tr key={user.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4">
                              <div>
                                <div className="font-medium text-gray-900">{user.name}</div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                {roles[user.role] || user.role}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm">
                                {manager ? (
                                  <div>
                                    <span className="font-medium text-gray-900">
                                      Equipo {manager.name}
                                    </span>
                                    <div className="text-xs text-gray-500">
                                      Reporta a: {manager.name} ({roles[manager.role] || manager.role})
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-gray-500">Sin equipo</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    user.active
                                      ? "bg-green-100 text-green-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {user.active ? "Activo" : "Inactivo"}
                                </span>
                                {user.role === "vendedor" && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        const updated = await apiUpdateUser(user.id, {
                                          ...user,
                                          active: user.active ? 0 : 1,
                                        });
                                        setUsers((prev) =>
                                          prev.map((u: any) => (u.id === user.id ? updated : u))
                                        );
                                      } catch (e) {
                                        console.error("No pude cambiar estado del usuario", e);
                                      }
                                    }}
                                    className={`px-2 py-1 text-xs rounded ${
                                      user.active
                                        ? "bg-red-100 text-red-700 hover:bg-red-200"
                                        : "bg-green-100 text-green-700 hover:bg-green-200"
                                    }`}
                                    title={user.active ? "Desactivar vendedor" : "Activar vendedor"}
                                  >
                                    {user.active ? "Desactivar" : "Activar"}
                                  </button>
                                )}
                              </div>
                              {user.role === "vendedor" && !user.active && (
                                <div className="text-xs text-orange-600 mt-1">
                                  No recibe leads nuevos
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {user.role === "vendedor" ? (
                                <div className="text-sm">
                                  <div className="flex items-center space-x-2">
                                    <span>{userLeads.length} leads</span>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-green-600 font-medium">
                                      {userSales} ventas
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {userLeads.length > 0
                                      ? `${((userSales / userLeads.length) * 100).toFixed(0)}% conversión`
                                      : "Sin conversión"}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-center space-x-2">
                                <button
                                  onClick={() => openEditUser(user)}
                                  className="p-1 text-blue-600 hover:text-blue-800"
                                  title="Editar usuario"
                                >
                                  <Edit3 size={16} />
                                </button>
                                {isOwner() && user.id !== currentUser?.id && (
                                  <button
                                    onClick={() => openDeleteConfirm(user)}
                                    className="p-1 text-red-600 hover:text-red-800"
                                    title="Eliminar usuario"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
    {/* Sección Presupuestos */}
{activeSection === "presupuestos" && (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h2 className="text-3xl font-bold text-gray-800">Plantillas de Presupuesto</h2>
      {isOwner() && (
        <button
          onClick={() => {
            setEditingPresupuesto(null);
            setShowPresupuestoModal(true);
          }}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          <span>Nueva Plantilla</span>
        </button>
      )}
    </div>

    {!isOwner() && (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          <strong>Nota:</strong> Solo puedes ver las plantillas de presupuesto. 
          Para enviar un presupuesto a un cliente, usa el botón de WhatsApp en la tabla de leads.
        </p>
      </div>
    )}

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {presupuestos.length === 0 ? (
        <div className="col-span-full text-center py-12">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No hay plantillas de presupuesto creadas</p>
          {isOwner() && (
            <button
              onClick={() => {
                setEditingPresupuesto(null);
                setShowPresupuestoModal(true);
              }}
              className="mt-4 text-blue-600 hover:text-blue-800"
            >
              Crear la primera plantilla
            </button>
          )}
        </div>
      ) : (
        presupuestos.map((presupuesto) => (
          <div
            key={presupuesto.id}
            className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
          >
            {presupuesto.imagen_url && (
              <div className="h-48 bg-gray-200 overflow-hidden">
                <img
                  src={presupuesto.imagen_url}
                  alt={presupuesto.modelo}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Sin+Imagen';
                  }}
                />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {presupuesto.modelo}
                  </h3>
                  <p className="text-sm text-gray-600">{presupuesto.marca}</p>
                </div>
              </div>
              
              {presupuesto.precio_contado && (
                <div className="mt-3 p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Precio Contado</p>
                  <p className="text-xl font-bold text-green-600">
                    {presupuesto.precio_contado}
                  </p>
                </div>
              )}

              {presupuesto.anticipo && (
                <div className="mt-2 text-sm text-gray-600">
                  <strong>Anticipo:</strong> {presupuesto.anticipo}
                </div>
              )}

              {isOwner() && (
                <div className="mt-4 flex space-x-2">
                  <button
                    onClick={() => {
                      setEditingPresupuesto(presupuesto);
                      setShowPresupuestoModal(true);
                    }}
                    className="flex-1 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                  >
                    <Edit3 size={14} className="inline mr-1" />
                    Editar
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`¿Eliminar plantilla de ${presupuesto.modelo}?`)) {
                        try {
                          await apiDeletePresupuesto(presupuesto.id);
                          setPresupuestos(prev => prev.filter(p => p.id !== presupuesto.id));
                        } catch (error) {
                          console.error('Error al eliminar:', error);
                          alert('Error al eliminar la plantilla');
                        }
                      }
                    }}
                    className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  </div>
)}
{/* Sección Gestión de Metas */}
{activeSection === "metas" && (["supervisor", "gerente", "director", "owner"].includes(currentUser?.role)) && (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h2 className="text-3xl font-bold text-gray-800">🎯 Gestión de Metas</h2>
      <button
        onClick={() => {
          setEditingMeta(null);
          setShowMetasModal(true);
        }}
        className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
      >
        <Plus size={20} />
        <span>Asignar Meta</span>
      </button>
    </div>

    {/* Resumen del mes actual */}
    <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl p-6">
      <h3 className="text-xl font-bold mb-4">
        📅 {new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {(() => {
          const mesActual = new Date().toISOString().slice(0, 7);
          const metasDelMes = metas.filter(m => m.mes === mesActual);
          const vendedoresConMeta = metasDelMes.length;
          const metasTotalesVentas = metasDelMes.reduce((sum, m) => sum + m.meta_ventas, 0);
          
          let ventasReales = 0;
          metasDelMes.forEach(meta => {
  const progreso = getProgresoMes(meta.vendedor_id);
  ventasReales += progreso.ventas;
});
          
          const cumplimiento = metasTotalesVentas > 0 
            ? ((ventasReales / metasTotalesVentas) * 100).toFixed(1)
            : '0';

          return (
            <>
              <div className="bg-white bg-opacity-20 rounded-lg p-4">
                <p className="text-sm opacity-90">Vendedores con Meta</p>
                <p className="text-3xl font-bold">{vendedoresConMeta}</p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-lg p-4">
                <p className="text-sm opacity-90">Meta Total Ventas</p>
                <p className="text-3xl font-bold">{metasTotalesVentas}</p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-lg p-4">
                <p className="text-sm opacity-90">Ventas Reales</p>
                <p className="text-3xl font-bold">{ventasReales}</p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-lg p-4">
                <p className="text-sm opacity-90">Cumplimiento</p>
                <p className="text-3xl font-bold">{cumplimiento}%</p>
              </div>
            </>
          );
        })()}
      </div>
    </div>

    {/* Tabla de metas por vendedor */}
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-xl font-semibold text-gray-800">
          Metas Asignadas - {new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Vendedor
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Meta Ventas
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Ventas Reales
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Progreso
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Meta Leads
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Leads Reales
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {(() => {
              const mesActual = new Date().toISOString().slice(0, 7);
              const vendedoresVisibles = getVisibleUsers().filter((u: any) => u.role === "vendedor");
              
              return vendedoresVisibles.map((vendedor: any) => {
  const meta = metas.find(m => m.vendedor_id === vendedor.id && m.mes === mesActual);
  const progreso = getProgresoMes(vendedor.id);
                
                const porcentajeVentas = meta && meta.meta_ventas > 0
  ? Math.min((progreso.ventas / meta.meta_ventas) * 100, 100)
  : 0;

const cumpleMeta = meta && progreso.ventas >= meta.meta_ventas;

                return (
                  <tr key={vendedor.id} className={cumpleMeta ? 'bg-green-50' : ''}>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{vendedor.name}</p>
                        <p className="text-sm text-gray-500">
                          {userById.get(vendedor.reportsTo)?.name || 'Sin supervisor'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {meta ? (
                        <span className="text-lg font-bold text-purple-600">
  {meta.meta_ventas}
</span>
                      ) : (
                        <span className="text-gray-400">Sin meta</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-lg font-bold ${
                        cumpleMeta ? 'text-green-600' : 'text-gray-900'
                      }`}>
                        {progreso.ventas}
                      </span>
                      {cumpleMeta && <span className="ml-2">✅</span>}
                    </td>
                    <td className="px-6 py-4">
                      {meta ? (
                        <div>
                          <div className="w-full bg-gray-200 rounded-full h-3 mb-1">
                            <div
                              className={`h-3 rounded-full transition-all ${
                                cumpleMeta ? 'bg-green-500' : 'bg-purple-500'
                              }`}
                              style={{ width: `${porcentajeVentas}%` }}
                            />
                          </div>
                          <p className="text-xs text-center text-gray-600">
                            {porcentajeVentas.toFixed(0)}%
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {meta ? (
                        <span className="text-lg font-bold text-blue-600">
  {meta.meta_leads}
</span>
                      ) : (
                        <span className="text-gray-400">Sin meta</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-lg font-bold text-gray-900">
                        {progreso.leads}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => {
                            if (meta) {
                              setEditingMeta(meta);
                              setShowMetasModal(true);
                            } else {
                              // Crear nueva meta para este vendedor
                              const nuevaMeta = {
  id: Date.now(),
  vendedor_id: vendedor.id,
  mes: new Date().toISOString().slice(0, 7),
  meta_ventas: 0,
  meta_leads: 0,
} as Meta;
                              setEditingMeta(nuevaMeta);
                              setShowMetasModal(true);
                            }
                          }}
                          className={`px-3 py-1 text-xs rounded ${
                            meta
                              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          }`}
                        >
                          {meta ? (
                            <>
                              <Edit3 size={12} className="inline mr-1" />
                              Editar
                            </>
                          ) : (
                            <>
                              <Plus size={12} className="inline mr-1" />
                              Asignar
                            </>
                          )}
                        </button>
                        
                        {meta && (
                          <button
  onClick={async () => {
    if (!confirm(`¿Eliminar meta de ${vendedor.name}?`)) return;
    
    try {
      await apiDeleteMeta(meta.id);
      setMetas(prev => prev.filter(m => m.id !== meta.id));
      alert('Meta eliminada exitosamente');
    } catch (error: any) {
      console.error('Error eliminando meta:', error);
      alert(error.response?.data?.error || 'Error al eliminar la meta');
    }
  }}
  className="px-3 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
>
  <Trash2 size={12} />
</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>
    </div>

    {/* Histórico de meses anteriores */}
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">
        📊 Histórico de Cumplimiento
      </h3>
      
      <div className="space-y-4">
        {(() => {
          // Obtener últimos 3 meses
          const mesesAnteriores = [];
          for (let i = 1; i <= 3; i++) {
            const fecha = new Date();
            fecha.setMonth(fecha.getMonth() - i);
            mesesAnteriores.push(fecha.toISOString().slice(0, 7));
          }
          
          return mesesAnteriores.map(mes => {
            const metasDelMes = metas.filter(m => m.mes === mes);
            
            if (metasDelMes.length === 0) return null;
  
  const vendedoresQueCumplieron = metasDelMes.filter(meta => {
    const [year, month] = mes.split('-');
    const leadsDelMes = leads.filter((lead) => {
      if (lead.vendedor !== meta.vendedor_id) return false;
      
      const dateToCheck = lead.last_status_change || lead.fecha || lead.created_at;
      if (!dateToCheck) return false;
      
      const leadDate = new Date(dateToCheck);
      const leadMonth = (leadDate.getMonth() + 1).toString().padStart(2, '0');
      const leadYear = leadDate.getFullYear().toString();
      
      return leadMonth === month && leadYear === year;
    });
    
    const ventasDelMes = leadsDelMes.filter(l => l.estado === 'vendido' && l.vendedor === meta.vendedor_id).length;
    return ventasDelMes >= meta.meta_ventas;
  }).length;
  
  const porcentajeCumplimiento = metasDelMes.length > 0
    ? ((vendedoresQueCumplieron / metasDelMes.length) * 100).toFixed(0)
    : '0';
  
  return (
    <div key={mes} className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-gray-900">
          {new Date(mes + '-01').toLocaleDateString('es-AR', { 
            month: 'long', 
            year: 'numeric' 
          })}
        </h4>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          parseInt(porcentajeCumplimiento) >= 80
            ? 'bg-green-100 text-green-800'
            : parseInt(porcentajeCumplimiento) >= 50
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {porcentajeCumplimiento}% cumplimiento
        </span>
      </div>
      <p className="text-sm text-gray-600">
        {vendedoresQueCumplieron} de {metasDelMes.length} vendedores cumplieron su meta
      </p>
    </div>
  );
});
        })()}
      </div>
    </div>
  </div>
)}
         {/* MODALES */}
        
        {/* Modal de Confirmación para Eliminar Lead */}
        {showDeleteLeadConfirmModal && leadToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center mb-6">
                <div className="bg-red-100 p-3 rounded-full mr-4">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    Eliminar Lead
                  </h3>
                  <p className="text-sm text-gray-600">
                    Esta acción no se puede deshacer
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-gray-800 mb-2">Lead a eliminar:</h4>
                <div className="text-sm space-y-1">
                  <div><strong>Cliente:</strong> {leadToDelete.nombre}</div>
                  <div><strong>Teléfono:</strong> {leadToDelete.telefono}</div>
                  <div><strong>Modelo:</strong> {leadToDelete.modelo}</div>
                  <div><strong>Estado:</strong> {estados[leadToDelete.estado]?.label || leadToDelete.estado}</div>
                  <div><strong>Vendedor:</strong> {leadToDelete.vendedor ? userById.get(leadToDelete.vendedor)?.name : 'Sin asignar'}</div>
                  {leadToDelete.created_by && (
                    <div><strong>Creado por:</strong> {userById.get(leadToDelete.created_by)?.name || 'Usuario eliminado'}</div>
                  )}
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Bell className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-red-800">
                      Atención - Eliminación Permanente
                    </h4>
                    <div className="mt-2 text-sm text-red-700">
                      <ul className="list-disc pl-5 space-y-1">
                        <li>El lead se eliminará permanentemente del sistema</li>
                        <li>Se perderán todos los datos y el historial</li>
                        <li>Esta acción no se puede revertir</li>
                        <li>El vendedor asignado perderá el acceso al lead</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={confirmDeleteLead}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  Sí, Eliminar Lead
                </button>
                <button
                  onClick={() => {
                    setShowDeleteLeadConfirmModal(false);
                    setLeadToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmación para Eliminar Usuario */}
        {showDeleteConfirmModal && userToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center mb-6">
                <div className="bg-red-100 p-3 rounded-full mr-4">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    Confirmar Eliminación
                  </h3>
                  <p className="text-sm text-gray-600">
                    Esta acción no se puede deshacer
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-gray-800 mb-2">Usuario a eliminar:</h4>
                <div className="text-sm space-y-1">
                  <div><strong>Nombre:</strong> {userToDelete.name}</div>
                  <div><strong>Email:</strong> {userToDelete.email}</div>
                  <div><strong>Rol:</strong> {roles[userToDelete.role] || userToDelete.role}</div>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Bell className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-red-800">
                      Atención - Eliminación Permanente
                    </h4>
                    <div className="mt-2 text-sm text-red-700">
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Se eliminará permanentemente del sistema</li>
                        <li>Se perderá acceso a todas las funcionalidades</li>
                        <li>No podrá recuperar su cuenta</li>
                        <li>Los datos históricos se mantendrán para auditoría</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={confirmDeleteUser}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  Sí, Eliminar Usuario
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirmModal(false);
                    setUserToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Reasignación de Lead */}
        {showReassignModal && leadToReassign && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  Reasignar Lead - {leadToReassign.nombre}
                </h3>
                <button
                  onClick={() => {
                    setShowReassignModal(false);
                    setLeadToReassign(null);
                    setSelectedVendorForReassign(null);
                  }}
                >
                  <X size={24} className="text-gray-600" />
                </button>
              </div>

              <div className="mb-6">
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-800 mb-2">Información del Lead</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">Cliente:</span>{" "}
                      {leadToReassign.nombre}
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Teléfono:</span>{" "}
                      {leadToReassign.telefono}
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Vehículo:</span>{" "}
                      {leadToReassign.modelo}
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Estado:</span>
                      <span
                        className={`ml-2 px-2 py-1 rounded-full text-xs font-medium text-white ${estados[leadToReassign.estado].color}`}
                      >
                        {estados[leadToReassign.estado].label}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Fuente:</span>
                      <span className="ml-2">
                        {fuentes[leadToReassign.fuente as string]?.icon || "❓"}{" "}
                        {fuentes[leadToReassign.fuente as string]?.label ||
                          String(leadToReassign.fuente)}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Vendedor actual:</span>{" "}
                      {leadToReassign.vendedor
                        ? userById.get(leadToReassign.vendedor)?.name
                        : "Sin asignar"}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Seleccionar nuevo vendedor (solo vendedores activos)
                  </label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {/* Opción para no asignar */}
                    <div
                      onClick={() => setSelectedVendorForReassign(null)}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedVendorForReassign === null
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-400 rounded-full flex items-center justify-center">
                            <span className="text-white font-medium text-sm">--</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Sin asignar</p>
                            <p className="text-sm text-gray-500">
                              Dejar el lead sin vendedor asignado
                            </p>
                          </div>
                        </div>
                        {selectedVendorForReassign === null && (
                          <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Lista de vendedores disponibles */}
                    {getAvailableVendorsForReassign().map((vendedor: any) => {
                      const vendedorLeads = leads.filter((l) => l.vendedor === vendedor.id);
                      const vendedorVentas = vendedorLeads.filter(
                        (l) => l.estado === "vendido"
                      ).length;
                      const conversion =
                        vendedorLeads.length > 0
                          ? ((vendedorVentas / vendedorLeads.length) * 100).toFixed(0)
                          : "0";

                      return (
                        <div
                          key={vendedor.id}
                          onClick={() => setSelectedVendorForReassign(vendedor.id)}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedVendorForReassign === vendedor.id
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                                <span className="text-white font-medium text-sm">
                                  {vendedor.name
                                    .split(" ")
                                    .map((n: string) => n[0])
                                    .join("")
                                    .toUpperCase()
                                    .substring(0, 2)}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{vendedor.name}</p>
                                <p className="text-sm text-gray-500">
                                  {vendedorLeads.length} leads • {vendedorVentas} ventas •{" "}
                                  {conversion}% conversión
                                </p>
                                <p className="text-xs text-gray-400">
                                  Equipo de {userById.get(vendedor.reportsTo)?.name || "—"}
                                </p>
                                <p className="text-xs text-green-600 font-medium">
                                  ✓ Activo - Recibe leads nuevos
                                </p>
                              </div>
                            </div>
                            {selectedVendorForReassign === vendedor.id && (
                              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {getAvailableVendorsForReassign().length === 0 && (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border">
                      <p className="text-gray-500">
                        No hay vendedores activos disponibles en tu scope para reasignar
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleReassignLead}
                  disabled={selectedVendorForReassign === leadToReassign.vendedor}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium ${
                    selectedVendorForReassign === leadToReassign.vendedor
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {selectedVendorForReassign === leadToReassign.vendedor
                    ? "Ya está asignado a este vendedor"
                    : "Reasignar Lead"}
                </button>
                <button
                  onClick={() => {
                    setShowReassignModal(false);
                    setLeadToReassign(null);
                    setSelectedVendorForReassign(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
{/* Modal: Reasignación Masiva */}
{showBulkReassignModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-gray-800">
          Reasignación Masiva de Leads
        </h3>
        <button
          onClick={() => {
            setShowBulkReassignModal(false);
            setBulkReassignVendorId(null);
          }}
        >
          <X size={24} className="text-gray-600" />
        </button>
      </div>

      <div className="mb-6">
        <div className="bg-blue-50 rounded-lg p-4 mb-4">
          <h4 className="font-medium text-blue-900 mb-2">
            📊 Resumen de la operación
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-600">Leads seleccionados:</span>{" "}
              <span className="font-bold text-blue-700">{selectedLeads.size}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Vendedores únicos afectados:</span>{" "}
              <span className="font-bold text-blue-700">
                {new Set(
                  Array.from(selectedLeads)
                    .map(id => leads.find(l => l.id === id)?.vendedor)
                    .filter(Boolean)
                ).size}
              </span>
            </div>
          </div>
        </div>

        {/* Preview de leads seleccionados */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-40 overflow-y-auto">
          <h4 className="font-medium text-gray-800 mb-2 text-sm">Leads a reasignar:</h4>
          <div className="space-y-1">
            {Array.from(selectedLeads).slice(0, 5).map(leadId => {
              const lead = leads.find(l => l.id === leadId);
              if (!lead) return null;
              return (
                <div key={leadId} className="text-xs text-gray-600 flex items-center justify-between">
                  <span>{lead.nombre} - {lead.modelo}</span>
                  <span className="text-gray-400">
                    {lead.vendedor ? userById.get(lead.vendedor)?.name : 'Sin asignar'}
                  </span>
                </div>
              );
            })}
            {selectedLeads.size > 5 && (
              <div className="text-xs text-gray-500 italic">
                ... y {selectedLeads.size - 5} más
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Seleccionar nuevo vendedor para todos los leads seleccionados
          </label>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {/* Opción para desasignar */}
            <div
              onClick={() => setBulkReassignVendorId(null)}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                bulkReassignVendorId === null
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-400 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium text-sm">--</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Sin asignar</p>
                    <p className="text-sm text-gray-500">
                      Quitar asignación de todos los leads seleccionados
                    </p>
                  </div>
                </div>
                {bulkReassignVendorId === null && (
                  <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Lista de vendedores disponibles */}
            {getAvailableVendorsForReassign().map((vendedor: any) => {
              const vendedorLeads = leads.filter((l) => l.vendedor === vendedor.id);
              const vendedorVentas = vendedorLeads.filter(
                (l) => l.estado === "vendido"
              ).length;
              const conversion =
                vendedorLeads.length > 0
                  ? ((vendedorVentas / vendedorLeads.length) * 100).toFixed(0)
                  : "0";

              return (
                <div
                  key={vendedor.id}
                  onClick={() => setBulkReassignVendorId(vendedor.id)}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    bulkReassignVendorId === vendedor.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                          {vendedor.name
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .toUpperCase()
                            .substring(0, 2)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{vendedor.name}</p>
                        <p className="text-sm text-gray-500">
                          {vendedorLeads.length} leads • {vendedorVentas} ventas •{" "}
                          {conversion}% conversión
                        </p>
                        <p className="text-xs text-gray-400">
                          Equipo de {userById.get(vendedor.reportsTo)?.name || "—"}
                        </p>
                        <p className="text-xs text-green-600 font-medium">
                          ✓ Activo - Recibe leads nuevos
                        </p>
                      </div>
                    </div>
                    {bulkReassignVendorId === vendedor.id && (
                      <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {getAvailableVendorsForReassign().length === 0 && (
            <div className="text-center py-8 bg-gray-50 rounded-lg border">
              <p className="text-gray-500">
                No hay vendedores activos disponibles en tu scope para reasignar
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex space-x-3">
        <button
          onClick={handleBulkReassign}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Reasignar {selectedLeads.size} Leads
        </button>
        <button
          onClick={() => {
            setShowBulkReassignModal(false);
            setBulkReassignVendorId(null);
          }}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}
        {/* Modal: Observaciones del Lead */}
        {showObservacionesModal && editingLeadObservaciones && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  Observaciones - {editingLeadObservaciones.nombre}
                </h3>
                <button
                  onClick={() => {
                    setShowObservacionesModal(false);
                    setEditingLeadObservaciones(null);
                  }}
                >
                  <X size={24} className="text-gray-600" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Cliente:</span>{" "}
                  {editingLeadObservaciones.nombre} |{" "}
                  <span className="font-medium ml-2">Teléfono:</span>{" "}
                  {editingLeadObservaciones.telefono} |{" "}
                  <span className="font-medium ml-2">Vehículo:</span>{" "}
                  {editingLeadObservaciones.modelo}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Estado actual:</span>
                  <span
                    className={`ml-2 px-2 py-1 rounded-full text-xs font-medium text-white ${estados[editingLeadObservaciones.estado].color}`}
                  >
                    {estados[editingLeadObservaciones.estado].label}
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observaciones
                </label>
                <textarea
                  id="observaciones-textarea"
                  defaultValue={editingLeadObservaciones.notas || ""}
                  placeholder="Agregar observaciones sobre el cliente, llamadas realizadas, intereses, objeciones, etc..."
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex space-x-3 pt-6">
                <button
                  onClick={() => {
                    const textarea = document.getElementById(
                      "observaciones-textarea"
                    ) as HTMLTextAreaElement;
                    if (textarea && editingLeadObservaciones) {
                      handleUpdateObservaciones(
                        editingLeadObservaciones.id,
                        textarea.value
                      );
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Guardar Observaciones
                </button>
                <button
                  onClick={() => {
                    setShowObservacionesModal(false);
                    setEditingLeadObservaciones(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Historial del Lead */}
        {showHistorialModal && viewingLeadHistorial && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  Historial - {viewingLeadHistorial.nombre}
                </h3>
                <button
                  onClick={() => {
                    setShowHistorialModal(false);
                    setViewingLeadHistorial(null);
                  }}
                >
                  <X size={24} className="text-gray-600" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Cliente:</span>{" "}
                  {viewingLeadHistorial.nombre} |{" "}
                  <span className="font-medium ml-2">Teléfono:</span>{" "}
                  {viewingLeadHistorial.telefono} |{" "}
                  <span className="font-medium ml-2">Vehículo:</span>{" "}
                  {viewingLeadHistorial.modelo}
                </p>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {(viewingLeadHistorial.historial || []).length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No hay historial disponible para este lead
                  </p>
                ) : (
                  <div className="space-y-3">
                    {viewingLeadHistorial.historial?.map((entry, index) => (
                      <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium text-white ${
                              estados[entry.estado]?.color || "bg-gray-500"
                            }`}
                          >
                            {estados[entry.estado]?.label || entry.estado}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(entry.timestamp).toLocaleDateString("es-AR")}{" "}
                            {new Date(entry.timestamp).toLocaleTimeString("es-AR")}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1">
                          Actualizado por: {entry.usuario}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-6">
                <button
                  onClick={() => {
                    setShowHistorialModal(false);
                    setViewingLeadHistorial(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Nuevo Lead */}
        {showNewLeadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-3xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">Nuevo Lead</h3>
                <button onClick={() => setShowNewLeadModal(false)}>
                  <X size={24} className="text-gray-600" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    id="new-nombre"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono *
                  </label>
                  <input
                    type="text"
                    id="new-telefono"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modelo *
                  </label>
                  <input
                    type="text"
                    id="new-modelo"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Forma de Pago
                  </label>
                  <select
                    id="new-formaPago"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Contado">Contado</option>
                    <option value="Financiado">Financiado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Info Usado
                  </label>
                  <input
                    type="text"
                    id="new-infoUsado"
                    placeholder="Marca Modelo Año"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha
                  </label>
                  <input
                    type="date"
                    id="new-fecha"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2 flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="new-entrega"
                    className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    Entrega de vehículo usado
                  </span>
                </div>
                <div className="col-span-2 flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="new-autoassign"
                    defaultChecked
                    className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    Asignación automática y equitativa a vendedores activos de mi equipo
                  </span>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Asignar a vendedor específico (opcional)
                  </label>
                  <select
                    id="new-vendedor"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin asignar</option>
                    {getAvailableVendorsForAssignment().map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name} - {userById.get(u.reportsTo)?.name ? `Equipo ${userById.get(u.reportsTo)?.name}` : 'Sin equipo'} ✓ Activo
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Si está activada la "Asignación automática", se ignorará esta selección.
                    Solo puedes asignar a vendedores activos de tu equipo.
                  </p>
                </div>

                {getAvailableVendorsForAssignment().length === 0 && (
                  <div className="col-span-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-700">
                      <strong>Atención:</strong> No hay vendedores activos disponibles en tu equipo. 
                      El lead se creará sin asignar.
                    </p>
                  </div>
                )}

                <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">
                    Información sobre la creación de leads:
                  </h4>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• Este lead aparecerá marcado como "Creado por {currentUser?.name}"</li>
                    <li>• La fuente se establecerá automáticamente como "Creado por"</li>
                    <li>• Solo puedes asignar a vendedores activos de tu scope/equipo</li>
                    {currentUser?.role === "vendedor" && (
                      <li>• Como vendedor, puedes crear leads pero solo asignártelos a ti mismo</li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="flex space-x-3 pt-6">
                <button
                  onClick={handleCreateLead}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Crear Lead
                </button>
                <button
                  onClick={() => setShowNewLeadModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Nuevo Evento */}
        {showNewEventModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">Nuevo Evento</h3>
                <button onClick={() => setShowNewEventModal(false)}>
                  <X size={24} className="text-gray-600" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Título *
                  </label>
                  <input
                    type="text"
                    id="ev-title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    id="ev-date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hora
                  </label>
                  <input
                    type="time"
                    id="ev-time"
                    defaultValue="09:00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Usuario
                  </label>
                  <select
                    id="ev-user"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    defaultValue={currentUser?.id}
                  >
                    <option value={currentUser?.id}>{currentUser?.name} (Yo)</option>
                    {visibleUsers
                      .filter((u: any) => u.id !== currentUser?.id)
                      .map((u: any) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex space-x-3 pt-6">
                <button
                  onClick={createEvent}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Crear Evento
                </button>
                <button
                  onClick={() => setShowNewEventModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Usuario */}
        {showUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
                </h3>
                <button onClick={() => setShowUserModal(false)}>
                  <X size={24} className="text-gray-600" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    id="u-name"
                    defaultValue={editingUser?.name || ""}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="u-email"
                    defaultValue={editingUser?.email || ""}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contraseña {editingUser ? "(dejar vacío para mantener actual)" : "*"}
                  </label>
                  <input
                    type="password"
                    id="u-pass"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={
                      editingUser ? "Nueva contraseña (opcional)" : "Contraseña obligatoria"
                    }
                  />
                  {!editingUser && (
                    <p className="text-xs text-gray-500 mt-1">
                      La contraseña es obligatoria para usuarios nuevos
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rol
                  </label>
                  <select
                    value={modalRole}
                    onChange={(e) => {
                      const newRole = e.target.value as typeof modalRole;
                      setModalRole(newRole);
                      const validManagers = validManagersByRole(newRole);
                      setModalReportsTo(validManagers[0]?.id ?? null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {validRolesByUser(currentUser).map((role: string) => (
                      <option key={role} value={role}>
                        {roles[role] || role}
                      </option>
                    ))}
                  </select>
                </div>
                {modalRole !== "owner" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reporta a *
                    </label>
                    <select
                      value={modalReportsTo || ""}
                      onChange={(e) =>
                        setModalReportsTo(
                          e.target.value ? parseInt(e.target.value, 10) : null
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {validManagersByRole(modalRole).map((manager: any) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name} ({roles[manager.role] || manager.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="u-active"
                    defaultChecked={editingUser?.active !== false}
                    className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="u-active" className="text-sm text-gray-700">
                    Usuario activo
                  </label>
                </div>
                {modalRole === "vendedor" && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-700">
                      <strong>Nota:</strong> Los vendedores desactivados pueden seguir usando el CRM 
                      para gestionar sus leads existentes, pero no recibirán leads nuevos automáticamente.
                    </p>
                  </div>
                )}

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-gray-800 mb-2">
                    Permisos del rol {roles[modalRole] || modalRole}:
                  </h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {modalRole === "owner" && (
                      <>
                        <li>• Acceso completo al sistema</li>
                        <li>• Gestión total de usuarios y equipos</li>
                        <li>• Visualización de todos los datos</li>
                        <li>• Puede eliminar leads</li>
                      </>
                    )}
                    {modalRole === "director" && (
                      <>
                        <li>• Gestión de gerentes, supervisores y vendedores</li>
                        <li>• Visualización de todos los equipos</li>
                        <li>• Creación y asignación de leads</li>
                        <li>• Puede eliminar leads</li>
                      </>
                    )}
                    {modalRole === "gerente" && (
                      <>
                        <li>• Gestión de supervisores y vendedores de su equipo</li>
                        <li>• Visualización de su equipo completo</li>
                        <li>• Creación y asignación de leads a su equipo</li>
                      </>
                    )}
                    {modalRole === "supervisor" && (
                      <>
                        <li>• Gestión de vendedores directos</li>
                        <li>• Visualización de su equipo directo</li>
                        <li>• Creación y asignación de leads a su equipo</li>
                      </>
                    )}
                    {modalRole === "vendedor" && (
                      <>
                        <li>• Gestión de sus propios leads</li>
                        <li>• Creación de leads (autoasignados)</li>
                        <li>• Visualización de su propio ranking</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>

              <div className="flex space-x-3 pt-6">
                <button
                  onClick={saveUser}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  {editingUser ? "Actualizar" : "Crear"} Usuario
                </button>
                <button
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
{/* Modal: Seleccionar Presupuesto para enviar por WhatsApp */}
{showPresupuestoSelectModal && selectedLeadForPresupuesto && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-800">
            Enviar Presupuesto a {selectedLeadForPresupuesto.nombre}
          </h3>
          <p className="text-sm text-gray-600">
            Selecciona una plantilla para enviar por WhatsApp
          </p>
        </div>
        <button
          onClick={() => {
            setShowPresupuestoSelectModal(false);
            setSelectedLeadForPresupuesto(null);
          }}
        >
          <X size={24} className="text-gray-600" />
        </button>
      </div>

      {presupuestos.length === 0 ? (
        <div className="text-center py-12">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No hay plantillas de presupuesto disponibles</p>
          <p className="text-sm text-gray-400 mt-2">
            Contacta al administrador para crear plantillas
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {presupuestos.map((presupuesto) => (
            <div
              key={presupuesto.id}
              onClick={() => {
                // Generar mensaje de WhatsApp
                const lead = selectedLeadForPresupuesto;
                
                let mensaje = `Hola ${lead.nombre}! 👋\n\n`;
                mensaje += `Te envío la cotización del *${presupuesto.marca} ${presupuesto.modelo}*\n\n`;
                
                if (presupuesto.precio_contado) {
                  mensaje += `💰 *PRECIO CONTADO:* ${presupuesto.precio_contado}\n`;
                }
                
                if (presupuesto.anticipo) {
                  mensaje += `📊 *ANTICIPO:* ${presupuesto.anticipo}\n`;
                }
                
                if (presupuesto.planes_cuotas) {
                  mensaje += `\n💳 *PLANES DE FINANCIACIÓN:*\n`;
                  const planes = typeof presupuesto.planes_cuotas === 'string' 
                    ? JSON.parse(presupuesto.planes_cuotas) 
                    : presupuesto.planes_cuotas;
                  
                  Object.entries(planes).forEach(([cuotas, valor]) => {
                    mensaje += `   • ${cuotas} cuotas: ${valor}\n`;
                  });
                }
                
                if (presupuesto.bonificaciones) {
                  mensaje += `\n🎁 *BONIFICACIONES:*\n${presupuesto.bonificaciones}\n`;
                }
                
                if (presupuesto.especificaciones_tecnicas) {
                  mensaje += `\n📋 *CARACTERÍSTICAS:*\n${presupuesto.especificaciones_tecnicas}\n`;
                }
                
                if (lead.infoUsado) {
                  mensaje += `\n🚗 *TU VEHÍCULO USADO:* ${lead.infoUsado}\n`;
                  mensaje += `(Se considera como parte de pago)\n`;
                }
                
                mensaje += `\n¿Te gustaría coordinar una visita al showroom para verlo personalmente?\n\n`;
                mensaje += `Saludos! 😊`;
                
                // Abrir WhatsApp
                const phoneNumber = lead.telefono.replace(/\D/g, '');
                const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(mensaje)}`;
                window.open(whatsappUrl, '_blank');
                
                // Cerrar modal
                setShowPresupuestoSelectModal(false);
                setSelectedLeadForPresupuesto(null);
              }}
              className="cursor-pointer border-2 border-gray-200 rounded-xl overflow-hidden hover:border-purple-500 hover:shadow-lg transition-all"
            >
              {presupuesto.imagen_url && (
                <div className="h-40 bg-gray-200 overflow-hidden">
                  <img
                    src={presupuesto.imagen_url}
                    alt={presupuesto.modelo}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Sin+Imagen';
                    }}
                  />
                </div>
              )}
              <div className="p-4">
                <h4 className="text-lg font-bold text-gray-900">
                  {presupuesto.marca} {presupuesto.modelo}
                </h4>
                
                {presupuesto.precio_contado && (
                  <div className="mt-2 p-2 bg-green-50 rounded">
                    <p className="text-xs text-gray-600">Precio Contado</p>
                    <p className="text-lg font-bold text-green-600">
                      {presupuesto.precio_contado}
                    </p>
                  </div>
                )}
                
                {presupuesto.anticipo && (
                  <p className="mt-2 text-sm text-gray-600">
                    <strong>Anticipo:</strong> {presupuesto.anticipo}
                  </p>
                )}
                
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    Click para enviar por WhatsApp
                  </span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-green-600">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.89 3.587"/>
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          onClick={() => {
            setShowPresupuestoSelectModal(false);
            setSelectedLeadForPresupuesto(null);
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}
       {/* Modal: Presupuesto */}
{showPresupuestoModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-gray-800">
          {editingPresupuesto ? "Editar Plantilla" : "Nueva Plantilla de Presupuesto"}
        </h3>
        <button onClick={() => {
          setShowPresupuestoModal(false);
          setEditingPresupuesto(null);
        }}>
          <X size={24} className="text-gray-600" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Marca *
            </label>
            <input
              type="text"
              id="pres-marca"
              defaultValue={editingPresupuesto?.marca || ""}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="ej: Chevrolet"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Modelo *
            </label>
            <input
              type="text"
              id="pres-modelo"
              defaultValue={editingPresupuesto?.modelo || ""}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="ej: Cruze LT"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            URL de Imagen
          </label>
          <input
            type="url"
            id="pres-imagen"
            defaultValue={editingPresupuesto?.imagen_url || ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="https://ejemplo.com/imagen.jpg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Precio Contado
          </label>
          <input
            type="text"
            id="pres-precio"
            defaultValue={editingPresupuesto?.precio_contado || ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="ej: $25.000.000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Anticipo
          </label>
          <input
            type="text"
            id="pres-anticipo"
            defaultValue={editingPresupuesto?.anticipo || ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="ej: 30% - $7.500.000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bonificaciones
          </label>
          <textarea
            id="pres-bonificaciones"
            defaultValue={editingPresupuesto?.bonificaciones || ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-20 resize-none"
            placeholder="ej: Bonificación por pago contado: $500.000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Especificaciones Técnicas
          </label>
          <textarea
            id="pres-specs"
            defaultValue={editingPresupuesto?.especificaciones_tecnicas || ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-24 resize-none"
            placeholder="Motor, transmisión, equipamiento, etc."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Planes de Cuotas (JSON)
          </label>
          <textarea
            id="pres-cuotas"
            defaultValue={editingPresupuesto?.planes_cuotas ? JSON.stringify(editingPresupuesto.planes_cuotas, null, 2) : ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-24 resize-none font-mono text-xs"
            placeholder='{"12": "cuota de $2.000.000", "24": "cuota de $1.100.000"}'
          />
          <p className="text-xs text-gray-500 mt-1">
            Formato JSON opcional. Ejemplo: {`{"12": "cuota $X", "24": "cuota $Y"}`}
          </p>
        </div>
      </div>

      <div className="flex space-x-3 pt-6">
        <button
          onClick={async () => {
            const marca = (document.getElementById("pres-marca") as HTMLInputElement)?.value?.trim();
            const modelo = (document.getElementById("pres-modelo") as HTMLInputElement)?.value?.trim();
            const imagen_url = (document.getElementById("pres-imagen") as HTMLInputElement)?.value?.trim();
            const precio_contado = (document.getElementById("pres-precio") as HTMLInputElement)?.value?.trim();
            const anticipo = (document.getElementById("pres-anticipo") as HTMLInputElement)?.value?.trim();
            const bonificaciones = (document.getElementById("pres-bonificaciones") as HTMLTextAreaElement)?.value?.trim();
            const especificaciones_tecnicas = (document.getElementById("pres-specs") as HTMLTextAreaElement)?.value?.trim();
            const cuotasStr = (document.getElementById("pres-cuotas") as HTMLTextAreaElement)?.value?.trim();

            if (!marca || !modelo) {
              alert("Marca y Modelo son obligatorios");
              return;
            }

            let planes_cuotas = null;
            if (cuotasStr) {
              try {
                planes_cuotas = JSON.parse(cuotasStr);
              } catch (e) {
                alert("El formato de Planes de Cuotas no es JSON válido");
                return;
              }
            }

            const data: any = {
              marca,
              modelo,
              imagen_url: imagen_url || null,
              precio_contado: precio_contado || null,
              anticipo: anticipo || null,
              bonificaciones: bonificaciones || null,
              especificaciones_tecnicas: especificaciones_tecnicas || null,
              planes_cuotas,
              activo: true,
            };

            try {
              if (editingPresupuesto) {
                const updated = await apiUpdatePresupuesto(editingPresupuesto.id, data);
                setPresupuestos(prev => prev.map(p => p.id === editingPresupuesto.id ? updated : p));
              } else {
                const created = await apiCreatePresupuesto(data);
                setPresupuestos(prev => [created, ...prev]);
              }
              setShowPresupuestoModal(false);
              setEditingPresupuesto(null);
            } catch (e: any) {
              console.error("Error al guardar presupuesto:", e);
              alert(`Error: ${e?.response?.data?.error || e.message}`);
            }
          }}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          {editingPresupuesto ? "Actualizar" : "Crear"} Plantilla
        </button>
        <button
          onClick={() => {
            setShowPresupuestoModal(false);
            setEditingPresupuesto(null);
          }}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}
{/* Modal: Presupuesto Personalizado */}
{showPresupuestoPersonalizadoModal && leadParaPresupuesto && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl w-full max-w-5xl max-h-[95vh] overflow-y-auto m-4">
      {/* Header con fondo rosa/rojo */}
      <div className="bg-gradient-to-r from-pink-500 to-red-500 text-white text-center py-4 rounded-t-xl">
        <p className="font-bold text-base px-4">
          ESTÁS A UN SOLO PASO DE TENER TU PRÓXIMO 0KM!!! FELICITACIONES!!!
        </p>
      </div>

      <div className="p-6">
        {/* Header del modal */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              Generar Presupuesto para {leadParaPresupuesto.nombre}
            </h3>
            <p className="text-sm text-gray-600">
              Tel: {leadParaPresupuesto.telefono}
            </p>
          </div>
          <button
            onClick={() => {
              setShowPresupuestoPersonalizadoModal(false);
              setLeadParaPresupuesto(null);
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Grid de 3 columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COLUMNA 1: Sube tus Imágenes (0KM) */}
          <div className="space-y-4">
            <div className="bg-blue-100 rounded-lg p-3">
              <h4 className="font-bold text-blue-900 text-center text-sm">
                📸 Sube tus Imágenes (0KM)
              </h4>
            </div>
            
            {[1, 2, 3].map((num) => (
              <div key={num} className="relative">
                <input
                  type="file"
                  id={`imagen-${num}`}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const container = document.getElementById(`upload-container-${num}`);
                        const img = document.getElementById(`preview-${num}`) as HTMLImageElement;
                        if (img && event.target?.result && container) {
                          img.src = event.target.result as string;
                          container.classList.add('hidden');
                          img.classList.remove('hidden');
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <label 
                  htmlFor={`imagen-${num}`} 
                  className="block border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 cursor-pointer bg-gray-50 transition-colors min-h-[150px] flex items-center justify-center"
                >
                  <div id={`upload-container-${num}`} className="text-center">
                    <p className="text-gray-400 text-sm mb-1">Click para subir</p>
                    <p className="text-gray-400 text-xs">Imagen {num}</p>
                  </div>
                  <img
                    id={`preview-${num}`}
                    className="hidden w-full h-full object-cover rounded"
                    alt={`Preview ${num}`}
                  />
                </label>
              </div>
            ))}
          </div>

          {/* COLUMNA 2: Financiación Exclusiva */}
          <div className="space-y-4">
            <div className="bg-blue-100 rounded-lg p-3 border-l-4 border-blue-500">
              <h4 className="font-bold text-blue-900 text-center text-sm flex items-center justify-center">
                <span className="mr-2">💰</span>
                Financiación Exclusiva
              </h4>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Nombre del Vehículo:
              </label>
              <input
                type="text"
                id="plan-pensado"
                defaultValue={leadParaPresupuesto.modelo}
                placeholder="Ej: Fiat Cronos 1.3 GSE"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Valor Móvil:
              </label>
              <input
                type="text"
                id="valor-plan"
                placeholder="$ 0.000.000"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Anticipo / Alicuota Extraordinaria:
              </label>
              <input
                type="text"
                id="anticipo"
                placeholder="$ 0.000.000"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Suscripción y Cuota 1:
              </label>
              <input
                type="text"
                id="cuota-1-valor"
                placeholder="$ 0.000"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Cuotas dinámicas con formato correcto */}
            
<div>
  <label className="block text-sm font-bold text-gray-700 mb-1">
    Cuota 2 a la 12:
  </label>
  <input
    type="text"
    id="cuota-2-12"
    placeholder="$ 0.000"
    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
  />
</div>

<div>
  <label className="block text-sm font-bold text-gray-700 mb-1">
    Cuota 13 a la 84:
  </label>
  <input
    type="text"
    id="cuota-13-84"
    placeholder="$ 0.000"
    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
  />
</div>
            <button
              onClick={() => {
                // Lógica para agregar otra cuota
              }}
              className="w-full py-2 text-sm border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              + Agregar cuota
            </button>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Adjudicación Asegurada:
              </label>
              <input
                type="text"
                id="adjudicacion"
                defaultValue="De la 2 a la 24"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* COLUMNA 3: Cotización del Usado */}
          <div className="space-y-4">
            <div className="bg-purple-100 rounded-lg p-3 border-l-4 border-purple-500">
              <h4 className="font-bold text-purple-900 text-center text-sm flex items-center justify-center">
                <span className="mr-2">📊</span>
                Cotizador de Usados
              </h4>
            </div>

            <div className="relative">
              <input
                type="file"
                id="imagen-cotizador"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const container = document.getElementById('upload-container-cotizador');
                      const img = document.getElementById('preview-cotizador') as HTMLImageElement;
                      if (img && event.target?.result && container) {
                        img.src = event.target.result as string;
                        container.classList.add('hidden');
                        img.classList.remove('hidden');
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <label 
                htmlFor="imagen-cotizador" 
                className="block border-2 border-dashed border-purple-300 rounded-lg p-12 text-center hover:border-purple-400 cursor-pointer bg-purple-50 transition-colors min-h-[200px] flex items-center justify-center"
              >
                <div id="upload-container-cotizador" className="text-center">
                  <p className="text-purple-600 text-base mb-2 font-semibold">Click para subir cotizador</p>
                  <p className="text-purple-500 text-sm">Captura de pantalla del cotizador</p>
                </div>
                <img
                  id="preview-cotizador"
                  className="hidden w-full h-full object-contain rounded"
                  alt="Preview cotizador"
                />
              </label>
            </div>

            <div className="bg-blue-100 rounded-lg p-3 border-l-4 border-blue-500 mt-6">
              <h4 className="font-bold text-blue-900 text-center text-sm flex items-center justify-center">
                <span className="mr-2">🚗</span>
                Cotización del Usado
              </h4>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Marca y Modelo:
              </label>
              <input
                type="text"
                id="modelo-usado"
                defaultValue={leadParaPresupuesto.infoUsado || ''}
                placeholder="Ej: Fiat Cronos"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Año:
              </label>
              <input
                type="text"
                id="anio-usado"
                placeholder="2020"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Kilómetros:
              </label>
              <input
                type="text"
                id="kilometros"
                placeholder="50.000 km"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Valor Estimado:
              </label>
              <input
                type="text"
                id="valor-estimado"
                placeholder="$ 0.000.000"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Observaciones */}
        <div className="mt-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Observaciones / Notas adicionales:
          </label>
          <textarea
            id="observaciones"
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md resize-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Información adicional..."
          />
        </div>

        {/* Advertencias amarillas */}
        <div className="mt-4 space-y-3">
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
            <div className="flex items-start">
              <span className="text-yellow-600 mr-2">⚠️</span>
              <div>
                <p className="text-sm font-bold text-yellow-900">
                  PROMOCIÓN VÁLIDA POR 72HS:
                </p>
                <p className="text-sm text-yellow-800 mt-1">
                  Todas las bonificaciones especiales tendrán una vigencia de 72 horas a partir de que te haya llegado este presupuesto.
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
            <div className="flex items-start">
              <span className="text-purple-600 mr-2">🚗</span>
              <div>
                <p className="text-sm font-bold text-yellow-900">
                  IMPORTANTE:
                </p>
                <p className="text-sm text-yellow-800 mt-1">
                  Si tenés un usado, por favor pedí que te lo coticen y lo incluyan en este presupuesto, ya que si no está incluido NO se tomará para la entrega del 0KM.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              setShowPresupuestoPersonalizadoModal(false);
              setLeadParaPresupuesto(null);
            }}
            className="flex-1 px-4 py-3 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerarPresupuestoPDF}
            className="flex-1 px-4 py-3 text-sm font-bold bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg hover:from-green-600 hover:to-blue-600 transition-all shadow-md hover:shadow-lg"
          >
            ✅ Generar este PDF
          </button>
        </div>
      </div>
    </div>
  </div>
)}
{/* Modal: Recordatorios del Lead */}
{showRecordatoriosModal && leadParaRecordatorios && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-800">
            📅 Recordatorios - {leadParaRecordatorios.nombre}
          </h3>
          <p className="text-sm text-gray-600">
            {leadParaRecordatorios.telefono} | {leadParaRecordatorios.modelo}
          </p>
        </div>
        <button
          onClick={() => {
            setShowRecordatoriosModal(false);
            setLeadParaRecordatorios(null);
          }}
        >
          <X size={24} className="text-gray-600" />
        </button>
      </div>

      <button
        onClick={() => setShowAddRecordatorioModal(true)}
        className="w-full mb-4 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
      >
        <Plus size={20} />
        <span>Agregar Nuevo Recordatorio</span>
      </button>

      <div className="space-y-3">
        {(!leadParaRecordatorios.recordatorios || leadParaRecordatorios.recordatorios.length === 0) ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Calendar size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No hay recordatorios para este lead</p>
            <p className="text-sm text-gray-400 mt-2">
              Agrega recordatorios para hacer seguimiento
            </p>
          </div>
        ) : (
          leadParaRecordatorios.recordatorios
            .sort((a, b) => {
              const fechaA = new Date(`${a.fecha}T${a.hora}`);
              const fechaB = new Date(`${b.fecha}T${b.hora}`);
              return fechaB.getTime() - fechaA.getTime();
            })
            .map((recordatorio) => {
              const fechaHora = new Date(`${recordatorio.fecha}T${recordatorio.hora}`);
              const ahora = new Date();
              const esPasado = fechaHora < ahora;
              const esHoy = recordatorio.fecha === ahora.toISOString().split('T')[0];
              
              return (
                <div
                  key={recordatorio.id}
                  className={`border-l-4 p-4 rounded-lg ${
                    recordatorio.completado
                      ? "border-green-500 bg-green-50"
                      : esPasado
                      ? "border-red-500 bg-red-50"
                      : esHoy
                      ? "border-yellow-500 bg-yellow-50"
                      : "border-blue-500 bg-blue-50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <input
                        type="checkbox"
                        checked={recordatorio.completado}
                        onChange={() =>
                          handleToggleRecordatorio(leadParaRecordatorios.id, recordatorio.id)
                        }
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`font-medium ${recordatorio.completado ? "line-through text-gray-500" : "text-gray-900"}`}>
                            {new Date(recordatorio.fecha).toLocaleDateString("es-AR", {
                              weekday: "long",
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                          <span className={`text-sm ${recordatorio.completado ? "text-gray-400" : "text-gray-600"}`}>
                            {recordatorio.hora}
                          </span>
                          {esHoy && !recordatorio.completado && (
                            <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 text-xs font-medium rounded-full">
                              HOY
                            </span>
                          )}
                          {esPasado && !recordatorio.completado && (
                            <span className="px-2 py-0.5 bg-red-200 text-red-800 text-xs font-medium rounded-full">
                              VENCIDO
                            </span>
                          )}
                          {recordatorio.completado && (
                            <span className="px-2 py-0.5 bg-green-200 text-green-800 text-xs font-medium rounded-full">
                              ✓ COMPLETADO
                            </span>
                          )}
                        </div>
                        <p className={`text-sm ${recordatorio.completado ? "text-gray-500" : "text-gray-700"}`}>
                          {recordatorio.descripcion}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        handleEliminarRecordatorio(leadParaRecordatorios.id, recordatorio.id)
                      }
                      className="ml-2 p-1 text-red-600 hover:text-red-800"
                      title="Eliminar recordatorio"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={() => {
            setShowRecordatoriosModal(false);
            setLeadParaRecordatorios(null);
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cerrar
        </button>
      </div>
    </div>
  </div>
)}

{/* Modal: Agregar Recordatorio */}
{showAddRecordatorioModal && leadParaRecordatorios && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 w-full max-w-lg">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-gray-800">
          ➕ Nuevo Recordatorio
        </h3>
        <button onClick={() => setShowAddRecordatorioModal(false)}>
          <X size={24} className="text-gray-600" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha *
          </label>
          <input
            type="date"
            id="recordatorio-fecha"
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hora *
          </label>
          <input
            type="time"
            id="recordatorio-hora"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción *
          </label>
          <textarea
            id="recordatorio-desc"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="ej: Llamar para seguimiento, Enviar cotización, etc."
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-700">
            💡 <strong>Tip:</strong> Recibirás una alerta cuando llegue la fecha y hora del recordatorio
          </p>
        </div>
      </div>

      <div className="flex space-x-3 pt-6">
        <button
          onClick={handleAgregarRecordatorio}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Guardar Recordatorio
        </button>
        <button
          onClick={() => setShowAddRecordatorioModal(false)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}
{/* Modal: Cotizador Integrado */}
{showCotizadorModal && leadParaCotizacion && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl w-full max-w-6xl max-h-[95vh] overflow-y-auto m-4">
      <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-4 rounded-t-xl">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold">💰 Cotizador Inteligente</h3>
            <p className="text-sm opacity-90">
              {leadParaCotizacion.nombre} - {leadParaCotizacion.modelo}
            </p>
          </div>
          <button
            onClick={() => {
              setShowCotizadorModal(false);
              setLeadParaCotizacion(null);
              setCotizacionActual({});
            }}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Datos del vehículo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vehículo
            </label>
            <input
              type="text"
              value={leadParaCotizacion.modelo}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Precio Contado *
            </label>
            <input
              type="number"
              id="cotiz-precio"
              placeholder="25000000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              onChange={(e) => {
                setCotizacionActual(prev => ({
                  ...prev,
                  precioContado: Number(e.target.value)
                }));
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Anticipo
            </label>
            <input
              type="number"
              id="cotiz-anticipo"
              placeholder="7500000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              onChange={(e) => {
                setCotizacionActual(prev => ({
                  ...prev,
                  anticipo: Number(e.target.value)
                }));
              }}
            />
          </div>
        </div>

        {/* Usado en parte de pago */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-orange-900 mb-3 flex items-center">
            <span className="mr-2">🚗</span>
            Vehículo Usado como Parte de Pago
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción del Usado
              </label>
              <input
                type="text"
                defaultValue={leadParaCotizacion.infoUsado || ''}
                placeholder="Ej: Fiat Cronos 2020"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor Estimado del Usado
              </label>
              <input
                type="number"
                id="cotiz-usado"
                placeholder="8000000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                onChange={(e) => {
                  setCotizacionActual(prev => ({
                    ...prev,
                    valorUsado: Number(e.target.value)
                  }));
                }}
              />
            </div>
          </div>
        </div>

        {/* Botón para calcular */}
        <button
          onClick={() => {
            const precio = cotizacionActual.precioContado || 0;
            const anticipo = cotizacionActual.anticipo || 0;
            const usado = cotizacionActual.valorUsado || 0;

            if (precio === 0) {
              alert('Ingresa el precio del vehículo');
              return;
            }

            const planes = generarPlanesCotizacion(precio, anticipo, usado);
            setCotizacionActual(prev => ({
              ...prev,
              planes
            }));
          }}
          className="w-full mb-6 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
        >
          🧮 Calcular Planes de Financiación
        </button>

        {/* Resultados de planes */}
        {cotizacionActual.planes && cotizacionActual.planes.length > 0 && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-bold text-blue-900 mb-2">📊 Resumen Financiero</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Precio Contado</p>
                  <p className="font-bold text-blue-900">
                    ${cotizacionActual.precioContado?.toLocaleString('es-AR')}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Anticipo</p>
                  <p className="font-bold text-green-700">
                    ${cotizacionActual.anticipo?.toLocaleString('es-AR') || 0}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Valor Usado</p>
                  <p className="font-bold text-orange-700">
                    ${cotizacionActual.valorUsado?.toLocaleString('es-AR') || 0}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">A Financiar</p>
                  <p className="font-bold text-purple-700">
                    ${cotizacionActual.planes[0]?.totalFinanciado.toLocaleString('es-AR')}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6">
              <h4 className="font-bold text-gray-900 mb-4 text-lg">
                💳 Planes de Financiación Disponibles
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cotizacionActual.planes.map((plan, index) => (
                  <div
                    key={index}
                    className={`bg-white rounded-lg p-4 border-2 transition-all hover:shadow-lg cursor-pointer ${
                      index === 1 ? 'border-blue-500 shadow-md' : 'border-gray-200'
                    }`}
                  >
                    {index === 1 && (
                      <div className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full inline-block mb-2">
                        ⭐ MÁS POPULAR
                      </div>
                    )}
                    <div className="text-center mb-3">
                      <p className="text-3xl font-bold text-gray-900">
                        {plan.cuotas}
                      </p>
                      <p className="text-sm text-gray-600">cuotas</p>
                    </div>
                    <div className="text-center mb-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-700">
                        ${plan.valorCuota.toLocaleString('es-AR')}
                      </p>
                      <p className="text-xs text-gray-600">por mes</p>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tasa:</span>
                        <span className="font-semibold">{plan.tasaInteres}% anual</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total a pagar:</span>
                        <span className="font-semibold text-purple-700">
                          ${(plan.valorCuota * plan.cuotas).toLocaleString('es-AR')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bonificaciones y notas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🎁 Bonificaciones Especiales
                </label>
                <textarea
                  id="cotiz-bonif"
                  rows={3}
                  placeholder="Ej: Bonificación por pago contado, descuento por mes de la patria..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📝 Notas Adicionales
                </label>
                <textarea
                  id="cotiz-notas"
                  rows={3}
                  placeholder="Información adicional para el cliente..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Botón para enviar por WhatsApp */}
            <button
              onClick={() => {
                if (!cotizacionActual.planes) return;

                const lead = leadParaCotizacion;
                let mensaje = `Hola ${lead.nombre}! 👋\n\n`;
                mensaje += `Te envío la cotización detallada del *${lead.modelo}*\n\n`;
                
                mensaje += `💰 *PRECIO CONTADO:* $${cotizacionActual.precioContado?.toLocaleString('es-AR')}\n\n`;
                
                if (cotizacionActual.anticipo) {
                  mensaje += `💵 *ANTICIPO:* $${cotizacionActual.anticipo.toLocaleString('es-AR')}\n`;
                }
                
                if (cotizacionActual.valorUsado) {
                  mensaje += `🚗 *TU USADO:* $${cotizacionActual.valorUsado.toLocaleString('es-AR')}\n`;
                }
                
                mensaje += `\n💳 *PLANES DE FINANCIACIÓN:*\n\n`;
                
                cotizacionActual.planes.forEach((plan, idx) => {
                  mensaje += `${idx === 1 ? '⭐ ' : ''}*${plan.cuotas} cuotas* de $${plan.valorCuota.toLocaleString('es-AR')}\n`;
mensaje += `   Total: $${(plan.valorCuota * plan.cuotas).toLocaleString('es-AR')}\n\n`;
                });

                const bonif = (document.getElementById('cotiz-bonif') as HTMLTextAreaElement)?.value;
                if (bonif) {
                  mensaje += `\n🎁 *BONIFICACIONES:*\n${bonif}\n`;
                }

                const notas = (document.getElementById('cotiz-notas') as HTMLTextAreaElement)?.value;
                if (notas) {
                  mensaje += `\n📝 ${notas}\n`;
                }
                
                mensaje += `\n¿Te gustaría coordinar una visita al showroom para verlo personalmente?\n\n`;
                mensaje += `Saludos! 😊`;
                
                const phoneNumber = lead.telefono.replace(/\D/g, '');
                const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(mensaje)}`;
                window.open(whatsappUrl, '_blank');
                
                // Marcar tarea como completada si existe
                const tareaRelacionada = tareasPendientes.find(
                  t => t.leadId === lead.id && t.tipo === 'cotizar' && !t.completada
                );
                if (tareaRelacionada) {
                  completarTarea(tareaRelacionada.id);
                }
                
                setShowCotizadorModal(false);
                setLeadParaCotizacion(null);
                setCotizacionActual({});
              }}
              className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold rounded-lg hover:from-green-600 hover:to-blue-600 transition-all shadow-lg text-lg"
            >
              💬 Enviar Cotización por WhatsApp
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
)}
{/* Modal: Plantillas WhatsApp */}
{showPlantillasModal && leadParaWhatsApp && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-800">
            💬 Plantillas de WhatsApp
          </h3>
          <p className="text-sm text-gray-600">
            {leadParaWhatsApp.nombre} - {leadParaWhatsApp.telefono}
          </p>
        </div>
        <button
          onClick={() => {
            setShowPlantillasModal(false);
            setLeadParaWhatsApp(null);
          }}
        >
          <X size={24} className="text-gray-600" />
        </button>
      </div>

      <div className="space-y-3">
        {Object.entries(plantillasWhatsApp).map(([key, plantilla]) => {
          const mensaje = plantilla.plantilla(
            leadParaWhatsApp.nombre,
            leadParaWhatsApp.modelo,
            currentUser?.name || 'Vendedor'
          );
          
          return (
            <button
              key={key}
              onClick={() => {
                const phoneNumber = leadParaWhatsApp.telefono.replace(/\D/g, '');
                const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(mensaje)}`;
                window.open(whatsappUrl, '_blank');
                
                // Agregar nota interna automática
                const notaAuto: NotaInterna = {
                  id: Date.now(),
                  leadId: leadParaWhatsApp.id,
                  texto: `Envió plantilla "${plantilla.nombre}" por WhatsApp`,
                  usuario: currentUser?.name || 'Sistema',
                  userId: currentUser?.id || 0,
                  timestamp: new Date().toISOString(),
                };
                
                setLeads((prev) =>
                  prev.map((l) =>
                    l.id === leadParaWhatsApp.id
                      ? {
                          ...l,
                          notasInternas: [...(l.notasInternas || []), notaAuto],
                        }
                      : l
                  )
                );
                
                setShowPlantillasModal(false);
                setLeadParaWhatsApp(null);
              }}
              className="w-full p-4 border-2 border-gray-200 rounded-lg text-left hover:border-green-500 hover:bg-green-50 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-2xl">{plantilla.emoji}</span>
                    <p className="font-semibold text-gray-900 group-hover:text-green-700">
                      {plantilla.nombre}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-3 whitespace-pre-wrap">
                    {mensaje}
                  </p>
                </div>
                <div className="ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-green-600">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.89 3.587"/>
                  </svg>
                </div>
              </div>
            </button>
          );
        })}
        
        {/* Opción de mensaje personalizado */}
        <button
          onClick={() => {
            const phoneNumber = leadParaWhatsApp.telefono.replace(/\D/g, '');
            const mensaje = `Hola ${leadParaWhatsApp.nombre}! Soy ${currentUser?.name} de auto del sol. `;
            const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(mensaje)}`;
            window.open(whatsappUrl, '_blank');
            setShowPlantillasModal(false);
            setLeadParaWhatsApp(null);
          }}
          className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-left hover:border-blue-500 hover:bg-blue-50 transition-all"
        >
          <div className="flex items-center space-x-2">
            <span className="text-2xl">✍️</span>
            <div>
              <p className="font-semibold text-gray-900">Mensaje Personalizado</p>
              <p className="text-sm text-gray-600">Escribir mensaje desde cero</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
)}
{/* Modal: Notas Internas */}
{showNotasModal && leadParaNotas && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-800 flex items-center">
            <span className="mr-2">📝</span>
            Notas Internas del Equipo
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {leadParaNotas.nombre} - {leadParaNotas.telefono} | {leadParaNotas.modelo}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            💡 Estas notas son privadas y solo las ve el equipo interno
          </p>
        </div>
        <button
          onClick={() => {
            setShowNotasModal(false);
            setLeadParaNotas(null);
          }}
        >
          <X size={24} className="text-gray-600" />
        </button>
      </div>

      {/* Timeline de notas */}
      <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
        {(!leadParaNotas.notasInternas || leadParaNotas.notasInternas.length === 0) ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <span className="text-4xl mb-3 block">📋</span>
            <p className="text-gray-500">No hay notas internas para este lead</p>
            <p className="text-sm text-gray-400 mt-2">
              Agrega la primera nota para comenzar el seguimiento
            </p>
          </div>
        ) : (
          leadParaNotas.notasInternas
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .map((nota) => {
              const esNotaPropia = nota.userId === currentUser?.id;
              
              return (
                <div
                  key={nota.id}
                  className={`border-l-4 p-4 rounded-lg ${
                    esNotaPropia 
                      ? "border-blue-500 bg-blue-50" 
                      : "border-gray-300 bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-semibold text-gray-900">
                          {nota.usuario}
                        </span>
                        {esNotaPropia && (
                          <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                            Tú
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {new Date(nota.timestamp).toLocaleDateString("es-AR", {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {nota.texto}
                      </p>
                    </div>
                    {(esNotaPropia || canManageUsers()) && (
                      <button
                        onClick={() => handleEliminarNota(leadParaNotas.id, nota.id)}
                        className="ml-2 p-1 text-red-600 hover:text-red-800"
                        title="Eliminar nota"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
        )}
      </div>

      {/* Agregar nueva nota */}
      <div className="border-t pt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ✍️ Agregar nueva nota interna
        </label>
        <textarea
          id="nueva-nota-interna"
          placeholder="Ej: Cliente pidió descuento, esperando aprobación de gerencia..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
        />
        <div className="flex space-x-3 mt-3">
          <button
            onClick={handleAgregarNota}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Agregar Nota
          </button>
          <button
            onClick={() => {
              setShowNotasModal(false);
              setLeadParaNotas(null);
            }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  </div>
)}
{/* Modal: Asignar/Editar Meta */}
{showMetasModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 w-full max-w-lg">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-gray-800">
          {editingMeta && editingMeta.id ? '✏️ Editar Meta' : '🎯 Asignar Nueva Meta'}
        </h3>
        <button
          onClick={() => {
            setShowMetasModal(false);
            setEditingMeta(null);
          }}
        >
          <X size={24} className="text-gray-600" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Vendedor *
          </label>
          <select
            id="meta-vendedor"
            defaultValue={editingMeta?.vendedor_id || ''}
            disabled={editingMeta && editingMeta.id ? true : false}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Seleccionar vendedor</option>
            {getVisibleUsers()
              .filter((u: any) => u.role === "vendedor" && u.active)
              .map((vendedor: any) => (
                <option key={vendedor.id} value={vendedor.id}>
                  {vendedor.name} - {userById.get(vendedor.reportsTo)?.name || 'Sin supervisor'}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mes *
          </label>
          <input
            type="month"
            id="meta-mes"
            defaultValue={editingMeta?.mes || new Date().toISOString().slice(0, 7)}
            disabled={editingMeta && editingMeta.id ? true : false}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Meta de Ventas *
          </label>
          <input
            type="number"
            id="meta-ventas"
            defaultValue={editingMeta?.meta_ventas || ''}
            min="0"
            placeholder="Ej: 5"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Cantidad de ventas (leads en estado "Vendido") que debe lograr
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Meta de Leads Gestionados *
          </label>
          <input
            type="number"
            id="meta-leads"
            defaultValue={editingMeta?.meta_leads || ''}
            min="0"
            placeholder="Ej: 25"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Cantidad total de leads que debe gestionar en el mes
          </p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-purple-800">
            💡 <strong>Consejo:</strong> Las metas realistas motivan mejor. 
            Analiza el desempeño histórico antes de asignar.
          </p>
        </div>
      </div>

      <div className="flex space-x-3 pt-6">
        <button
  onClick={async () => {
    const vendedor_id = parseInt(
      (document.getElementById('meta-vendedor') as HTMLSelectElement).value
    );
    const mes = (document.getElementById('meta-mes') as HTMLInputElement).value;
    const meta_ventas = parseInt(
      (document.getElementById('meta-ventas') as HTMLInputElement).value
    );
    const meta_leads = parseInt(
      (document.getElementById('meta-leads') as HTMLInputElement).value
    );

    if (!vendedor_id || !mes || !meta_ventas || !meta_leads) {
      alert('Por favor completa todos los campos');
      return;
    }

    try {
      if (editingMeta && editingMeta.id) {
        // Actualizar meta existente
        const metaActualizada = await apiUpdateMeta(editingMeta.id, {
          meta_ventas: meta_ventas,
          meta_leads: meta_leads,
        });
        setMetas(prev => prev.map(m => m.id === editingMeta.id ? metaActualizada : m));
      } else {
        // Crear nueva meta
        const nuevaMeta = await apiCreateMeta({
          vendedor_id: vendedor_id,
          mes,
          meta_ventas: meta_ventas,
          meta_leads: meta_leads,
        });
        setMetas(prev => [...prev, nuevaMeta]);
      }

      setShowMetasModal(false);
      setEditingMeta(null);
      alert('Meta guardada exitosamente');
    } catch (error: any) {
      console.error('Error guardando meta:', error);
      alert(error.response?.data?.error || 'Error al guardar la meta');
    }
  }}
          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
        >
          {editingMeta && editingMeta.id ? 'Actualizar Meta' : 'Asignar Meta'}
        </button>
        <button
          onClick={() => {
            setShowMetasModal(false);
            setEditingMeta(null);
          }}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}
{/* Modal: Asignar Tarea a Vendedor */}
{showAsignarTareaModal && leadParaAsignarTarea && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-800">
            📋 Asignar Tarea a Vendedor
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Lead: {leadParaAsignarTarea.nombre} - {leadParaAsignarTarea.telefono}
          </p>
        </div>
        <button
          onClick={() => {
            setShowAsignarTareaModal(false);
            setLeadParaAsignarTarea(null);
            setVendedorSeleccionadoTarea(null);
          }}
        >
          <X size={24} className="text-gray-600" />
        </button>
      </div>

      {/* Información del lead */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-4 border-l-4 border-blue-500">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="font-medium text-gray-700">Cliente:</span>{" "}
            <span className="text-gray-900 font-semibold">{leadParaAsignarTarea.nombre}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Teléfono:</span>{" "}
            <span className="text-gray-900">{leadParaAsignarTarea.telefono}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Vehículo:</span>{" "}
            <span className="text-gray-900">{leadParaAsignarTarea.modelo}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Estado:</span>{" "}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${estados[leadParaAsignarTarea.estado].color}`}>
              {estados[leadParaAsignarTarea.estado].label}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Seleccionar vendedor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Asignar Tarea A: *
          </label>
          <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
            {getVisibleUsers()
              .filter((u: any) => u.role === "vendedor" && u.active)
              .map((vendedor: any) => {
                const tareasActuales = tareasPendientes.filter(
                  t => t.asignadoA === vendedor.id && !t.completada
                ).length;

                return (
                  <div
                    key={vendedor.id}
                    onClick={() => setVendedorSeleccionadoTarea(vendedor.id)}
                    className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                      vendedorSeleccionadoTarea === vendedor.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-sm">
                            {vendedor.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{vendedor.name}</p>
                          <p className="text-xs text-gray-500">
                            {userById.get(vendedor.reportsTo)?.name || 'Sin supervisor'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Tareas pendientes</p>
                        <p className={`font-bold ${
                          tareasActuales === 0 ? 'text-green-600' :
                          tareasActuales < 3 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {tareasActuales}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 Se muestra la carga actual de tareas de cada vendedor
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Tarea *
            </label>
            <select
              id="tarea-tipo"
              defaultValue="llamar"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="llamar">📞 Llamar al Cliente</option>
              <option value="whatsapp">💬 Enviar WhatsApp</option>
              <option value="email">📧 Enviar Email</option>
              <option value="cotizar">💰 Preparar Cotización</option>
              <option value="seguimiento">👁️ Hacer Seguimiento</option>
              {leadParaAsignarTarea.estado === 'perdido' && (
                <option value="recuperar_perdido">🔄 Intentar Recuperar Lead</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prioridad *
            </label>
            <select
              id="tarea-prioridad"
              defaultValue="media"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="alta">🔴 Alta - Urgente</option>
              <option value="media">🟡 Media - Normal</option>
              <option value="baja">🔵 Baja - Cuando pueda</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Límite *
            </label>
            <input
              type="date"
              id="tarea-fecha"
              min={new Date().toISOString().split('T')[0]}
              defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hora Límite
            </label>
            <input
              type="time"
              id="tarea-hora"
              defaultValue="18:00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Instrucciones para el Vendedor *
          </label>
          <textarea
            id="tarea-descripcion"
            rows={4}
            placeholder="Ej: Llamar al cliente para ofrecerle descuento del 10% si cierra esta semana..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Plantillas rápidas */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm font-medium text-purple-900 mb-3">
            ⚡ Plantillas Rápidas:
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                (document.getElementById('tarea-descripcion') as HTMLTextAreaElement).value = 
                  `Llamar a ${leadParaAsignarTarea.nombre} para hacer seguimiento del ${leadParaAsignarTarea.modelo}. Verificar interés y ofrecerle test drive.`;
              }}
              className="px-3 py-2 text-xs bg-white border border-purple-300 text-purple-700 rounded hover:bg-purple-100 text-left"
            >
              📞 Seguimiento + Test Drive
            </button>
            <button
              onClick={() => {
                (document.getElementById('tarea-descripcion') as HTMLTextAreaElement).value = 
                  `Enviar cotización actualizada del ${leadParaAsignarTarea.modelo} con descuentos vigentes. Incluir comparativa de planes de financiación.`;
              }}
              className="px-3 py-2 text-xs bg-white border border-purple-300 text-purple-700 rounded hover:bg-purple-100 text-left"
            >
              💰 Cotización con descuentos
            </button>
            <button
              onClick={() => {
                (document.getElementById('tarea-descripcion') as HTMLTextAreaElement).value = 
                  `Contactar a ${leadParaAsignarTarea.nombre} por WhatsApp para resolver dudas sobre el ${leadParaAsignarTarea.modelo}. Ser proactivo y ofrecer ayuda.`;
              }}
              className="px-3 py-2 text-xs bg-white border border-purple-300 text-purple-700 rounded hover:bg-purple-100 text-left"
            >
              💬 Contacto por WhatsApp
            </button>
            {leadParaAsignarTarea.estado === 'perdido' && (
              <button
                onClick={() => {
                  (document.getElementById('tarea-descripcion') as HTMLTextAreaElement).value = 
                    `RECUPERAR LEAD PERDIDO: Contactar a ${leadParaAsignarTarea.nombre} con nueva oferta especial para ${leadParaAsignarTarea.modelo}. Intentar reactivar interés.`;
                  (document.getElementById('tarea-prioridad') as HTMLSelectElement).value = 'alta';
                }}
                className="px-3 py-2 text-xs bg-white border border-orange-300 text-orange-700 rounded hover:bg-orange-100 text-left"
              >
                🔄 Recuperar Lead Perdido
              </button>
            )}
          </div>
        </div>

        {/* Preview de la tarea */}
        {vendedorSeleccionadoTarea && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-medium text-green-900 mb-2">
              ✅ Vista Previa de la Asignación:
            </p>
            <p className="text-sm text-green-800">
              <strong>{userById.get(vendedorSeleccionadoTarea)?.name}</strong> recibirá una alerta 
              y verá esta tarea en su sección "Mis Tareas" con la prioridad seleccionada.
            </p>
          </div>
        )}
      </div>

      <div className="flex space-x-3 pt-6">
        <button
          onClick={handleAsignarTareaAVendedor}
          disabled={!vendedorSeleccionadoTarea}
          className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
            vendedorSeleccionadoTarea
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {vendedorSeleccionadoTarea
            ? `✅ Asignar Tarea a ${userById.get(vendedorSeleccionadoTarea)?.name}`
            : '⚠️ Selecciona un Vendedor'}
        </button>
        <button
          onClick={() => {
            setShowAsignarTareaModal(false);
            setLeadParaAsignarTarea(null);
            setVendedorSeleccionadoTarea(null);
          }}
          className="px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}
{/* Modal: Seleccionar Lead para Asignar Tarea */}
{showSeleccionarLeadModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-gray-800">
          Seleccionar Lead para Asignar Tarea
        </h3>
        <button
          onClick={() => {
            setShowSeleccionarLeadModal(false);
          }}
        >
          <X size={24} className="text-gray-600" />
        </button>
      </div>

      {/* Buscador */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o modelo..."
            id="buscar-lead-tarea"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Lista de leads */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {(() => {
          const searchTerm = (document.getElementById('buscar-lead-tarea') as HTMLInputElement)?.value?.toLowerCase() || '';
          
          return getFilteredLeads()
            .filter(l => 
              l.estado !== 'vendido' && 
              l.estado !== 'numero_invalido' &&
              l.vendedor &&
              (searchTerm === '' || 
               l.nombre.toLowerCase().includes(searchTerm) ||
               l.telefono.includes(searchTerm) ||
               l.modelo.toLowerCase().includes(searchTerm))
            )
            .map(lead => {
              const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
              
              return (
                <div
                  key={lead.id}
                  onClick={() => {
                    setLeadParaAsignarTarea(lead);
                    setVendedorSeleccionadoTarea(lead.vendedor);
                    setShowSeleccionarLeadModal(false);
                    setShowAsignarTareaModal(true);
                  }}
                  className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className={`w-3 h-3 rounded-full ${estados[lead.estado].color}`}></div>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{lead.nombre}</p>
                          <p className="text-sm text-gray-600">{lead.telefono} • {lead.modelo}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${estados[lead.estado].color}`}>
                              {estados[lead.estado].label}
                            </span>
                            <span className="text-xs text-gray-500">
                              {fuentes[lead.fuente]?.icon} {fuentes[lead.fuente]?.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-medium text-gray-700">
                        {vendedor?.name || 'Sin vendedor'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {lead.fecha ? new Date(lead.fecha).toLocaleDateString('es-AR') : 'Sin fecha'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            });
        })()}
      </div>

      {(() => {
        const leadsDisponibles = getFilteredLeads().filter(l => 
          l.estado !== 'vendido' && 
          l.estado !== 'numero_invalido' &&
          l.vendedor
        );

        if (leadsDisponibles.length === 0) {
          return (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500">No hay leads activos con vendedores asignados</p>
              <p className="text-sm text-gray-400 mt-2">
                Asigna vendedores a los leads primero
              </p>
            </div>
          );
        }
        return null;
      })()}

      <div className="mt-6 flex justify-end">
        <button
          onClick={() => {
            setShowSeleccionarLeadModal(false);
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}
      </div>
    </div>
  );
}

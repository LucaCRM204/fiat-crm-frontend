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

// ===== Utilidades de jerarquía =====
function buildIndex(users) {
  const byId = new Map(users.map((u) => [u.id, u]));
  const children = new Map();
  users.forEach((u) => children.set(u.id, []));
  users.forEach((u) => {
    if (u.reportsTo) children.get(u.reportsTo)?.push(u.id);
  });
  return { byId, children };
}

function getDescendantUserIds(rootId, childrenIndex) {
  const out = [];
  const stack = [...(childrenIndex.get(rootId) || [])];
  console.log(`=== getDescendantUserIds para ID ${rootId} ===`);
  console.log('Hijos directos:', childrenIndex.get(rootId));
  while (stack.length) {
    const id = stack.pop();
    out.push(id);
    const kids = childrenIndex.get(id) || [];
    for (const k of kids) stack.push(k);
  }
  console.log('Descendientes totales:', out);
  return out;
}

const roles = {
  owner: "Dueño",
  gerente_general: "Gerente General",
  gerente: "Gerente",
  supervisor: "Supervisor",
  vendedor: "Vendedor",
};

const estados = {
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

const fuentes = {
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
const botConfig = {
  whatsapp_bot_cm1: { targetTeam: "sauer", label: "Bot CM 1" },
  whatsapp_bot_cm2: { targetTeam: "daniel", label: "Bot CM 2" },
  whatsapp_100: { targetTeam: null, label: "Bot 100" },
};

// ===== Funciones de descarga Excel =====
const formatDate = (dateString) => {
  if (!dateString) return "Sin fecha";
  const date = new Date(dateString);
  return date.toLocaleDateString("es-AR");
};

const downloadAllLeadsExcel = (leads, userById, fuentes) => {
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

  const headers = Object.keys(excelData[0] || {});
  const csvContent = [
    headers.join(','),
    ...excelData.map(row => 
      headers.map(header => {
        const value = row[header] || '';
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');

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

const downloadLeadsByStateExcel = (leads, estado, userById, fuentes) => {
  const leadsByState = leads.filter(l => l.estado === estado);

  if (leadsByState.length === 0) {
    alert(`No hay leads en estado "${estados[estado]?.label || estado}"`);
    return;
  }

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

  const headers = Object.keys(excelData[0] || {});
  const csvContent = [
    headers.join(','),
    ...excelData.map(row => 
      headers.map(header => {
        const value = row[header] || '';
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');

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
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const { byId: userById, children: childrenIndex } = useMemo(
    () => buildIndex(users),
    [users]
  );

  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [loginError, setLoginError] = useState("");
  const [selectedEstado, setSelectedEstado] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState("todos");

  // Estados para búsqueda y filtrado de leads
  const [searchText, setSearchText] = useState("");
  const [selectedVendedorFilter, setSelectedVendedorFilter] = useState(null);
  const [selectedEstadoFilter, setSelectedEstadoFilter] = useState("");
  const [selectedFuenteFilter, setSelectedFuenteFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Estados para filtrado de usuarios
  const [userSearchText, setUserSearchText] = useState("");
  const [selectedTeamFilter, setSelectedTeamFilter] = useState("todos");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("todos");
  const [userSortBy, setUserSortBy] = useState("team");
  const [showUserFilters, setShowUserFilters] = useState(false);

  // Estados para reasignación
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [leadToReassign, setLeadToReassign] = useState(null);
  const [selectedVendorForReassign, setSelectedVendorForReassign] = useState(null);

  // Estados para confirmación de eliminación
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // Estados para confirmación de eliminación de leads
  const [showDeleteLeadConfirmModal, setShowDeleteLeadConfirmModal] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState(null);

  // Estados para modales
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [showObservacionesModal, setShowObservacionesModal] = useState(false);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [editingLeadObservaciones, setEditingLeadObservaciones] = useState(null);
  const [viewingLeadHistorial, setViewingLeadHistorial] = useState(null);

  // Estados para calendario
  const [events, setEvents] = useState([]);
  const [selectedCalendarUserId, setSelectedCalendarUserId] = useState(null);
  const [showNewEventModal, setShowNewEventModal] = useState(false);

  // Estados para gestión de usuarios
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [modalRole, setModalRole] = useState("vendedor");
  const [modalReportsTo, setModalReportsTo] = useState(null);

  // Estados para presupuestos
  const [presupuestos, setPresupuestos] = useState([]);
  const [showPresupuestoModal, setShowPresupuestoModal] = useState(false);
  const [editingPresupuesto, setEditingPresupuesto] = useState(null);
  const [showPresupuestoSelectModal, setShowPresupuestoSelectModal] = useState(false);
  const [selectedLeadForPresupuesto, setSelectedLeadForPresupuesto] = useState(null);

  // ===== Login contra backend =====
  const handleLogin = async (email, password) => {
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

        const u = r.data.user || {
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
        const mappedLeads = (ll || []).map((L) => ({
          id: L.id,
          nombre: L.nombre,
          telefono: L.telefono,
          modelo: L.modelo,
          formaPago: L.formaPago,
          infoUsado: L.infoUsado,
          entrega: L.entrega,
          fecha: L.fecha || L.created_at || "",
          estado: L.estado || "nuevo",
          vendedor: L.assigned_to ?? null,
          notas: L.notas || "",
          fuente: L.fuente || "otro",
          historial: L.historial || [],
          created_by: L.created_by || null,
        }));
        setUsers(uu || []);
        setLeads(mappedLeads);

        try {
          const pp = await listPresupuestos();
          setPresupuestos(pp || []);
        } catch (error) {
          console.error('Error cargando presupuestos:', error);
        }
      } else {
        throw new Error("Respuesta inválida del servidor");
      }
    } catch (err) {
      setLoginError(err?.response?.data?.error || "Credenciales incorrectas");
      setIsAuthenticated(false);
    }
  };

  // ===== Acceso por rol =====
  const getAccessibleUserIds = (user) => {
    if (!user) return [];
    if (["owner", "gerente_general", "dueño"].includes(user.role))
      return users.map((u) => u.id);
    const ids = [user.id, ...getDescendantUserIds(user.id, childrenIndex)];
    return ids;
  };

  const canCreateUsers = () =>
    currentUser && ["owner", "gerente_general", "gerente"].includes(currentUser.role);

  const canManageUsers = () =>
    currentUser && ["owner", "gerente_general", "gerente", "dueño"].includes(currentUser.role);
  
  const isOwner = () => currentUser?.role === "owner" || currentUser?.role === "dueño";

  const canCreateLeads = () =>
    currentUser && ["owner", "gerente_general", "gerente", "supervisor", "vendedor"].includes(currentUser.role);

  const canDeleteLeads = () => {
    const canDelete = currentUser && ["owner", "dueño"].includes(currentUser.role);
    return canDelete;
  };

  // ===== Funciones de filtro por equipo =====
  const getTeamManagerById = (teamId) => {
    if (teamId === "todos") return null;
    return users.find(
      (u) => u.role === "gerente" && u.id.toString() === teamId
    );
  };

  const getTeamUserIds = (teamId) => {
    if (teamId === "todos") return [];
    const manager = getTeamManagerById(teamId);
    if (!manager) return [];

    const descendants = getDescendantUserIds(manager.id, childrenIndex);
    return [manager.id, ...descendants];
  };

  const getFilteredLeadsByTeam = (teamId) => {
    if (!currentUser) return [];

    if (teamId && teamId !== "todos" && ["owner", "gerente_general", "dueño"].includes(currentUser.role)) {
      const teamUserIds = getTeamUserIds(teamId);
      return leads.filter((l) => l.vendedor && teamUserIds.includes(l.vendedor));
    }

    return getFilteredLeads();
  };

  const getAvailableVendorsForAssignment = () => {
    if (!currentUser) return [];

    const visibleUserIds = getAccessibleUserIds(currentUser);
    
    return users.filter((u) => {
      if (u.role !== "vendedor" || !u.active) return false;
      if (!visibleUserIds.includes(u.id)) return false;
      return true;
    });
  };

  const getVisibleUsers = () => {
    if (!currentUser) return [];

    return users.filter((u) => {
      if (currentUser.role === "owner") return true;

      if (currentUser.role === "gerente_general") return u.role !== "owner";

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

  // ===== Funciones para filtrar y ordenar usuarios =====
  const getFilteredAndSortedUsers = () => {
    let filteredUsers = getVisibleUsers();

    if (userSearchText.trim()) {
      const searchLower = userSearchText.toLowerCase().trim();
      filteredUsers = filteredUsers.filter((u) => {
        const manager = u.reportsTo ? userById.get(u.reportsTo) : null;
        return (
          u.name.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower) ||
          (roles[u.role] || u.role).toLowerCase().includes(searchLower) ||
          (manager && manager.name.toLowerCase().includes(searchLower))
        );
      });
    }

    if (selectedTeamFilter !== "todos") {
      if (selectedTeamFilter === "sin_equipo") {
        filteredUsers = filteredUsers.filter((u) => !u.reportsTo);
      } else {
        const teamUserIds = getTeamUserIds(selectedTeamFilter);
        filteredUsers = filteredUsers.filter((u) => 
          teamUserIds.includes(u.id) || u.id.toString() === selectedTeamFilter
        );
      }
    }

    if (selectedRoleFilter !== "todos") {
      filteredUsers = filteredUsers.filter((u) => u.role === selectedRoleFilter);
    }

    filteredUsers.sort((a, b) => {
      switch (userSortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "role":
          const roleOrder = ["owner", "gerente_general", "gerente", "supervisor", "vendedor"];
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
              return bVentas - aVentas;
            }
            return bLeads.length - aLeads.length;
          }
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
    if (!currentUser) return [];

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

  const clearFilters = () => {
    setSearchText("");
    setSelectedVendedorFilter(null);
    setSelectedEstadoFilter("");
    setSelectedFuenteFilter("");
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (searchText.trim()) count++;
    if (selectedVendedorFilter) count++;
    if (selectedEstadoFilter) count++;
    if (selectedFuenteFilter) count++;
    return count;
  };

  const getAvailableVendorsForReassign = () => {
    if (!currentUser) return [];

    const visibleUsers = getVisibleUsers();
    return visibleUsers.filter((u) => u.role === "vendedor" && u.active);
  };

  const openReassignModal = (lead) => {
    setLeadToReassign(lead);
    setSelectedVendorForReassign(lead.vendedor);
    setShowReassignModal(true);
  };

  const handleReassignLead = async () => {
    if (!leadToReassign) return;

    try {
      await apiUpdateLead(
        leadToReassign.id,
        { vendedor: selectedVendorForReassign }
      );

      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadToReassign.id
            ? { ...l, vendedor: selectedVendorForReassign }
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

      addHistorialEntry(
        leadToReassign.id,
        `Reasignado a ${
          selectedVendorForReassign
            ? userById.get(selectedVendorForReassign)?.name
            : "Sin asignar"
        }`
      );

      setShowReassignModal(false);
      setLeadToReassign(null);
      setSelectedVendorForReassign(null);
    } catch (e) {
      console.error("No pude reasignar el lead", e);
    }
  };

  const openDeleteLeadConfirm = (lead) => {
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
      alert("Lead eliminado exitosamente");
    } catch (e) {
      console.error("No pude eliminar el lead", e);
      alert(`Error al eliminar el lead: ${e?.response?.data?.error || e.message}`);
    }
  };

  // ===== Round-robin =====
  const [rrIndex, setRrIndex] = useState(0);

  const getActiveVendorIdsInScope = (scopeUser) => {
    if (!scopeUser) return [];
    const scope = getAccessibleUserIds(scopeUser);
    return users
      .filter(
        (u) => u.role === "vendedor" && u.active && scope.includes(u.id)
      )
      .map((u) => u.id);
  };

  const getVendorsByTeam = (teamName) => {
    const manager = users.find(
      (u) =>
        u.role === "gerente" &&
        u.name.toLowerCase().includes(teamName.toLowerCase())
    );

    if (!manager) return [];

    const descendants = getDescendantUserIds(manager.id, childrenIndex);
    return users
      .filter(
        (u) =>
          u.role === "vendedor" && u.active && descendants.includes(u.id)
      )
      .map((u) => u.id);
  };

  const pickNextVendorId = (scopeUser, botSource) => {
    let pool = [];

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

  // ===== Alertas =====
  const [alerts, setAlerts] = useState([]);
  const nextAlertId = useRef(1);

  const pushAlert = (userId, type, message) => {
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

  const pushAlertToChain = (vendorId, type, message) => {
    pushAlert(vendorId, type, message);
    const sup = users.find((u) => u.id === userById.get(vendorId)?.reportsTo);
    if (sup) pushAlert(sup.id, type, message);
    const gerente = sup ? users.find((u) => u.id === sup.reportsTo) : null;
    if (gerente) pushAlert(gerente.id, type, message);
  };

  const unreadAlerts = alerts.filter(a => a.userId === currentUser?.id && !a.read).length;

  // ===== Filtrados y ranking =====
  const visibleUserIds = useMemo(
    () => getAccessibleUserIds(currentUser),
    [currentUser, users]
  );

  const getFilteredLeads = () => {
    if (!currentUser) return [];
    
    const visibleUserIds = getAccessibleUserIds(currentUser);
    return leads.filter((l) =>
      l.vendedor && visibleUserIds.includes(l.vendedor)
    );
  };

  const getRanking = () => {
    const vendedores = users.filter((u) => u.role === "vendedor");
    return vendedores
      .map((v) => {
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
      (u) => u.role === "vendedor" && visibleUserIds.includes(u.id)
    );
    return vendedores
      .map((v) => {
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
        (u) => u.role === "vendedor" && teamUserIds.includes(u.id)
      );
      
      return vendedores
        .map((v) => {
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

  const prevRankingRef = useRef(new Map());

  useEffect(() => {
    const r = getRanking();
    const curr = new Map();
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

  const getDashboardStats = (teamFilter) => {
    let filteredLeads;
    
    if (teamFilter && teamFilter !== "todos" && ["owner", "gerente_general", "dueño"].includes(currentUser?.role)) {
      const teamUserIds = getTeamUserIds(teamFilter);
      filteredLeads = leads.filter((l) => l.vendedor && teamUserIds.includes(l.vendedor));
    } else {
      filteredLeads = getFilteredLeads();
    }
    
    const vendidos = filteredLeads.filter((lead) => lead.estado === "vendido").length;
    const conversion = filteredLeads.length > 0
      ? ((vendidos / filteredLeads.length) * 100).toFixed(1)
      : "0";
    
    return { totalLeads: filteredLeads.length, vendidos, conversion };
  };

  const getSourceMetrics = (teamFilter) => {
    let filteredLeads;
    
    if (teamFilter && teamFilter !== "todos" && ["owner", "gerente_general", "dueño"].includes(currentUser?.role)) {
      const teamUserIds = getTeamUserIds(teamFilter);
      filteredLeads = leads.filter((l) => l.vendedor && teamUserIds.includes(l.vendedor));
    } else {
      filteredLeads = getFilteredLeads();
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
  const mapLeadFromApi = (L) => ({
    id: L.id,
    nombre: L.nombre,
    telefono: L.telefono,
    modelo: L.modelo,
    formaPago: L.formaPago,
    infoUsado: L.infoUsado,
    entrega: L.entrega,
    fecha: L.fecha || L.created_at || "",
    estado: L.estado || "nuevo",
    vendedor: L.assigned_to ?? null,
    notas: L.notas || "",
    fuente: L.fuente || "otro",
    historial: L.historial || [],
    created_by: L.created_by || null,
  });

  const addHistorialEntry = (leadId, estado) => {
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

  const handleUpdateLeadStatus = async (leadId, newStatus) => {
    try {
      const updated = await apiUpdateLead(leadId, { estado: newStatus });
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, ...mapLeadFromApi(updated) } : l))
      );

      addHistorialEntry(leadId, newStatus);
    } catch (e) {
      console.error("No pude actualizar estado del lead", e);
    }
  };

  const handleUpdateObservaciones = async (leadId, observaciones) => {
    try {
      const updated = await apiUpdateLead(leadId, { notas: observaciones });
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
      const nombre = document.getElementById("new-nombre")?.value?.trim();
      const telefono = document.getElementById("new-telefono")?.value?.trim();
      const modelo = document.getElementById("new-modelo")?.value?.trim();
      const formaPago = document.getElementById("new-formaPago")?.value;
      const infoUsado = document.getElementById("new-infoUsado")?.value?.trim();
      const entrega = document.getElementById("new-entrega")?.checked;
      const fecha = document.getElementById("new-fecha")?.value;
      const autoAssign = document.getElementById("new-autoassign")?.checked;
      const vendedorSelVal = document.getElementById("new-vendedor")?.value;

      if (!nombre || !telefono || !modelo) {
        alert("Por favor completa los campos obligatorios: Nombre, Teléfono y Modelo");
        return;
      }

      const vendedorIdSelRaw = parseInt(vendedorSelVal, 10);
      const vendedorIdSel = Number.isNaN(vendedorIdSelRaw)
        ? null
        : vendedorIdSelRaw;

      const fuente = "creado_por";

      let vendedorId = null;
      if (autoAssign) {
        vendedorId = pickNextVendorId(currentUser) ?? null;
      } else {
        if (vendedorIdSel) {
          const selectedVendor = users.find(u => u.id === vendedorIdSel);
          const availableVendors = getAvailableVendorsForAssignment();
          
          if (selectedVendor && selectedVendor.active && availableVendors.some(v => v.id === vendedorIdSel)) {
            vendedorId = vendedorIdSel;
          } else {
            alert("El vendedor seleccionado no está disponible. Por favor selecciona otro vendedor o usa la asignación automática.");
            return;
          }
        } else {
          vendedorId = null;
        }
      }

      let equipo = 'equipo1';
      
      if (vendedorId) {
        const vendedorAsignado = users.find(u => u.id === vendedorId);
        if (vendedorAsignado) {
          let currentUserForTeam = vendedorAsignado;
          while (currentUserForTeam && currentUserForTeam.reportsTo) {
            const manager = userById.get(currentUserForTeam.reportsTo);
            if (!manager) break;
            
            if (manager.role === 'gerente') {
              equipo = manager.name.toLowerCase().replace(/\s+/g, '_');
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
            equipo = manager.name.toLowerCase().replace(/\s+/g, '_');
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
        vendedor: vendedorId,
        equipo: equipo,
      };

      const created = await apiCreateLead(leadData);
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

      document.getElementById("new-nombre").value = "";
      document.getElementById("new-telefono").value = "";
      document.getElementById("new-modelo").value = "";
      document.getElementById("new-infoUsado").value = "";
      document.getElementById("new-fecha").value = "";
      document.getElementById("new-entrega").checked = false;

      addHistorialEntry(mapped.id, `Creado por ${currentUser?.name}`);
      alert("Lead creado exitosamente");
      
    } catch (e) {
      console.error("Error completo al crear el lead:", e);
      alert(`Error al crear el lead: ${e?.response?.data?.error || e?.message || 'Error desconocido'}`);
    }
  };

  // ===== Calendario =====
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
    const title = document.getElementById("ev-title").value;
    const date = document.getElementById("ev-date").value;
    const time = document.getElementById("ev-time").value;
    const userId = parseInt(document.getElementById("ev-user").value, 10);
    if (title && date && userId) {
      setEvents((prev) => [
        ...prev,
        {
          id: Math.max(0, ...prev.map((e) => e.id)) + 1,
          title,
          date,
          time: time || "09:00",
          userId,
        },
      ]);
      setShowNewEventModal(false);
    }
  };

  const deleteEvent = (id) =>
    setEvents((prev) => prev.filter((e) => e.id !== id));

  // ===== Gestión de Usuarios =====
  const validRolesByUser = (user) => {
    if (!user) return [];
    switch (user.role) {
      case "owner":
        return ["gerente_general", "gerente", "supervisor", "vendedor"];
      case "gerente_general":
        return ["gerente", "supervisor", "vendedor"];
      case "gerente":
        return ["supervisor", "vendedor"];
      default:
        return [];
    }
  };

  const validManagersByRole = (role) => {
    switch (role) {
      case "owner":
        return [];
      case "gerente_general":
        return users.filter((u) => u.role === "owner");
      case "gerente":
        return users.filter((u) => u.role === "gerente_general");
      case "supervisor":
        return users.filter((u) => u.role === "gerente");
      case "vendedor":
        return users.filter((u) => u.role === "supervisor");
      default:
        return [];
    }
  };

  const openCreateUser = () => {
    setEditingUser(null);
    const availableRoles = validRolesByUser(currentUser);
    const roleDefault = availableRoles?.[0] || "vendedor";
    const validManagers = validManagersByRole(roleDefault);
    setModalRole(roleDefault);
    setModalReportsTo(validManagers[0]?.id ?? null);
    setShowUserModal(true);
  };

  const openEditUser = (u) => {
    setEditingUser(u);
    const roleCurrent = u.role;
    const availableRoles =
      currentUser.role === "owner" && u.id === currentUser?.id
        ? ["owner", ...validRolesByUser(currentUser)]
        : validRolesByUser(currentUser);
    const roleToSet = availableRoles.includes(roleCurrent)
      ? roleCurrent
      : availableRoles[0];
    const validManagers = validManagersByRole(roleToSet);
    setModalRole(roleToSet);
    setModalReportsTo(
      roleToSet === "owner" ? null : u.reportsTo ?? validManagers[0]?.id ?? null
    );
    setShowUserModal(true);
  };

  const saveUser = async () => {
    const name = document.getElementById("u-name").value.trim();
    const email = document.getElementById("u-email").value.trim();
    const password = document.getElementById("u-pass").value;
    const active = document.getElementById("u-active").checked;

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
        const updateData = {
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
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? updated : u)));
      } else {
        const createData = {
          name,
          email,
          password: password.trim(),
          role: modalRole,
          reportsTo: finalReportsTo,
          active: active ? 1 : 0,
        };
        
        const created = await apiCreateUser(createData);
        setUsers((prev) => [...prev, created]);
      }
      setShowUserModal(false);
    } catch (e) {
      console.error("No pude guardar usuario", e);
      alert(`Error al ${editingUser ? 'actualizar' : 'crear'} usuario: ${e?.response?.data?.error || e.message}`);
    }
  };

  const openDeleteConfirm = (user) => {
    if (user.role === "owner") {
      alert("No podés eliminar al Dueño.");
      return;
    }
    
    const hasChildren = users.some((u) => u.reportsTo === user.id);
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
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setShowDeleteConfirmModal(false);
      setUserToDelete(null);
    } catch (e) {
      console.error("No pude eliminar usuario", e);
      alert("Error al eliminar el usuario. Por favor, intenta nuevamente.");
    }
  };

  // ===== UI: Login =====
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-900 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-red-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-2xl">FIAT</span>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">FIAT Auto del sol</h1>
            <p className="text-gray-600">Sistema de gestión CRM</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                id="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                placeholder="tu@fiat.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
              <input
                type="password"
                id="password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
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
                  document.getElementById("email").value,
                  document.getElementById("password").value
                )
              }
              className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white py-3 px-4 rounded-lg font-semibold hover:from-red-700 hover:to-red-800"
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
      <div className="bg-red-900 text-white w-64 min-h-screen p-4">
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
              <span className="text-red-600 font-bold text-lg">FIAT</span>
            </div>
            <div className="ml-3">
              <h1 className="text-xl font-bold text-white">FIAT</h1>
              <p className="text-xs text-red-300">Argentina</p>
            </div>
          </div>

          <div className="text-sm text-gray-300">
            <p>{currentUser?.name || currentUser?.email}</p>
            <p className="text-red-300">
              {roles[currentUser?.role] || currentUser?.role}
            </p>
            {!currentUser?.active && (
              <p className="text-yellow-300 text-xs mt-1">
                ⚠️ Usuario desactivado - No recibe leads nuevos
              </p>
            )}
          </div>
        </div>

        <nav className="space-y-2">
          {[
            { key: "dashboard", label: "Dashboard", Icon: Home },
            { key: "leads", label: "Leads", Icon: Users },
            { key: "calendar", label: "Calendario", Icon: Calendar },
            { key: "presupuestos", label: "Presupuestos", Icon: FileText },
            { key: "ranking", label: "Ranking", Icon: Trophy },
            ...(["supervisor", "gerente", "gerente_general", "owner"].includes(currentUser?.role)
              ? [{ key: "team", label: "Mi Equipo", Icon: UserCheck }]
              : []),
            { key: "alerts", label: "Alertas", Icon: Bell, badge: unreadAlerts },
            ...(canManageUsers()
              ? [{ key: "users", label: "Usuarios", Icon: Settings }]
              : []),
          ].map(({ key, label, Icon, badge }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={`w-full flex items-center justify-between space-x-3 px-3 py-2 rounded-lg transition-colors ${
                activeSection === key
                  ? "bg-red-700 text-white"
                  : "text-gray-300 hover:bg-red-800"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon size={20} />
                <span>{label}</span>
              </div>
              {badge !== undefined && badge > 0 && (
                <span className="bg-yellow-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Botón de Cerrar Sesión */}
        <div className="mt-auto pt-4 border-t border-red-800">
          <button
            onClick={async () => {
              try {
                await api.post('/auth/logout');
              } catch (error) {
                console.error('Error al cerrar sesión:', error);
              } finally {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.clear();
                sessionStorage.clear();
                delete api.defaults.headers.common['Authorization'];
                setIsAuthenticated(false);
                setCurrentUser(null);
                setUsers([]);
                setLeads([]);
                window.location.reload();
              }
            }}
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-red-300 hover:bg-red-800 transition-colors"
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

      {/* Main Content Area - Dashboard */}
      <div className="flex-1 p-6">
        {activeSection === "dashboard" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
              <div className="flex items-center space-x-3">
                {["owner", "gerente_general", "dueño"].includes(currentUser?.role) && (
                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="todos">Todos los equipos</option>
                    {users
                      .filter((u) => u.role === "gerente")
                      .map((gerente) => (
                        <option key={gerente.id} value={gerente.id.toString()}>
                          Equipo {gerente.name}
                        </option>
                      ))}
                  </select>
                )}
                {canCreateLeads() && (
                  <button
                    onClick={() => setShowNewLeadModal(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <Plus size={20} />
                    <span>Nuevo Lead</span>
                  </button>
                )}
              </div>
            </div>

            {!currentUser?.active && (
              <div className="bg-orange-50 border-l-4 border-orange-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Bell className="h-5 w-5 text-orange-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-orange-700">
                      <strong>Usuario Desactivado:</strong> No recibirás nuevos leads automáticamente. 
                      Solo podrás gestionar los leads que ya tienes asignados.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Estadísticas principales */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(() => {
                const teamFilter = ["owner", "gerente_general", "dueño"].includes(currentUser?.role)
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
                        <div className="bg-red-500 p-3 rounded-full">
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
                          <p className="text-3xl font-bold text-red-600">
                            {stats.conversion}%
                          </p>
                        </div>
                        <div className="bg-red-500 p-3 rounded-full">
                          <BarChart3 className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Estados de Leads */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Estados de Leads</h3>
                <div className="flex items-center space-x-2">
                  {["owner", "gerente_general"].includes(currentUser?.role) && (
                    <>
                      <span className="text-sm text-gray-600">Descargar Excel:</span>
                      <button
                        onClick={() => {
                          const teamFilter = ["owner", "gerente_general"].includes(currentUser?.role)
                            ? selectedTeam
                            : undefined;
                          const filteredLeads = teamFilter && teamFilter !== "todos"
                            ? getFilteredLeadsByTeam(teamFilter)
                            : getFilteredLeads();
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
                      className="text-sm text-red-600 hover:text-red-800 flex items-center space-x-1"
                    >
                      <X size={16} />
                      <span>Cerrar filtro</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(estados).map(([key, estado]) => {
                  const teamFilter = ["owner", "gerente_general"].includes(currentUser?.role)
                    ? selectedTeam
                    : undefined;
                  const filteredLeads = teamFilter && teamFilter !== "todos"
                    ? getFilteredLeadsByTeam(teamFilter)
                    : getFilteredLeads();
                  const count = filteredLeads.filter((l) => l.estado === key).length;
                  const percentage = filteredLeads.length > 0 
                    ? ((count / filteredLeads.length) * 100).toFixed(1)
                    : "0";
                  
                  return (
                    <div key={key} className="relative group">
                      <button
                        onClick={() => setSelectedEstado(selectedEstado === key ? null : key)}
                        className={`w-full text-center transition-all duration-200 transform hover:scale-105 ${
                          selectedEstado === key ? "ring-4 ring-red-300 ring-opacity-50" : ""
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
                                const teamFilter = ["owner", "gerente_general"].includes(currentUser?.role)
                                  ? selectedTeam
                                  : undefined;
                                const filteredLeads = teamFilter && teamFilter !== "todos"
                                  ? getFilteredLeadsByTeam(teamFilter)
                                  : getFilteredLeads();
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

              {/* Lista filtrada por estado */}
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
                  </h4>

                  {(() => {
                    const teamFilter = ["owner", "gerente_general"].includes(currentUser?.role)
                      ? selectedTeam
                      : undefined;
                    const filteredLeads = teamFilter && teamFilter !== "todos"
                      ? getFilteredLeadsByTeam(teamFilter)
                      : getFilteredLeads();
                    const leadsFiltrados = filteredLeads.filter(
                      (l) => l.estado === selectedEstado
                    );

                    if (leadsFiltrados.length === 0) {
                      return (
                        <p className="text-gray-500 text-center py-8">
                          No hay leads en estado "{estados[selectedEstado].label}"
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
                                  getVisibleUsers().some((u) => u.id === lead.vendedor));
                              
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
                                        {fuentes[lead.fuente]?.icon || "❓"}
                                      </span>
                                      <span className="text-xs text-gray-600">
                                        {fuentes[lead.fuente]?.label ||
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
                                      <button
                                        onClick={() => {
                                          const phoneNumber = lead.telefono.replace(/\D/g, '');
                                          const message = encodeURIComponent(
                                            `Hola ${lead.nombre}, me contacto desde FIAT Auto del sol por su consulta sobre el ${lead.modelo}. ¿Cómo está?`
                                          );
                                          const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
                                          window.open(whatsappUrl, '_blank');
                                        }}
                                        className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 flex items-center space-x-1"
                                        title="Chatear por WhatsApp"
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.89 3.587"/>
                                        </svg>
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedLeadForPresupuesto(lead);
                                          setShowPresupuestoSelectModal(true);
                                        }}
                                        className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 flex items-center space-x-1"
                                        title="Enviar presupuesto por WhatsApp"
                                      >
                                        <FileText size={12} />
                                        <span>Pres</span>
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
                  const teamFilter = ["owner", "gerente_general"].includes(currentUser?.role)
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
                          <span className="font-semibold text-red-600">
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
              {canCreateLeads() && (
                <button
                  onClick={() => setShowNewLeadModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Plus size={20} />
                  <span>Nuevo Lead</span>
                </button>
              )}
            </div>

            {/* Barra de búsqueda y filtros */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Buscar por cliente, teléfono, modelo, vendedor, observaciones..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                      showFilters || getActiveFiltersCount() > 0
                        ? "bg-red-100 border-red-300 text-red-700"
                        : "bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Filter size={20} />
                    <span>Filtros</span>
                    {getActiveFiltersCount() > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
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
                    <span className="font-medium">{getFilteredAndSearchedLeads().length}</span> leads encontrados
                  </div>
                </div>
              </div>

              {showFilters && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <User size={16} className="inline mr-1" />
                        Vendedor
                      </label>
                      <select
                        value={selectedVendedorFilter || ""}
                        onChange={(e) => setSelectedVendedorFilter(e.target.value ? parseInt(e.target.value, 10) : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                      >
                        <option value="">Todos los vendedores</option>
                        <option value="0">Sin asignar</option>
                        {getVisibleUsers()
                          .filter((u) => u.role === "vendedor")
                          .map((vendedor) => {
                            const leadsCount = leads.filter(l => l.vendedor === vendedor.id).length;
                            return (
                              <option key={vendedor.id} value={vendedor.id}>
                                {vendedor.name} ({leadsCount} leads) {!vendedor.active ? " - Inactivo" : ""}
                              </option>
                            );
                          })}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Estado
                      </label>
                      <select
                        value={selectedEstadoFilter}
                        onChange={(e) => setSelectedEstadoFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                      >
                        <option value="">Todos los estados</option>
                        {Object.entries(estados).map(([key, estado]) => (
                          <option key={key} value={key}>
                            {estado.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fuente
                      </label>
                      <select
                        value={selectedFuenteFilter}
                        onChange={(e) => setSelectedFuenteFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
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

            {/* Tabla de leads */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
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
                    {getFilteredAndSearchedLeads().length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          {searchText.trim() || selectedVendedorFilter || selectedEstadoFilter || selectedFuenteFilter
                            ? "No se encontraron leads que coincidan con los filtros aplicados"
                            : "No hay leads para mostrar"}
                        </td>
                      </tr>
                    ) : (
                      getFilteredAndSearchedLeads().map((lead) => {
                        const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
                        const canReassign =
                          canManageUsers() ||
                          (currentUser?.role === "supervisor" &&
                            lead.vendedor &&
                            getVisibleUsers().some((u) => u.id === lead.vendedor));

                        return (
                          <tr key={lead.id} className="hover:bg-gray-50">
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
                                  {fuentes[lead.fuente]?.icon || "❓"}
                                </span>
                                <span className="text-xs text-gray-600">
                                  {fuentes[lead.fuente]?.label || String(lead.fuente)}
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
                                <button
                                  onClick={() => {
                                    const phoneNumber = lead.telefono.replace(/\D/g, '');
                                    const message = encodeURIComponent(
                                      `Hola ${lead.nombre}, me contacto desde FIAT Auto del sol por su consulta sobre el ${lead.modelo}. ¿Cómo está?`
                                    );
                                    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
                                    window.open(whatsappUrl, '_blank');
                                  }}
                                  className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 flex items-center space-x-1"
                                  title="Chatear por WhatsApp"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.89 3.587"/>
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedLeadForPresupuesto(lead);
                                    setShowPresupuestoSelectModal(true);
                                  }}
                                  className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 flex items-center space-x-1"
                                  title="Enviar presupuesto por WhatsApp"
                                >
                                  <FileText size={12} />
                                  <span>Pres</span>
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
                    .filter((u) => u.id !== currentUser?.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {roles[u.role] || u.role}
                      </option>
                    ))}
                </select>
                <button
                  onClick={() => setShowNewEventModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
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
                  {eventsForSelectedUser.map((event) => (
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
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
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
                      className="mt-4 text-red-600 hover:text-red-800"
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
                            e.target.src = 'https://via.placeholder.com/400x300?text=Sin+Imagen';
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

        {/* Sección Ranking */}
        {activeSection === "ranking" && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">Ranking de Vendedores</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {isOwner() && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">
                    Ranking General
                  </h3>
                  <div className="space-y-3">
                    {getRanking().map((vendedor, index) => (
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
                            {vendedor.leadsAsignados} leads asignados
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {getRanking().length === 0 && (
                    <p className="text-gray-500 text-center py-8">
                      No hay vendedores registrados
                    </p>
                  )}
                </div>
              )}

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  {currentUser?.role === "vendedor" 
                    ? "Ranking Vendedores" 
                    : isOwner() 
                    ? "Mi Scope" 
                    : "Ranking"}
                </h3>
                <div className="space-y-3">
                  {(currentUser?.role === "vendedor" 
                    ? getRankingByManagerialTeam() 
                    : getRankingInScope()
                  ).map((vendedor, index) => (
                    <div
                      key={vendedor.id}
                      className={`flex items-center justify-between p-4 border border-gray-200 rounded-lg ${
                        vendedor.id === currentUser?.id ? "bg-red-50 border-red-300" : ""
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
                            vendedor.id === currentUser?.id ? "text-red-900" : "text-gray-900"
                          }`}>
                            {vendedor.nombre}
                            {vendedor.id === currentUser?.id && (
                              <span className="ml-2 text-xs text-red-600 font-normal">(Tú)</span>
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
                  ))}
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
          </div>
        )}

        {/* Sección Mi Equipo */}
        {activeSection === "team" &&
          ["supervisor", "gerente", "gerente_general", "owner"].includes(currentUser?.role) && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-gray-800">Mi Equipo</h2>
                {["owner", "gerente_general"].includes(currentUser?.role) && (
                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="todos">Todos los equipos</option>
                    {users
                      .filter((u) => u.role === "gerente")
                      .map((gerente) => (
                        <option key={gerente.id} value={gerente.id.toString()}>
                          Equipo {gerente.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              {/* Panel de Debug solo para Owner/Gerente General */}
              {["owner", "gerente_general"].includes(currentUser?.role) && (
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
                        {users.filter((u) => u.role === "gerente").map((gerente) => {
                          const gerenteChildren = childrenIndex.get(gerente.id) || [];
                          return (
                            <div key={gerente.id} className="ml-4 mt-2">
                              <div className="font-semibold">👔 {gerente.name} (Gerente)</div>
                              {gerenteChildren.map((supId) => {
                                const supervisor = userById.get(supId);
                                const supChildren = childrenIndex.get(supId) || [];
                                const supLeads = leads.filter(l => l.vendedor === supId || supChildren.includes(l.vendedor || 0));
                                return (
                                  <div key={supId} className="ml-4">
                                    <div>👨‍💼 {supervisor?.name} ({supervisor?.role}) - {supLeads.length} leads</div>
                                    {supChildren.map((vendId) => {
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

              {/* Estadísticas por estado */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-800">
                    Estados de Leads - Mi Equipo
                  </h3>
                  {selectedEstado && (
                    <button
                      onClick={() => setSelectedEstado(null)}
                      className="text-sm text-red-600 hover:text-red-800 flex items-center space-x-1"
                    >
                      <X size={16} />
                      <span>Cerrar filtro</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Object.entries(estados).map(([key, estado]) => {
                    const teamFilter = ["owner", "gerente_general"].includes(currentUser?.role)
                      ? selectedTeam
                      : undefined;
                    const filteredLeads = getFilteredLeadsByTeam(teamFilter);
                    const count = filteredLeads.filter((l) => l.estado === key).length;
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedEstado(selectedEstado === key ? null : key)}
                        className={`text-center transition-all duration-200 transform hover:scale-105 ${
                          selectedEstado === key ? "ring-4 ring-red-300 ring-opacity-50" : ""
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
                      const teamFilter = ["owner", "gerente_general"].includes(currentUser?.role)
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
                                          {fuentes[lead.fuente]?.icon || "❓"}
                                        </span>
                                        <span className="text-xs text-gray-600">
                                          {fuentes[lead.fuente]?.label ||
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
                                        <button
                                          onClick={() => {
                                            const phoneNumber = lead.telefono.replace(/\D/g, '');
                                            const message = encodeURIComponent(
                                              `Hola ${lead.nombre}, me contacto desde FIAT Auto del sol por su consulta sobre el ${lead.modelo}. ¿Cómo está?`
                                            );
                                            const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
                                            window.open(whatsappUrl, '_blank');
                                          }}
                                          className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 flex items-center space-x-1"
                                          title="Chatear por WhatsApp"
                                        >
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.89 3.587"/>
                                          </svg>
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedLeadForPresupuesto(lead);
                                            setShowPresupuestoSelectModal(true);
                                          }}
                                          className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 flex items-center space-x-1"
                                          title="Enviar presupuesto por WhatsApp"
                                        >
                                          <FileText size={12} />
                                          <span>Pres</span>
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
                                              (u) => u.id === lead.vendedor
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

              {/* Top vendedores */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  Top Vendedores en Mi Organización
                </h3>
                <div className="space-y-3">
                  {(() => {
                    const teamFilter = ["owner", "gerente_general"].includes(currentUser?.role)
                      ? selectedTeam
                      : undefined;
                    const filteredLeads = getFilteredLeadsByTeam(teamFilter);
                    
                    const vendedoresEnScope = users.filter(
                      (u) => u.role === "vendedor" && visibleUserIds.includes(u.id)
                    );
                    
                    const ranking = vendedoresEnScope
                      .map((v) => {
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
                    (u) => u.role === "vendedor" && visibleUserIds.includes(u.id)
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

        {/* Sección Alertas */}
        {activeSection === "alerts" && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">Notificaciones y Alertas</h2>

            <div className="bg-white rounded-xl shadow-lg p-6">
              {alerts.filter(a => a.userId === currentUser?.id).length === 0 ? (
                <div className="text-center py-12">
                  <Bell size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No tienes alertas pendientes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts
                    .filter(a => a.userId === currentUser?.id)
                    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
                    .map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-4 border rounded-lg ${
                          alert.read ? 'bg-white border-gray-200' : 'bg-red-50 border-red-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            {alert.type === 'lead_assigned' ? (
                              <Users className="h-5 w-5 text-red-600 mt-0.5" />
                            ) : (
                              <Trophy className="h-5 w-5 text-yellow-600 mt-0.5" />
                            )}
                            <div>
                              <p className="font-medium text-gray-900">{alert.message}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(alert.ts).toLocaleString('es-AR')}
                              </p>
                            </div>
                          </div>
                          {!alert.read && (
                            <button
                              onClick={() => {
                                setAlerts(prev => 
                                  prev.map(a => a.id === alert.id ? {...a, read: true} : a)
                                );
                              }}
                              className="text-xs text-red-600 hover:text-red-800"
                            >
                              Marcar como leída
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sección Usuarios con filtros */}
        {activeSection === "users" && canManageUsers() && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Gestión de Usuarios</h2>
              {canCreateUsers() && (
                <button
                  onClick={openCreateUser}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Plus size={20} />
                  <span>Nuevo Usuario</span>
                </button>
              )}
            </div>

            {/* Barra de búsqueda y filtros usuarios */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, email, rol o equipo..."
                      value={userSearchText}
                      onChange={(e) => setUserSearchText(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Ordenar por:</span>
                    <select
                      value={userSortBy}
                      onChange={(e) => setUserSortBy(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
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
                        ? "bg-red-100 border-red-300 text-red-700"
                        : "bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Filter size={20} />
                    <span>Filtros</span>
                    {getActiveUserFiltersCount() > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
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

              {showUserFilters && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Users size={16} className="inline mr-1" />
                        Equipo
                      </label>
                      <select
                        value={selectedTeamFilter}
                        onChange={(e) => setSelectedTeamFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                      >
                        <option value="todos">Todos los equipos</option>
                        <option value="sin_equipo">Sin equipo asignado</option>
                        {users
                          .filter((u) => u.role === "gerente" && getVisibleUsers().some((vu) => vu.id === u.id))
                          .map((gerente) => {
                            const teamCount = users.filter((u) => {
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

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <User size={16} className="inline mr-1" />
                        Rol
                      </label>
                      <select
                        value={selectedRoleFilter}
                        onChange={(e) => setSelectedRoleFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                      >
                        <option value="todos">Todos los roles</option>
                        {Object.entries(roles).map(([key, label]) => {
                          const roleCount = getVisibleUsers().filter((u) => u.role === key).length;
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

            {/* Tabla de usuarios */}
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
                      getFilteredAndSortedUsers().map((user) => {
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
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
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
                                          prev.map((u) => (u.id === user.id ? updated : u))
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

        {/* ===== MODALES ===== */}

        {/* Modal: Confirmación Eliminar Lead */}
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

        {/* Modal: Confirmación Eliminar Usuario */}
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

        {/* Modal: Reasignar Lead */}
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
                        {fuentes[leadToReassign.fuente]?.icon || "❓"}{" "}
                        {fuentes[leadToReassign.fuente]?.label ||
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
                    <div
                      onClick={() => setSelectedVendorForReassign(null)}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedVendorForReassign === null
                          ? "border-red-500 bg-red-50"
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
                          <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                        )}
                      </div>
                    </div>

                    {getAvailableVendorsForReassign().map((vendedor) => {
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
                              ? "border-red-500 bg-red-50"
                              : "border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                                <span className="text-white font-medium text-sm">
                                  {vendedor.name
                                    .split(" ")
                                    .map((n) => n[0])
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
                              <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
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
                      : "bg-red-600 text-white hover:bg-red-700"
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

        {/* Modal: Observaciones */}
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
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div className="flex space-x-3 pt-6">
                <button
                  onClick={() => {
                    const textarea = document.getElementById(
                      "observaciones-textarea"
                    );
                    if (textarea && editingLeadObservaciones) {
                      handleUpdateObservaciones(
                        editingLeadObservaciones.id,
                        textarea.value
                      );
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
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

        {/* Modal: Historial */}
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
                      <div key={index} className="border-l-4 border-red-500 pl-4 py-2">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono *
                  </label>
                  <input
                    type="text"
                    id="new-telefono"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modelo *
                  </label>
                  <input
                    type="text"
                    id="new-modelo"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Forma de Pago
                  </label>
                  <select
                    id="new-formaPago"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha
                  </label>
                  <input
                    type="date"
                    id="new-fecha"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div className="col-span-2 flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="new-entrega"
                    className="rounded border-gray-300 text-red-600 focus:ring-2 focus:ring-red-500"
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
                    className="rounded border-gray-300 text-red-600 focus:ring-2 focus:ring-red-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">Sin asignar</option>
                    {getAvailableVendorsForAssignment().map((u) => (
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
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    id="ev-date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Usuario
                  </label>
                  <select
                    id="ev-user"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    defaultValue={currentUser?.id}
                  >
                    <option value={currentUser?.id}>{currentUser?.name} (Yo)</option>
                    {visibleUsers
                      .filter((u) => u.id !== currentUser?.id)
                      .map((u) => (
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
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contraseña {editingUser ? "(dejar vacío para mantener actual)" : "*"}
                  </label>
                  <input
                    type="password"
                    id="u-pass"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
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
                      const newRole = e.target.value;
                      setModalRole(newRole);
                      const validManagers = validManagersByRole(newRole);
                      setModalReportsTo(validManagers[0]?.id ?? null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  >
                    {validRolesByUser(currentUser).map((role) => (
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    >
                      {validManagersByRole(modalRole).map((manager) => (
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
                    className="rounded border-gray-300 text-red-600 focus:ring-2 focus:ring-red-500"
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
                    {modalRole === "gerente_general" && (
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
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
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

        {/* Modal: Seleccionar Presupuesto */}
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
                        mensaje += `Saludos desde FIAT Auto del sol! 🚙`;
                        
                        const phoneNumber = lead.telefono.replace(/\D/g, '');
                        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(mensaje)}`;
                        window.open(whatsappUrl, '_blank');
                        
                        setShowPresupuestoSelectModal(false);
                        setSelectedLeadForPresupuesto(null);
                      }}
                      className="cursor-pointer border-2 border-gray-200 rounded-xl overflow-hidden hover:border-red-500 hover:shadow-lg transition-all"
                    >
                      {presupuesto.imagen_url && (
                        <div className="h-40 bg-gray-200 overflow-hidden">
                          <img
                            src={presupuesto.imagen_url}
                            alt={presupuesto.modelo}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = 'https://via.placeholder.com/400x300?text=Sin+Imagen';
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                      placeholder="ej: FIAT"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                      placeholder="ej: Cronos 1.3"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 h-20 resize-none"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 h-24 resize-none"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 h-24 resize-none font-mono text-xs"
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
                    const marca = document.getElementById("pres-marca")?.value?.trim();
                    const modelo = document.getElementById("pres-modelo")?.value?.trim();
                    const imagen_url = document.getElementById("pres-imagen")?.value?.trim();
                    const precio_contado = document.getElementById("pres-precio")?.value?.trim();
                    const anticipo = document.getElementById("pres-anticipo")?.value?.trim();
                    const bonificaciones = document.getElementById("pres-bonificaciones")?.value?.trim();
                    const especificaciones_tecnicas = document.getElementById("pres-specs")?.value?.trim();
                    const cuotasStr = document.getElementById("pres-cuotas")?.value?.trim();

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

                    const data = {
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
                    } catch (e) {
                      console.error("Error al guardar presupuesto:", e);
                      alert(`Error: ${e?.response?.data?.error || e.message}`);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
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
      </div>
    </div>
  );
}
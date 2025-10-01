import { api } from '../api';

export const listPresupuestos = async () => {
  const response = await api.get('/presupuestos');
  return response.data;
};

export const getPresupuesto = async (id) => {
  const response = await api.get(`/presupuestos/${id}`);
  return response.data;
};

export const createPresupuesto = async (presupuestoData) => {
  const response = await api.post('/presupuestos', presupuestoData);
  return response.data;
};

export const updatePresupuesto = async (id, presupuestoData) => {
  const response = await api.put(`/presupuestos/${id}`, presupuestoData);
  return response.data;
};

export const deletePresupuesto = async (id) => {
  const response = await api.delete(`/presupuestos/${id}`);
  return response.data;
};
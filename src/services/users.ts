import { api } from './api';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'owner' | 'director' | 'gerente' | 'supervisor' | 'vendedor';
  reportsTo: number | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: string;
  reportsTo?: number | null;
  active?: number;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  reportsTo?: number | null;
  active?: number;
}

export async function listUsers(): Promise<User[]> {
  const response = await api.get('/users');
  return response.data;
}

export async function getUser(id: number): Promise<User> {
  const response = await api.get(`/users/${id}`);
  return response.data;
}

export async function createUser(data: CreateUserData): Promise<User> {
  const response = await api.post('/users', data);
  return response.data;
}

export async function updateUser(id: number, data: UpdateUserData): Promise<User> {
  const response = await api.put(`/users/${id}`, data);
  return response.data;
}

export async function deleteUser(id: number): Promise<{ ok: boolean; message: string }> {
  const response = await api.delete(`/users/${id}`);
  return response.data;
}
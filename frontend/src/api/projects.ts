import client from './client'
import type { Project, CreateProject } from '../types'

export const getProjects = () => client.get<Project[]>('/projects').then(r => r.data)
export const getProject = (id: string) => client.get<Project>(`/projects/${id}`).then(r => r.data)
export const createProject = (data: CreateProject) => client.post<Project>('/projects', data).then(r => r.data)
export const updateProject = (id: string, data: Partial<CreateProject>) => client.put<Project>(`/projects/${id}`, data).then(r => r.data)
export const deleteProject = (id: string) => client.delete(`/projects/${id}`).then(r => r.data)

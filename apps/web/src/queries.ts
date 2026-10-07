import { api } from "./api";
import type { Module, Progress } from "./types";
export const modulesQ = () => api<Module[]>("/modules");
export const progressQ = () => api<Progress>("/progress");

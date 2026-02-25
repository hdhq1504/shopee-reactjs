import type { AuthResponse } from '../types/auth.type'
import http from '../utils/http'

export const registerAccount = (body: { email: string; password: string }) => http.post<AuthResponse>('/register', body)

export const loginAccount = (body: { email: string; password: string }) => http.post<AuthResponse>('/login', body)

export const logout = () => http.post('/logout')

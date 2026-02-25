import type { User } from './user.type'
import type { SuccessResponse } from './utils.type'

export type AuthResponse = SuccessResponse<{
  access_token: string
  expires: string
  user: User
}>

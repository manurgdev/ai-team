export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface ApiError {
  error: string;
  details?: Array<{
    path: string;
    message: string;
  }>;
}

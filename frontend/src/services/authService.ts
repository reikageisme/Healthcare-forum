import axios from 'axios';
import {
  AuthSession,
  AuthTokenResponse,
  LoginInput,
  RegisterInput,
  User,
} from '../types';

interface AuthHttpClient {
  get<T>(url: string, config?: { headers?: Record<string, string> }): Promise<{ data: T }>;
  post<T>(url: string, data?: unknown): Promise<{ data: T }>;
}

function requireTokenResponse(value: AuthTokenResponse): AuthTokenResponse {
  if (
    !value ||
    typeof value.access_token !== 'string' ||
    !value.access_token ||
    typeof value.refresh_token !== 'string' ||
    !value.refresh_token ||
    value.token_type !== 'bearer'
  ) {
    throw new Error('Invalid authentication token response');
  }
  return value;
}

export function createAuthService(client: AuthHttpClient) {
  const me = async (accessToken: string): Promise<User> => {
    const response = await client.get<User>('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  };

  return {
    async register(input: RegisterInput): Promise<AuthTokenResponse> {
      const response = await client.post<AuthTokenResponse>('/auth/register', input);
      return requireTokenResponse(response.data);
    },

    async login(input: LoginInput): Promise<AuthTokenResponse> {
      const response = await client.post<AuthTokenResponse>('/auth/login', input);
      return requireTokenResponse(response.data);
    },

    me,

    async refresh(refreshToken: string): Promise<AuthTokenResponse> {
      const response = await client.post<AuthTokenResponse>('/auth/refresh', {
        refresh_token: refreshToken,
      });
      return requireTokenResponse(response.data);
    },

    async sessionFromTokens(tokens: AuthTokenResponse): Promise<AuthSession> {
      const verifiedTokens = requireTokenResponse(tokens);
      const user = await me(verifiedTokens.access_token);
      return {
        user,
        accessToken: verifiedTokens.access_token,
        refreshToken: verifiedTokens.refresh_token,
      };
    },
  };
}

const authHttp = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

export const authService = createAuthService(authHttp);

export default authService;

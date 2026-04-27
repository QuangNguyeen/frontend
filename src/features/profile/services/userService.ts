import { httpClient } from '@/shared/lib/httpClient';
import type {
  UserProfileResponse,
  UserUpdateRequest,
} from '@/shared/types/api';

export const userService = {
  getProfile: async (): Promise<UserProfileResponse> => {
    const res = await httpClient.get<UserProfileResponse>('/api/v1/users/me');
    return res.data;
  },

  updateProfile: async (data: UserUpdateRequest): Promise<UserProfileResponse> => {
    const res = await httpClient.put<UserProfileResponse>('/api/v1/users/me', data);
    return res.data;
  },
};

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userService } from '../services/userService';
import type { UserUpdateRequest } from '@/shared/types/api';

export const profileKeys = {
  me: ['profile', 'me'] as const,
};

export function useProfile() {
  return useQuery({
    queryKey: profileKeys.me,
    queryFn: userService.getProfile,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserUpdateRequest) => userService.updateProfile(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(profileKeys.me, updated);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

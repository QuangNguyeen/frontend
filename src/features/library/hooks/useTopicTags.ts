import { useQuery } from '@tanstack/react-query';
import { topicTagService } from '../services/topicTagService';

export const topicTagKeys = {
  all: ['topic-tags'] as const,
  active: () => [...topicTagKeys.all, 'active'] as const,
};

/**
 * Fetches the active, selectable topic tags for the current user.
 * Tags are fixed and admin-managed — users cannot create new ones.
 */
export function useActiveTopicTags() {
  return useQuery({
    queryKey: topicTagKeys.active(),
    queryFn: () => topicTagService.list(),
    staleTime: 5 * 60 * 1000,
  });
}

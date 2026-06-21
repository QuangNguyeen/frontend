import { httpClient } from '@/shared/lib/httpClient';
import type { TopicTag } from '@/shared/types/api';

/**
 * Public topic-tag service.
 * Topic tags are fixed and managed by administrators; this endpoint only ever
 * returns the *active* tags a regular user is allowed to select.
 */
export const topicTagService = {
  list: async (): Promise<TopicTag[]> => {
    const res = await httpClient.get('/api/v1/topic-tags');
    const data = res.data;
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  },
};

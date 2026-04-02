/**
 * @deprecated
 * This file is a backward-compat re-export barrel.
 * Prefer importing directly from feature hooks/services:
 *
 *   import { useLogin, useRegister }      from '@/features/auth/hooks/useAuth'
 *   import { useVideos, useVideo }        from '@/features/library/hooks/useVideos'
 *   import { useDictationSession, ... }  from '@/features/dictation/hooks/useDictation'
 *   import { useDashboardStats, ... }    from '@/features/dashboard/hooks/useDashboard'
 *   import { useVocabulary, ... }        from '@/features/vocabulary/hooks/useVocabulary'
 *
 * Data flow:  Component → Hook → Service → httpClient → API
 */

export { httpClient as api } from './httpClient';
export { extractApiError } from './httpClient';

// Service objects with legacy names so old import sites still compile
export { authService as authApi }     from '@/features/auth/services/authService';
export { videoService as videosApi }  from '@/features/library/services/videoService';
export { dictationService as dictationApi } from '@/features/dictation/services/dictationService';
export { dashboardService as dashboardApi } from '@/features/dashboard/services/dashboardService';
export { vocabularyService as vocabularyApi } from '@/features/vocabulary/services/vocabularyService';
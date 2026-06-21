import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { LoginPage } from '../features/auth/components/LoginPage';
import { RegisterPage } from '../features/auth/components/RegisterPage';
import { LibraryPage } from '../features/library/components/LibraryPage';
import { AppLayout } from '../components/layout/AppLayout';
import { AdminLayout } from '../components/layout/AdminLayout';
import { ProtectedRoute } from '../components/layout/ProtectedRoute';
import { RequireAdmin } from '../components/layout/RequireAdmin';

const DictationPage = lazy(() => import('../features/dictation/components/DictationPage').then(m => ({ default: m.DictationPage })));
const ResultPage = lazy(() => import('../features/dictation/components/ResultPage').then(m => ({ default: m.ResultPage })));
const DashboardPage = lazy(() => import('../features/dashboard/components/DashboardPage').then(m => ({ default: m.DashboardPage })));
const HistoryPage = lazy(() => import('../features/history/components/HistoryPage').then(m => ({ default: m.HistoryPage })));
const VocabularyPage = lazy(() => import('../features/vocabulary/components/VocabularyPage').then(m => ({ default: m.VocabularyPage })));
const FlashCardPage = lazy(() => import('../features/vocabulary/components/FlashCardPage').then(m => ({ default: m.FlashCardPage })));
const ProfilePage = lazy(() => import('../features/profile/components/ProfilePage').then(m => ({ default: m.ProfilePage })));
const RoomPage = lazy(() => import('../features/room/components/RoomPage').then(m => ({ default: m.RoomPage })));
const AdminDashboard = lazy(() => import('../features/admin/components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminAnalyticsPage = lazy(() => import('../features/admin/components/analytics/AdminAnalyticsPage').then(m => ({ default: m.AdminAnalyticsPage })));
const AdminVideosPage = lazy(() => import('../features/admin/components/videos/AdminVideosPage').then(m => ({ default: m.AdminVideosPage })));
const AdminUsersPage = lazy(() => import('../features/admin/components/users/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const AdminUserDetailPage = lazy(() => import('../features/admin/components/users/AdminUserDetailPage').then(m => ({ default: m.AdminUserDetailPage })));
const AdminTopicTagsPage = lazy(() => import('../features/admin/components/topic-tags/AdminTopicTagsPage').then(m => ({ default: m.AdminTopicTagsPage })));
const AdminPublishRequestsPage = lazy(() => import('../features/admin/components/publish-requests/AdminPublishRequestsPage').then(m => ({ default: m.AdminPublishRequestsPage })));
const AdminTranscriptFeedbackPage = lazy(() => import('../features/admin/components/transcript-feedback/AdminTranscriptFeedbackPage').then(m => ({ default: m.AdminTranscriptFeedbackPage })));
const MyPracticePage = lazy(() => import('../features/my-practice/components/MyPracticePage').then(m => ({ default: m.MyPracticePage })));

function RouteLoader() {
    return (
        <div className="flex items-center justify-center h-full min-h-[200px] text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
        </div>
    );
}

function SuspenseRoute({ children }: { children: React.ReactNode }) {
    return <Suspense fallback={<RouteLoader />}>{children}</Suspense>;
}

export function AppRouter() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                    <Route path="/library" element={<LibraryPage />} />
                    <Route path="/my-practice" element={<SuspenseRoute><MyPracticePage /></SuspenseRoute>} />
                    <Route path="/dictation/:videoId" element={<SuspenseRoute><DictationPage /></SuspenseRoute>} />
                    <Route path="/result/:sessionId" element={<SuspenseRoute><ResultPage /></SuspenseRoute>} />
                    <Route path="/dashboard" element={<SuspenseRoute><DashboardPage /></SuspenseRoute>} />
                    <Route path="/history" element={<SuspenseRoute><HistoryPage /></SuspenseRoute>} />
                    <Route path="/vocabulary" element={<SuspenseRoute><VocabularyPage /></SuspenseRoute>} />
                    <Route path="/vocabulary/review" element={<SuspenseRoute><FlashCardPage /></SuspenseRoute>} />
                    <Route path="/profile" element={<SuspenseRoute><ProfilePage /></SuspenseRoute>} />
                    <Route path="/rooms" element={<SuspenseRoute><RoomPage /></SuspenseRoute>} />
                    <Route path="/rooms/:roomCode" element={<SuspenseRoute><RoomPage /></SuspenseRoute>} />

                    <Route element={<RequireAdmin />}>
                        <Route path="/admin" element={<AdminLayout />}>
                            <Route index element={<SuspenseRoute><AdminDashboard /></SuspenseRoute>} />
                            <Route path="analytics" element={<SuspenseRoute><AdminAnalyticsPage /></SuspenseRoute>} />
                            <Route path="videos" element={<SuspenseRoute><AdminVideosPage /></SuspenseRoute>} />
                            <Route path="topic-tags" element={<SuspenseRoute><AdminTopicTagsPage /></SuspenseRoute>} />
                            <Route path="publish-requests" element={<SuspenseRoute><AdminPublishRequestsPage /></SuspenseRoute>} />
                            <Route path="transcript-feedback" element={<SuspenseRoute><AdminTranscriptFeedbackPage /></SuspenseRoute>} />
                            <Route path="users" element={<SuspenseRoute><AdminUsersPage /></SuspenseRoute>} />
                            <Route path="users/:userId" element={<SuspenseRoute><AdminUserDetailPage /></SuspenseRoute>} />
                        </Route>
                    </Route>
                </Route>
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}

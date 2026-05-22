import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { LoginPage } from '../features/auth/components/LoginPage';
import { RegisterPage } from '../features/auth/components/RegisterPage';
import { LibraryPage } from '../features/library/components/LibraryPage';
import { AppLayout } from '../components/layout/AppLayout';
import { ProtectedRoute } from '../components/layout/ProtectedRoute';

const DictationPage = lazy(() => import('../features/dictation/components/DictationPage').then(m => ({ default: m.DictationPage })));
const QuizPage = lazy(() => import('../features/quiz/components/QuizPage').then(m => ({ default: m.QuizPage })));
const ResultPage = lazy(() => import('../features/dictation/components/ResultPage').then(m => ({ default: m.ResultPage })));
const DashboardPage = lazy(() => import('../features/dashboard/components/DashboardPage').then(m => ({ default: m.DashboardPage })));
const HistoryPage = lazy(() => import('../features/history/components/HistoryPage').then(m => ({ default: m.HistoryPage })));
const VocabularyPage = lazy(() => import('../features/vocabulary/components/VocabularyPage').then(m => ({ default: m.VocabularyPage })));
const FlashCardPage = lazy(() => import('../features/vocabulary/components/FlashCardPage').then(m => ({ default: m.FlashCardPage })));
const ProfilePage = lazy(() => import('../features/profile/components/ProfilePage').then(m => ({ default: m.ProfilePage })));
const RoomPage = lazy(() => import('../features/room/components/RoomPage').then(m => ({ default: m.RoomPage })));

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
                    <Route path="/dictation/:videoId" element={<SuspenseRoute><DictationPage /></SuspenseRoute>} />
                    <Route path="/quiz/:videoId" element={<SuspenseRoute><QuizPage /></SuspenseRoute>} />
                    <Route path="/result/:sessionId" element={<SuspenseRoute><ResultPage /></SuspenseRoute>} />
                    <Route path="/dashboard" element={<SuspenseRoute><DashboardPage /></SuspenseRoute>} />
                    <Route path="/history" element={<SuspenseRoute><HistoryPage /></SuspenseRoute>} />
                    <Route path="/vocabulary" element={<SuspenseRoute><VocabularyPage /></SuspenseRoute>} />
                    <Route path="/vocabulary/review" element={<SuspenseRoute><FlashCardPage /></SuspenseRoute>} />
                    <Route path="/profile" element={<SuspenseRoute><ProfilePage /></SuspenseRoute>} />
                    <Route path="/rooms" element={<SuspenseRoute><RoomPage /></SuspenseRoute>} />
                    <Route path="/rooms/:roomCode" element={<SuspenseRoute><RoomPage /></SuspenseRoute>} />
                </Route>
            </Route>

            <Route path="*" element={<Navigate to="/library" replace />} />
        </Routes>
    );
}

import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '../features/auth/components/LoginPage';
import { RegisterPage } from '../features/auth/components/RegisterPage';
import { LibraryPage } from '../features/library/components/LibraryPage';
import { DictationPage } from '../features/dictation/components/DictationPage';
import { QuizPage } from '../features/quiz/components/QuizPage';
import { ResultPage } from '../features/dictation/components/ResultPage';
import { DashboardPage } from '../features/dashboard/components/DashboardPage';
import { HistoryPage } from '../features/dashboard/components/HistoryPage';
import { VocabularyPage } from '../features/vocabulary/components/VocabularyPage';
import { FlashCardPage } from '../features/vocabulary/components/FlashCardPage';

export function AppRouter() {
    return (
        <Routes>
            {/* Auth */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Main */}
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/dictation/:videoId" element={<DictationPage />} />
            <Route path="/quiz/:videoId" element={<QuizPage />} />
            <Route path="/result/:sessionId" element={<ResultPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/history" element={<HistoryPage />} />

            {/* Vocabulary */}
            <Route path="/vocabulary" element={<VocabularyPage />} />
            <Route path="/vocabulary/review" element={<FlashCardPage />} />

            {/* Default redirect */}
            <Route path="*" element={<Navigate to="/library" replace />} />
        </Routes>
    );
}

export interface User {
    id: string;
    email: string;
    name: string;
    language: 'en' | 'ja';
    streak: number;
    createdAt: string;
}

export interface Video {
    id: string;
    youtubeId: string;
    title: string;
    channel: string;
    duration: number;
    language: 'en' | 'ja';
    level: string;
    isCurated: boolean;
    thumbnailUrl: string;
    createdAt: string;
}

export interface Sentence {
    id: string;
    videoId: string;
    index: number;
    text: string;
    startTime: number;
    endTime: number;
}

export interface DictationSession {
    id: string;
    videoId: string;
    userId: string;
    currentSentenceIndex: number;
    totalSentences: number;
    score: number;
    startedAt: string;
    completedAt?: string;
}

export interface DictationResult {
    sentenceIndex: number;
    userInput: string;
    correctText: string;
    score: number;
    wordDiffs: WordDiff[];
}

export interface WordDiff {
    word: string;
    status: 'correct' | 'wrong' | 'missing';
    expected?: string;
}

export interface HistoryEntry {
    id: string;
    videoId: string;
    videoTitle: string;
    type: 'dictation';
    score: number;
    duration: number;
    completedAt: string;
}

export interface DashboardStats {
    totalSessions: number;
    totalTime: number;
    averageAccuracy: number;
    totalVideos: number;
    streak: number;
}

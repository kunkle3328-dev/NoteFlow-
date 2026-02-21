export interface Project {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
}

export interface Source {
  id: string;
  project_id: string;
  type: 'text' | 'url' | 'pdf';
  title: string;
  content: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  project_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface ScriptSegment {
  speaker: 'host_a' | 'host_b' | 'expert';
  text: string;
  sourceReferences?: string[];
  emotion?: 'neutral' | 'excited' | 'curious' | 'serious';
  startTime?: number;
  endTime?: number;
}

export interface AudioSettings {
  hostA: {
    name: string;
    voice: string;
    personality: string;
  };
  hostB: {
    name: string;
    voice: string;
    personality: string;
  };
  tone: 'casual' | 'professional' | 'academic' | 'humorous';
  length: 'short' | 'medium' | 'long';
}

export interface AudioOverview {
  id: string;
  projectId: string;
  title: string;
  format: 'dialogue' | 'monologue' | 'interview';
  duration: number;
  status: 'generating' | 'ready' | 'error';
  script: ScriptSegment[];
  audioUrl: string; // Base64 data
  waveformData: number[]; // For visualization
  settings: AudioSettings;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // index
  explanation: string;
}

export interface GeneratedContent {
  id: string;
  project_id: string;
  type: string;
  title: string;
  content_url: string;
  created_at: string;
  // Extended properties for Audio Overview
  audio_overview?: AudioOverview;
  // Extended properties for Learning
  flashcards?: Flashcard[];
  quiz?: QuizQuestion[];
}

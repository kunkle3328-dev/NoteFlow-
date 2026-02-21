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
  mode?: 'research' | 'tutor';
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
    pitch?: number; // -20 to 20
    speed?: number; // 0.5 to 2.0
  };
  hostB: {
    name: string;
    voice: string;
    personality: string;
    pitch?: number;
    speed?: number;
  };
  tone: 'casual' | 'professional' | 'academic' | 'humorous' | 'enthusiastic' | 'serious' | 'storytelling';
  length: 'short' | 'medium' | 'long';
  language: 'en-US' | 'en-GB' | 'es-ES' | 'fr-FR' | 'de-DE';
  engagementLevel: 'high' | 'medium' | 'low'; // Controls banter and interruptions
  pacing: 'fast' | 'moderate' | 'slow'; // Controls overall speed of conversation
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

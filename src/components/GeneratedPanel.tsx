import { useState, useEffect, useCallback, useRef } from 'react';
import { Headphones, Loader2, Play, Pause, FileAudio, Network, Download, Share2, FileText, Presentation, BookOpen, Clock, Activity, Eye, X, CheckCircle2, Sparkles, BrainCircuit, Mic, Settings, Volume2, GraduationCap, ChevronLeft, ChevronRight, RotateCw, HelpCircle, Layers, Check, AlertCircle, FileDown } from 'lucide-react';
import { Source, GeneratedContent, AudioOverview, ScriptSegment, AudioSettings, Flashcard, QuizQuestion } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI, Modality } from '@google/genai';
import { playPcmAudio } from '../lib/audio';
import ReactFlow, { 
  Background, 
  Controls, 
  Node, 
  Edge, 
  useNodesState, 
  useEdgesState,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'react-markdown';

interface GeneratedPanelProps {
  projectId: string;
  sources: Source[];
}

type Tab = 'audio' | 'mindmap' | 'export' | 'learn';

interface ProgressState {
  steps: { label: string; status: 'waiting' | 'current' | 'completed' }[];
  currentStepIndex: number;
}

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  hostA: { name: 'Alex', voice: 'Kore', personality: 'Enthusiastic, curious', pitch: 0, speed: 1.0 },
  hostB: { name: 'Sam', voice: 'Fenrir', personality: 'Knowledgeable, calm', pitch: 0, speed: 1.0 },
  tone: 'professional',
  length: 'medium',
  language: 'en-US',
  engagementLevel: 'medium',
  pacing: 'moderate'
};

export default function GeneratedPanel({ projectId, sources }: GeneratedPanelProps) {
  const [contents, setContents] = useState<GeneratedContent[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [activeAudioSource, setActiveAudioSource] = useState<AudioBufferSourceNode | null>(null);
  const [activeAudioContext, setActiveAudioContext] = useState<AudioContext | null>(null);
  const [audioStartTime, setAudioStartTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const animationRef = useRef<number | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<Tab>('audio');
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [viewingContent, setViewingContent] = useState<GeneratedContent | null>(null);
  
  // Audio Settings State
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'hostA' | 'hostB'>('general');

  // Learning State
  const [activeFlashcardIndex, setActiveFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<{[key: string]: number}>({});
  const [showQuizResults, setShowQuizResults] = useState(false);

  // Mind Map State
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    fetchGeneratedContent();
    return () => {
      if (activeAudioSource) {
        activeAudioSource.stop();
      }
    };
  }, [projectId]);


  const fetchGeneratedContent = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/generated`);
      const data = await res.json();
      setContents(data);
      
      // Load the latest mind map if exists
      const mindMap = data.find((c: GeneratedContent) => c.type === 'mindmap');
      if (mindMap) {
        try {
          const parsed = JSON.parse(mindMap.content_url); // We stored JSON string in content_url for simplicity
          setNodes(parsed.nodes || []);
          setEdges(parsed.edges || []);
        } catch (e) {
          console.error("Failed to parse mind map", e);
        }
      }
    } catch (error) {
      console.error('Failed to fetch generated content', error);
    }
  };

  const updateProgress = (stepIndex: number) => {
    setProgress(prev => {
      if (!prev) return null;
      const newSteps = prev.steps.map((step, idx) => ({
        ...step,
        status: idx < stepIndex ? 'completed' : idx === stepIndex ? 'current' : 'waiting'
      })) as { label: string; status: 'waiting' | 'current' | 'completed' }[];
      return { ...prev, steps: newSteps, currentStepIndex: stepIndex };
    });
  };

  const generateWaveform = (length: number = 50): number[] => {
    return Array.from({ length }, () => Math.random() * 0.8 + 0.2);
  };

  const generateFlashcards = async () => {
    if (sources.length === 0) return alert('Please add sources first.');
    setIsGenerating(true);
    setProgress({
      steps: [
        { label: 'Analyzing content', status: 'current' },
        { label: 'Extracting key terms', status: 'waiting' },
        { label: 'Creating flashcards', status: 'waiting' }
      ],
      currentStepIndex: 0
    });

    try {
      const context = sources
        .map((s, i) => `Source [${i + 1}]: ${s.title}\n${s.content}`)
        .join('\n\n---\n\n');

      updateProgress(1);
      const prompt = `Create 10 flashcards based on the key concepts in these sources.
      Return ONLY valid JSON with this structure:
      [
        { "id": "1", "front": "Term or Question", "back": "Definition or Answer" },
        ...
      ]
      
      SOURCES:
      ${context}`;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });

      updateProgress(2);
      const jsonText = response.text || '[]';
      const flashcards: Flashcard[] = JSON.parse(jsonText);

      if (flashcards.length > 0) {
        const newContent: GeneratedContent = {
          id: uuidv4(),
          project_id: projectId,
          type: 'flashcards',
          title: 'Study Flashcards',
          content_url: JSON.stringify(flashcards),
          created_at: new Date().toISOString(),
          flashcards: flashcards
        };

        await fetch(`/api/projects/${projectId}/generated`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newContent),
        });

        setContents(prev => [newContent, ...prev]);
      }
    } catch (error) {
      console.error('Failed to generate flashcards', error);
      alert('Failed to generate flashcards.');
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const generateQuiz = async () => {
    if (sources.length === 0) return alert('Please add sources first.');
    setIsGenerating(true);
    setProgress({
      steps: [
        { label: 'Analyzing content', status: 'current' },
        { label: 'Drafting questions', status: 'waiting' },
        { label: 'Finalizing quiz', status: 'waiting' }
      ],
      currentStepIndex: 0
    });

    try {
      const context = sources
        .map((s, i) => `Source [${i + 1}]: ${s.title}\n${s.content}`)
        .join('\n\n---\n\n');

      updateProgress(1);
      const prompt = `Create a 5-question multiple choice quiz based on these sources.
      Return ONLY valid JSON with this structure:
      [
        { 
          "id": "1", 
          "question": "The question text?", 
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": 0,
          "explanation": "Why this is the correct answer."
        },
        ...
      ]
      Note: correctAnswer is the 0-based index of the correct option.
      
      SOURCES:
      ${context}`;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });

      updateProgress(2);
      const jsonText = response.text || '[]';
      const quiz: QuizQuestion[] = JSON.parse(jsonText);

      if (quiz.length > 0) {
        const newContent: GeneratedContent = {
          id: uuidv4(),
          project_id: projectId,
          type: 'quiz',
          title: 'Knowledge Check',
          content_url: JSON.stringify(quiz),
          created_at: new Date().toISOString(),
          quiz: quiz
        };

        await fetch(`/api/projects/${projectId}/generated`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newContent),
        });

        setContents(prev => [newContent, ...prev]);
      }
    } catch (error) {
      console.error('Failed to generate quiz', error);
      alert('Failed to generate quiz.');
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const generateAudioOverview = async () => {
    if (sources.length === 0) return alert('Please add sources first.');
    setIsGenerating(true);
    setProgress({
      steps: [
        { label: 'Content Analysis: Extracting key themes', status: 'current' },
        { label: 'Script Generation: Drafting dialogue', status: 'waiting' },
        { label: 'Audio Synthesis: Generating voices', status: 'waiting' },
        { label: 'Finalizing: Processing audio', status: 'waiting' }
      ],
      currentStepIndex: 0
    });

    try {
      const context = sources
        .map((s, i) => `Source [${i + 1}]: ${s.title}\n${s.content}`)
        .join('\n\n---\n\n');

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      // Step 1: Content Analysis
      const analysisPrompt = `Analyze the following sources and extract the key themes, main arguments, and most interesting insights. 
      Focus on what would make for a compelling discussion.
      
      SOURCES:
      ${context}`;

      const analysisResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: analysisPrompt }] }],
      });
      const analysis = analysisResponse.text;

      // Step 2: Script Generation
      updateProgress(1);
      const scriptPrompt = `Create a podcast script based on the following analysis and sources.
      
      Format: Two-host conversational (Host A: ${audioSettings.hostA.name}, Host B: ${audioSettings.hostB.name}).
      Tone: ${audioSettings.tone}.
      Length: ${audioSettings.length} (approx ${audioSettings.length === 'short' ? '300' : audioSettings.length === 'medium' ? '600' : '1000'} words).
      Language: ${audioSettings.language}.
      Engagement Level: ${audioSettings.engagementLevel} (High = lots of banter/interruptions, Low = formal turn-taking).
      Pacing: ${audioSettings.pacing} (Fast = quick exchanges, Slow = thoughtful pauses).
      
      Host A (${audioSettings.hostA.name}): ${audioSettings.hostA.personality}.
      Host B (${audioSettings.hostB.name}): ${audioSettings.hostB.personality}.
      
      Requirements:
      - Dynamic banter, interruptions, and natural transitions.
      - "Wait, that's interesting..." style reactions.
      - Deep dives into complex topics.
      - Use [Source X] citations in the text where appropriate.
      - Include emotional cues in the JSON.
      
      Return ONLY a JSON array of script segments with this structure:
      [
        {
          "speaker": "host_a" | "host_b",
          "text": "The spoken text...",
          "emotion": "neutral" | "excited" | "curious" | "serious" | "humorous" | "concerned"
        },
        ...
      ]

      ANALYSIS:
      ${analysis}
      
      SOURCES:
      ${context}`;

      const scriptResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ parts: [{ text: scriptPrompt }] }],
        config: { responseMimeType: "application/json" }
      });

      const scriptJson = scriptResponse.text;
      if (!scriptJson) throw new Error("Failed to generate script");
      
      let scriptSegments: ScriptSegment[] = [];
      try {
        scriptSegments = JSON.parse(scriptJson);
      } catch (e) {
        console.error("Failed to parse script JSON", e);
        throw new Error("Invalid script format generated");
      }

      // Step 3: Audio Synthesis
      updateProgress(2);
      
      // Convert script segments to a single text for the TTS model
      // The model handles multi-speaker if formatted correctly
      const ttsInput = scriptSegments.map(seg => {
        const speakerName = seg.speaker === 'host_a' ? audioSettings.hostA.name : audioSettings.hostB.name;
        return `${speakerName}: ${seg.text}`;
      }).join('\n');

      const ttsResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: ttsInput }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                {
                  speaker: audioSettings.hostA.name,
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: audioSettings.hostA.voice } }
                },
                {
                  speaker: audioSettings.hostB.name,
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: audioSettings.hostB.voice } }
                }
              ]
            }
          },
        },
      });

      const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      updateProgress(3);
      
      if (base64Audio) {
        const audioOverview: AudioOverview = {
          id: uuidv4(),
          projectId: projectId,
          title: `Podcast: ${sources[0].title.substring(0, 20)}...`,
          format: 'dialogue',
          duration: 0, // We don't know exact duration without decoding
          status: 'ready',
          script: scriptSegments,
          audioUrl: base64Audio,
          waveformData: generateWaveform(),
          settings: audioSettings
        };

        const newContent: GeneratedContent = {
          id: audioOverview.id,
          project_id: projectId,
          type: 'audio',
          title: audioOverview.title,
          content_url: JSON.stringify(audioOverview), // Store full object
          created_at: new Date().toISOString(),
          audio_overview: audioOverview
        };

        await fetch(`/api/projects/${projectId}/generated`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newContent),
        });

        setContents(prev => [newContent, ...prev]);
      }
    } catch (error) {
      console.error('Failed to generate audio', error);
      alert('Failed to generate audio overview.');
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const generateExport = async (format: string) => {
    if (sources.length === 0) return alert('Please add sources first.');
    setIsGenerating(true);
    setProgress({
      steps: [
        { label: 'Analyzing content context', status: 'current' },
        { label: 'Structuring document', status: 'waiting' },
        { label: 'Formatting output', status: 'waiting' }
      ],
      currentStepIndex: 0
    });

    try {
      const context = sources
        .map((s, i) => `Source [${i + 1}]: ${s.title}\n${s.content}`)
        .join('\n\n---\n\n');

      let prompt = "";
      let title = "";

      switch (format) {
        case 'report':
          title = "Structured Report";
          prompt = `Generate a structured report based on the sources. Include a Table of Contents, Introduction, Key Findings (with citations), Methodology, and Conclusion. Format as Markdown.`;
          break;
        case 'summary':
          title = "Executive Summary";
          prompt = `Generate a one-page executive summary of the sources. Focus on key takeaways, strategic insights, and actionable recommendations. Format as Markdown.`;
          break;
        case 'review':
          title = "Literature Review";
          prompt = `Write an academic literature review based on the sources. Synthesize the arguments, identify themes, and properly cite the sources. Format as Markdown.`;
          break;
        case 'presentation':
          title = "Presentation Deck";
          prompt = `Generate a presentation deck outline based on the sources. Create 5-7 slides. For each slide, provide a Title, Bullet Points, and Speaker Notes. Format as Markdown.`;
          break;
        case 'study':
          title = "Study Guide";
          prompt = `Create a study guide from the sources. Include Key Terms and Definitions, a Summary of Major Concepts, and 5 Practice Questions with Answers. Format as Markdown.`;
          break;
        case 'timeline':
          title = "Timeline";
          prompt = `Extract a chronological timeline of events mentioned in the sources. Format as a list with dates and descriptions. Format as Markdown.`;
          break;
        case 'analysis':
          title = "Content Analysis";
          prompt = `Perform a content analysis of the sources. Extract key themes, main arguments, and underlying assumptions. Provide specific examples from the text. Format as Markdown.`;
          break;
        case 'briefing':
          title = "Research Briefing";
          prompt = `Create a comprehensive Research Briefing document.
          Structure:
          1. Executive Overview (High-level summary)
          2. Strategic Implications (Why this matters)
          3. Key Insights (Bulleted list of critical facts)
          4. Source Analysis (Evaluation of the source material credibility/bias)
          5. Recommended Next Steps
          
          Tone: Professional, authoritative, and concise.
          Format: Markdown with clear headers and bullet points.`;
          break;
        default:
          return;
      }

      updateProgress(1);
      prompt += `\n\nSOURCES:\n${context}`;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
      });

      updateProgress(2);
      const text = response.text;
      if (text) {
        const newContent: GeneratedContent = {
          id: uuidv4(),
          project_id: projectId,
          type: 'text', // Using 'text' type for exports for now, could be 'export'
          title: title,
          content_url: text, // Storing text content directly
          created_at: new Date().toISOString(),
        };

        await fetch(`/api/projects/${projectId}/generated`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newContent),
        });

        setContents(prev => [newContent, ...prev]);
      }

    } catch (error) {
      console.error('Failed to generate export', error);
      alert('Failed to generate export.');
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const generateMindMap = async () => {
    if (sources.length === 0) return alert('Please add sources first.');
    setIsGenerating(true);
    setProgress({
      steps: [
        { label: 'Extracting key concepts', status: 'current' },
        { label: 'Mapping relationships', status: 'waiting' },
        { label: 'Visualizing data', status: 'waiting' }
      ],
      currentStepIndex: 0
    });

    try {
      const context = sources
        .map((s, i) => `Source [${i + 1}]: ${s.title}\n${s.content}`)
        .join('\n\n---\n\n');

      updateProgress(1);
      const prompt = `Create a mind map JSON structure based on the key concepts in these sources.
Return ONLY valid JSON with this structure:
{
  "nodes": [
    { "id": "1", "data": { "label": "Main Concept" }, "position": { "x": 250, "y": 5 } },
    ...
  ],
  "edges": [
    { "id": "e1-2", "source": "1", "target": "2" },
    ...
  ]
}
Make sure positions are spread out reasonably.

SOURCES:
${context}`;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json"
        }
      });

      updateProgress(2);
      const jsonText = response.text || '{}';
      const parsed = JSON.parse(jsonText);

      if (parsed.nodes && parsed.edges) {
        // Add styles to nodes
        const styledNodes = parsed.nodes.map((n: any) => ({
          ...n,
          style: { 
            background: '#1e1e24', 
            color: '#fff', 
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '10px 20px',
            fontSize: '12px'
          }
        }));

        const styledEdges = parsed.edges.map((e: any) => ({
          ...e,
          animated: true,
          style: { stroke: '#6366f1' },
        }));

        setNodes(styledNodes);
        setEdges(styledEdges);

        const newContent: GeneratedContent = {
          id: uuidv4(),
          project_id: projectId,
          type: 'mindmap',
          title: 'Concept Map',
          content_url: JSON.stringify({ nodes: styledNodes, edges: styledEdges }),
          created_at: new Date().toISOString(),
        };

        await fetch(`/api/projects/${projectId}/generated`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newContent),
        });

        setContents(prev => [newContent, ...prev]);
      }
    } catch (error) {
      console.error('Failed to generate mind map', error);
      alert('Failed to generate mind map.');
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const togglePlay = async (id: string, contentUrl: string) => {
    // Check if contentUrl is a JSON string (AudioOverview) or raw base64
    let base64Data = contentUrl;
    try {
      const parsed = JSON.parse(contentUrl);
      if (parsed.audioUrl) {
        base64Data = parsed.audioUrl;
      }
    } catch (e) {
      // Not JSON, assume base64
    }

    if (playingId === id) {
      if (activeAudioSource) {
        activeAudioSource.stop();
        setActiveAudioSource(null);
        setActiveAudioContext(null);
      }
      setPlayingId(null);
      setAudioProgress(0);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    } else {
      if (activeAudioSource) {
        activeAudioSource.stop();
      }
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      
      try {
        const { source, context, duration } = await playPcmAudio(base64Data);
        source.playbackRate.value = playbackRate; // Set initial playback rate
        source.onended = () => {
          setPlayingId(null);
          setActiveAudioSource(null);
          setActiveAudioContext(null);
          setAudioProgress(0);
          if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
        setActiveAudioSource(source);
        setActiveAudioContext(context);
        setAudioDuration(duration);
        setAudioStartTime(context.currentTime);
        setPlayingId(id);
      } catch (e) {
        console.error("Failed to play audio", e);
      }
    }
  };

  // Update playback rate dynamically
  useEffect(() => {
    if (activeAudioSource) {
      activeAudioSource.playbackRate.value = playbackRate;
    }
  }, [playbackRate, activeAudioSource]);

  // Track audio progress
  useEffect(() => {
    const updateProgress = () => {
      if (activeAudioContext && playingId) {
        const elapsed = (activeAudioContext.currentTime - audioStartTime) * playbackRate;
        setAudioProgress(Math.min(elapsed / audioDuration, 1));
        animationRef.current = requestAnimationFrame(updateProgress);
      }
    };

    if (playingId) {
      animationRef.current = requestAnimationFrame(updateProgress);
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [playingId, activeAudioContext, audioStartTime, audioDuration, playbackRate]);

  const handleDownload = (content: GeneratedContent) => {
    if (content.type === 'text') {
      const blob = new Blob([content.content_url], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${content.title.replace(/\s+/g, '_')}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (content.type === 'audio') {
      let base64Data = content.content_url;
      try {
        const parsed = JSON.parse(content.content_url);
        if (parsed.audioUrl) base64Data = parsed.audioUrl;
      } catch (e) {}

      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/wav' }); // Assuming WAV/PCM container or raw
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${content.title.replace(/\s+/g, '_')}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const getAudioOverview = (content: GeneratedContent): AudioOverview | null => {
    try {
      return JSON.parse(content.content_url);
    } catch {
      return null;
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-transparent relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 right-1/2 translate-x-1/2 w-full h-32 bg-purple-500/5 blur-[100px] pointer-events-none" />

      <div className="p-4 sm:p-6 border-b border-white/5 bg-black/40 backdrop-blur-2xl sticky top-0 z-20">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-1.5 bg-purple-500/10 rounded-lg">
            <Sparkles className="w-4 h-4 text-purple-500" />
          </div>
          <h2 className="font-bold text-white text-sm uppercase tracking-[0.2em]">Synthesis</h2>
        </div>

        <div className="flex bg-black/40 rounded-xl p-1 border border-white/5 overflow-x-auto no-scrollbar">
          {[
            { id: 'audio', label: 'Audio', icon: Headphones },
            { id: 'mindmap', label: 'Mindmap', icon: Network },
            { id: 'export', label: 'Export', icon: FileDown },
            { id: 'learn', label: 'Study', icon: BookOpen },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'learn' && (
          <div className="h-full overflow-y-auto p-4 sm:p-8 space-y-8 sm:space-y-12 custom-scrollbar">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Cognitive Lab</h3>
                <p className="text-[10px] sm:text-sm text-slate-500 mt-0.5 sm:mt-1">Master your research through active recall and spaced repetition.</p>
              </div>
              <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                <button
                  onClick={generateFlashcards}
                  disabled={isGenerating || sources.length === 0}
                  className="premium-button flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs flex items-center justify-center gap-2"
                >
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  <span>Flashcards</span>
                </button>
                <button
                  onClick={generateQuiz}
                  disabled={isGenerating || sources.length === 0}
                  className="premium-button flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs flex items-center justify-center gap-2"
                >
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  <span>Quiz</span>
                </button>
              </div>
            </div>

            <div className="space-y-8 sm:space-y-12">
              {contents.filter(c => c.type === 'flashcards' || c.type === 'quiz').map((content) => {
                const isFlashcards = content.type === 'flashcards';
                const flashcards = isFlashcards ? (content.flashcards || JSON.parse(content.content_url)) : [];
                const quiz = !isFlashcards ? (content.quiz || JSON.parse(content.content_url)) : [];

                return (
                  <div key={content.id} className="space-y-4 sm:space-y-6">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 bg-purple-500/10 rounded-lg flex items-center justify-center border border-purple-500/20">
                          {isFlashcards ? <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" /> : <BrainCircuit className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />}
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">{content.title}</h4>
                      </div>
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {new Date(content.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {isFlashcards && flashcards.length > 0 && (
                      <div className="flex flex-col items-center gap-6 sm:gap-8">
                        <div 
                          className="relative w-full max-w-lg aspect-[4/3] cursor-pointer perspective-1000 group"
                          onClick={() => setIsFlipped(!isFlipped)}
                        >
                          <motion.div
                            initial={false}
                            animate={{ rotateY: isFlipped ? 180 : 0 }}
                            transition={{ duration: 0.7, type: "spring", stiffness: 260, damping: 20 }}
                            className="w-full h-full relative preserve-3d"
                          >
                            {/* Front */}
                            <div className="absolute inset-0 backface-hidden glass-panel rounded-xl sm:rounded-[2.5rem] p-3 sm:p-10 flex flex-col items-center justify-center text-center border border-white/10 shadow-2xl overflow-hidden">
                              <div className="absolute inset-0 cinematic-gradient opacity-5"></div>
                              <div className="relative z-10">
                                <div className="w-6 h-6 sm:w-12 sm:h-12 bg-purple-500/10 rounded-lg sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-8 mx-auto border border-purple-500/20">
                                  <HelpCircle className="w-3 h-3 sm:w-6 sm:h-6 text-purple-400" />
                                </div>
                                <p className="text-sm sm:text-2xl font-bold text-white leading-tight tracking-tight px-1 sm:px-2">{flashcards[activeFlashcardIndex].front}</p>
                                <p className="text-[7px] sm:text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold mt-4 sm:mt-10 opacity-50 group-hover:opacity-100 transition-opacity">Click to reveal answer</p>
                              </div>
                            </div>

                            {/* Back */}
                            <div className="absolute inset-0 backface-hidden glass-panel rounded-xl sm:rounded-[2.5rem] p-3 sm:p-10 flex flex-col items-center justify-center text-center border border-emerald-500/20 shadow-2xl rotate-y-180 overflow-hidden">
                              <div className="absolute inset-0 bg-emerald-500/5"></div>
                              <div className="relative z-10">
                                <div className="w-6 h-6 sm:w-12 sm:h-12 bg-emerald-500/10 rounded-lg sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-8 mx-auto border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3 sm:w-6 sm:h-6 text-emerald-400" />
                                </div>
                                <p className="text-[13px] sm:text-xl text-slate-200 leading-relaxed font-medium px-1 sm:px-2">{flashcards[activeFlashcardIndex].back}</p>
                              </div>
                            </div>
                          </motion.div>
                        </div>

                        <div className="flex items-center gap-4 sm:gap-6">
                          <button
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setActiveFlashcardIndex(prev => Math.max(0, prev - 1));
                              setIsFlipped(false);
                            }}
                            disabled={activeFlashcardIndex === 0}
                            className="p-2.5 sm:p-4 rounded-lg sm:rounded-2xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all hover:scale-110 active:scale-95 disabled:opacity-20"
                          >
                            <ChevronLeft className="w-4 h-4 sm:w-6 sm:h-6" />
                          </button>
                          <span className="text-[8px] sm:text-[10px] font-bold text-purple-400 uppercase tracking-widest">
                            {activeFlashcardIndex + 1} / {flashcards.length}
                          </span>
                          <button
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setActiveFlashcardIndex(prev => Math.min(flashcards.length - 1, prev + 1));
                              setIsFlipped(false);
                            }}
                            disabled={activeFlashcardIndex === flashcards.length - 1}
                            className="p-2.5 sm:p-4 rounded-lg sm:rounded-2xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all hover:scale-110 active:scale-95 disabled:opacity-20"
                          >
                            <ChevronRight className="w-4 h-4 sm:w-6 sm:h-6" />
                          </button>
                        </div>
                      </div>
                    )}

                    {!isFlashcards && quiz.length > 0 && (
                      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
                        {quiz.map((q: QuizQuestion, qIdx: number) => {
                          const isAnswered = quizAnswers[`${content.id}-${q.id}`] !== undefined;
                          const selectedIdx = quizAnswers[`${content.id}-${q.id}`];
                          const isCorrect = selectedIdx === q.correctAnswer;
                          
                          return (
                            <div key={q.id} className="glass-panel p-4 sm:p-10 rounded-xl sm:rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden">
                              <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
                                <div 
                                  className="h-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] transition-all duration-500"
                                  style={{ width: `${((qIdx + 1) / quiz.length) * 100}%` }}
                                />
                              </div>
                              <h5 className="text-[15px] sm:text-2xl font-bold text-white leading-tight tracking-tight mb-4 sm:mb-10">
                                <span className="text-purple-500 mr-2 sm:mr-3">{qIdx + 1}.</span>
                                {q.question}
                              </h5>
                              <div className="grid grid-cols-1 gap-2 sm:gap-4">
                                {q.options.map((opt: string, oIdx: number) => {
                                  const isAnswered = quizAnswers[`${content.id}-${q.id}`] !== undefined;
                                  const selectedIdx = quizAnswers[`${content.id}-${q.id}`];
                                  const isCorrect = selectedIdx === q.correctAnswer;
                                  const isSelected = selectedIdx === oIdx;
                                  const isOptionCorrect = oIdx === q.correctAnswer;
                                  
                                  let variant = "default";
                                  if (showQuizResults) {
                                    if (isOptionCorrect) variant = "correct";
                                    else if (isSelected) variant = "incorrect";
                                  } else if (isSelected) {
                                    variant = "selected";
                                  }

                                  return (
                                    <button
                                      key={oIdx}
                                      onClick={() => !showQuizResults && setQuizAnswers(prev => ({ ...prev, [`${content.id}-${q.id}`]: oIdx }))}
                                      className={`w-full p-2.5 sm:p-5 rounded-lg sm:rounded-2xl text-left transition-all duration-300 border flex items-center justify-between group ${
                                        variant === "correct" ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]" :
                                        variant === "incorrect" ? "bg-red-500/10 border-red-500/50 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.1)]" :
                                        variant === "selected" ? "bg-purple-500/10 border-purple-500/50 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.1)]" :
                                        "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20"
                                      }`}
                                    >
                                      <span className="text-[11px] sm:text-base font-medium">{opt}</span>
                                      <div className={`w-3.5 h-3.5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                        variant === "correct" ? "border-emerald-500 bg-emerald-500" :
                                        variant === "incorrect" ? "border-red-500 bg-red-500" :
                                        variant === "selected" ? "border-purple-500 bg-purple-500" :
                                        "border-white/10 group-hover:border-white/30"
                                      }`}>
                                        {variant === "correct" && <Check className="w-2 h-2 sm:w-4 sm:h-4 text-white" />}
                                        {variant === "incorrect" && <X className="w-2 h-2 sm:w-4 sm:h-4 text-white" />}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>

                              {showQuizResults && (
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className={`mt-4 sm:mt-8 p-3 sm:p-6 rounded-lg sm:rounded-2xl border ${selectedIdx === q.correctAnswer ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300' : 'bg-red-500/5 border-red-500/20 text-red-300'}`}
                                >
                                  <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                                    {selectedIdx === q.correctAnswer ? <CheckCircle2 className="w-3 h-3 sm:w-5 sm:h-5" /> : <AlertCircle className="w-3 h-3 sm:w-5 sm:h-5" />}
                                    <span className="font-bold text-[8px] sm:text-sm uppercase tracking-widest">{selectedIdx === q.correctAnswer ? 'Correct' : 'Incorrect'}</span>
                                  </div>
                                  <p className="text-[10px] sm:text-sm opacity-80 leading-relaxed">{q.explanation}</p>
                                </motion.div>
                              )}
                            </div>
                          );
                        })}

                        <div className="flex justify-center pt-6 sm:pt-8">
                          <button
                            onClick={() => setShowQuizResults(!showQuizResults)}
                            className="premium-button px-8 sm:px-12 py-4 sm:py-5 flex items-center gap-2 sm:gap-3"
                          >
                            <BrainCircuit className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="text-[10px] sm:text-sm tracking-[0.15em] sm:tracking-[0.2em] font-bold">{showQuizResults ? 'HIDE RESULTS' : 'CHECK ANSWERS'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {contents.filter(c => c.type === 'flashcards' || c.type === 'quiz').length === 0 && (
                <div className="glass-panel rounded-2xl sm:rounded-[2.5rem] p-8 sm:p-20 flex flex-col items-center justify-center text-center border border-white/5 shadow-xl">
                  <div className="w-12 h-12 sm:w-20 sm:h-20 bg-white/5 rounded-xl sm:rounded-[2rem] flex items-center justify-center mb-4 sm:mb-8 border border-white/5">
                    <BrainCircuit className="w-6 h-6 sm:w-10 sm:h-10 text-slate-700" />
                  </div>
                  <h5 className="text-base sm:text-xl font-bold text-white mb-1.5 sm:mb-3">Cognitive Lab Empty</h5>
                  <p className="text-[11px] sm:text-sm text-slate-500 max-w-[240px] leading-relaxed">Generate flashcards or a quiz to start your knowledge assessment journey.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="h-full overflow-y-auto p-3 sm:p-8 space-y-4 sm:space-y-8 custom-scrollbar">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-4 sm:p-8 rounded-xl sm:rounded-3xl text-center relative overflow-hidden group border border-white/10 shadow-2xl"
            >
              <div className="absolute inset-0 cinematic-gradient opacity-10 group-hover:opacity-20 transition-opacity duration-700"></div>
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4 sm:mb-8">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-lg sm:rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-white/10 shadow-[0_0_20px_rgba(168,85,247,0.15)] backdrop-blur-xl group-hover:scale-105 transition-transform duration-500">
                      <Mic className="w-5 h-5 sm:w-8 sm:h-8 text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-base sm:text-xl font-bold text-white tracking-tight">Intelligence Studio</h3>
                      <p className="text-[8px] sm:text-[10px] text-purple-400/80 uppercase tracking-[0.2em] sm:tracking-[0.3em] font-bold">High Fidelity Synthesis</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-1.5 sm:p-3 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg sm:rounded-2xl transition-all border border-transparent hover:border-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                  >
                    <Settings className="w-4 h-4 sm:w-6 sm:h-6" />
                  </button>
                </div>
                
                <p className="text-[13px] sm:text-base text-slate-400 mb-4 sm:mb-8 text-left leading-relaxed max-w-xl font-medium">
                  Transform your research into a cinematic audio experience. Featuring <span className="text-white font-bold">{audioSettings.hostA.name}</span> & <span className="text-white font-bold">{audioSettings.hostB.name}</span> in a deep-dive conversational format.
                </p>
                
                <div className="flex flex-wrap gap-1 sm:gap-3 mb-4 sm:mb-10">
                  {[
                    { icon: Activity, label: audioSettings.tone, color: 'text-blue-400' },
                    { icon: Clock, label: audioSettings.length, color: 'text-purple-400' },
                    { icon: Network, label: `${audioSettings.engagementLevel} Engagement`, color: 'text-emerald-400' }
                  ].map((tag, i) => (
                    <div key={i} className="px-2 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 text-[8px] sm:text-xs font-bold text-slate-300 flex items-center gap-1 sm:gap-1.5 hover:bg-white/10 transition-colors">
                      <tag.icon className={`w-2 h-2 sm:w-3.5 h-3.5 ${tag.color}`} />
                      <span className="capitalize tracking-wide">{tag.label}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={generateAudioOverview}
                  disabled={isGenerating || sources.length === 0}
                  className="premium-button w-full py-3.5 sm:py-5 flex items-center justify-center gap-2 sm:gap-4 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 sm:w-6 sm:h-6 animate-spin" />
                      <span className="text-[10px] sm:text-sm tracking-[0.15em] sm:tracking-[0.2em] font-bold">SYNTHESIZING...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 sm:w-6 sm:h-6" />
                      <span className="text-[10px] sm:text-sm tracking-[0.15em] sm:tracking-[0.2em] font-bold">GENERATE AUDIO</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>

            {/* Playback Controls */}
            {playingId && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-3 sm:p-4 rounded-2xl flex items-center justify-between gap-3 sm:gap-6 sticky top-0 z-10 bg-black/60 backdrop-blur-2xl border border-purple-500/20 shadow-2xl"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-purple-500/10 rounded-lg">
                    <Volume2 className="w-3.5 h-3.5 sm:w-4 h-4 text-purple-400" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest">Speed</span>
                </div>
                <div className="flex gap-1.5 sm:gap-2">
                  {[0.5, 1.0, 1.5, 2.0].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => setPlaybackRate(rate)}
                      className={`text-[9px] sm:text-[10px] font-bold px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg transition-all ${
                        playbackRate === rate 
                          ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' 
                          : 'bg-white/5 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {contents.filter(c => c.type === 'audio').map((content) => {
                const overview = getAudioOverview(content);
                return (
                  <motion.div 
                    key={content.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="glass-card p-3 sm:p-6 rounded-xl sm:rounded-3xl border border-white/5 hover:border-purple-500/30 transition-all group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl pointer-events-none group-hover:bg-purple-500/10 transition-colors" />
                    
                    <div className="flex items-center gap-3 sm:gap-6 mb-3 sm:mb-6">
                      <button
                        onClick={() => togglePlay(content.id, content.content_url)}
                        className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 hover:bg-purple-500 transition-all shadow-lg shadow-purple-500/20 active:scale-95"
                      >
                        {playingId === content.id ? <Pause className="w-4 h-4 sm:w-6 sm:h-6" /> : <Play className="w-4 h-4 sm:w-6 sm:h-6 ml-1" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm sm:text-lg font-bold text-white truncate mb-0.5 sm:mb-1">{content.title}</h4>
                        <div className="flex items-center gap-2 sm:gap-3 text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          <Clock className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5" />
                          <span>{new Date(content.created_at).toLocaleDateString()}</span>
                          {overview && (
                            <>
                              <span className="text-slate-800 hidden sm:inline">•</span>
                              <span className="text-purple-400/80 truncate">{overview.settings.hostA.name} & {overview.settings.hostB.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDownload(content)}
                        className="p-1.5 sm:p-3 text-slate-500 hover:text-white transition-colors hover:bg-white/10 rounded-lg sm:rounded-2xl border border-transparent hover:border-white/10"
                      >
                        <Download className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                      </button>
                    </div>

                    {/* Waveform Visualization */}
                    {overview && overview.waveformData && (
                      <div className="space-y-4">
                        <div className="h-12 flex items-end gap-[2px] opacity-40 group-hover:opacity-100 transition-all duration-500">
                          {overview.waveformData.map((val, i) => {
                            const isPlayed = playingId === content.id && (i / overview.waveformData.length) <= audioProgress;
                            return (
                              <div 
                                key={i} 
                                className={`flex-1 rounded-full transition-all duration-300 ${
                                  playingId === content.id 
                                    ? (isPlayed ? 'bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-purple-500/20') 
                                    : 'bg-slate-700'
                                }`}
                                style={{ 
                                  height: `${Math.max(10, val * 100)}%`,
                                }}
                              />
                            );
                          })}
                        </div>
                        {playingId === content.id && (
                          <div className="space-y-2">
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.6)] transition-all duration-100 ease-linear"
                                style={{ width: `${audioProgress * 100}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-500 font-mono font-bold">
                              <span>{formatTime(audioProgress * audioDuration)}</span>
                              <span>{formatTime(audioDuration)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}


        {activeTab === 'mindmap' && (
          <div className="h-full flex flex-col gap-3 sm:gap-6 p-3 sm:p-8">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base sm:text-xl font-bold text-white tracking-tight">Concept Map</h3>
                <p className="text-[9px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">Visualizing relationships between key research nodes.</p>
              </div>
              <button
                onClick={generateMindMap}
                disabled={isGenerating || sources.length === 0}
                className="premium-button px-3 sm:px-6 py-1.5 sm:py-2.5 text-[9px] sm:text-xs flex items-center gap-1.5 sm:gap-2"
              >
                {isGenerating ? <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" /> : <Network className="w-3 h-3 sm:w-4 sm:h-4" />}
                <span>{nodes.length > 0 ? 'Refresh' : 'Generate'}</span>
              </button>
            </div>

            <div className="flex-1 glass-panel rounded-xl sm:rounded-3xl border border-white/5 overflow-hidden relative min-h-[300px] sm:min-h-[500px] shadow-2xl">
              {nodes.length > 0 ? (
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  fitView
                  className="bg-black/20"
                >
                  <Background color="#333" gap={20} />
                  <Controls className="bg-black/60 border-white/10 fill-white scale-75 sm:scale-100 origin-bottom-left" />
                </ReactFlow>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 sm:p-8">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/5 rounded-xl flex items-center justify-center mb-4 sm:mb-6 border border-white/5">
                    <Network className="w-6 h-6 sm:w-8 text-slate-700" />
                  </div>
                  <p className="text-[11px] sm:text-sm text-slate-500 max-w-[200px]">Generate a visual map to see how your research concepts connect.</p>
                </div>
              )}
            </div>
          </div>
        )}


        {activeTab === 'export' && (
          <div className="h-full overflow-y-auto p-3 sm:p-8 space-y-4 sm:space-y-8 custom-scrollbar">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base sm:text-xl font-bold text-white tracking-tight">Intelligence Synthesis</h3>
                <p className="text-[9px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">Export your research into high-fidelity documents.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {[
                { id: 'summary', label: 'Executive Summary', icon: FileText, desc: 'A concise overview of all key points.' },
                { id: 'report', label: 'Research Report', icon: FileDown, desc: 'Detailed analysis with structured sections.' },
                { id: 'review', label: 'Literature Review', icon: BookOpen, desc: 'Synthesized analysis of source arguments.' },
                { id: 'presentation', label: 'Presentation Deck', icon: Layers, desc: 'Slide-by-slide outline for presentations.' },
                { id: 'study', label: 'Study Guide', icon: GraduationCap, desc: 'Key terms, concepts, and review questions.' },
                { id: 'timeline', label: 'Timeline', icon: Clock, desc: 'Chronological mapping of key events.' },
                { id: 'analysis', label: 'Content Analysis', icon: BrainCircuit, desc: 'Deep dive into themes and assumptions.' },
                { id: 'briefing', label: 'Research Briefing', icon: Sparkles, desc: 'Actionable insights and strategic takeaways.' },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => generateExport(type.id)}
                  disabled={isGenerating}
                  className="glass-card p-4 sm:p-6 rounded-xl sm:rounded-3xl border border-white/5 text-left group hover:scale-[1.02] transition-all duration-300 relative overflow-hidden shadow-xl"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl pointer-events-none group-hover:bg-purple-500/10 transition-colors" />
                  <div className="w-8 h-8 sm:w-14 sm:h-14 bg-purple-500/10 rounded-lg sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-6 border border-purple-500/20 group-hover:bg-purple-500 group-hover:text-white transition-all shadow-lg shadow-purple-500/5">
                    <type.icon className="w-4 h-4 sm:w-7 sm:h-7" />
                  </div>
                  <h4 className="text-sm sm:text-lg font-bold text-white mb-0.5 sm:mb-2">{type.label}</h4>
                  <p className="text-[9px] sm:text-xs text-slate-500 leading-relaxed mb-3 sm:mb-6 line-clamp-2">{type.desc}</p>
                  <div className="flex items-center gap-1.5 text-[8px] sm:text-[10px] font-bold text-purple-400 uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-all">
                    Generate Document <ChevronRight className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5" />
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-3 mt-6 sm:mt-12">
              <h3 className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] sm:tracking-[0.3em] px-1">Recent Syntheses</h3>
              <div className="grid grid-cols-1 gap-2 sm:gap-4">
                {contents.filter(c => c.type === 'text').map((content) => (
                  <motion.div 
                    key={content.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="glass-card p-3 sm:p-6 rounded-xl sm:rounded-3xl border border-white/5 hover:border-purple-500/30 transition-all group relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-3 sm:gap-6">
                      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                        <div className="w-7 h-7 sm:w-10 sm:h-10 bg-white/5 rounded-lg sm:rounded-xl flex items-center justify-center border border-white/5 group-hover:bg-purple-500/10 group-hover:border-purple-500/20 transition-all">
                          <FileText className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-slate-400 group-hover:text-purple-400" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-[13px] sm:text-sm font-bold text-white truncate">{content.title}</h4>
                          <p className="text-[8px] sm:text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">
                            {new Date(content.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 sm:gap-2 shrink-0">
                        <button 
                          onClick={() => setViewingContent(content)}
                          className="p-1.5 sm:p-2.5 text-slate-500 hover:text-white transition-all hover:bg-white/10 rounded-lg sm:rounded-xl border border-transparent hover:border-white/10"
                        >
                          <Eye className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                        </button>
                        <button 
                          onClick={() => handleDownload(content)}
                          className="p-1.5 sm:p-2.5 text-slate-500 hover:text-white transition-all hover:bg-white/10 rounded-lg sm:rounded-xl border border-transparent hover:border-white/10"
                        >
                          <Download className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}


        {/* Settings Modal */}
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setIsSettingsOpen(false)}
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-400" />
                    Podcast Settings
                  </h3>
                  <button onClick={() => setIsSettingsOpen(false)} className="text-slate-500 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex border-b border-white/5">
                  <button 
                    onClick={() => setSettingsTab('general')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors relative ${settingsTab === 'general' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    General
                    {settingsTab === 'general' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>}
                  </button>
                  <button 
                    onClick={() => setSettingsTab('hostA')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors relative ${settingsTab === 'hostA' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Host A
                    {settingsTab === 'hostA' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>}
                  </button>
                  <button 
                    onClick={() => setSettingsTab('hostB')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors relative ${settingsTab === 'hostB' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Host B
                    {settingsTab === 'hostB' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>}
                  </button>
                </div>

                <div className="p-6 space-y-6 min-h-[300px]">
                  {settingsTab === 'general' && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-slate-500 block mb-1.5 uppercase tracking-wider font-medium">Tone</label>
                          <select 
                            value={audioSettings.tone}
                            onChange={e => setAudioSettings({...audioSettings, tone: e.target.value as any})}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-blue-500/50 outline-none appearance-none hover:border-white/20 transition-colors"
                          >
                            <option value="casual">Casual</option>
                            <option value="professional">Professional</option>
                            <option value="academic">Academic</option>
                            <option value="humorous">Humorous</option>
                            <option value="enthusiastic">Enthusiastic</option>
                            <option value="serious">Serious</option>
                            <option value="storytelling">Storytelling</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 block mb-1.5 uppercase tracking-wider font-medium">Length</label>
                          <select 
                            value={audioSettings.length}
                            onChange={e => setAudioSettings({...audioSettings, length: e.target.value as any})}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-blue-500/50 outline-none appearance-none hover:border-white/20 transition-colors"
                          >
                            <option value="short">Short (~2 min)</option>
                            <option value="medium">Medium (~5 min)</option>
                            <option value="long">Long (~10 min)</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                          <label className="text-xs text-slate-500 block mb-1.5 uppercase tracking-wider font-medium">Language</label>
                          <select 
                            value={audioSettings.language}
                            onChange={e => setAudioSettings({...audioSettings, language: e.target.value as any})}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-blue-500/50 outline-none appearance-none hover:border-white/20 transition-colors"
                          >
                            <option value="en-US">English (US)</option>
                            <option value="en-GB">English (UK)</option>
                            <option value="es-ES">Spanish</option>
                            <option value="fr-FR">French</option>
                            <option value="de-DE">German</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 block mb-1.5 uppercase tracking-wider font-medium">Pacing</label>
                          <select 
                            value={audioSettings.pacing}
                            onChange={e => setAudioSettings({...audioSettings, pacing: e.target.value as any})}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-blue-500/50 outline-none appearance-none hover:border-white/20 transition-colors"
                          >
                            <option value="fast">Fast</option>
                            <option value="moderate">Moderate</option>
                            <option value="slow">Slow</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-slate-500 block mb-1.5 uppercase tracking-wider font-medium">Engagement Level</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['low', 'medium', 'high'].map((level) => (
                            <button
                              key={level}
                              onClick={() => setAudioSettings({...audioSettings, engagementLevel: level as any})}
                              className={`py-2 rounded-lg text-xs font-medium capitalize border transition-all ${
                                audioSettings.engagementLevel === level 
                                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' 
                                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2">
                          Controls the amount of banter, interruptions, and "human-like" imperfections.
                        </p>
                      </div>
                    </div>
                  )}

                  {(settingsTab === 'hostA' || settingsTab === 'hostB') && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      {(() => {
                        const hostKey = settingsTab as 'hostA' | 'hostB';
                        const host = audioSettings[hostKey];
                        const updateHost = (updates: any) => setAudioSettings({
                          ...audioSettings,
                          [hostKey]: { ...host, ...updates }
                        });

                        return (
                          <>
                            <div className="flex items-center gap-4 mb-2">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${hostKey === 'hostA' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'}`}>
                                {host.name.charAt(0)}
                              </div>
                              <div>
                                <h4 className="text-white font-medium">{hostKey === 'hostA' ? 'Primary Host' : 'Co-Host'}</h4>
                                <p className="text-xs text-slate-500">Configure voice and personality</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs text-slate-500 block mb-1.5 uppercase tracking-wider font-medium">Name</label>
                                <input 
                                  type="text" 
                                  value={host.name}
                                  onChange={e => updateHost({ name: e.target.value })}
                                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-blue-500/50 outline-none transition-colors hover:border-white/20"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 block mb-1.5 uppercase tracking-wider font-medium">Voice</label>
                                <select 
                                  value={host.voice}
                                  onChange={e => updateHost({ voice: e.target.value })}
                                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-blue-500/50 outline-none appearance-none hover:border-white/20 transition-colors"
                                >
                                  <option value="Kore">Kore (Female, Warm)</option>
                                  <option value="Fenrir">Fenrir (Male, Deep)</option>
                                  <option value="Puck">Puck (Male, Energetic)</option>
                                  <option value="Charon">Charon (Male, Authoritative)</option>
                                  <option value="Zephyr">Zephyr (Female, Calm)</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="text-xs text-slate-500 block mb-1.5 uppercase tracking-wider font-medium">Personality Prompt</label>
                              <textarea 
                                value={host.personality}
                                onChange={e => updateHost({ personality: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-blue-500/50 outline-none min-h-[80px] hover:border-white/20 transition-colors resize-none"
                                placeholder="Describe how this host should behave..."
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                               <div>
                                <label className="text-xs text-slate-500 block mb-1.5 uppercase tracking-wider font-medium">Pitch Offset</label>
                                <input 
                                  type="range" 
                                  min="-20" 
                                  max="20" 
                                  value={host.pitch || 0}
                                  onChange={e => updateHost({ pitch: parseInt(e.target.value) })}
                                  className="w-full accent-blue-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                                  <span>Low</span>
                                  <span>{host.pitch || 0}</span>
                                  <span>High</span>
                                </div>
                               </div>
                               <div>
                                <label className="text-xs text-slate-500 block mb-1.5 uppercase tracking-wider font-medium">Speaking Rate</label>
                                <input 
                                  type="range" 
                                  min="0.5" 
                                  max="2.0" 
                                  step="0.1"
                                  value={host.speed || 1.0}
                                  onChange={e => updateHost({ speed: parseFloat(e.target.value) })}
                                  className="w-full accent-blue-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                                  <span>Slow</span>
                                  <span>{host.speed || 1.0}x</span>
                                  <span>Fast</span>
                                </div>
                               </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-white/5 bg-white/5 flex justify-end">
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-6 py-2 bg-white text-black hover:bg-slate-200 rounded-lg text-sm font-bold transition-colors shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                  >
                    Save Changes
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress Modal */}
        <AnimatePresence>
          {progress && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm p-5 sm:p-8"
              >
                <div className="text-center mb-5 sm:mb-8">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 border border-blue-500/20 relative">
                    <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
                    <div className="absolute inset-0 border-2 border-blue-500/30 rounded-full animate-ping opacity-20"></div>
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-white">Generating Content</h3>
                  <p className="text-xs sm:text-sm text-slate-400">AI is processing your request...</p>
                </div>
                
                <div className="space-y-3 sm:space-y-4">
                  {progress.steps.map((step, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                        step.status === 'completed' 
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                          : step.status === 'current'
                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                            : 'bg-white/5 border-white/10 text-slate-600'
                      }`}>
                        {step.status === 'completed' ? (
                          <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        ) : step.status === 'current' ? (
                          <Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" />
                        ) : (
                          <span className="text-[9px] sm:text-[10px] font-medium">{index + 1}</span>
                        )}
                      </div>
                      <span className={`text-[13px] sm:text-sm transition-colors ${
                        step.status === 'waiting' ? 'text-slate-600' : 'text-slate-200'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* View Modal */}
        <AnimatePresence>
          {viewingContent && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setViewingContent(null)}
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5 flex justify-between items-center bg-black/40">
                  <h3 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2 truncate pr-4">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 shrink-0" />
                    <span className="truncate">{viewingContent.title}</span>
                  </h3>
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <button 
                      onClick={() => handleDownload(viewingContent)}
                      className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button 
                      onClick={() => setViewingContent(null)}
                      className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-[#050505]">
                  <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-headings:text-white prose-a:text-blue-400 prose-sm sm:prose-base">
                    <Markdown>{viewingContent.content_url}</Markdown>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
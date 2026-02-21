import { useState, useEffect, useCallback } from 'react';
import { Headphones, Loader2, Play, Pause, FileAudio, Network, Download, Share2, FileText, Presentation, BookOpen, Clock, Activity, Eye, X, CheckCircle2, Sparkles, BrainCircuit, Mic, Settings, Volume2, GraduationCap, ChevronLeft, ChevronRight, RotateCw, HelpCircle } from 'lucide-react';
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
  hostA: { name: 'Alex', voice: 'Kore', personality: 'Enthusiastic, curious' },
  hostB: { name: 'Sam', voice: 'Fenrir', personality: 'Knowledgeable, calm' },
  tone: 'professional',
  length: 'medium'
};

export default function GeneratedPanel({ projectId, sources }: GeneratedPanelProps) {
  const [contents, setContents] = useState<GeneratedContent[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [activeAudioSource, setActiveAudioSource] = useState<AudioBufferSourceNode | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('audio');
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [viewingContent, setViewingContent] = useState<GeneratedContent | null>(null);
  
  // Audio Settings State
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
      
      Host A (${audioSettings.hostA.name}): ${audioSettings.hostA.personality}.
      Host B (${audioSettings.hostB.name}): ${audioSettings.hostB.personality}.
      
      Requirements:
      - Dynamic banter, interruptions, and natural transitions.
      - "Wait, that's interesting..." style reactions.
      - Deep dives into complex topics.
      - Use [Source X] citations in the text where appropriate.
      
      Return ONLY a JSON array of script segments with this structure:
      [
        {
          "speaker": "host_a" | "host_b",
          "text": "The spoken text...",
          "emotion": "neutral" | "excited" | "curious" | "serious"
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
      }
      setPlayingId(null);
    } else {
      if (activeAudioSource) {
        activeAudioSource.stop();
      }
      
      try {
        const source = await playPcmAudio(base64Data);
        source.playbackRate.value = playbackRate; // Set initial playback rate
        source.onended = () => {
          setPlayingId(null);
          setActiveAudioSource(null);
        };
        setActiveAudioSource(source);
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

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] relative">
      <div className="p-3 sm:p-4 border-b border-white/5 flex justify-between items-center">
        <h2 className="font-semibold text-white flex items-center gap-2 text-sm uppercase tracking-wider">
          <Headphones className="w-4 h-4 text-blue-400" />
          Studio
        </h2>
        <div className="flex bg-black/40 rounded-lg p-1 border border-white/5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('audio')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              activeTab === 'audio' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Audio
          </button>
          <button
            onClick={() => setActiveTab('mindmap')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              activeTab === 'mindmap' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Mind Map
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              activeTab === 'export' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Export
          </button>
          <button
            onClick={() => setActiveTab('learn')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              activeTab === 'learn' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Learn
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'learn' && (
          <div className="h-full overflow-y-auto p-3 sm:p-4 space-y-4 custom-scrollbar">
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={generateFlashcards}
                disabled={isGenerating || sources.length === 0}
                className="flex flex-col items-center justify-center p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-emerald-500/30 transition-all text-center gap-2 disabled:opacity-50"
              >
                <RotateCw className="w-6 h-6 text-emerald-400" />
                <span className="text-xs font-medium text-slate-300">Generate Flashcards</span>
              </button>
              <button
                onClick={generateQuiz}
                disabled={isGenerating || sources.length === 0}
                className="flex flex-col items-center justify-center p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-emerald-500/30 transition-all text-center gap-2 disabled:opacity-50"
              >
                <HelpCircle className="w-6 h-6 text-emerald-400" />
                <span className="text-xs font-medium text-slate-300">Generate Quiz</span>
              </button>
            </div>

            <div className="space-y-6">
              {contents.filter(c => c.type === 'flashcards' || c.type === 'quiz').map((content) => {
                const isFlashcards = content.type === 'flashcards';
                const flashcards = isFlashcards ? (content.flashcards || JSON.parse(content.content_url)) : [];
                const quiz = !isFlashcards ? (content.quiz || JSON.parse(content.content_url)) : [];

                return (
                  <div key={content.id} className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-300 px-1">
                      {isFlashcards ? <RotateCw className="w-4 h-4 text-emerald-400" /> : <HelpCircle className="w-4 h-4 text-emerald-400" />}
                      {content.title}
                      <span className="text-xs text-slate-500 ml-auto">{new Date(content.created_at).toLocaleDateString()}</span>
                    </div>

                    {isFlashcards && flashcards.length > 0 && (
                      <div className="glass-panel p-6 rounded-xl flex flex-col items-center justify-center min-h-[300px] relative">
                        <div className="absolute top-4 right-4 text-xs text-slate-500">
                          {activeFlashcardIndex + 1} / {flashcards.length}
                        </div>
                        
                        <motion.div 
                          className="w-full max-w-sm aspect-[3/2] cursor-pointer perspective-1000"
                          onClick={() => setIsFlipped(!isFlipped)}
                        >
                          <motion.div 
                            className="w-full h-full relative preserve-3d transition-all duration-500"
                            animate={{ rotateY: isFlipped ? 180 : 0 }}
                          >
                            {/* Front */}
                            <div className="absolute inset-0 backface-hidden bg-white/5 border border-white/10 rounded-xl flex items-center justify-center p-6 text-center">
                              <h4 className="text-xl font-medium text-white">{flashcards[activeFlashcardIndex].front}</h4>
                              <p className="absolute bottom-4 text-xs text-slate-500">Click to flip</p>
                            </div>
                            {/* Back */}
                            <div className="absolute inset-0 backface-hidden bg-emerald-900/20 border border-emerald-500/20 rounded-xl flex items-center justify-center p-6 text-center rotate-y-180">
                              <p className="text-lg text-slate-200">{flashcards[activeFlashcardIndex].back}</p>
                            </div>
                          </motion.div>
                        </motion.div>

                        <div className="flex items-center gap-4 mt-6">
                          <button 
                            onClick={() => {
                              setActiveFlashcardIndex(prev => Math.max(0, prev - 1));
                              setIsFlipped(false);
                            }}
                            disabled={activeFlashcardIndex === 0}
                            className="p-2 text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            <ChevronLeft className="w-6 h-6" />
                          </button>
                          <button 
                            onClick={() => {
                              setActiveFlashcardIndex(prev => Math.min(flashcards.length - 1, prev + 1));
                              setIsFlipped(false);
                            }}
                            disabled={activeFlashcardIndex === flashcards.length - 1}
                            className="p-2 text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            <ChevronRight className="w-6 h-6" />
                          </button>
                        </div>
                      </div>
                    )}

                    {!isFlashcards && quiz.length > 0 && (
                      <div className="glass-panel p-6 rounded-xl space-y-6">
                        {quiz.map((q: QuizQuestion, qIdx: number) => {
                          const isAnswered = quizAnswers[`${content.id}-${q.id}`] !== undefined;
                          const isCorrect = quizAnswers[`${content.id}-${q.id}`] === q.correctAnswer;
                          
                          return (
                            <div key={q.id} className="space-y-3">
                              <h4 className="text-base font-medium text-white">
                                <span className="text-emerald-400 mr-2">{qIdx + 1}.</span>
                                {q.question}
                              </h4>
                              <div className="space-y-2 pl-6">
                                {q.options.map((opt: string, oIdx: number) => (
                                  <button
                                    key={oIdx}
                                    onClick={() => setQuizAnswers(prev => ({ ...prev, [`${content.id}-${q.id}`]: oIdx }))}
                                    className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all border ${
                                      quizAnswers[`${content.id}-${q.id}`] === oIdx
                                        ? isCorrect || !showQuizResults
                                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-100'
                                          : 'bg-red-500/20 border-red-500/50 text-red-100'
                                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                              {showQuizResults && (
                                <div className={`pl-6 text-sm p-3 rounded-lg ${isCorrect ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                                  <p className="font-medium mb-1">{isCorrect ? 'Correct!' : 'Incorrect'}</p>
                                  <p className="opacity-80">{q.explanation}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div className="flex justify-end pt-4 border-t border-white/5">
                          <button
                            onClick={() => setShowQuizResults(!showQuizResults)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            {showQuizResults ? 'Hide Results' : 'Check Answers'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="h-full overflow-y-auto p-3 sm:p-4 space-y-4 custom-scrollbar">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-5 rounded-xl text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 opacity-50"></div>
              <div className="flex justify-between items-start mb-2">
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
                  <Mic className="w-6 h-6 text-blue-400" />
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  title="Audio Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
              
              <h3 className="text-sm font-semibold text-white mb-1 text-left">Generate Podcast</h3>
              <p className="text-xs text-slate-400 mb-4 text-left">
                Create a deep-dive audio summary with {audioSettings.hostA.name} and {audioSettings.hostB.name}.
              </p>
              
              <div className="flex gap-2 mb-4 text-xs text-slate-500">
                <span className="bg-white/5 px-2 py-1 rounded border border-white/5">{audioSettings.tone}</span>
                <span className="bg-white/5 px-2 py-1 rounded border border-white/5">{audioSettings.length} length</span>
              </div>

              <button
                onClick={generateAudioOverview}
                disabled={isGenerating || sources.length === 0}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Episode
                  </>
                )}
              </button>
            </motion.div>

            {/* Playback Controls */}
            {playingId && (
              <div className="glass-panel p-3 rounded-xl flex items-center justify-between gap-4 sticky top-0 z-10 bg-[#0a0a0a]/90 backdrop-blur-md border border-blue-500/20 shadow-lg shadow-blue-500/5">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-slate-400 font-medium">Speed:</span>
                </div>
                <div className="flex gap-1">
                  {[0.5, 1.0, 1.5, 2.0].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => setPlaybackRate(rate)}
                      className={`text-[10px] px-2 py-1 rounded transition-colors ${playbackRate === rate ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {contents.filter(c => c.type === 'audio').map((content) => {
                const overview = getAudioOverview(content);
                return (
                  <motion.div 
                    key={content.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all group"
                  >
                    <div className="flex items-center gap-4 mb-3">
                      <button
                        onClick={() => togglePlay(content.id, content.content_url)}
                        className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 hover:bg-blue-500/30 transition-colors border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                      >
                        {playingId === content.id ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-slate-200 truncate">{content.title}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(content.created_at).toLocaleDateString()}</span>
                          {overview && (
                            <>
                              <span>•</span>
                              <span>{overview.settings.hostA.name} & {overview.settings.hostB.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => handleDownload(content)}
                          className="p-2 text-slate-500 hover:text-white transition-colors hover:bg-white/10 rounded-lg"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Waveform Visualization */}
                    {overview && overview.waveformData && (
                      <div className="h-8 flex items-center gap-0.5 opacity-50 group-hover:opacity-80 transition-opacity">
                        {overview.waveformData.map((val, i) => (
                          <div 
                            key={i} 
                            className={`flex-1 rounded-full transition-all duration-300 ${playingId === content.id ? 'bg-blue-500 animate-pulse' : 'bg-slate-600'}`}
                            style={{ 
                              height: `${val * 100}%`,
                              opacity: playingId === content.id ? 1 : 0.5
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ... (Mindmap and Export tabs remain mostly the same, just wrapped in the return) */}
        {activeTab === 'mindmap' && (
          <div className="h-full flex flex-col">
             <div className="p-3 sm:p-4 shrink-0">
               <button
                onClick={generateMindMap}
                disabled={isGenerating || sources.length === 0}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Network className="w-4 h-4" />
                    Generate New Map
                  </>
                )}
              </button>
             </div>
             <div className="flex-1 bg-black/20 relative">
               {nodes.length > 0 ? (
                 <ReactFlow
                   nodes={nodes}
                   edges={edges}
                   onNodesChange={onNodesChange}
                   onEdgesChange={onEdgesChange}
                   fitView
                   className="bg-transparent"
                 >
                   <Background color="#333" gap={16} />
                   <Controls className="bg-white/10 border-white/10 text-white" />
                 </ReactFlow>
               ) : (
                 <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
                   No mind map generated yet.
                 </div>
               )}
             </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="h-full overflow-y-auto p-3 sm:p-4 space-y-4 custom-scrollbar">
             <div className="grid grid-cols-2 gap-3">
               {[
                 { id: 'report', label: 'Structured Report', icon: FileText },
                 { id: 'summary', label: 'Executive Summary', icon: Activity },
                 { id: 'review', label: 'Literature Review', icon: BookOpen },
                 { id: 'presentation', label: 'Presentation Deck', icon: Presentation },
                 { id: 'study', label: 'Study Guide', icon: BookOpen },
                 { id: 'timeline', label: 'Timeline', icon: Clock },
                 { id: 'analysis', label: 'Content Analysis', icon: Activity },
                 { id: 'briefing', label: 'Research Briefing', icon: FileText },
               ].map((item) => (
                 <button
                   key={item.id}
                   onClick={() => generateExport(item.id)}
                   disabled={isGenerating || sources.length === 0}
                   className="flex flex-col items-center justify-center p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-blue-500/30 transition-all text-center gap-2 disabled:opacity-50"
                 >
                   <item.icon className="w-6 h-6 text-blue-400" />
                   <span className="text-xs font-medium text-slate-300">{item.label}</span>
                 </button>
               ))}
             </div>

             <div className="space-y-3 mt-6">
               <h3 className="text-sm font-semibold text-white px-1">Generated Documents</h3>
               {contents.filter(c => c.type === 'text').map((content) => (
                 <motion.div 
                   key={content.id}
                   initial={{ opacity: 0, x: 10 }}
                   animate={{ opacity: 1, x: 0 }}
                   className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all"
                 >
                   <div className="flex items-start justify-between mb-2 gap-3">
                     <div className="flex items-center gap-2 min-w-0 flex-1">
                       <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                       <h4 className="text-sm font-medium text-slate-200 truncate">{content.title}</h4>
                     </div>
                     <div className="flex gap-1 shrink-0">
                       <button 
                         onClick={() => setViewingContent(content)}
                         className="p-1.5 text-slate-500 hover:text-white transition-colors hover:bg-white/10 rounded-lg"
                         title="View"
                       >
                         <Eye className="w-4 h-4" />
                       </button>
                       <button 
                         onClick={() => handleDownload(content)}
                         className="p-1.5 text-slate-500 hover:text-white transition-colors hover:bg-white/10 rounded-lg"
                         title="Download"
                       >
                         <Download className="w-4 h-4" />
                       </button>
                     </div>
                   </div>
                   <div className="text-xs text-slate-400 line-clamp-3 font-serif opacity-80">
                     {content.content_url}
                   </div>
                 </motion.div>
               ))}
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
                <div className="p-6 space-y-6">
                  {/* Host A Settings */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-white flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      Host A (Female)
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Name</label>
                        <input 
                          type="text" 
                          value={audioSettings.hostA.name}
                          onChange={e => setAudioSettings({...audioSettings, hostA: {...audioSettings.hostA, name: e.target.value}})}
                          className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500/50 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Personality</label>
                        <input 
                          type="text" 
                          value={audioSettings.hostA.personality}
                          onChange={e => setAudioSettings({...audioSettings, hostA: {...audioSettings.hostA, personality: e.target.value}})}
                          className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500/50 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Host B Settings */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-white flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                      Host B (Male)
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Name</label>
                        <input 
                          type="text" 
                          value={audioSettings.hostB.name}
                          onChange={e => setAudioSettings({...audioSettings, hostB: {...audioSettings.hostB, name: e.target.value}})}
                          className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500/50 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Personality</label>
                        <input 
                          type="text" 
                          value={audioSettings.hostB.personality}
                          onChange={e => setAudioSettings({...audioSettings, hostB: {...audioSettings.hostB, personality: e.target.value}})}
                          className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500/50 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* General Settings */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Tone</label>
                      <select 
                        value={audioSettings.tone}
                        onChange={e => setAudioSettings({...audioSettings, tone: e.target.value as any})}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500/50 outline-none"
                      >
                        <option value="casual">Casual</option>
                        <option value="professional">Professional</option>
                        <option value="academic">Academic</option>
                        <option value="humorous">Humorous</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Length</label>
                      <select 
                        value={audioSettings.length}
                        onChange={e => setAudioSettings({...audioSettings, length: e.target.value as any})}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500/50 outline-none"
                      >
                        <option value="short">Short (~2 min)</option>
                        <option value="medium">Medium (~5 min)</option>
                        <option value="long">Long (~10 min)</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="p-4 border-t border-white/5 bg-white/5 flex justify-end">
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Save Settings
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
                className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm p-6"
              >
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20 relative">
                    <Sparkles className="w-8 h-8 text-blue-400" />
                    <div className="absolute inset-0 border-2 border-blue-500/30 rounded-full animate-ping opacity-20"></div>
                  </div>
                  <h3 className="text-lg font-semibold text-white">Generating Content</h3>
                  <p className="text-sm text-slate-400">AI is processing your request...</p>
                </div>
                
                <div className="space-y-4">
                  {progress.steps.map((step, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                        step.status === 'completed' 
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                          : step.status === 'current'
                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                            : 'bg-white/5 border-white/10 text-slate-600'
                      }`}>
                        {step.status === 'completed' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : step.status === 'current' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <span className="text-[10px] font-medium">{index + 1}</span>
                        )}
                      </div>
                      <span className={`text-sm transition-colors ${
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
                <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-black/40">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    {viewingContent.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleDownload(viewingContent)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setViewingContent(null)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#050505]">
                  <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-headings:text-white prose-a:text-blue-400">
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
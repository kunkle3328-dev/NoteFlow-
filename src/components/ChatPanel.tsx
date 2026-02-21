import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2, Sparkles, Copy, ThumbsUp, ThumbsDown, ArrowRight, GraduationCap, BrainCircuit } from 'lucide-react';
import { Source, ChatMessage } from '../types';
import Markdown from 'react-markdown';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatPanelProps {
  projectId: string;
  sources: Source[];
}

type ChatMode = 'research' | 'tutor';

export default function ChatPanel({ projectId, sources }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [mode, setMode] = useState<ChatMode>('research');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, suggestedQuestions]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/chats?mode=${mode}`);
      const data = await res.json();
      setMessages(data);
    } catch (error) {
      console.error('Failed to fetch messages', error);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [projectId, mode]);

  const generateSuggestedQuestions = async (lastMessage: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Based on the following response, suggest 3 short, relevant follow-up questions the user might want to ask.
      Response: "${lastMessage}"
      
      Return ONLY a JSON array of strings, e.g. ["Question 1?", "Question 2?", "Question 3?"]`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' }
      });

      const text = response.text;
      if (text) {
        const questions = JSON.parse(text);
        if (Array.isArray(questions)) {
          setSuggestedQuestions(questions.slice(0, 3));
        }
      }
    } catch (error) {
      console.error('Failed to generate suggestions', error);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, textOverride?: string) => {
    e?.preventDefault();
    const textToSend = textOverride || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: uuidv4(),
      project_id: projectId,
      role: 'user',
      content: textToSend,
      mode: mode,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSuggestedQuestions([]); // Clear suggestions while loading
    setIsLoading(true);

    try {
      // Save user message
      await fetch(`/api/projects/${projectId}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userMessage),
      });

      const context = sources
        .map((s, i) => `Source [${i + 1}] (${s.title}):\n${s.content}`)
        .join('\n\n---\n\n');

      let systemPrompt = '';

      if (mode === 'research') {
        systemPrompt = `You are NoteFlow AI, an expert research assistant. 
You must answer the user's questions based ONLY on the provided sources. 
If the answer is not in the sources, say "I cannot find information about this in the provided sources."
Always cite your sources using [1], [2], etc. corresponding to the source number.
Format your response in Markdown. Use bolding for key terms. Use headers for sections. Use lists for points.

SOURCES:
${context || 'No sources provided yet.'}`;
      } else {
        systemPrompt = `You are NoteFlow AI, a patient and encouraging Socratic Tutor.
Your goal is to help the user LEARN the material in the sources, not just give them answers.
- Do NOT simply summarize the text.
- Ask probing questions to check their understanding.
- If they ask a question, guide them to the answer using the source material, but encourage them to think.
- Use analogies and examples to explain complex concepts.
- Be encouraging and supportive.
- If they get something wrong, gently correct them and explain why.
- Still cite sources where appropriate.

SOURCES:
${context || 'No sources provided yet.'}`;
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: mode === 'research' ? 'Understood. I will answer based only on the sources and cite them properly.' : 'Understood. I will act as a Socratic tutor, guiding the user to learn from the sources.' }] },
          ...history,
          { role: 'user', parts: [{ text: userMessage.content }] }
        ]
      });

      const aiText = response.text || 'Sorry, I could not generate a response.';

      const aiMessage: ChatMessage = {
        id: uuidv4(),
        project_id: projectId,
        role: 'assistant',
        content: aiText,
        mode: mode,
        created_at: new Date().toISOString(),
      };

      // Save AI message
      await fetch(`/api/projects/${projectId}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiMessage),
      });

      setMessages((prev) => [...prev, aiMessage]);
      
      // Generate follow-up questions in background
      generateSuggestedQuestions(aiText);

    } catch (error) {
      console.error('Failed to send message', error);
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        project_id: projectId,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request.',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-indigo-500/5 blur-[100px] pointer-events-none" />
      
      <div className="p-3 sm:p-6 border-b border-white/5 flex justify-between items-center bg-black/40 backdrop-blur-2xl sticky top-0 z-20">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`p-1.5 rounded-lg ${mode === 'research' ? 'bg-blue-500/10' : 'bg-emerald-500/10'}`}>
            {mode === 'research' ? <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" /> : <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />}
          </div>
          <h2 className="font-bold text-white text-[11px] sm:text-sm uppercase tracking-[0.2em]">
            {mode === 'research' ? 'Research' : 'Tutor'}
          </h2>
        </div>
        
        <div className="flex bg-black/40 rounded-xl p-1 border border-white/5">
          <button
            onClick={() => setMode('research')}
            className={`px-3 sm:px-4 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center gap-1.5 sm:gap-2 ${
              mode === 'research' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Sparkles className="w-2.5 h-2.5 sm:w-3 h-3" />
            RESEARCH
          </button>
          <button
            onClick={() => setMode('tutor')}
            className={`px-3 sm:px-4 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center gap-1.5 sm:gap-2 ${
              mode === 'tutor' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <GraduationCap className="w-2.5 h-2.5 sm:w-3 h-3" />
            LEARN
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-8 space-y-4 sm:space-y-8 custom-scrollbar scroll-smooth pt-16 sm:pt-24">
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="p-1.5 bg-indigo-500/10 rounded-lg">
            <Bot className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Intelligence</span>
        </div>
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto p-4">
            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mb-6 border animate-pulse-slow ${
              mode === 'research' ? 'bg-blue-500/5 border-blue-500/10' : 'bg-emerald-500/5 border-emerald-500/10'
            }`}>
              {mode === 'research' ? <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-blue-500/50" /> : <GraduationCap className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-500/50" />}
            </div>
            <h3 className="text-base sm:text-xl font-bold text-white mb-2 tracking-tight">
              {mode === 'research' ? 'Intelligence Engine Active' : 'Socratic Tutor Ready'}
            </h3>
            <p className="text-[11px] sm:text-sm text-slate-500 leading-relaxed">
              {mode === 'research' 
                ? 'Ask questions about your sources, request summaries, or explore complex connections.'
                : 'I can help you master this material. Ask me to quiz you, explain a concept, or help you study.'}
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[92%] sm:max-w-[75%] group relative ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-1.5 px-1 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-4.5 h-4.5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center border ${
                    msg.role === 'user' ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500'
                  }`}>
                    {msg.role === 'user' ? <User className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" /> : <Bot className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />}
                  </div>
                  <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    {msg.role === 'user' ? 'Researcher' : 'Intelligence'}
                  </span>
                </div>
                
                <div className={`p-3 sm:p-5 rounded-xl sm:rounded-2xl shadow-2xl relative overflow-hidden ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'glass-panel text-slate-200 rounded-tl-none border-white/5'
                }`}>
                  {msg.role === 'assistant' && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500/50 via-purple-500/50 to-pink-500/50 opacity-30" />
                  )}
                  <div className="prose prose-invert prose-slate prose-sm sm:prose-base max-w-none leading-relaxed">
                    <Markdown>{msg.content}</Markdown>
                  </div>
                </div>

                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-y-2 group-hover:translate-y-0">
                    <button className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-2 text-slate-500 hover:text-emerald-500 hover:bg-emerald-500/5 rounded-lg transition-all">
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/5 rounded-lg transition-all">
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
        
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-4"
          >
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
              mode === 'research' 
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-500'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
            }`}>
              <Bot className="w-5 h-5" />
            </div>
            <div className="glass-panel border-white/5 rounded-2xl rounded-tl-none px-6 py-4 flex items-center gap-4 shadow-xl">
              <Loader2 className={`w-4 h-4 animate-spin ${mode === 'research' ? 'text-blue-400' : 'text-emerald-400'}`} />
              <span className="text-sm text-slate-400 font-bold uppercase tracking-widest">
                {mode === 'research' ? 'Analyzing sources...' : 'Thinking...'}
              </span>
            </div>
          </motion.div>
        )}

        {!isLoading && suggestedQuestions.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-2 pt-4"
          >
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(undefined, q)}
                className="px-4 py-2 bg-white/5 border border-white/5 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all flex items-center gap-2"
              >
                <Sparkles className="w-3 h-3 text-indigo-400" />
                {q}
                <ArrowRight className="w-3 h-3 opacity-30" />
              </button>
            ))}
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="p-2 sm:p-8 bg-black/20 backdrop-blur-3xl border-t border-white/5">
        <form onSubmit={(e) => handleSendMessage(e)} className="relative group max-w-4xl mx-auto">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-[22px] blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
          <div className="relative flex items-end gap-2 sm:gap-3 bg-black/60 border border-white/10 rounded-xl sm:rounded-3xl p-1 sm:p-2 pl-3 sm:pl-6 focus-within:border-indigo-500/40 transition-all shadow-2xl">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder={sources.length === 0 ? "Add sources..." : "Query intelligence..."}
              disabled={sources.length === 0}
              className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder:text-slate-700 py-2 sm:py-3 text-[13px] sm:text-base resize-none max-h-24 sm:max-h-32 min-h-[36px] sm:min-h-[40px] leading-relaxed"
              rows={1}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading || sources.length === 0}
              className={`w-9 h-9 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg sm:rounded-2xl transition-all duration-300 ${
                input.trim() 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 hover:scale-105 active:scale-95' 
                  : 'bg-white/5 text-slate-700'
              }`}
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 sm:w-5 sm:h-5 animate-spin" /> : <Send className="w-3.5 h-3.5 sm:w-5 sm:h-5" />}
            </button>
          </div>
          <div className="flex justify-between items-center px-3 mt-1.5 sm:mt-3">
            <span className="text-[8px] sm:text-[10px] text-slate-600 font-bold uppercase tracking-widest">
              {isLoading ? 'Processing...' : 'Neural Engine Active'}
            </span>
            <span className="text-[8px] sm:text-[10px] text-slate-700 font-mono hidden sm:block">
              Press Enter to send
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
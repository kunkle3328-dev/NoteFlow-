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
    fetchMessages();
  }, [projectId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, suggestedQuestions]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/chats`);
      const data = await res.json();
      setMessages(data);
    } catch (error) {
      console.error('Failed to fetch messages', error);
    }
  };

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
    <div className="flex flex-col h-full bg-[#050505] relative">
      <div className="p-3 sm:p-4 border-b border-white/5 flex justify-between items-center bg-black/40 backdrop-blur-md z-10 absolute top-0 w-full">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-white flex items-center gap-2 text-sm uppercase tracking-wider">
            {mode === 'research' ? <Sparkles className="w-4 h-4 text-blue-400" /> : <GraduationCap className="w-4 h-4 text-emerald-400" />}
            {mode === 'research' ? 'Research Assistant' : 'AI Tutor'}
          </h2>
        </div>
        
        <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
          <button
            onClick={() => setMode('research')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
              mode === 'research' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            Research
          </button>
          <button
            onClick={() => setMode('tutor')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
              mode === 'tutor' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            <GraduationCap className="w-3 h-3" />
            Learn
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 pt-16 sm:pt-20 space-y-4 sm:space-y-6 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto opacity-50 px-4">
            <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 shadow-lg border border-white/5 ${
              mode === 'research' ? 'bg-blue-500/10 shadow-blue-500/10' : 'bg-emerald-500/10 shadow-emerald-500/10'
            }`}>
              {mode === 'research' ? (
                <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
              ) : (
                <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400" />
              )}
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">
              {mode === 'research' ? 'How can I help you?' : 'Ready to learn?'}
            </h3>
            <p className="text-sm text-slate-500">
              {mode === 'research' 
                ? 'Ask questions about your uploaded sources, request summaries, or have me extract specific information.'
                : 'I can help you master this material. Ask me to quiz you, explain a concept, or help you study.'}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 sm:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border hidden sm:flex ${
                  msg.role === 'user' 
                    ? 'bg-white/10 border-white/10 text-white' 
                    : mode === 'research'
                      ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                      : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                }`}
              >
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div
                className={`max-w-[95%] sm:max-w-[85%] rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 ${
                  msg.role === 'user'
                    ? 'bg-white/10 text-white rounded-tr-none border border-white/5'
                    : 'bg-transparent text-slate-200 w-full'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                ) : (
                  <div className={`prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-[#1e1e1e] prose-pre:border prose-pre:border-white/10 prose-headings:text-white prose-headings:font-semibold prose-strong:text-white prose-ul:my-2 prose-li:my-0.5 text-sm sm:text-base ${
                    mode === 'research' 
                      ? 'prose-a:text-blue-400 hover:prose-a:text-blue-300 prose-code:text-blue-300 prose-code:bg-blue-500/10'
                      : 'prose-a:text-emerald-400 hover:prose-a:text-emerald-300 prose-code:text-emerald-300 prose-code:bg-emerald-500/10'
                  }`}>
                    <Markdown
                      components={{
                        // Custom renderer for text to handle citations like [1], [2]
                        p: ({ children }) => {
                          const processText = (text: string) => {
                            const parts = text.split(/(\[\d+\])/g);
                            return parts.map((part, i) => {
                              const match = part.match(/^\[(\d+)\]$/);
                              if (match) {
                                const sourceIndex = parseInt(match[1]) - 1;
                                const source = sources[sourceIndex];
                                return (
                                  <span 
                                    key={i} 
                                    className="inline-flex items-center justify-center min-w-[1.2em] h-[1.2em] px-1 ml-0.5 text-[10px] font-bold text-blue-950 bg-blue-400 rounded cursor-help align-text-top hover:bg-blue-300 transition-colors"
                                    title={source ? source.title : 'Source not found'}
                                  >
                                    {match[1]}
                                  </span>
                                );
                              }
                              return part;
                            });
                          };

                          // Handle array of children or single child
                          if (Array.isArray(children)) {
                             return <p>{children.map((child, idx) => {
                               if (typeof child === 'string') return <span key={idx}>{processText(child)}</span>;
                               return child;
                             })}</p>;
                          }
                          if (typeof children === 'string') {
                            return <p>{processText(children)}</p>;
                          }
                          return <p>{children}</p>;
                        }
                      }}
                    >
                      {msg.content}
                    </Markdown>
                  </div>
                )}
                {msg.role === 'assistant' && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                    <button className="text-slate-500 hover:text-white transition-colors p-1">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button className="text-slate-500 hover:text-white transition-colors p-1">
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button className="text-slate-500 hover:text-white transition-colors p-1">
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
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 hidden sm:flex ${
              mode === 'research' 
                ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
            }`}>
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-black/40 border border-white/10 rounded-2xl rounded-tl-none px-5 py-4 flex items-center gap-3">
              <Loader2 className={`w-4 h-4 animate-spin ${mode === 'research' ? 'text-blue-400' : 'text-emerald-400'}`} />
              <span className="text-sm text-slate-400 font-medium">
                {mode === 'research' ? 'Analyzing sources...' : 'Thinking...'}
              </span>
            </div>
          </motion.div>
        )}
        
        {/* Suggested Questions */}
        {!isLoading && suggestedQuestions.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-2 ml-0 sm:ml-12"
          >
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(undefined, q)}
                className={`text-xs border border-white/10 text-slate-300 hover:text-white px-3 py-2 rounded-full transition-colors flex items-center gap-1.5 ${
                  mode === 'research' 
                    ? 'bg-blue-500/5 hover:bg-blue-500/10' 
                    : 'bg-emerald-500/5 hover:bg-emerald-500/10'
                }`}
              >
                {q}
                <ArrowRight className="w-3 h-3 opacity-50" />
              </button>
            ))}
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 sm:p-4 bg-[#050505] border-t border-white/5">
        <form
          onSubmit={(e) => handleSendMessage(e)}
          className={`max-w-4xl mx-auto relative flex items-end gap-2 bg-white/5 border border-white/10 rounded-2xl p-1.5 sm:p-2 transition-all shadow-lg shadow-black/50 ${
            mode === 'research' 
              ? 'focus-within:ring-1 focus-within:ring-blue-500/50 focus-within:border-blue-500/50'
              : 'focus-within:ring-1 focus-within:ring-emerald-500/50 focus-within:border-emerald-500/50'
          }`}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            placeholder={sources.length === 0 ? "Add sources first to start chatting..." : (mode === 'research' ? "Ask a question about your sources..." : "Ask me to quiz you or explain a concept...")}
            disabled={sources.length === 0}
            className="w-full max-h-32 min-h-[40px] sm:min-h-[44px] bg-transparent border-none focus:ring-0 resize-none px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 disabled:opacity-50"
            rows={1}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || sources.length === 0}
            className={`p-2.5 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 mb-0.5 shadow-lg ${
              mode === 'research' 
                ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="text-center mt-2">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider font-medium">AI can make mistakes. Verify important information.</p>
        </div>
      </div>
    </div>
  );
}
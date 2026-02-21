import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, MessageSquare, Headphones, Settings, Share2, Menu, Sparkles } from 'lucide-react';
import { Project, Source } from '../types';
import SourcesPanel from '../components/SourcesPanel';
import ChatPanel from '../components/ChatPanel';
import GeneratedPanel from '../components/GeneratedPanel';
import { motion } from 'framer-motion';

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [mobileTab, setMobileTab] = useState<'sources' | 'chat' | 'generated'>('chat');
  
  useEffect(() => {
    if (id) {
      fetchProjectData();
    }
  }, [id]);

  const fetchProjectData = async () => {
    try {
      const [projectRes, sourcesRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/projects/${id}/sources`)
      ]);
      
      if (projectRes.ok) {
        setProject(await projectRes.json());
      }
      
      if (sourcesRes.ok) {
        setSources(await sourcesRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch project data', error);
    }
  };

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#050505] text-slate-200 overflow-hidden font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="bg-black/40 border-b border-white/5 h-14 sm:h-16 flex items-center px-4 sm:px-6 shrink-0 z-10 backdrop-blur-xl">
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
          <Link to="/" className="text-slate-400 hover:text-white transition-colors shrink-0 p-1.5 hover:bg-white/5 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="h-5 w-px bg-white/10 shrink-0 hidden sm:block"></div>
          <div className="min-w-0">
            <h1 className="font-semibold text-white truncate text-sm sm:text-base">{project.title}</h1>
            <p className="text-[10px] sm:text-xs text-slate-500 truncate hidden sm:block">Last edited just now</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <Share2 className="w-4 h-4" />
          </button>
          <button className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace - Responsive Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Panel: Sources */}
        <div className={`
          w-full md:w-80 border-r border-white/5 bg-[#0a0a0a] flex flex-col shrink-0 transition-transform duration-300 ease-in-out
          ${mobileTab === 'sources' ? 'absolute inset-0 z-20 translate-x-0' : 'absolute inset-0 z-0 -translate-x-full md:static md:translate-x-0 md:flex'}
        `}>
          <SourcesPanel 
            projectId={project.id} 
            sources={sources} 
            onSourcesChange={fetchProjectData} 
          />
        </div>

        {/* Center Panel: Chat / Workspace */}
        <div className={`
          flex-1 flex flex-col min-w-0 bg-[#050505] relative transition-opacity duration-300
          ${mobileTab === 'chat' ? 'opacity-100 z-10' : 'opacity-0 z-0 md:opacity-100 md:z-auto md:flex'}
        `}>
          <ChatPanel 
            projectId={project.id} 
            sources={sources} 
          />
        </div>

        {/* Right Panel: Generated Content (Audio, Mindmap, etc) */}
        <div className={`
          w-full md:w-96 border-l border-white/5 bg-[#0a0a0a] flex flex-col shrink-0 transition-transform duration-300 ease-in-out
          ${mobileTab === 'generated' ? 'absolute inset-0 z-20 translate-x-0' : 'absolute inset-0 z-0 translate-x-full md:static md:translate-x-0 md:flex'}
        `}>
          <GeneratedPanel 
            projectId={project.id} 
            sources={sources} 
          />
        </div>
      </div>

      {/* Mobile Navigation Bar */}
      <div className="md:hidden border-t border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl flex justify-around p-2 shrink-0 pb-safe z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <button 
          onClick={() => setMobileTab('sources')}
          className={`flex flex-col items-center p-2 rounded-xl flex-1 transition-all duration-200 ${
            mobileTab === 'sources' 
              ? 'text-blue-400 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
              : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
          }`}
        >
          <FileText className={`w-5 h-5 ${mobileTab === 'sources' ? 'fill-current' : ''}`} />
          <span className="text-[10px] font-medium mt-1">Sources</span>
        </button>
        <button 
          onClick={() => setMobileTab('chat')}
          className={`flex flex-col items-center p-2 rounded-xl flex-1 transition-all duration-200 ${
            mobileTab === 'chat' 
              ? 'text-blue-400 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
              : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
          }`}
        >
          <Sparkles className={`w-5 h-5 ${mobileTab === 'chat' ? 'fill-current' : ''}`} />
          <span className="text-[10px] font-medium mt-1">Chat</span>
        </button>
        <button 
          onClick={() => setMobileTab('generated')}
          className={`flex flex-col items-center p-2 rounded-xl flex-1 transition-all duration-200 ${
            mobileTab === 'generated' 
              ? 'text-blue-400 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
              : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
          }`}
        >
          <Headphones className={`w-5 h-5 ${mobileTab === 'generated' ? 'fill-current' : ''}`} />
          <span className="text-[10px] font-medium mt-1">Studio</span>
        </button>
      </div>
    </div>
  );
}

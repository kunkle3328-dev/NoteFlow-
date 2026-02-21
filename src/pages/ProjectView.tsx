import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, MessageSquare, Headphones, Settings, Share2, Menu, Sparkles, Activity } from 'lucide-react';
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
    <div className="h-screen flex flex-col cinematic-gradient text-slate-200 overflow-hidden font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="bg-black/60 border-b border-white/5 h-12 sm:h-20 flex items-center px-3 sm:px-8 shrink-0 z-30 backdrop-blur-3xl sticky top-0">
        <div className="flex items-center gap-2.5 sm:gap-6 flex-1 min-w-0">
          <Link 
            to="/" 
            className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-slate-400 hover:text-white transition-all bg-white/5 hover:bg-white/10 rounded-lg sm:rounded-xl border border-white/5"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
          </Link>
          <div className="h-5 sm:h-8 w-px bg-white/10 shrink-0 hidden sm:block"></div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 sm:gap-2 mb-0">
              <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[8px] sm:text-[10px] font-bold text-blue-500 uppercase tracking-widest">Research Node</span>
            </div>
            <h1 className="font-bold text-white truncate text-xs sm:text-xl tracking-tight">{project.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/5">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Syncing</span>
          </div>
          <button className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all border border-transparent hover:border-white/10">
            <Share2 className="w-3.5 h-3.5 sm:w-4 h-4" />
          </button>
          <button className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all border border-transparent hover:border-white/10">
            <Settings className="w-3.5 h-3.5 sm:w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace - Responsive Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Panel: Sources */}
        <motion.div 
          initial={false}
          animate={{ 
            x: mobileTab === 'sources' ? 0 : (window.innerWidth < 768 ? '-100%' : 0),
            opacity: mobileTab === 'sources' ? 1 : (window.innerWidth < 768 ? 0 : 1)
          }}
          className={`
            w-full md:w-80 lg:w-96 border-r border-white/5 bg-black/20 backdrop-blur-xl flex flex-col shrink-0 transition-all duration-500 ease-in-out
            absolute inset-0 z-20 md:static md:z-auto md:flex
          `}
        >
          <SourcesPanel 
            projectId={project.id} 
            sources={sources} 
            onSourcesChange={fetchProjectData} 
          />
        </motion.div>

        {/* Center Panel: Chat / Workspace */}
        <motion.div 
          initial={false}
          animate={{ 
            opacity: mobileTab === 'chat' ? 1 : (window.innerWidth < 768 ? 0 : 1),
            scale: mobileTab === 'chat' ? 1 : (window.innerWidth < 768 ? 0.95 : 1)
          }}
          className={`
            flex-1 flex flex-col min-w-0 bg-transparent relative transition-all duration-500
            ${mobileTab === 'chat' ? 'z-10' : 'z-0 md:z-auto md:flex'}
          `}
        >
          <ChatPanel 
            projectId={project.id} 
            sources={sources} 
          />
        </motion.div>

        {/* Right Panel: Generated Content */}
        <motion.div 
          initial={false}
          animate={{ 
            x: mobileTab === 'generated' ? 0 : (window.innerWidth < 768 ? '100%' : 0),
            opacity: mobileTab === 'generated' ? 1 : (window.innerWidth < 768 ? 0 : 1)
          }}
          className={`
            w-full md:w-80 lg:w-96 border-l border-white/5 bg-black/20 backdrop-blur-xl flex flex-col shrink-0 transition-all duration-500 ease-in-out
            absolute inset-0 z-20 md:static md:z-auto md:flex
          `}
        >
          <GeneratedPanel 
            projectId={project.id} 
            sources={sources} 
          />
        </motion.div>
      </div>

      {/* Mobile Navigation Bar - Premium Style */}
      <div className="md:hidden border-t border-white/5 bg-black/80 backdrop-blur-3xl flex justify-around p-1.5 shrink-0 pb-safe z-40 shadow-[0_-20px_50px_rgba(0,0,0,0.8)]">
        <button 
          onClick={() => setMobileTab('sources')}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg flex-1 transition-all duration-300 ${
            mobileTab === 'sources' 
              ? 'text-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.1)]' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <FileText className={`w-4 h-4 ${mobileTab === 'sources' ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : ''}`} />
          <span className="text-[8px] font-bold uppercase tracking-widest">Sources</span>
        </button>
        <button 
          onClick={() => setMobileTab('chat')}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg flex-1 transition-all duration-300 ${
            mobileTab === 'chat' 
              ? 'text-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.1)]' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Sparkles className={`w-4 h-4 ${mobileTab === 'chat' ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : ''}`} />
          <span className="text-[8px] font-bold uppercase tracking-widest">Chat</span>
        </button>
        <button 
          onClick={() => setMobileTab('generated')}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg flex-1 transition-all duration-300 ${
            mobileTab === 'generated' 
              ? 'text-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.1)]' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Headphones className={`w-4 h-4 ${mobileTab === 'generated' ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : ''}`} />
          <span className="text-[8px] font-bold uppercase tracking-widest">Studio</span>
        </button>
      </div>
    </div>
  );
}

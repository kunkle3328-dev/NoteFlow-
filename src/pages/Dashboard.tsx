import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Trash2, MoreVertical, Sparkles, Search, Clock, ArrowRight, Activity, HardDrive, FileText, Mic, Upload, BrainCircuit, Zap } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Project } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import Logo from '../components/Logo';

interface ActivityItem {
  id: string;
  type: 'project' | 'source' | 'generated';
  title: string;
  created_at: string;
  project_id: string;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isActivityCollapsed, setIsActivityCollapsed] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
    fetchActivity();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch (error) {
      console.error('Failed to fetch projects', error);
    }
  };

  const fetchActivity = async () => {
    try {
      const res = await fetch('/api/activity');
      const data = await res.json();
      setActivities(data);
    } catch (error) {
      console.error('Failed to fetch activity', error);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newProject = {
      id: uuidv4(),
      title: newTitle,
      description: newDescription,
    };

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      });
      const data = await res.json();
      setProjects([data, ...projects]);
      setIsCreating(false);
      setNewTitle('');
      setNewDescription('');
      navigate(`/project/${data.id}`);
    } catch (error) {
      console.error('Failed to create project', error);
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      setProjects(projects.filter((p) => p.id !== id));
    } catch (error) {
      console.error('Failed to delete project', error);
    }
  };

  // Mock data for storage
  const storageUsed = 2.4; // GB
  const storageLimit = 5; // GB
  const storagePercentage = (storageUsed / storageLimit) * 100;

  return (
    <div className="min-h-screen cinematic-gradient text-slate-200 relative overflow-hidden font-sans selection:bg-blue-500/30">
      {/* Ambient Background */}
      <div className="absolute top-0 left-0 w-full h-96 bg-blue-900/10 blur-[120px] rounded-full pointer-events-none -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-full h-96 bg-emerald-900/5 blur-[120px] rounded-full pointer-events-none translate-y-1/2" />

      <header className="relative z-20 border-b border-white/5 px-4 sm:px-8 py-4 flex justify-between items-center bg-black/40 backdrop-blur-2xl sticky top-0">
        <Logo />
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="hidden md:flex items-center gap-4 px-5 py-2.5 glass-panel rounded-2xl">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-slate-500 font-bold tracking-widest uppercase">Storage</span>
                <span className="text-[9px] text-slate-300 font-mono">{storageUsed}GB / {storageLimit}GB</span>
              </div>
              <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${storagePercentage}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                />
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="premium-button flex items-center gap-2 group"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
            <span className="hidden sm:inline">New Project</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        
        {/* Hero Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12 sm:mb-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px w-8 bg-blue-500" />
              <span className="text-[10px] font-bold text-blue-500 tracking-[0.3em] uppercase">Workspace</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
              Your Research <span className="italic font-normal text-slate-400">Hub</span>
            </h2>
            <p className="text-base text-slate-400 max-w-md leading-relaxed">
              Manage your intelligent notes, analyze complex documents, and generate insights with NoteFlow AI.
            </p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 w-full md:w-auto"
          >
             <div className="relative flex-1 md:flex-none">
              <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search projects..." 
                className="w-full md:w-72 bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 transition-all"
              />
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12">
          
          {/* Projects Grid */}
          <div className="lg:col-span-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-semibold text-white flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <BookOpen className="w-5 h-5 text-blue-500" />
                </div>
                Active Projects
                <span className="ml-2 px-2 py-0.5 bg-white/5 rounded-md text-[10px] text-slate-500 font-mono">{projects.length}</span>
              </h3>
            </div>

            {projects.length === 0 && !isCreating ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-24 sm:py-32 glass-panel rounded-3xl border-dashed border-white/10"
              >
                <div className="w-20 h-20 bg-blue-500/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/10 shadow-[0_0_50px_rgba(59,130,246,0.1)]">
                  <BrainCircuit className="w-10 h-10 text-blue-500/50" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Begin Your Journey</h3>
                <p className="text-sm text-slate-500 mb-8 max-w-xs mx-auto px-4 leading-relaxed">
                  Start by creating a project to organize your research sources and unlock AI insights.
                </p>
                <button
                  onClick={() => setIsCreating(true)}
                  className="premium-button inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create First Project
                </button>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {projects.map((project, index) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
                  >
                    <Link
                      to={`/project/${project.id}`}
                      className="group block h-full glass-card rounded-3xl overflow-hidden relative flex flex-col"
                    >
                      {/* Cover Thumbnail */}
                      <div className="h-40 bg-gradient-to-br from-blue-600/10 via-indigo-600/5 to-transparent relative overflow-hidden">
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <motion.div
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            transition={{ type: "spring", stiffness: 300 }}
                          >
                            <BookOpen className="w-12 h-12 text-white/5 group-hover:text-blue-500/40 transition-colors duration-500" />
                          </motion.div>
                        </div>
                        
                        {/* Status Badge */}
                        <div className="absolute top-4 left-4">
                          <div className="px-2.5 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Active</span>
                          </div>
                        </div>

                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                           <button
                            onClick={(e) => handleDeleteProject(project.id, e)}
                            className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white p-2 rounded-xl backdrop-blur-md border border-red-500/20 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="p-6 flex-1 flex flex-col">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                            {project.title}
                          </h3>
                        </div>
                        <p className="text-sm text-slate-400 mb-6 line-clamp-2 flex-1 leading-relaxed">
                          {project.description || 'No description provided for this research project.'}
                        </p>
                        <div className="flex items-center justify-between pt-5 border-t border-white/5">
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{formatDistanceToNow(new Date(project.created_at))} ago</span>
                          </div>
                          <div className="flex -space-x-2">
                            {[1, 2, 3].map((i) => (
                              <div key={i} className="w-6 h-6 rounded-full border-2 border-[#0a0a0a] bg-slate-800 flex items-center justify-center overflow-hidden">
                                <div className="text-[8px] font-bold text-slate-400">{i}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="lg:col-span-4">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-panel rounded-3xl p-8 h-full sticky top-28 flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-semibold text-white flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <Activity className="w-5 h-5 text-emerald-500" />
                  </div>
                  Live Activity
                </h3>
              </div>
              
              <div className="space-y-8 relative flex-1">
                {/* Vertical Line */}
                <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-emerald-500/50 via-white/5 to-transparent" />
                
                {activities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-4">
                      <Zap className="w-6 h-6 text-slate-600" />
                    </div>
                    <p className="text-xs text-slate-500">Waiting for activity...</p>
                  </div>
                ) : (
                  activities.slice(0, 6).map((activity, i) => (
                    <motion.div 
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      key={activity.id + i} 
                      className="flex gap-4 relative group"
                    >
                      <div className={`w-10 h-10 rounded-xl border shrink-0 flex items-center justify-center z-10 transition-all duration-300 group-hover:scale-110 ${
                        activity.type === 'project' ? 'bg-blue-500/10 border-blue-500/20' :
                        activity.type === 'source' ? 'bg-purple-500/10 border-purple-500/20' :
                        'bg-emerald-500/10 border-emerald-500/20'
                      }`}>
                        {activity.type === 'project' ? <BookOpen className="w-4 h-4 text-blue-500" /> :
                         activity.type === 'source' ? <FileText className="w-4 h-4 text-purple-500" /> :
                         <Sparkles className="w-4 h-4 text-emerald-500" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-sm text-white font-medium truncate">
                            {activity.type === 'project' ? 'New Project' :
                             activity.type === 'source' ? 'Source Added' :
                             'AI Insight'}
                          </p>
                          <span className="text-[10px] text-slate-600 font-mono">
                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: false })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate" title={activity.title}>
                          {activity.title}
                        </p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
              
              <div className="mt-12 pt-8 border-t border-white/5">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Intelligence Stats</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5 group hover:bg-white/10 transition-colors">
                    <div className="text-2xl font-bold text-white mb-1">{projects.length}</div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Nodes</div>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5 group hover:bg-white/10 transition-colors">
                    <div className="text-2xl font-bold text-white mb-1">
                      {activities.filter(a => a.type === 'source').length}
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Sources</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

        </div>

        {isCreating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="glass-panel rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/10"
            >
              <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">New Research Node</h3>
                  <p className="text-xs text-slate-500 mt-1">Initialize a new intelligent workspace</p>
                </div>
                <button 
                  onClick={() => setIsCreating(false)} 
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleCreateProject} className="p-8">
                <div className="space-y-6">
                  <div className="group">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Project Identity</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 text-white placeholder:text-slate-700 transition-all text-lg font-medium"
                      placeholder="e.g., Neural Networks & Ethics"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Contextual Description</label>
                    <textarea
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 text-white placeholder:text-slate-700 resize-none h-32 transition-all leading-relaxed"
                      placeholder="Define the scope of this research..."
                    />
                  </div>
                </div>
                <div className="mt-10 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="text-sm font-bold text-slate-500 hover:text-slate-300 transition-colors px-2"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    disabled={!newTitle.trim()}
                    className="premium-button flex items-center gap-2 px-8"
                  >
                    <span>Initialize Node</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

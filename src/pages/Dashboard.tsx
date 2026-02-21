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
    <div className="min-h-screen bg-[#050505] text-slate-200 relative overflow-hidden font-sans selection:bg-blue-500/30">
      {/* Ambient Background */}
      <div className="absolute top-0 left-0 w-full h-96 bg-blue-900/10 blur-[120px] rounded-full pointer-events-none -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-full h-96 bg-emerald-900/5 blur-[120px] rounded-full pointer-events-none translate-y-1/2" />

      <header className="relative z-10 border-b border-white/5 px-4 sm:px-8 py-4 flex justify-between items-center bg-black/20 backdrop-blur-xl sticky top-0">
        <Logo />
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-white/5 rounded-full border border-white/5">
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)]" style={{ width: `${storagePercentage}%` }} />
            </div>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide">{storageUsed}GB / {storageLimit}GB</span>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Project</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
        
        {/* Quick Actions & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 sm:mb-10">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">Dashboard</h2>
            <p className="text-sm text-slate-400">Welcome back. You have {projects.length} active projects.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
             <div className="relative flex-1 md:flex-none">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search projects..." 
                className="w-full md:w-64 bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all placeholder:text-slate-600"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8">
          
          {/* Projects Grid */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                Recent Projects
              </h3>
            </div>

            {projects.length === 0 && !isCreating ? (
              <div className="text-center py-16 sm:py-20 border border-dashed border-white/10 rounded-2xl bg-white/5 hover:bg-white/[0.07] transition-colors">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5 shadow-inner">
                  <BookOpen className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No projects yet</h3>
                <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto px-4">
                  Create your first project to start uploading documents and analyzing them with AI.
                </p>
                <button
                  onClick={() => setIsCreating(true)}
                  className="text-blue-400 hover:text-blue-300 font-medium text-sm hover:underline underline-offset-4"
                >
                  Create New Project
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {projects.map((project, index) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      to={`/project/${project.id}`}
                      className="group block h-full bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden hover:border-blue-500/30 transition-all duration-300 relative flex flex-col hover:shadow-[0_0_30px_rgba(0,0,0,0.5)] hover:-translate-y-1"
                    >
                      {/* Cover Thumbnail */}
                      <div className="h-28 sm:h-32 bg-gradient-to-br from-blue-900/20 to-purple-900/20 relative group-hover:from-blue-900/30 group-hover:to-purple-900/30 transition-colors overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-white/10 group-hover:text-blue-400/50 transition-colors transform group-hover:scale-110 duration-500" />
                        </div>
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button
                            onClick={(e) => handleDeleteProject(project.id, e)}
                            className="bg-black/50 hover:bg-red-500/80 text-white p-1.5 rounded-lg backdrop-blur-sm transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="p-4 sm:p-5 flex-1 flex flex-col">
                        <h3 className="text-base sm:text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors truncate">
                          {project.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-400 mb-4 line-clamp-2 flex-1 font-serif leading-relaxed">
                          {project.description || 'No description provided.'}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-500 pt-4 border-t border-white/5">
                          <Clock className="w-3 h-3" />
                          <span>{formatDistanceToNow(new Date(project.created_at))} ago</span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="lg:col-span-1">
            <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-5 sm:p-6 h-full sticky top-24 overflow-hidden">
              <h3 className="text-base sm:text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                Activity Feed
              </h3>
              <div className="space-y-6 relative">
                {/* Vertical Line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/5" />
                
                {activities.length === 0 ? (
                  <p className="text-xs text-slate-500 pl-6">No recent activity.</p>
                ) : (
                  activities.map((activity, i) => (
                    <div key={activity.id + i} className="flex gap-3 relative">
                      <div className={`w-4 h-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center z-10 ${
                        activity.type === 'project' ? 'bg-blue-500/10 border-blue-500/30' :
                        activity.type === 'source' ? 'bg-purple-500/10 border-purple-500/30' :
                        'bg-emerald-500/10 border-emerald-500/30'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          activity.type === 'project' ? 'bg-blue-500' :
                          activity.type === 'source' ? 'bg-purple-500' :
                          'bg-emerald-500'
                        }`}></div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm text-slate-300 truncate">
                          <span className="text-white font-medium">
                            {activity.type === 'project' ? 'Created project' :
                             activity.type === 'source' ? 'Added source' :
                             'Generated content'}
                          </span>
                        </p>
                        <p className="text-xs text-slate-400 truncate mb-0.5" title={activity.title}>
                          {activity.title}
                        </p>
                        <span className="text-[10px] text-slate-600 block">
                          {formatDistanceToNow(new Date(activity.created_at))} ago
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="mt-8 pt-6 border-t border-white/5">
                <h4 className="text-xs sm:text-sm font-semibold text-white mb-3">Quick Stats</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                    <div className="text-xl sm:text-2xl font-bold text-white">{projects.length}</div>
                    <div className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider">Projects</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                    <div className="text-xl sm:text-2xl font-bold text-white">
                      {activities.filter(a => a.type === 'source').length}
                    </div>
                    <div className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider">Sources</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {isCreating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                <h3 className="text-lg font-semibold text-white">Create New Project</h3>
                <button onClick={() => setIsCreating(false)} className="text-slate-500 hover:text-white transition-colors">
                  <span className="sr-only">Close</span>
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleCreateProject} className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Project Title</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/50 text-white placeholder:text-slate-600 transition-colors"
                      placeholder="e.g., Quantum Computing Research"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Description (Optional)</label>
                    <textarea
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/50 text-white placeholder:text-slate-600 resize-none h-24 transition-colors"
                      placeholder="Brief description of this project..."
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newTitle.trim()}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                  >
                    Create Project
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

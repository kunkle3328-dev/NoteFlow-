import { useState } from 'react';
import { FileText, Plus, Link as LinkIcon, Trash2, FileUp, Loader2, Globe, FileType, Search, Check, ExternalLink } from 'lucide-react';
import { Source } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI } from '@google/genai';

interface SourcesPanelProps {
  projectId: string;
  sources: Source[];
  onSourcesChange: () => void;
}

interface SearchResult {
  title: string;
  uri: string;
  snippet: string;
}

export default function SourcesPanel({ projectId, sources, onSourcesChange }: SourcesPanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [addType, setAddType] = useState<'text' | 'url' | 'pdf' | 'discovery'>('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Discovery State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());
  const [isSearching, setIsSearching] = useState(false);

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && addType === 'text') return;
    if (!url.trim() && addType === 'url') return;
    if (!file && addType === 'pdf') return;

    setIsLoading(true);

    try {
      let finalContent = content;
      let finalTitle = title;

      if (addType === 'url') {
        const res = await fetch('/api/fetch-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        finalContent = data.text;
        finalTitle = data.title || url;
      } else if (addType === 'pdf' && file) {
        const formData = new FormData();
        formData.append('file', file);
        
        const res = await fetch('/api/upload-pdf', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        finalContent = data.text;
        finalTitle = data.title || file.name;
      }

      const newSource = {
        id: uuidv4(),
        type: addType,
        title: finalTitle,
        content: finalContent,
      };

      await fetch(`/api/projects/${projectId}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSource),
      });

      setIsAdding(false);
      setTitle('');
      setContent('');
      setUrl('');
      setFile(null);
      onSourcesChange();
    } catch (error) {
      console.error('Failed to add source', error);
      alert('Failed to add source. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchResults([]);
    setSelectedResults(new Set());

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Find 5 high-quality, up-to-date sources about: "${searchQuery}".`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const results: SearchResult[] = [];

      if (chunks) {
        chunks.forEach((chunk: any) => {
          if (chunk.web) {
            results.push({
              title: chunk.web.title,
              uri: chunk.web.uri,
              snippet: "Source from Google Search" // The API might not return snippets directly in chunks, simplified for now
            });
          }
        });
      }
      
      // Filter out duplicates based on URI
      const uniqueResults = results.filter((v, i, a) => a.findIndex(t => (t.uri === v.uri)) === i);
      setSearchResults(uniqueResults);

    } catch (error) {
      console.error("Search failed", error);
      alert("Failed to search sources.");
    } finally {
      setIsSearching(false);
    }
  };

  const toggleSelection = (index: number) => {
    const newSelected = new Set(selectedResults);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedResults(newSelected);
  };

  const addSelectedSources = async () => {
    setIsLoading(true);
    try {
      const selected = Array.from(selectedResults).map(i => searchResults[i]);
      
      for (const result of selected) {
        // Try to fetch content, fallback to snippet/url
        let content = result.snippet;
        try {
           const res = await fetch('/api/fetch-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: result.uri }),
          });
          const data = await res.json();
          if (!data.error && data.text) {
            content = data.text;
          }
        } catch (e) {
          console.warn(`Failed to fetch content for ${result.uri}`, e);
        }

        const newSource = {
          id: uuidv4(),
          type: 'url',
          title: result.title,
          content: content,
        };

        await fetch(`/api/projects/${projectId}/sources`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSource),
        });
      }
      
      setIsAdding(false);
      setSearchQuery('');
      setSearchResults([]);
      onSourcesChange();
    } catch (error) {
      console.error("Failed to add selected sources", error);
      alert("Failed to add some sources.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm('Remove this source?')) return;
    try {
      await fetch(`/api/sources/${id}`, { method: 'DELETE' });
      onSourcesChange();
    } catch (error) {
      console.error('Failed to delete source', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="p-2.5 sm:p-6 border-b border-white/5 flex justify-between items-center bg-black/40 backdrop-blur-2xl sticky top-0 z-10">
        <h2 className="font-bold text-white flex items-center gap-2 sm:gap-3 text-[10px] sm:text-sm uppercase tracking-[0.2em]">
          <div className="p-1 sm:p-1.5 bg-blue-500/10 rounded-lg">
            <FileText className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" />
          </div>
          Sources <span className="text-slate-600 font-mono text-[9px] sm:text-xs">[{sources.length}]</span>
        </h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg sm:rounded-xl transition-all duration-300 border ${
            isAdding 
              ? 'bg-blue-500 text-white border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.4)] rotate-45' 
              : 'bg-white/5 text-slate-400 border-white/5 hover:text-white hover:bg-white/10 hover:border-white/10'
          }`}
          title="Add Source"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 sm:p-6 space-y-2 sm:space-y-4 custom-scrollbar">
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="glass-panel p-5 rounded-2xl mb-6 overflow-hidden border-blue-500/20 shadow-[0_0_40px_rgba(0,0,0,0.3)]"
            >
              <div className="flex gap-1.5 mb-6 bg-black/40 p-1.5 rounded-xl border border-white/5">
                {[
                  { id: 'text', label: 'Text', icon: FileType },
                  { id: 'url', label: 'URL', icon: Globe },
                  { id: 'pdf', label: 'PDF', icon: FileUp },
                  { id: 'discovery', label: 'Search', icon: Search },
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setAddType(type.id as any)}
                    className={`flex-1 py-2 px-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                      addType === type.id 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <type.icon className="w-3.5 h-3.5" />
                    {type.label}
                  </button>
                ))}
              </div>

              {addType === 'discovery' ? (
                <div className="space-y-4">
                  <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Research a topic..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/40 transition-all"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSearching || !searchQuery.trim()}
                      className="w-12 h-12 flex items-center justify-center bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20"
                    >
                      {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                    </button>
                  </form>

                  {searchResults.length > 0 && (
                    <div className="space-y-2.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                      {searchResults.map((result, idx) => (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          key={idx}
                          onClick={() => toggleSelection(idx)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
                            selectedResults.has(idx) 
                              ? 'bg-blue-500/10 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                              : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                              selectedResults.has(idx) ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-700 bg-black/20'
                            }`}>
                              {selectedResults.has(idx) && <Check className="w-3 h-3" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-bold text-white truncate leading-tight">{result.title}</h4>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[10px] text-slate-500 font-mono truncate max-w-[150px]">{new URL(result.uri).hostname}</span>
                                <a href={result.uri} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-blue-500 hover:text-blue-400">
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <button
                      onClick={addSelectedSources}
                      disabled={isLoading || selectedResults.size === 0}
                      className="premium-button w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Import {selectedResults.size} Sources</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleAddSource} className="space-y-4">
                  {addType === 'text' && (
                    <>
                      <input
                        type="text"
                        placeholder="Document Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/40 transition-all"
                        required
                      />
                      <textarea
                        placeholder="Paste research material here..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-700 h-40 resize-none focus:outline-none focus:border-blue-500/40 transition-all leading-relaxed"
                        required
                      />
                    </>
                  )}
                  
                  {addType === 'url' && (
                    <div className="relative">
                      <Globe className="w-4 h-4 text-slate-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="url"
                        placeholder="https://example.com/research-paper"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/40 transition-all"
                        required
                      />
                    </div>
                  )}

                  {addType === 'pdf' && (
                    <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center hover:bg-white/5 transition-all group cursor-pointer relative overflow-hidden">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        id="pdf-upload"
                        required
                      />
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-blue-500/5 rounded-full flex items-center justify-center mb-4 border border-blue-500/10 group-hover:scale-110 transition-transform duration-500">
                          <FileUp className="w-8 h-8 text-blue-500/50 group-hover:text-blue-500 transition-colors" />
                        </div>
                        <span className="text-sm text-white font-bold tracking-tight">
                          {file ? file.name : 'Select Research PDF'}
                        </span>
                        <span className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-widest">
                          {file ? 'Click to replace' : 'Up to 50MB'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                    >
                      Discard
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="premium-button flex-1 py-3 flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Add Source</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {sources.length === 0 && !isAdding ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12 sm:py-20 px-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/5 rounded-full flex items-center justify-center mb-4 sm:6 border border-white/5 shadow-inner">
              <FileUp className="w-8 h-8 sm:w-10 sm:h-10 text-slate-700" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mb-1.5 sm:mb-2 tracking-tight">No Sources Detected</h3>
            <p className="text-[10px] sm:text-xs text-slate-500 leading-relaxed max-w-[180px] sm:max-w-[200px] mx-auto">
              Populate your research node with documents, links, or text to begin analysis.
            </p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {sources.map((source, idx) => (
              <motion.div
                key={source.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group glass-card p-3 sm:p-4 rounded-xl sm:rounded-2xl relative flex items-start gap-3 sm:gap-4 overflow-hidden"
              >
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300 group-hover:scale-110 ${
                  source.type === 'url' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                  source.type === 'pdf' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                  'bg-blue-500/10 border-blue-500/20 text-blue-500'
                }`}>
                  {source.type === 'url' ? <Globe className="w-4 h-4 sm:w-5 sm:h-5" /> :
                   source.type === 'pdf' ? <FileText className="w-4 h-4 sm:w-5 sm:h-5" /> :
                   <FileType className="w-4 h-4 sm:w-5 sm:h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[13px] sm:text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors leading-tight" title={source.title}>
                    {source.title}
                  </h4>
                  <div className="flex items-center gap-2 sm:gap-3 mt-1 sm:mt-1.5">
                    <span className="text-[9px] sm:text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                      {source.content.length > 1000 ? `${(source.content.length / 1000).toFixed(1)}k` : source.content.length} chars
                    </span>
                    <div className="w-0.5 h-0.5 sm:w-1 sm:h-1 rounded-full bg-slate-700" />
                    <span className="text-[9px] sm:text-[10px] text-slate-600 font-medium">
                      {new Date(source.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSource(source.id);
                  }}
                  className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-red-500/10 rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

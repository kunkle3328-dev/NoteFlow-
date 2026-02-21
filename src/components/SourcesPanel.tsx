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
    <div className="flex flex-col h-full">
      <div className="p-3 sm:p-4 border-b border-white/5 flex justify-between items-center">
        <h2 className="font-semibold text-white flex items-center gap-2 text-sm uppercase tracking-wider">
          <FileText className="w-4 h-4 text-blue-400" />
          Sources <span className="text-slate-500">({sources.length})</span>
        </h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="p-1.5 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Add Source"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 custom-scrollbar">
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="glass-panel p-3 sm:p-4 rounded-xl mb-4 overflow-hidden"
            >
              <div className="flex gap-1 mb-4 bg-black/20 p-1 rounded-lg overflow-x-auto">
                {[
                  { id: 'text', label: 'Text', icon: FileType },
                  { id: 'url', label: 'URL', icon: Globe },
                  { id: 'pdf', label: 'PDF', icon: FileUp },
                  { id: 'discovery', label: 'Discovery', icon: Search },
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setAddType(type.id as any)}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                      addType === type.id 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <type.icon className="w-3 h-3" />
                    {type.label}
                  </button>
                ))}
              </div>

              {addType === 'discovery' ? (
                <div className="space-y-4">
                  <form onSubmit={handleSearch} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter a topic to research..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500/50 text-white placeholder:text-slate-600"
                    />
                    <button
                      type="submit"
                      disabled={isSearching || !searchQuery.trim()}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
                    >
                      {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </button>
                  </form>

                  {searchResults.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                      {searchResults.map((result, idx) => (
                        <div 
                          key={idx}
                          onClick={() => toggleSelection(idx)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            selectedResults.has(idx) 
                              ? 'bg-blue-500/10 border-blue-500/50' 
                              : 'bg-white/5 border-white/5 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
                              selectedResults.has(idx) ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-600'
                            }`}>
                              {selectedResults.has(idx) && <Check className="w-3 h-3" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-white truncate">{result.title}</h4>
                              <a href={result.uri} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-blue-400 hover:underline flex items-center gap-1 mt-0.5">
                                {new URL(result.uri).hostname} <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <button
                      onClick={addSelectedSources}
                      disabled={isLoading || selectedResults.size === 0}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Add ${selectedResults.size} Sources`}
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleAddSource} className="space-y-3">
                  {addType === 'text' && (
                    <>
                      <input
                        type="text"
                        placeholder="Source Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500/50 text-white placeholder:text-slate-600"
                        required
                      />
                      <textarea
                        placeholder="Paste your text here..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500/50 text-white placeholder:text-slate-600 h-32 resize-none"
                        required
                      />
                    </>
                  )}
                  
                  {addType === 'url' && (
                    <input
                      type="url"
                      placeholder="https://example.com/article"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500/50 text-white placeholder:text-slate-600"
                      required
                    />
                  )}

                  {addType === 'pdf' && (
                    <div className="border-2 border-dashed border-white/10 rounded-lg p-6 text-center hover:bg-white/5 transition-colors group">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="hidden"
                        id="pdf-upload"
                        required
                      />
                      <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center">
                        <FileUp className="w-8 h-8 text-slate-500 group-hover:text-blue-400 transition-colors mb-2" />
                        <span className="text-sm text-slate-300 font-medium">
                          {file ? file.name : 'Click to select PDF'}
                        </span>
                        <span className="text-xs text-slate-500 mt-1">
                          {file ? 'Click to change' : 'Max 50MB'}
                        </span>
                      </label>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="flex-1 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Source'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {sources.length === 0 && !isAdding ? (
          <div className="text-center py-10 px-4 opacity-50">
            <FileUp className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No sources yet. Add text, links, or PDFs to build your knowledge base.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sources.map((source) => (
              <motion.div
                key={source.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="group bg-white/5 p-3 rounded-lg border border-white/5 hover:border-blue-500/30 hover:bg-white/10 transition-all cursor-pointer flex items-start gap-3"
              >
                <div className="mt-0.5">
                  {source.type === 'url' ? (
                    <Globe className="w-4 h-4 text-emerald-400" />
                  ) : source.type === 'pdf' ? (
                    <FileText className="w-4 h-4 text-red-400" />
                  ) : (
                    <FileType className="w-4 h-4 text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-slate-200 truncate group-hover:text-white transition-colors" title={source.title}>
                    {source.title}
                  </h4>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {source.content.length.toLocaleString()} chars • {new Date(source.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSource(source.id);
                  }}
                  className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

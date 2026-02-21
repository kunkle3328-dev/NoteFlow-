import { BrainCircuit, Sparkles } from 'lucide-react';

export default function Logo({ className = "w-8 h-8", textSize = "text-xl" }: { className?: string, textSize?: string }) {
  return (
    <div className="flex items-center gap-2.5 group cursor-pointer">
      <div className={`relative flex items-center justify-center ${className} bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all duration-300 border border-white/10`}>
        <BrainCircuit className="w-1/2 h-1/2 text-white relative z-10" />
        <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="absolute -top-1 -right-1">
          <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
        </div>
      </div>
      <div className="flex flex-col">
        <h1 className={`${textSize} font-bold text-white tracking-tight leading-none`}>
          Note<span className="text-blue-400">Flow</span>
        </h1>
        <span className="text-[10px] text-slate-500 font-medium tracking-widest uppercase">AI Research</span>
      </div>
    </div>
  );
}

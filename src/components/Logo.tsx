import { BrainCircuit, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Logo({ className = "w-10 h-10", textSize = "text-2xl" }: { className?: string, textSize?: string }) {
  return (
    <div className="flex items-center gap-3 group cursor-pointer select-none">
      <div className="relative">
        <motion.div 
          whileHover={{ scale: 1.05, rotate: 5 }}
          whileTap={{ scale: 0.95 }}
          className={`relative flex items-center justify-center ${className} bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 rounded-2xl shadow-xl shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all duration-500 border border-white/20 overflow-hidden`}
        >
          {/* Animated Background Shimmer */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
          
          <BrainCircuit className="w-3/5 h-3/5 text-white relative z-10 drop-shadow-md" />
          
          {/* Glow Effect */}
          <div className="absolute inset-0 bg-blue-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </motion.div>
        
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5] 
          }}
          transition={{ 
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -top-1.5 -right-1.5"
        >
          <Sparkles className="w-4 h-4 text-blue-300 drop-shadow-[0_0_8px_rgba(147,197,253,0.8)]" />
        </motion.div>
      </div>
      
      <div className="flex flex-col">
        <h1 className={`${textSize} font-bold text-white tracking-tight leading-none flex items-center`}>
          <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">Note</span>
          <span className="text-blue-500 relative">
            Flow
            <motion.span 
              initial={{ width: 0 }}
              whileHover={{ width: '100%' }}
              className="absolute -bottom-1 left-0 h-0.5 bg-blue-500 rounded-full"
            />
          </span>
        </h1>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="h-px w-3 bg-blue-500/50" />
          <span className="text-[9px] text-slate-500 font-bold tracking-[0.2em] uppercase">Intelligence</span>
        </div>
      </div>
    </div>
  );
}

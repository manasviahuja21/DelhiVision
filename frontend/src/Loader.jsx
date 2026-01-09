import React, { useState, useEffect } from "react";
import { Activity } from "lucide-react";

const Loader = ({ message = "Establishing Link", subtext = "Syncing Node" }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev < 95 ? prev + Math.random() * 10 : prev));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-900 flex items-center justify-center overflow-hidden">
      <div className="relative flex flex-col items-center w-full max-w-md px-10">
        <div className="relative w-20 h-20 mb-8">
          <div className="absolute inset-0 border-2 border-cyan-500/20 rounded-full" />
          <div className="absolute inset-0 border-2 border-t-cyan-500 rounded-full animate-spin" />
          <Activity className="absolute inset-0 m-auto text-cyan-500 animate-pulse" size={28} />
        </div>
        <div className="text-center mb-8">
          <h3 className="text-white text-[12px] font-black uppercase tracking-[0.4em] italic mb-2">{message}</h3>
          <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">{subtext} — {Math.floor(progress)}%</p>
        </div>
        <div className="w-full h-[3px] bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-cyan-500 transition-all duration-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
};

export default Loader;
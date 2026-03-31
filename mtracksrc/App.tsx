import { useState, useEffect, useRef, Fragment } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, AlertTriangle, Globe, Info, Zap, Volume2, VolumeX, Activity, Server, ShieldAlert, History, Database, Timer, ChevronDown, ChevronUp } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';

// Target Shutdown Time: March 31, 2026, 23:59 UTC
const GLOBAL_SHUTDOWN_DATE = new Date('2026-03-31T23:59:00Z');

const TIMEZONES = [
  { 
    name: 'UTC', 
    zone: 'UTC', 
    label: '23:59 UTC', 
    node: 'Primary', 
    target: GLOBAL_SHUTDOWN_DATE,
    subNodes: [
      { id: 'UTC-01', name: 'CORE-ALPHA', location: 'London-1', type: 'Primary' },
      { id: 'UTC-02', name: 'CORE-BETA', location: 'Frankfurt-2', type: 'Secondary' },
      { id: 'UTC-03', name: 'AUTH-GW', location: 'Global', type: 'Gateway' }
    ]
  },
  { 
    name: 'Central (CDT)', 
    zone: 'America/Chicago', 
    label: '6:59 PM CDT', 
    node: 'US-Central', 
    target: GLOBAL_SHUTDOWN_DATE,
    subNodes: [
      { id: 'USC-01', name: 'CHI-NODE-01', location: 'Chicago', type: 'Storage' },
      { id: 'USC-02', name: 'DAL-NODE-02', location: 'Dallas', type: 'Mirror' }
    ]
  },
  { 
    name: 'Eastern (EDT)', 
    zone: 'America/New_York', 
    label: '7:59 PM EDT', 
    node: 'US-East', 
    target: GLOBAL_SHUTDOWN_DATE,
    subNodes: [
      { id: 'USE-01', name: 'NYC-NODE-01', location: 'New York', type: 'Storage' },
      { id: 'USE-02', name: 'ASH-NODE-02', location: 'Ashburn', type: 'Mirror' }
    ]
  },
  { 
    name: 'Mountain (MDT)', 
    zone: 'America/Denver', 
    label: '5:59 PM MDT', 
    node: 'US-West', 
    target: GLOBAL_SHUTDOWN_DATE,
    subNodes: [
      { id: 'USW-01', name: 'DEN-NODE-01', location: 'Denver', type: 'Storage' },
      { id: 'USW-02', name: 'SLC-NODE-02', location: 'Salt Lake City', type: 'Mirror' }
    ]
  },
  { 
    name: 'Pacific (PDT)', 
    zone: 'America/Los_Angeles', 
    label: '4:59 PM PDT', 
    node: 'US-Pacific', 
    target: GLOBAL_SHUTDOWN_DATE,
    subNodes: [
      { id: 'USP-01', name: 'LAX-NODE-01', location: 'Los Angeles', type: 'Storage' },
      { id: 'USP-02', name: 'SFO-NODE-02', location: 'San Francisco', type: 'Mirror' }
    ]
  },
  { 
    name: 'London (BST)', 
    zone: 'Europe/London', 
    label: '12:59 AM BST', 
    node: 'EU-West', 
    target: GLOBAL_SHUTDOWN_DATE,
    subNodes: [
      { id: 'EUW-01', name: 'LDN-MIRROR-01', location: 'London', type: 'Mirror' },
      { id: 'EUW-02', name: 'DUB-MIRROR-02', location: 'Dublin', type: 'Mirror' }
    ]
  },
  { 
    name: 'Central Europe (CEST)', 
    zone: 'Europe/Paris', 
    label: '1:59 AM CEST', 
    node: 'EU-Central', 
    target: GLOBAL_SHUTDOWN_DATE,
    subNodes: [
      { id: 'EUC-01', name: 'PAR-NODE-01', location: 'Paris', type: 'Storage' },
      { id: 'EUC-02', name: 'AMS-NODE-02', location: 'Amsterdam', type: 'Mirror' }
    ]
  },
  { 
    name: 'Japan (JST)', 
    zone: 'Asia/Tokyo', 
    label: '8:59 AM JST', 
    node: 'ASIA-East', 
    target: GLOBAL_SHUTDOWN_DATE,
    subNodes: [
      { id: 'ASE-01', name: 'TYO-NODE-01', location: 'Tokyo', type: 'Storage' },
      { id: 'ASE-02', name: 'OSA-NODE-02', location: 'Osaka', type: 'Mirror' }
    ]
  },
  { 
    name: 'Australia Eastern (AEDT)', 
    zone: 'Australia/Sydney', 
    label: '10:59 AM AEDT', 
    node: 'OCEANIA', 
    target: GLOBAL_SHUTDOWN_DATE,
    subNodes: [
      { id: 'OCE-01', name: 'SYD-NODE-01', location: 'Sydney', type: 'Storage' },
      { id: 'OCE-02', name: 'MEL-NODE-02', location: 'Melbourne', type: 'Mirror' }
    ]
  },
];

const WATCHLIST = [
  { name: 'Myrient Primary Node', status: 'CRITICAL', timeLabel: '23:59 UTC', target: GLOBAL_SHUTDOWN_DATE, risk: 100 },
  { name: 'Public Mirror Network', status: 'DEGRADED', timeLabel: '23:59 UTC', target: GLOBAL_SHUTDOWN_DATE, risk: 95 },
  { name: 'Legacy Archive Access', status: 'UNSTABLE', timeLabel: '04:00 UTC (Apr 1)', target: new Date('2026-04-01T04:00:00Z'), risk: 80 },
  { name: 'Community Sync Protocols', status: 'OFFLINE', timeLabel: 'TERMINATED', target: null, risk: 0 },
];

export default function App() {
  const [now, setNow] = useState(new Date());
  const [isAudioPlaying, setIsAudioPlaying] = useState(true);
  const [integrity, setIntegrity] = useState(100);
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  const [showSunsetSplash, setShowSunsetSplash] = useState(true);
  const audioRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const currentTime = new Date();
      setNow(currentTime);
      
      // Calculate Integrity based on global shutdown
      const difference = GLOBAL_SHUTDOWN_DATE.getTime() - currentTime.getTime();
      const totalWindow = 24 * 60 * 60 * 1000;
      const currentIntegrity = Math.max(0, Math.min(100, (difference / totalWindow) * 100));
      setIntegrity(currentIntegrity);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getCountdown = (targetDate: Date | null) => {
    if (!targetDate) return { hours: 0, minutes: 0, seconds: 0, total: 0, expired: true, nearingEnd: false, critical: false };
    
    const difference = targetDate.getTime() - now.getTime();
    if (difference <= 0) {
      return { hours: 0, minutes: 0, seconds: 0, total: 0, expired: true, nearingEnd: false, critical: false };
    }

    return {
      hours: Math.floor(difference / (1000 * 60 * 60)),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
      total: difference,
      expired: false,
      nearingEnd: difference <= 60 * 60 * 1000, // Last hour
      critical: difference <= 60 * 1000 // Last minute
    };
  };

  const formatNumber = (num: number) => num.toString().padStart(2, '0');
  const formatCountdown = (cd: ReturnType<typeof getCountdown>) => 
    `${formatNumber(cd.hours)}:${formatNumber(cd.minutes)}:${formatNumber(cd.seconds)}`;

  const toggleAudio = () => {
    setIsAudioPlaying(!isAudioPlaying);
  };

  const globalCD = getCountdown(GLOBAL_SHUTDOWN_DATE);

  const audioSrc = globalCD.expired 
    ? `https://www.youtube.com/embed/fDhUB2kWkOo?autoplay=${isAudioPlaying ? 1 : 0}&loop=1&playlist=fDhUB2kWkOo`
    : `https://www.youtube.com/embed/uAxD8-_6_rs?autoplay=${isAudioPlaying ? 1 : 0}&loop=1&playlist=uAxD8-_6_rs`;

  if (globalCD.expired && showSunsetSplash) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-[#020202] text-zinc-400 selection:bg-zinc-800">
        {/* Background Atmosphere */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-zinc-900/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-zinc-900/20 rounded-full blur-[120px]" />
        </div>

        {/* Hidden YouTube Audio Embed */}
        <div className="hidden">
          <iframe
            ref={audioRef}
            width="560"
            height="315"
            src={audioSrc}
            title="Background Audio"
            allow="autoplay"
          ></iframe>
        </div>

        <main className="relative w-full max-w-2xl space-y-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 2 }}
            className="space-y-6"
          >
            <div className="flex justify-center mb-8">
              <div className="p-4 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-600">
                <ShieldAlert size={48} strokeWidth={1} />
              </div>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-serif italic tracking-tighter text-zinc-200">
              Finally Sunsetted.
            </h1>
            
            <div className="space-y-4 max-w-md mx-auto">
              <p className="text-sm font-mono text-zinc-500 leading-relaxed uppercase tracking-widest">
                The Myrient network has reached its final termination point. 
                All nodes have been decommissioned. All synchronization protocols have ceased.
              </p>
              <div className="h-px w-12 bg-zinc-800 mx-auto" />
              <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.4em]">
                March 31, 2026 • 23:59 UTC
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3, duration: 2 }}
            className="pt-12 flex flex-col items-center gap-4"
          >
            <div className="flex gap-4">
              <button 
                onClick={toggleAudio}
                className="px-6 py-2 rounded-full border border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 text-zinc-500 text-[10px] font-mono uppercase tracking-widest transition-all"
              >
                {isAudioPlaying ? 'Silence Audio' : 'Resume Audio'}
              </button>
              <button 
                onClick={() => setShowSunsetSplash(false)}
                className="px-6 py-2 rounded-full border border-zinc-700 hover:border-zinc-500 bg-zinc-800/20 text-zinc-300 text-[10px] font-mono uppercase tracking-widest transition-all"
              >
                Access Archive
              </button>
            </div>

            <motion.a
              href="https://minerva-archive.org/"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 4 }}
              className="group flex items-center gap-3 px-8 py-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-all duration-500"
            >
              <div className="p-2 rounded-full bg-amber-500/20 text-amber-500 group-hover:scale-110 transition-transform">
                <Zap size={20} />
              </div>
              <div className="text-left">
                <div className="text-[10px] font-mono text-amber-500/60 uppercase tracking-widest">A Saviour Emerges</div>
                <div className="text-sm font-bold text-amber-500 uppercase tracking-wider">Enter Minerva Archive</div>
              </div>
            </motion.a>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{ delay: 5 }}
            className="pt-8"
          >
            <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-[0.8em]">
              End of Transmission • 0x0000
            </p>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-[#050505] selection:bg-red-500/30">
      {/* Persistent Sunset Banner */}
      {globalCD.expired && (
        <motion.div 
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          className="fixed top-0 left-0 w-full z-[100] bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-[0.3em]">
              <ShieldAlert size={12} className="text-zinc-600" />
              System Status: Finally Sunsetted
            </div>
            <div className="h-3 w-px bg-zinc-800" />
            <button 
              onClick={() => setShowSunsetSplash(true)}
              className="text-[9px] font-mono text-zinc-600 hover:text-zinc-400 uppercase tracking-widest transition-colors underline underline-offset-4"
            >
              View Final Transmission
            </button>
          </div>

          <a 
            href="https://minerva-archive.org/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-500 text-[10px] font-mono uppercase tracking-widest hover:bg-amber-500/20 transition-all"
          >
            <Zap size={10} />
            Minerva Archive Active
          </a>
        </motion.div>
      )}

      {/* Background Atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-900/10 rounded-full blur-[120px]" />
      </div>

      {/* Hidden YouTube Audio Embed */}
      <div className="hidden">
        <iframe
          ref={audioRef}
          width="560"
          height="315"
          src={audioSrc}
          title="Background Audio"
          allow="autoplay"
        ></iframe>
      </div>

      <main className="relative w-full max-w-4xl space-y-8">
        {/* Header Section */}
        <header className="flex flex-col items-center text-center space-y-4">
          <div className="flex gap-4">
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/30 bg-red-500/5 text-red-500 text-[10px] font-mono uppercase tracking-widest"
            >
              <AlertTriangle size={12} className="animate-pulse" />
              System Termination Imminent
            </motion.div>
            
            <button 
              onClick={toggleAudio}
              className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-300 text-[10px] font-mono uppercase tracking-widest ${
                isAudioPlaying 
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-500' 
                : 'border-zinc-700 bg-zinc-900/50 text-zinc-500 hover:border-zinc-500'
              }`}
            >
              {isAudioPlaying ? <Volume2 size={12} /> : <VolumeX size={12} />}
              {isAudioPlaying ? 'Audio Active' : 'Audio Muted'}
            </button>
          </div>

          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-5xl md:text-7xl font-bold tracking-tighter text-white"
          >
            MYRIENT <span className="text-red-600">SHUTDOWN</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-zinc-500 font-mono text-sm uppercase tracking-widest"
          >
            Final Sequence Initiated: 23:59 UTC • March 31, 2026
          </motion.p>
        </header>

        {/* System Integrity Bar */}
        <section className="space-y-2">
          <div className="flex justify-between items-end px-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <ShieldAlert size={12} className={integrity < 20 ? 'text-red-500 animate-pulse' : 'text-zinc-500'} />
              System Integrity
            </span>
            <span className={`text-xs font-mono font-bold ${integrity < 20 ? 'text-red-500' : 'text-zinc-400'}`}>
              {integrity.toFixed(2)}%
            </span>
          </div>
          <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800 p-[1px]">
            <motion.div 
              initial={{ width: '100%' }}
              animate={{ width: `${integrity}%` }}
              className={`h-full rounded-full ${
                integrity < 20 ? 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 
                integrity < 50 ? 'bg-amber-600' : 
                'bg-zinc-600'
              }`}
            />
          </div>
        </section>

        {/* Countdown Display */}
        <section className="hardware-card p-8 md:p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-50" />
          
          <div className="grid grid-cols-3 gap-4 md:gap-8 text-center relative z-10">
            {[
              { label: 'Hours', value: globalCD.hours },
              { label: 'Minutes', value: globalCD.minutes },
              { label: 'Seconds', value: globalCD.seconds },
            ].map((item, idx) => (
              <div key={item.label} className="flex flex-col items-center">
                <div className="relative">
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={item.value}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ 
                        opacity: 1, 
                        y: 0,
                        scale: globalCD.critical ? [1, 1.05, 1] : 1,
                        color: globalCD.critical ? '#ef4444' : globalCD.nearingEnd ? '#f59e0b' : '#ffffff'
                      }}
                      transition={{
                        scale: { repeat: Infinity, duration: 0.5 },
                        default: { duration: 0.2 }
                      }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`text-6xl md:text-9xl font-mono font-bold tracking-tighter ${globalCD.expired ? 'text-zinc-700' : 'glow-red'}`}
                    >
                      {formatNumber(item.value)}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <span className="text-[10px] md:text-xs font-mono uppercase tracking-[0.3em] text-zinc-500 mt-2">
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {!globalCD.expired && (globalCD.nearingEnd || globalCD.critical) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8 text-center"
            >
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border font-mono text-[10px] uppercase tracking-[0.2em] ${
                globalCD.critical ? 'bg-red-500/10 border-red-500/50 text-red-500 animate-pulse' : 'bg-amber-500/10 border-amber-500/50 text-amber-500'
              }`}>
                <AlertTriangle size={14} />
                {globalCD.critical ? 'CRITICAL: Final Termination Imminent' : 'WARNING: System Shutdown Imminent'}
              </div>
            </motion.div>
          )}

          {globalCD.expired && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-20"
            >
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-bold text-red-600 tracking-tighter">OFFLINE</h2>
                <p className="text-zinc-400 font-mono text-sm">System resources have been decommissioned.</p>
              </div>
            </motion.div>
          )}
        </section>

        {/* Digital Preservation Watchlist */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Global Node Status */}
          <div className="hardware-card overflow-hidden flex flex-col">
            <div className="bg-[#1a1b1e] px-4 py-2 border-b border-[#2a2a2a] flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                <Activity size={12} />
                Node Connectivity
              </div>
            </div>
            <div className="p-4 space-y-3 flex-grow">
              {TIMEZONES.slice(0, 5).map((tz) => {
                const cd = getCountdown(tz.target);
                return (
                  <div key={tz.node} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server size={10} className="text-zinc-600" />
                      <span className="text-[11px] font-mono text-zinc-300">{tz.node}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[9px] font-mono tabular-nums flex items-center gap-1 ${
                        cd.critical ? 'text-red-500 animate-pulse font-bold' : 
                        cd.nearingEnd ? 'text-amber-500' : 
                        'text-red-500/60'
                      }`}>
                        {cd.nearingEnd && !cd.expired && <AlertTriangle size={8} />}
                        {cd.expired ? '00:00:00' : formatCountdown(cd)}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                        !cd.expired ? 'text-green-500 border-green-500/20' : 'text-red-500 border-red-500/20'
                      }`}>
                        {!cd.expired ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-zinc-800/50">
                <p className="text-[9px] font-mono text-zinc-600 italic">Showing primary regional nodes...</p>
              </div>
            </div>
          </div>

          {/* Preservation Watchlist */}
          <div className="hardware-card overflow-hidden flex flex-col">
            <div className="bg-[#1a1b1e] px-4 py-2 border-b border-[#2a2a2a] flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                <History size={12} />
                Preservation Watchlist
              </div>
            </div>
            <div className="p-4 space-y-3 flex-grow">
              {WATCHLIST.map((item) => {
                const cd = getCountdown(item.target);
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-zinc-300">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-mono tabular-nums flex items-center gap-1 ${
                          cd.critical ? 'text-red-500 animate-pulse font-bold' : 
                          cd.nearingEnd ? 'text-amber-500 font-medium' : 
                          'text-red-500/80'
                        }`}>
                          {cd.nearingEnd && !cd.expired && <AlertTriangle size={8} />}
                          {cd.expired ? '00:00:00' : formatCountdown(cd)}
                        </span>
                        <span className={`text-[9px] font-bold ${
                          item.status === 'CRITICAL' ? 'text-red-500' : 
                          item.status === 'DEGRADED' ? 'text-amber-500' : 
                          'text-zinc-500'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                    <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          item.risk > 90 ? 'bg-red-600' : 
                          item.risk > 50 ? 'bg-amber-600' : 
                          'bg-zinc-700'
                        }`}
                        style={{ width: `${item.risk}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[8px] font-mono text-zinc-600 uppercase">
                      <span>Impact: {item.timeLabel}</span>
                      <span>Risk: {item.risk}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Regional Synchronization Table */}
        <section className="hardware-card overflow-hidden">
          <div className="bg-[#1a1b1e] px-6 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-400">
              <Globe size={14} />
              Regional Synchronization
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-mono text-red-500 uppercase">Live</span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2a2a2a] bg-[#1a1b1e]/50">
                  <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-zinc-500">Node Location</th>
                  <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-zinc-500">Status</th>
                  <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-zinc-500">Shutdown Time</th>
                  <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-zinc-500">Date</th>
                  <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-zinc-500">Time Remaining</th>
                </tr>
              </thead>
              <tbody className="font-mono text-sm">
                {TIMEZONES.map((tz, idx) => {
                  const formattedDate = formatInTimeZone(tz.target, tz.zone, 'EEEE, MMM d');
                  const cd = getCountdown(tz.target);
                  const isExpanded = expandedRegion === tz.name;
                  
                  return (
                    <Fragment key={tz.name}>
                      <tr 
                        onClick={() => setExpandedRegion(isExpanded ? null : tz.name)}
                        className={`border-b border-[#2a2a2a]/50 hover:bg-white/5 transition-colors cursor-pointer group ${idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors">
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                            <div className="flex items-center gap-2">
                              <Server size={12} className="text-zinc-600" />
                              <span className="font-bold text-zinc-300">{tz.name}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            !cd.expired ? 'text-green-500 border-green-500/30 bg-green-500/5' : 
                            'text-red-500 border-red-500/30 bg-red-500/5'
                          }`}>
                            {!cd.expired ? 'ONLINE' : 'OFFLINE'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-amber-500 font-bold">{tz.label}</td>
                        <td className="px-6 py-4 text-zinc-500">{formattedDate}</td>
                        <td className={`px-6 py-4 font-mono text-xs tabular-nums flex items-center gap-2 ${
                          cd.critical ? 'text-red-500 animate-pulse font-bold' : 
                          cd.nearingEnd ? 'text-amber-500 font-medium' : 
                          'text-red-500/80'
                        }`}>
                          {cd.nearingEnd && !cd.expired && <AlertTriangle size={10} />}
                          {cd.expired ? '00:00:00' : formatCountdown(cd)}
                        </td>
                      </tr>
                      <AnimatePresence>
                        {isExpanded && (
                          <tr>
                            <td colSpan={5} className="p-0 border-b border-[#2a2a2a]/50 bg-black/40">
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                className="overflow-hidden"
                              >
                                <div className="px-12 py-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {tz.subNodes.map((node) => (
                                    <div key={node.id} className="p-3 rounded border border-zinc-800/50 bg-zinc-900/30 space-y-2">
                                      <div className="flex justify-between items-start">
                                        <div className="space-y-0.5">
                                          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">{node.name}</div>
                                          <div className="text-[9px] text-zinc-600 uppercase">{node.location}</div>
                                        </div>
                                        <div className="px-1.5 py-0.5 rounded bg-zinc-800 text-[8px] font-mono text-zinc-500 uppercase tracking-widest">
                                          {node.type}
                                        </div>
                                      </div>
                                      <div className="flex justify-between items-center pt-1 border-t border-zinc-800/30">
                                        <div className="flex items-center gap-1.5">
                                          <div className={`w-1 h-1 rounded-full ${!cd.expired ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                                          <span className={`text-[9px] font-bold ${!cd.expired ? 'text-green-600' : 'text-red-600'}`}>
                                            {!cd.expired ? 'ACTIVE' : 'TERMINATED'}
                                          </span>
                                        </div>
                                        <span className={`text-[9px] font-mono tabular-nums ${cd.critical ? 'text-red-500 animate-pulse' : 'text-zinc-500'}`}>
                                          {cd.expired ? '00:00:00' : formatCountdown(cd)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer Info */}
        <footer className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="hardware-card p-4 flex gap-4 items-start">
            <div className="p-2 rounded bg-zinc-800 text-zinc-400">
              <Info size={18} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Information</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Site: <a href="https://myrient.erista.me/" target="_blank" rel="noopener noreferrer" className="text-red-500 hover:underline">myrient.erista.me</a>. 
                All global nodes are currently being monitored for connectivity. Shutdown will be simultaneous across all mirrors.
              </p>
            </div>
          </div>
          <div className="hardware-card p-4 flex gap-4 items-start">
            <div className="p-2 rounded bg-zinc-800 text-zinc-400">
              <Zap size={18} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Status</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Current Status: <span className="text-red-500 font-bold">{globalCD.expired ? 'TERMINATED' : 'DECOMMISSIONING'}</span>. 
                System Integrity: <span className="text-amber-500">{integrity.toFixed(1)}%</span>.
              </p>
            </div>
          </div>
        </footer>

        <div className="text-center pb-8">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.5em]">
            End of Line • Terminal Session 0x3F2A
          </p>
        </div>
      </main>
    </div>
  );
}

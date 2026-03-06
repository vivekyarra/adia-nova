import { useEffect, useState } from "react";

const LINES = [
  { text: "> Ingesting document corpus...", doneColor: "#444", delay: 0 },
  { text: "> Extracting entities and risk signals...", doneColor: "#444", delay: 900 },
  { text: "> Blue Team mapping competitive moat...", doneColor: "#00a8ff", delay: 2000 },
  { text: "> Red Team hunting fatal flaws...", doneColor: "#ff003c", delay: 3200 },
  { text: "> Amazon Nova arbitrating verdict...", doneColor: "#00ff9d", delay: 4500 },
];

const CHAR_SPEED = 32;

export default function TerminalLoader({ isVisible }) {
  const [lineStates, setLineStates] = useState(LINES.map(() => ({ typed: "", done: false, active: false })));
  const [mounted, setMounted] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      if (mounted) {
        setFadingOut(true);
        const t = setTimeout(() => { setMounted(false); setFadingOut(false); }, 300);
        return () => clearTimeout(t);
      }
      return;
    }

    setMounted(true);
    setFadingOut(false);
    setLineStates(LINES.map(() => ({ typed: "", done: false, active: false })));

    const timers = [];

    LINES.forEach((line, lineIdx) => {
      const startTimer = setTimeout(() => {
        setLineStates((prev) => {
          const next = [...prev];
          next[lineIdx] = { ...next[lineIdx], active: true };
          return next;
        });

        let charIdx = 0;
        const full = line.text;

        const typeInterval = setInterval(() => {
          charIdx++;
          const partial = full.slice(0, charIdx);
          setLineStates((prev) => {
            const next = [...prev];
            next[lineIdx] = { ...next[lineIdx], typed: partial };
            return next;
          });

          if (charIdx >= full.length) {
            clearInterval(typeInterval);
            if (lineIdx < LINES.length - 1) {
              setLineStates((prev) => {
                const next = [...prev];
                next[lineIdx] = { ...next[lineIdx], done: true, active: false };
                return next;
              });
            }
          }
        }, CHAR_SPEED);

        timers.push(typeInterval);
      }, line.delay);

      timers.push(startTimer);
    });

    return () => timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
  }, [isVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.97)", display:"flex", alignItems:"center", justifyContent:"center", opacity:fadingOut?0:1, transition:"opacity 0.3s ease" }}>
      <div style={{ width:"100%", maxWidth:580, background:"#050505", border:"1px solid #1e1e1e", borderRadius:6, overflow:"hidden", boxShadow:"0 0 60px rgba(0,255,157,0.05), 0 24px 48px rgba(0,0,0,0.8)" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 14px", borderBottom:"1px solid #1a1a1a", background:"#080808" }}>
          <span style={{ width:10, height:10, borderRadius:"50%", background:"#ff5f57", display:"inline-block" }} />
          <span style={{ width:10, height:10, borderRadius:"50%", background:"#febc2e", display:"inline-block" }} />
          <span style={{ width:10, height:10, borderRadius:"50%", background:"#28c840", display:"inline-block" }} />
          <span style={{ marginLeft:10, fontFamily:"var(--mono)", fontSize:11, color:"#3a3a3a", letterSpacing:"0.15em" }}>
            ADIA INTELLIGENCE ENGINE — AMAZON NOVA
          </span>
        </div>

        {/* Body */}
        <div style={{ padding:"22px 20px 24px", minHeight:200 }}>
          {LINES.map((line, idx) => {
            const state = lineStates[idx];
            const isLastLine = idx === LINES.length - 1;
            const hasStarted = state.typed.length > 0 || state.active;
            if (!hasStarted) return null;

            return (
              <div key={idx} style={{ fontFamily:"var(--mono)", fontSize:13, lineHeight:"1.8", color:state.done ? state.doneColor : "#e8e8e8", display:"flex", alignItems:"center", gap:6 }}>
                <span>{state.typed}</span>
                {state.active && !state.done && (
                  <span style={{ display:"inline-block", width:8, height:14, background:"#00ff9d", animation:"blink 0.8s step-start infinite", verticalAlign:"middle" }} />
                )}
                {state.done && !isLastLine && (
                  <span style={{ color:state.doneColor, opacity:0.5, fontSize:11 }}>&nbsp;[DONE]</span>
                )}
                {isLastLine && state.typed.length >= line.text.length && (
                  <span style={{ color:"#00ff9d", fontSize:11, animation:"blink 0.8s step-start infinite", letterSpacing:"0.1em" }}>&nbsp;[PROCESSING...]</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


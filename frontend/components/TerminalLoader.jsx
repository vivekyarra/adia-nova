import { useEffect, useState } from "react";

const LINES = [
  { text: "> Ingesting document corpus...", delay: 0, doneColor: "#444" },
  { text: "> Extracting entities and risk signals...", delay: 1000, doneColor: "#444" },
  { text: "> Blue Team mapping competitive moat...", delay: 2200, doneColor: "#00a8ff" },
  { text: "> Red Team hunting fatal flaws...", delay: 3400, doneColor: "#ff003c" },
  { text: "> Amazon Nova arbitrating verdict...", delay: 4600, doneColor: "#00ff9d" },
];

export default function TerminalLoader({ isVisible }) {
  const [render, setRender] = useState(isVisible);
  const [fadingOut, setFadingOut] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [completed, setCompleted] = useState([]);
  const [processingVisible, setProcessingVisible] = useState(true);

  useEffect(() => {
    if (isVisible) {
      setRender(true);
      setFadingOut(false);
      setCurrentLineIndex(0);
      setTypedText("");
      setCompleted([]);
    } else if (render) {
      setFadingOut(true);
      const timeout = setTimeout(() => {
        setRender(false);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [isVisible, render]);

  useEffect(() => {
    if (!render) return;

    let typingTimeout;
    let cursorInterval;

    const startLineTyping = (index) => {
      if (index >= LINES.length) return;
      const line = LINES[index];
      setTypedText("");

      typingTimeout = setTimeout(() => {
        let charIndex = 0;
        const full = line.text;

        const typeNext = () => {
          charIndex += 1;
          setTypedText(full.slice(0, charIndex));
          if (charIndex < full.length) {
            typingTimeout = setTimeout(typeNext, 35);
          } else {
            setCompleted((prev) => [...prev, index]);
            setCurrentLineIndex((prev) => Math.min(prev + 1, LINES.length - 1));
            if (index + 1 < LINES.length) {
              startLineTyping(index + 1);
            }
          }
        };

        typeNext();
      }, line.delay);
    };

    startLineTyping(0);

    cursorInterval = setInterval(() => {
      setProcessingVisible((v) => !v);
    }, 800);

    return () => {
      clearTimeout(typingTimeout);
      clearInterval(cursorInterval);
    };
  }, [render]);

  if (!render) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.96)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        opacity: fadingOut ? 0 : 1,
        transition: "opacity 300ms ease-out",
      }}
    >
      <div
        style={{
          maxWidth: 600,
          width: "90%",
          background: "#060606",
          border: "1px solid #1a1a1a",
          borderRadius: 4,
          padding: 32,
          boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
          fontFamily: "var(--mono)",
          fontSize: 12,
          color: "#e8e8e8",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 16,
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#ff003c",
              }}
            />
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#ffb800",
              }}
            />
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#00ff9d",
              }}
            />
          </div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              color: "#444",
              textTransform: "uppercase",
            }}
          >
            ADIA INTELLIGENCE ENGINE
          </div>
          <div style={{ width: 40 }} />
        </div>

        <div
          style={{
            fontFamily: "var(--mono)",
            lineHeight: 1.6,
            minHeight: 140,
          }}
        >
          {LINES.map((line, index) => {
            const isCompleted = completed.includes(index);
            const isActive = index === currentLineIndex && !isCompleted;

            let content = null;
            if (isActive) {
              content = (
                <>
                  {typedText}
                  <span
                    style={{
                      opacity: processingVisible ? 1 : 0,
                    }}
                  >
                    _
                  </span>
                </>
              );
            } else if (isCompleted) {
              const suffix = index === LINES.length - 1 ? "[PROCESSING...]" : "[DONE]";
              content = (
                <>
                  {line.text}{" "}
                  <span
                    style={{
                      color: line.doneColor,
                      opacity: index === LINES.length - 1 ? (processingVisible ? 1 : 0.4) : 0.6,
                    }}
                  >
                    {suffix}
                  </span>
                </>
              );
            } else {
              content = " ";
            }

            return (
              <div key={line.text} style={{ marginBottom: 6 }}>
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


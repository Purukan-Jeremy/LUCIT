import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import "../../assets/style.css";
import { readStoredUser } from "../../utils/session";
import { getApiUrl } from "../../utils/api";

type ChatMessage = { role: "user" | "assistant"; text: string };

function formatPredictionLabel(prediction: string) {
  if (!prediction) return "Unknown";

  const p = prediction.trim();
  switch (p) {
    case "Colon N":
      return "Colon Normal";
    case "Colon ACA":
      return "Colon Adenocarcinoma";
    case "Lung ACA":
      return "Lung Adenocarcinoma";
    case "Lung N":
      return "Lung Normal";
    case "Lung SCC":
      return "Lung Squamous Cell Carcinoma";
    default:
      return p;
  }
}

type HistoryItem = {
  id: number;
  prediction: string;
  confidence: number | string | null;
  createdAt: string;
  model: string;
  description: string;
  variant: "lung" | "colon" | "breast" | "unknown";
  originalImage?: string;
  heatmapImage?: string;
  overlayImage?: string;
  featureType?: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

const DonutChart = ({
  percent,
  label,
  color,
}: {
  percent: number;
  label: string;
  color: string;
}) => {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="history-donut-wrapper">
      <svg width="80" height="80" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
          stroke="#f0f0f0"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text
          x="50"
          y="55"
          textAnchor="middle"
          fontSize="18"
          fontWeight="700"
          fill="#333"
        >
          {Math.round(percent)}%
        </text>
      </svg>
      <span className="history-donut-label">{label}</span>
    </div>
  );
};

// --- NEW COMPONENT: MEDICAL PULSE LOADER ---
const ClinicalPulseLoader = () => {
  return (
    <div className="clinical-loader-container">
      <div className="pulse-wrapper">
        <div className="pulse-ring ring-1"></div>
        <div className="pulse-ring ring-2"></div>
        <div className="pulse-ring ring-3"></div>
        <div className="pulse-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 12h3l2 8 4-16 4 16 2-8h3" />
          </svg>
        </div>
      </div>
      <div className="loader-text-group">
        <h3 className="scanning-text">Scanning Diagnostic Archive</h3>
        <p className="loading-subtext">
          Retrieving clinical records from secure storage...
        </p>
      </div>

      <style>{`
        .clinical-loader-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px;
          min-height: 400px;
        }
        .pulse-wrapper {
          position: relative;
          width: 100px;
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 30px;
        }
        .pulse-center {
          width: 60px;
          height: 60px;
          background: #6a1b9a;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 5;
          box-shadow: 0 4px 15px rgba(106, 27, 154, 0.4);
        }
        .pulse-ring {
          position: absolute;
          width: 60px;
          height: 60px;
          border: 2px solid #f06292;
          border-radius: 50%;
          opacity: 0;
          animation: clinicalPulse 2.4s cubic-bezier(0.2, 0, 0.2, 1) infinite;
        }
        .ring-2 { animation-delay: 0.8s; }
        .ring-3 { animation-delay: 1.6s; }
        
        @keyframes clinicalPulse {
          0% { transform: scale(1); opacity: 0; }
          10% { opacity: 0.6; }
          100% { transform: scale(3.5); opacity: 0; }
        }

        .loader-text-group {
          text-align: center;
        }
        .scanning-text {
          font-size: 1.4rem;
          color: #6a1b9a;
          margin-bottom: 8px;
          letter-spacing: -0.01em;
          animation: textShimmer 2s ease-in-out infinite;
        }
        .loading-subtext {
          color: #666;
          font-size: 0.95rem;
          opacity: 0.8;
        }

        @keyframes textShimmer {
          0%, 100% { opacity: 1; transform: translateY(0); }
          50% { opacity: 0.6; transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
};

function HistoryPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [userFullname, setUserFullname] = useState("Guest");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chat state per history item
  const [chatOpenId, setChatOpenId] = useState<number | null>(null);
  const [historyChats, setHistoryChats] = useState<Record<number, ChatMessage[]>>({});
  const [chatInputs, setChatInputs] = useState<Record<number, string>>({});
  const [chatLoading, setChatLoading] = useState<Set<number>>(new Set());
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Drag state for chatbox — uses direct DOM for zero-lag dragging
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const wasDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const PANEL_W = 400;
  const PANEL_H = 560;

  useEffect(() => {
    const syncUser = () => {
      try {
        setUserFullname(readStoredUser()?.fullname || "Guest");
      } catch (error) {
        setUserFullname("Guest");
      }
    };
    syncUser();
    window.addEventListener("storage", syncUser);
    return () => window.removeEventListener("storage", syncUser);
  }, []);

  const fetchHistory = async (searchQuery: string = "") => {
    setIsLoading(true);
    setError(null);
    try {
      const url = new URL(getApiUrl("/api/history"), window.location.origin);
      if (searchQuery) {
        url.searchParams.append("q", searchQuery);
      }

      const response = await fetch(url.toString(), {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401)
          throw new Error("Unauthorized: Please login first.");
        throw new Error("Failed to fetch history");
      }

      const data = await response.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDeleteHistory = async (id: number) => {
    try {
      const response = await fetch(getApiUrl(`/api/history/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete history item");
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (expandedId === id) setExpandedId(null);
      toast.success("Clinical record deleted successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete item");
    }
  };

  const handleConfirmDelete = () => {
    if (deleteTargetId === null) return;
    handleDeleteHistory(deleteTargetId);
    setDeleteTargetId(null);
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return "#2e7d32";
    if (score >= 65) return "#ef6c00";
    if (score >= 40) return "#fbc02d";
    return "#d32f2f";
  };

  const parseConfidence = (conf: any): number => {
    if (typeof conf === "number") return conf;
    if (typeof conf === "string") {
      const match = conf.match(/(\d+\.?\d*)/);
      return match ? parseFloat(match[1]) : 0;
    }
    return 0;
  };

  const openChat = (item: HistoryItem) => {
    if (chatOpenId === item.id) {
      setChatOpenId(null);
      return;
    }
    setChatOpenId(item.id);
    setDragPos(null); // reset to default bottom-right position
    // Pre-load AI description as first assistant message if not already set
    if (!historyChats[item.id]) {
      setHistoryChats((prev) => ({
        ...prev,
        [item.id]: [
          { role: "assistant" as const, text: item.description || "No AI description available." },
        ],
      }));
    }
  };

  const handleHeaderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't start drag on button clicks inside header
    if ((e.target as HTMLElement).closest("button")) return;

    const panel = panelRef.current;
    if (!panel) return;

    // Snapshot current rendered position so first frame is instant
    const rect = panel.getBoundingClientRect();
    panel.style.left = rect.left + "px";
    panel.style.top = rect.top + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";

    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    isDraggingRef.current = true;
    wasDraggingRef.current = false;

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      wasDraggingRef.current = true;
      const clampedX = Math.max(0, Math.min(ev.clientX - dragOffsetRef.current.x, window.innerWidth - PANEL_W));
      const clampedY = Math.max(0, Math.min(ev.clientY - dragOffsetRef.current.y, window.innerHeight - PANEL_H));
      // Direct DOM write — NO React re-render during drag
      panel.style.left = clampedX + "px";
      panel.style.top = clampedY + "px";
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // Sync final position to React state so it survives re-renders
      const finalX = parseFloat(panel.style.left) || 0;
      const finalY = parseFloat(panel.style.top) || 0;
      setDragPos({ x: finalX, y: finalY });
      setTimeout(() => { wasDraggingRef.current = false; }, 80);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const sendHistoryChat = async (item: HistoryItem) => {
    const msg = (chatInputs[item.id] || "").trim();
    if (!msg || chatLoading.has(item.id)) return;

    const currentMessages = historyChats[item.id] || [];
    const newMessages: ChatMessage[] = [...currentMessages, { role: "user", text: msg }];
    setHistoryChats((prev) => ({ ...prev, [item.id]: newMessages }));
    setChatInputs((prev) => ({ ...prev, [item.id]: "" }));
    setChatLoading((prev) => new Set(prev).add(item.id));

    try {
      const confidenceRaw = parseConfidence(item.confidence);
      const res = await fetch(getApiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: msg,
          analysis_context: {
            model_type: item.model.toLowerCase(),
            prediction: item.prediction,
            confidence: confidenceRaw / 100,
            ai_description: item.description,
          },
          chat_history: newMessages.slice(1), // skip the AI description intro
        }),
      });
      const data = await res.json();
      const reply = data.status === "success" ? data.reply : "Error connecting to AI.";
      setHistoryChats((prev) => ({
        ...prev,
        [item.id]: [...newMessages, { role: "assistant", text: reply }],
      }));
    } catch {
      setHistoryChats((prev) => ({
        ...prev,
        [item.id]: [...newMessages, { role: "assistant", text: "Offline. Please try again." }],
      }));
    } finally {
      setChatLoading((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  return (
    <main className="history-page-v2">
      <div className="history-container">
        <header className="history-header-v2">
          <div className="history-header-left">
            <button
              className="history-back-btn"
              onClick={() => navigate("/analysis")}
              aria-label="Back to Analysis"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              <span>Back to Analysis</span>
            </button>
            <span className="history-breadcrumb">
              LUCIT / Clinical Archives
            </span>
            <h1>Diagnostic History</h1>
            <p className="history-subtitle">
              Comprehensive record of AI-assisted histopathology examinations
            </p>
          </div>
          <div className="history-header-right">
            <div className="history-user-info">
              <div className="user-avatar-small">
                {userFullname.charAt(0).toUpperCase()}
              </div>
              <div className="user-text">
                <span className="user-name">{userFullname}</span>
                <span className="user-role">Authorized Pathologist</span>
              </div>
            </div>
          </div>
        </header>

        <div className="history-controls-v2">
          <div className="search-box-v2">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Filter by prediction, organ, or findings..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchHistory(query)}
            />
          </div>
          <div className="history-stats-mini">
            <div className="stat-pill">
              <span className="stat-label">Total Exams:</span>
              <span className="stat-value">{items.length}</span>
            </div>
          </div>
        </div>

        <section className="history-content-v2">
          {isLoading ? (
            <ClinicalPulseLoader />
          ) : error ? (
            <div className="history-error-v2">
              <div className="error-icon">!</div>
              <p>{error}</p>
              <button onClick={() => fetchHistory(query)} className="retry-btn">
                Retry Connection
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="history-empty-v2">
              <div className="empty-illustration">🔬</div>
              <h3>No Diagnostic Records Found</h3>
              <p>Start a new analysis to populate your clinical archive.</p>
            </div>
          ) : (
            <div className="history-grid-v2">
              {items.map((item) => {
                const confValue = parseConfidence(item.confidence);
                const isSegmentation = item.model === "Segmentation";

                return (
                  <article
                    key={item.id}
                    className={`history-item-v2 ${expandedId === item.id ? "expanded" : ""}`}
                  >
                    <div
                      className="history-item-main"
                      onClick={() =>
                        setExpandedId(expandedId === item.id ? null : item.id)
                      }
                    >
                      <div className="item-specimen-preview">
                        <img src={item.originalImage} alt="Specimen" />
                        {!isSegmentation && (
                          <div className={`organ-tag ${item.variant}`}>
                            {item.variant.toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="item-info">
                        <div className="item-id-row">
                          <span className="item-id">EXAM #{item.id}</span>
                          <span className="item-date">
                            {formatDate(item.createdAt)}
                          </span>
                        </div>
                        <h3 className="item-prediction">
                          {isSegmentation
                            ? ""
                            : formatPredictionLabel(item.prediction)}
                        </h3>
                        <div className="item-tags">
                          <span
                            className={`type-badge ${item.model.toLowerCase()}`}
                          >
                            {item.model}
                          </span>
                          <span className="pathologist-badge">
                            Dr. {userFullname.split(" ")[0]}
                          </span>
                        </div>
                      </div>

                      <div className="item-visual-summary">
                        <DonutChart
                          percent={confValue}
                          label={isSegmentation ? "Cancer" : "Confidence"}
                          color={
                            isSegmentation
                              ? "#d32f2f"
                              : getConfidenceColor(confValue)
                          }
                        />
                      </div>

                      <div className="item-actions-v2">
                        <button
                          className="delete-item-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTargetId(item.id);
                          }}
                          title="Delete Record"
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </button>
                        <div
                          className={`expand-chevron ${expandedId === item.id ? "active" : ""}`}
                        >
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {expandedId === item.id && (
                      <div className="history-item-details">
                        <div className="details-grid">
                          <div className="detail-visuals">
                            <div className="visual-card">
                              <span className="visual-label">
                                Binary Mask
                              </span>
                              <div className="visual-box">
                                <img src={item.heatmapImage} alt="Heatmap" />
                              </div>
                            </div>
                            <div className="visual-card">
                              <span className="visual-label">
                                Diagnostic Overlay
                              </span>
                              <div className="visual-box">
                                <img src={item.overlayImage} alt="Overlay" />
                              </div>
                            </div>
                          </div>
                          <div className="detail-findings">
                            <div className="findings-title-row">
                              <h4 className="findings-title">
                                Clinical Findings &amp; AI Interpretation
                              </h4>
                              <button
                                className={`findings-chat-icon ${chatOpenId === item.id ? "active" : ""}`}
                                title="Discuss with AI"
                                onClick={(e) => { e.stopPropagation(); openChat(item); }}
                              >
                                <svg
                                  width="20"
                                  height="20"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                              </button>
                            </div>
                            <div className="findings-text markdown-content" data-lenis-prevent>
                              <ReactMarkdown
                                components={{
                                  h2: ({ node, ...props }) => (
                                    <h2
                                      style={{
                                        fontSize: "1rem",
                                        fontWeight: 600,
                                        color: "#6a1b9a",
                                        marginTop: "1.5rem",
                                        marginBottom: "0.7rem",
                                        borderBottom: "2px solid rgba(106, 27, 154, 0.1)",
                                        paddingBottom: "0.4rem",
                                      }}
                                      {...props}
                                    />
                                  ),
                                  p: ({ node, ...props }) => (
                                    <p
                                      style={{
                                        marginBottom: "1rem",
                                        textAlign: "justify",
                                        lineHeight: "1.8",
                                      }}
                                      {...props}
                                    />
                                  ),
                                  ul: ({ node, ...props }) => (
                                    <ul
                                      style={{
                                        marginLeft: "1.5rem",
                                        marginBottom: "1rem",
                                        lineHeight: "1.7",
                                      }}
                                      {...props}
                                    />
                                  ),
                                  li: ({ node, ...props }) => (
                                    <li
                                      style={{
                                        marginBottom: "0.4rem",
                                      }}
                                      {...props}
                                    />
                                  ),
                                  strong: ({ node, ...props }) => (
                                    <strong
                                      style={{
                                        color: "#6a1b9a",
                                        fontWeight: 600,
                                      }}
                                      {...props}
                                    />
                                  ),
                                }}
                              >
                                {item.description}
                              </ReactMarkdown>
                            </div>
                            <div className="findings-footer">
                              <div className="disclaimer-badge">
                                AI-Generated Interpretation
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {deleteTargetId !== null &&
        createPortal(
          <div
            className="medical-modal-overlay"
            onClick={() => setDeleteTargetId(null)}
          >
            <div className="medical-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-v2">
                <div className="modal-warn-icon">!</div>
                <h3>Confirm Deletion</h3>
              </div>
              <div className="modal-body-v2">
                <p>
                  You are about to permanently remove{" "}
                  <strong>Exam #{deleteTargetId}</strong> from the clinical
                  archives.
                </p>
                <p className="modal-subtext">
                  This action cannot be undone and will remove all associated AI
                  diagnostic data.
                </p>
              </div>
              <div className="modal-footer-v2">
                <button
                  className="modal-btn-cancel"
                  onClick={() => setDeleteTargetId(null)}
                >
                  Cancel
                </button>
                <button
                  className="modal-btn-confirm"
                  onClick={handleConfirmDelete}
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Sticky Chatbox Popup */}
      {chatOpenId !== null && (() => {
        const activeItem = items.find((i) => i.id === chatOpenId);
        if (!activeItem) return null;
        const messages = historyChats[chatOpenId] || [];
        const isThinking = chatLoading.has(chatOpenId);

        return createPortal(
          <div className="hx-chat-wrapper">
            {/* Backdrop — closes on click but not when user just finished dragging */}
            <div
              className="hx-chat-backdrop"
              onClick={() => {
                if (wasDraggingRef.current) return;
                setChatOpenId(null);
                setDragPos(null);
              }}
            />
            <div
              ref={panelRef}
              className="hx-chat-panel"
              style={
                dragPos
                  ? { left: dragPos.x, top: dragPos.y, bottom: "auto", right: "auto" }
                  : {}
              }
            >
              {/* Header — drag handle */}
              <div
                className="hx-chat-header"
                onMouseDown={handleHeaderMouseDown}
              >
                <div className="hx-chat-header-info">
                  <div className="hx-chat-avatar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="hx-chat-title">AI Discussion</div>
                    <div className="hx-chat-subtitle">Exam #{activeItem.id} · {activeItem.model}</div>
                  </div>
                </div>
                <button className="hx-chat-close" onClick={() => setChatOpenId(null)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Pink accent bar */}
              <div className="hx-chat-accent-bar" />

              {/* Messages */}
              <div className="hx-chat-messages" data-lenis-prevent>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`hx-chat-msg ${msg.role === "user" ? "hx-msg-user" : "hx-msg-assistant"}`}
                  >
                    <div className="hx-chat-bubble">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                ))}
                {isThinking && (
                  <div className="hx-chat-msg hx-msg-assistant">
                    <div className="hx-chat-bubble hx-thinking">
                      <span /><span /><span />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="hx-chat-input-row">
                <input
                  className="hx-chat-input"
                  type="text"
                  placeholder="Discuss more"
                  value={chatInputs[chatOpenId] || ""}
                  onChange={(e) =>
                    setChatInputs((prev) => ({ ...prev, [chatOpenId]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendHistoryChat(activeItem);
                    }
                  }}
                  disabled={isThinking}
                />
                <button
                  className="hx-chat-send"
                  onClick={() => sendHistoryChat(activeItem)}
                  disabled={isThinking || !(chatInputs[chatOpenId] || "").trim()}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m22 2-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </main>
  );
}

export default HistoryPage;

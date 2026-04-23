import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import "../../assets/style.css";
import { readStoredUser } from "../../utils/session";
import { getApiUrl } from "../../utils/api";

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
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
                                Feature Heatmap
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
                            <h4 className="findings-title">
                              Clinical Findings & AI Interpretation
                            </h4>
                            <p className="findings-text">{item.description}</p>
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
    </main>
  );
}

export default HistoryPage;

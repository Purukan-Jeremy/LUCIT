import { useEffect, useMemo, useState } from "react";
import "../../assets/style.css";
import { readStoredUser } from "../../utils/session";

const ANALYSIS_HISTORY_KEY = "lucit_analysis_history";

function formatPredictionLabel(prediction: string) {
  switch (prediction.trim()) {
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
      return prediction;
  }
}

type HistoryItem = {
  id: number;
  prediction: string;
  confidence: string;
  createdAt: string;
  model: string;
  description: string;
  variant: "lung" | "colon" | "breast" | "unknown";
  originalImage?: string;
  heatmapImage?: string;
  overlayImage?: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedText(text: string, query: string) {
  const keyword = query.trim();
  if (!keyword) return text;

  const parts = text.split(new RegExp(`(${escapeRegExp(keyword)})`, "gi"));

  return parts.map((part, index) =>
    part.toLowerCase() === keyword.toLowerCase() ? (
      <mark className="history-highlight" key={`${text}-${index}`}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function HistoryPage() {
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [userFullname, setUserFullname] = useState("Guest");

  useEffect(() => {
    const syncUser = () => {
      try {
        setUserFullname(readStoredUser()?.fullname || "Guest");
      } catch (error) {
        console.error("Failed to load current user:", error);
        setUserFullname("Guest");
      }
    };

    syncUser();
    window.addEventListener("storage", syncUser);

    return () => window.removeEventListener("storage", syncUser);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ANALYSIS_HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const safeItems = Array.isArray(parsed) ? parsed : [];
      setItems(safeItems);
    } catch (error) {
      console.error("Failed to load analysis history:", error);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    if (deleteTargetId === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDeleteTargetId(null);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [deleteTargetId]);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;

    return items.filter((item) =>
      [
        formatPredictionLabel(item.prediction),
        item.confidence,
        formatDate(item.createdAt),
        item.model,
        item.description,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [items, query]);

  const handleDeleteHistory = (id: number) => {
    const updatedItems = items.filter((item) => item.id !== id);
    localStorage.setItem(ANALYSIS_HISTORY_KEY, JSON.stringify(updatedItems));
    setItems(updatedItems);
    if (expandedId === id) {
      setExpandedId(null);
    }
  };

  const handleToggleDetail = (id: number) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  const handleDeleteClick = (id: number) => {
    setDeleteTargetId(id);
  };

  const handleConfirmDelete = () => {
    if (deleteTargetId === null) return;
    handleDeleteHistory(deleteTargetId);
    setExpandedId(null);
    setDeleteTargetId(null);
  };

  return (
    <main className="history-page">
      <section className="history-hero">
        <h1>Riwayat Analisis</h1>
        <p>
          Displaying the results of histopathological image classification and
          segmentation that have been performed
        </p>
      </section>

      <section className="history-toolbar">
        <label className="history-search" htmlFor="history-search">
          <input
            id="history-search"
            type="search"
            placeholder="Search....."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </section>

      <section className="history-list" aria-label="Analysis history results">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <article className="history-card" key={item.id}>
              <div className="history-card-thumb-wrap">
                <div
                  className={`history-card-thumb history-thumb-${item.variant}`}
                  style={
                    item.originalImage
                      ? { backgroundImage: `url("${item.originalImage}")` }
                      : undefined
                  }
                  aria-hidden="true"
                />
              </div>

              <div className="history-card-content">
                <div className="history-card-topbar">
                  <strong className="history-card-name">
                    {renderHighlightedText(userFullname, query)}
                  </strong>
                </div>

                <div className="history-card-main">
                  <div className="history-card-row">
                    <span className="history-card-label">Prediction</span>
                    <span className="history-card-separator">:</span>
                    <strong className="history-card-value">
                      {renderHighlightedText(formatPredictionLabel(item.prediction), query)}
                    </strong>
                  </div>

                  <div className="history-card-row">
                    <span className="history-card-label">Confidence</span>
                    <span className="history-card-separator">:</span>
                    <strong className="history-card-value">
                      {renderHighlightedText(item.confidence, query)}
                    </strong>
                  </div>
                </div>

                <div className="history-card-meta">
                  <div className="history-card-meta-center">
                    <span className="history-card-model">
                      {renderHighlightedText(item.model, query)}
                    </span>
                    <span>{renderHighlightedText(formatDate(item.createdAt), query)}</span>
                  </div>
                  <div className="history-card-actions">
                    <button
                      type="button"
                      className="history-card-button history-card-button-delete"
                      onClick={() => handleDeleteClick(item.id)}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className="history-card-button"
                      aria-expanded={expandedId === item.id}
                      aria-controls={`history-detail-${item.id}`}
                      onClick={() => handleToggleDetail(item.id)}
                    >
                      {expandedId === item.id ? "Hide Details" : "More Details"}
                      <svg
                        className="history-card-button-icon"
                        aria-hidden="true"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M2.25 4.5L6 8.25L9.75 4.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {expandedId === item.id ? (
                <section
                  className="history-detail"
                  id={`history-detail-${item.id}`}
                  aria-label={`Detail for ${formatPredictionLabel(item.prediction)}`}
                >
                  <div className="history-detail-gallery">
                    <div className="history-detail-gallery-item">
                      <span>Original</span>
                      <div
                        className={`history-detail-gallery-thumb history-thumb-${item.variant}`}
                        style={
                          item.originalImage
                            ? { backgroundImage: `url("${item.originalImage}")` }
                            : undefined
                        }
                        aria-hidden="true"
                      />
                    </div>

                    <div className="history-detail-gallery-item">
                      <span>Heatmap</span>
                      <div
                        className={`history-detail-gallery-thumb history-detail-heatmap history-detail-heatmap-${item.variant}`}
                        style={
                          item.heatmapImage
                            ? { backgroundImage: `url("${item.heatmapImage}")` }
                            : undefined
                        }
                        aria-hidden="true"
                      />
                    </div>

                    <div className="history-detail-gallery-item">
                      <span>Overlay</span>
                      <div
                        className={`history-detail-gallery-thumb history-detail-overlay history-detail-overlay-${item.variant}`}
                        style={
                          item.overlayImage
                            ? { backgroundImage: `url("${item.overlayImage}")` }
                            : undefined
                        }
                        aria-hidden="true"
                      />
                    </div>
                  </div>

                  <div className="history-detail-description">
                    <span className="history-detail-description-label">Description :</span>
                    <p>{item.description}</p>
                  </div>
                </section>
              ) : null}
            </article>
          ))
        ) : (
          <div className="history-empty">
            <h2>History is Empty</h2>
            <p>Belum ada hasil analisis. Jalankan analisis terlebih dahulu.</p>
          </div>
        )}
      </section>

      {deleteTargetId !== null ? (
        <div className="history-delete-modal-overlay" onClick={() => setDeleteTargetId(null)}>
          <div
            className="history-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-delete-modal-title"
            aria-describedby="history-delete-modal-description"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="history-delete-modal-title" className="history-delete-modal-title">
              Delete this history?
            </h2>
            <p
              id="history-delete-modal-description"
              className="history-delete-modal-description"
            >
              This action will permanently remove the selected analysis history item.
            </p>
            <div className="history-delete-modal-actions">
              <button
                type="button"
                className="history-delete-modal-button history-delete-modal-button-secondary"
                onClick={() => setDeleteTargetId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="history-delete-modal-button history-delete-modal-button-primary"
                onClick={handleConfirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default HistoryPage;

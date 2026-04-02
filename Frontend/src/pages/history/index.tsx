import { useMemo, useState } from "react";

type HistoryItem = {
  id: number;
  prediction: string;
  confidence: string;
  date: string;
  model: string;
  description: string;
  variant: "lung" | "colon" | "breast";
};

const historyItems: HistoryItem[] = [
  {
    id: 1,
    prediction: "Lung Benign",
    confidence: "99.99%",
    date: "01 April 2026",
    model: "Classification",
    description:
      "The tissue pattern is dominated by benign pulmonary structures with relatively uniform nuclei, preserved tissue organization, and no obvious malignant infiltration. Cellular density appears stable across the observed area, while the nuclear morphology remains relatively consistent without aggressive pleomorphism. The heatmap and overlay views emphasize low-risk regions and distribute attention broadly rather than concentrating on suspicious focal lesions. This pattern supports a non-malignant interpretation and suggests that the model is identifying normal or reactive histological features instead of invasive disease. Overall, the result indicates a high-confidence benign classification with visual evidence that is consistent across the original image, activation map, and overlay comparison.",
    variant: "lung",
  },
  {
    id: 2,
    prediction: "Colon Benign",
    confidence: "99.99%",
    date: "29 March 2026",
    model: "Classification",
    description:
      "The colon sample shows organized glandular morphology with preserved structural boundaries and no destructive architectural change that would typically suggest malignant progression. Tissue arrangement remains relatively balanced, and there is no dominant region that visually indicates irregular invasion or severe disruption. The activation map remains focused on benign regions and aligns with areas that retain normal-looking glandular composition, suggesting that the model is responding to stable histopathological characteristics rather than abnormal tumor-associated patterns. When viewed together with the overlay representation, the highlighted areas remain coherent and support a consistent decision pathway. This produces a stable benign classification result with high confidence and reinforces the interpretation that the observed tissue is more compatible with non-malignant colon histology.",
    variant: "colon",
  },
  {
    id: 3,
    prediction: "Breast Malignant",
    confidence: "98.72%",
    date: "26 March 2026",
    model: "Segmentation",
    description:
      "The segmented regions highlight suspicious tissue distribution with irregular cell density, heterogeneous structure, and invasive boundaries that differ from surrounding areas. Several highlighted zones appear to cluster around the dominant lesion region, suggesting that the model is consistently detecting patterns associated with malignant behavior rather than isolated visual noise. The overlay indicates that these suspicious regions remain spatially coherent across the analyzed field, while the heatmap intensifies around areas with stronger abnormal morphological cues. Compared with a benign presentation, the tissue in this sample appears less organized and more structurally distorted, supporting the segmentation outcome. Taken together, the original image, heatmap, and overlay provide a stronger visual basis for identifying malignant tissue involvement and explain why the model returns a high-confidence abnormal result.",
    variant: "breast",
  },
];

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

function HistoryPage() {
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return historyItems;

    return historyItems.filter((item) =>
      [item.prediction, item.confidence, item.date, item.model]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [query]);

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
                  aria-hidden="true"
                />
              </div>

              <div className="history-card-content">
                <div className="history-card-main">
                  <div className="history-card-row">
                    <span className="history-card-label">Prediction</span>
                    <span className="history-card-separator">:</span>
                    <strong className="history-card-value">
                      {renderHighlightedText(item.prediction, query)}
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
                  <strong className="history-card-name">Dr.Poppy</strong>
                  <div className="history-card-meta-center">
                    <span className="history-card-model">
                      {renderHighlightedText(item.model, query)}
                    </span>
                    <span>{renderHighlightedText(item.date, query)}</span>
                  </div>
                  <button
                    type="button"
                    className="history-card-button"
                    aria-expanded={expandedId === item.id}
                    aria-controls={`history-detail-${item.id}`}
                    onClick={() =>
                      setExpandedId((current) => (current === item.id ? null : item.id))
                    }
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

              {expandedId === item.id ? (
                <section
                  className="history-detail"
                  id={`history-detail-${item.id}`}
                  aria-label={`Detail for ${item.prediction}`}
                >
                  <div className="history-detail-gallery">
                    <div className="history-detail-gallery-item">
                      <span>Original</span>
                      <div
                        className={`history-detail-gallery-thumb history-thumb-${item.variant}`}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="history-detail-gallery-item">
                      <span>Heatmap</span>
                      <div
                        className={`history-detail-gallery-thumb history-detail-heatmap history-detail-heatmap-${item.variant}`}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="history-detail-gallery-item">
                      <span>Overlay</span>
                      <div
                        className={`history-detail-gallery-thumb history-detail-overlay history-detail-overlay-${item.variant}`}
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
            <h2>No history found</h2>
            <p>Try another keyword to find previous analysis results.</p>
          </div>
        )}
      </section>
    </main>
  );
}

export default HistoryPage;

import React, { useEffect, useRef, useState } from "react";
import "../../assets/style.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";
const API_TARGET_LABEL = API_BASE_URL || "Vite proxy (/api -> 127.0.0.1:8000)";
const ANALYSIS_HISTORY_KEY = "lucit_analysis_history";
type ChatMessage = { role: "user" | "assistant"; text: string };

const AnalysisPage: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string>("");
  const [heatmapPreview, setHeatmapPreview] = useState<string>("");
  const [overlayPreview, setOverlayPreview] = useState<string>("");
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [modelType, setModelType] = useState<
    "none" | "classification" | "segmentation"
  >("none");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const [predictionResult, setPredictionResult] = useState<{
    status?: string;
    model_type?: string;
    // classification fields
    prediction?: string;
    confidence?: number;
    gradcam_heatmap?: string;
    gradcam_image?: string;
    ai_description?: string;
    warning?: string;
    // segmentation fields
    mask_image?: string;
    overlay_image?: string;
    area_stats?: {
      cancer_percent: number;
      normal_percent: number;
      cancer_pixels: number;
      total_pixels: number;
    };
    threshold?: number;
    // error
    error?: string;
    message?: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<{
    type: "info" | "error";
    text: string;
  } | null>(null);
  const [modelSelectAttention, setModelSelectAttention] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const noticeTimeoutRef = useRef<number | null>(null);
  const modelSelectTimeoutRef = useRef<number | null>(null);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedImage(file);
      setIsAnalyzed(false);
      setHeatmapPreview("");
      setOverlayPreview("");
      setPredictionResult(null);
      setError("");

      const reader = new FileReader();
      reader.onload = () => {
        setSelectedPreview((reader.result as string) || "");
      };
      reader.readAsDataURL(file);
    }
  };

  const showNotice = (type: "info" | "error", text: string) => {
    setNotice({ type, text });
    if (noticeTimeoutRef.current) {
      window.clearTimeout(noticeTimeoutRef.current);
    }
    noticeTimeoutRef.current = window.setTimeout(() => setNotice(null), 3200);
  };

  const triggerModelSelectAttention = () => {
    if (modelType !== "none") return;
    setModelSelectAttention(true);
    if (modelSelectTimeoutRef.current) {
      window.clearTimeout(modelSelectTimeoutRef.current);
    }
    modelSelectTimeoutRef.current = window.setTimeout(
      () => setModelSelectAttention(false),
      2000,
    );
  };

  const inferVariant = (
    prediction?: string,
  ): "lung" | "colon" | "breast" | "unknown" => {
    const text = (prediction || "").toLowerCase();
    if (text.includes("lung")) return "lung";
    if (text.includes("colon")) return "colon";
    if (text.includes("breast")) return "breast";
    return "unknown";
  };

  const saveAnalysisToHistory = (data: typeof predictionResult) => {
    if (!data) return;

    const isSegmentation = data.model_type === "segmentation";

    const confidenceValue = isSegmentation
      ? `Cancer area: ${data.area_stats?.cancer_percent ?? "N/A"}%`
      : typeof data.confidence === "number"
        ? `${(data.confidence * 100).toFixed(2)}%`
        : "N/A";

    const heatmapImage = data.gradcam_heatmap
      ? `data:image/jpeg;base64,${data.gradcam_heatmap}`
      : data.mask_image
        ? `data:image/jpeg;base64,${data.mask_image}`
        : "";

    const overlayImage = data.gradcam_image
      ? `data:image/jpeg;base64,${data.gradcam_image}`
      : data.overlay_image
        ? `data:image/jpeg;base64,${data.overlay_image}`
        : "";

    const predictionLabel = isSegmentation
      ? `Cancer: ${data.area_stats?.cancer_percent ?? "N/A"}% | Normal: ${data.area_stats?.normal_percent ?? "N/A"}%`
      : data.prediction || "Unknown";

    const entry = {
      id: Date.now(),
      prediction: predictionLabel,
      confidence: confidenceValue,
      createdAt: new Date().toISOString(),
      model: isSegmentation ? "Segmentation" : "Classification",
      description: data.ai_description || "No AI description available.",
      variant: inferVariant(data.prediction),
      originalImage: selectedPreview,
      heatmapImage,
      overlayImage,
    };

    try {
      const raw = localStorage.getItem(ANALYSIS_HISTORY_KEY);
      const prev = raw ? JSON.parse(raw) : [];
      const safePrev = Array.isArray(prev) ? prev : [];
      localStorage.setItem(
        ANALYSIS_HISTORY_KEY,
        JSON.stringify([entry, ...safePrev].slice(0, 100)),
      );
    } catch (storageError) {
      console.error("Failed to save history:", storageError);
    }
  };

  const getDescriptionText = () => {
    // Segmentation: buat deskripsi dari area_stats
    if (predictionResult?.model_type === "segmentation") {
      const stats = predictionResult.area_stats;
      if (stats) {
        const level =
          stats.cancer_percent > 50
            ? "more than half"
            : stats.cancer_percent > 25
              ? "a significant portion"
              : "a minor portion";
        return (
          `The segmentation model identified cancerous regions covering approximately ${stats.cancer_percent}% ` +
          `of the tissue area (${stats.cancer_pixels.toLocaleString()} out of ${stats.total_pixels.toLocaleString()} pixels). ` +
          `This means ${level} of the analyzed tissue shows characteristics associated with malignancy. ` +
          `The remaining ${stats.normal_percent}% of tissue appears normal based on the model output. ` +
          `The red overlay in the segmentation image highlights the areas flagged as cancerous. ` +
          `This result is intended as decision-support only and should be reviewed by a qualified pathologist ` +
          `alongside clinical findings before any diagnostic conclusion is made.`
        );
      }
      return "Segmentation analysis complete. Please review the mask and overlay images above.";
    }

    // Classification: gunakan ai_description dari backend atau fallback
    const text = (predictionResult?.ai_description || "").trim();
    if (text) return text;

    const prediction = predictionResult?.prediction || "Unknown";
    const confidence = predictionResult?.confidence;
    const confidenceText =
      typeof confidence === "number"
        ? `${(confidence * 100).toFixed(2)}%`
        : "N/A";
    const predictionLower = prediction.toLowerCase();
    const riskPhrase =
      predictionLower.includes("aca") ||
      predictionLower.includes("scc") ||
      predictionLower.includes("malignant")
        ? "higher-risk malignant pattern"
        : predictionLower.includes("benign")
          ? "lower-risk benign pattern"
          : "non-specific pattern";

    return (
      `Based on the model output, this sample is classified as ${prediction} with an estimated confidence of ${confidenceText}. ` +
      `The extracted visual features are more consistent with a ${riskPhrase} compared with other classes in this model. ` +
      "Although confidence is high, it does not represent absolute diagnostic certainty because prediction quality can be affected by slide preparation, staining variation, and scanner artifacts. " +
      "This AI result should be interpreted as clinical decision-support and not as a standalone diagnosis. " +
      "A final conclusion should combine pathology review, clinical correlation, and additional supporting examinations by a qualified specialist."
    );
  };

  const sendImageToBackend = async (file: File) => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("model_type", modelType);

    try {
      setIsLoading(true);
      setError("");

      const response = await fetch(`${API_BASE_URL}/api/predict`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || data.status === "error") {
        throw new Error(data.message || data.error || "Analysis failed");
      }

      setPredictionResult(data);

      if (data.model_type === "segmentation") {
        // Segmentasi: pakai mask_image dan overlay_image
        if (data.mask_image) {
          setHeatmapPreview(`data:image/jpeg;base64,${data.mask_image}`);
        }
        if (data.overlay_image) {
          setOverlayPreview(`data:image/jpeg;base64,${data.overlay_image}`);
        }
      } else {
        // Klasifikasi: pakai gradcam_heatmap dan gradcam_image
        if (data.gradcam_heatmap) {
          setHeatmapPreview(`data:image/jpeg;base64,${data.gradcam_heatmap}`);
        }
        if (data.gradcam_image) {
          setOverlayPreview(`data:image/jpeg;base64,${data.gradcam_image}`);
        }
      }

      saveAnalysisToHistory(data);
      setIsAnalyzed(true);
    } catch (error) {
      console.error("Error uploading image:", error);
      const errorMessage =
        error instanceof TypeError
          ? `Cannot reach backend at ${API_TARGET_LABEL}. Make sure the backend server is running and CORS/network settings are correct.`
          : error instanceof Error
            ? error.message
            : "Error analyzing image";
      setError(errorMessage);
      showNotice("error", `Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartAnalysis = async () => {
    const savedUser = localStorage.getItem("lucit_user");
    if (!savedUser) {
      showNotice("info", "Please sign in first before starting detection.");
      window.dispatchEvent(new Event("lucit:open-login"));
      return;
    }

    if (!selectedImage || !selectedPreview || modelType === "none") {
      showNotice("info", "Please select a model and upload an image first.");
      triggerModelSelectAttention();
      return;
    }

    await sendImageToBackend(selectedImage);
  };

  const handleReset = () => {
    setSelectedImage(null);
    setSelectedPreview("");
    setHeatmapPreview("");
    setOverlayPreview("");
    setIsAnalyzed(false);
    setPredictionResult(null);
    setError("");
    setModelType("none");
    setNotice(null);
    setChatOpen(false);
    setChatInput("");
    setChatMessages([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (modelType !== "none") {
      setModelSelectAttention(false);
    }
  }, [modelType]);

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) {
        window.clearTimeout(noticeTimeoutRef.current);
      }
      if (modelSelectTimeoutRef.current) {
        window.clearTimeout(modelSelectTimeoutRef.current);
      }
    };
  }, []);

  const handleSendChat = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isChatLoading) return;

    const message = chatInput.trim();
    if (!message) return;

    const historyForRequest = [
      ...chatMessages,
      { role: "user", text: message },
    ];
    setChatMessages(historyForRequest);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          analysis_context: {
            model_type: modelType,
            prediction: predictionResult?.prediction,
            confidence: predictionResult?.confidence,
            ai_description: predictionResult?.ai_description,
            warning: predictionResult?.warning,
            // Tambahan context segmentasi untuk chatbot
            area_stats: predictionResult?.area_stats,
          },
          chat_history: chatMessages,
        }),
      });

      const rawText = await response.text();
      let result: { status?: string; reply?: string; message?: string } = {};
      try {
        result = rawText ? JSON.parse(rawText) : {};
      } catch {
        result = {
          status: "error",
          message: rawText || "Invalid server response",
        };
      }

      const assistantText =
        response.ok && result.status === "success"
          ? result.reply ||
            "Maaf, saya tidak dapat menghasilkan jawaban saat ini."
          : result.message || "Chatbot sedang tidak tersedia untuk sementara.";

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: assistantText },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Chatbot sedang tidak tersedia untuk sementara.",
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // ── Label dinamis untuk panel visual ──────────────────────────
  const isSegmentation = predictionResult?.model_type === "segmentation";
  const heatmapLabel = isSegmentation ? "Binary Mask" : "Grad-CAM Heatmap";
  const overlayLabel = isSegmentation
    ? "Overlay (Red=Cancer)"
    : "Grad-CAM Overlay";
  const heatmapEmpty = isSegmentation
    ? "Mask not available"
    : "Heatmap not available";
  const overlayEmpty = isSegmentation
    ? "Overlay not available"
    : "Overlay not available";

  return (
    <div className={`analysis-container ${chatOpen ? "chat-open" : ""}`}>
      <div className="analysis-stack">
        <div className="analysis-hero">
          <h1>AI Histopathology Analysis</h1>
          <p className="analysis-hero-subtitle">
            Select a model, upload a histopathology image, and review clear
            AI‑assisted insights for classification or segmentation.
          </p>
        </div>

        {notice && (
          <div className={`notice notice-top ${notice.type}`}>
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        )}

        <div className="analysis-card">
          <div className="card-left">
            <h2 className="upload-title">
              {modelType === "classification"
                ? "Upload image histopathology for classification"
                : modelType === "segmentation"
                  ? "Upload image histopathology for segmentation"
                  : "Upload image histopathology"}
            </h2>

            <div className="upload-box">
              <input
                type="file"
                id="file-upload"
                accept="image/*"
                onChange={handleImageChange}
                ref={fileInputRef}
                disabled={modelType === "none"}
                hidden
              />
              <label
                htmlFor="file-upload"
                className={`upload-label ${modelType === "none" ? "disabled" : ""}`}
                onClick={(event) => {
                  if (modelType === "none") {
                    event.preventDefault();
                    showNotice("info", "Please select a model first.");
                    triggerModelSelectAttention();
                  }
                }}
              >
                <div className="folder-icon">
                  <svg
                    width="80"
                    height="80"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  </svg>
                </div>
              </label>

              <div
                className={`model-select ${modelSelectAttention ? "attention" : ""}`}
              >
                <select
                  id="model-type"
                  className="model-dropdown"
                  value={modelType}
                  onChange={(event) =>
                    setModelType(
                      event.target.value as
                        | "none"
                        | "classification"
                        | "segmentation",
                    )
                  }
                  disabled={isAnalyzed}
                >
                  <option value="none">Select Model</option>
                  <option value="classification">Classification</option>
                  <option value="segmentation">Segmentation</option>
                </select>
              </div>
            </div>

            {selectedPreview && !isAnalyzed && (
              <div style={{ marginTop: "1rem" }}>
                <img
                  src={selectedPreview}
                  alt="Selected preview"
                  className="selected-preview-image"
                />
              </div>
            )}

            <button
              className="primary-btn start-analysis-btn"
              onClick={handleStartAnalysis}
              disabled={!selectedImage || modelType === "none" || isLoading}
              style={{
                opacity:
                  !selectedImage || modelType === "none" || isLoading ? 0.6 : 1,
                cursor:
                  !selectedImage || modelType === "none" || isLoading
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {isLoading ? "Analyzing..." : "Start Analysis"}
            </button>

            {isAnalyzed && (
              <button
                className="primary-btn"
                onClick={handleReset}
                style={{
                  marginTop: "1rem",
                  backgroundColor: "#6c757d",
                }}
              >
                Analyze Another Image
              </button>
            )}

            {selectedImage && !isAnalyzed && (
              <p
                style={{ marginTop: "1rem", color: "#666", fontSize: "0.9rem" }}
              >
                File selected: <strong>{selectedImage.name}</strong>
              </p>
            )}

            {error && (
              <div
                className="analysis-error-panel"
                style={{
                  marginTop: "1rem",
                }}
              >
                <strong>Error:</strong> {error}
              </div>
            )}
          </div>

          <div className="card-right">
            {isLoading ? (
              <div className="analysis-loading">
                <div className="analysis-loading-spinner" aria-hidden="true" />
                <div className="analysis-loading-text">Analyzing image...</div>
              </div>
            ) : isAnalyzed && modelType !== "none" && predictionResult ? (
              <div className="analysis-result">
                <div className="result-summary-card">
                  <div className="result-metrics">
                    <h3 style={{ marginBottom: "0.5rem" }}>Analysis Results</h3>
                    <div className="metrics-center">
                      {isSegmentation ? (
                        // ── Segmentasi: tampilkan area stats ──
                        <>
                          <p>
                            <span className="metric-label">Cancer Area:</span>
                            <span
                              className="metric-value"
                              style={{ color: "#ff6b6b" }}
                            >
                              {predictionResult.area_stats?.cancer_percent ??
                                "N/A"}
                              %
                            </span>
                          </p>
                          <p>
                            <span className="metric-label">Normal Area:</span>
                            <span
                              className="metric-value"
                              style={{ color: "#ffffff" }}
                            >
                              {predictionResult.area_stats?.normal_percent ??
                                "N/A"}
                              %
                            </span>
                          </p>
                        </>
                      ) : (
                        // ── Klasifikasi: tampilkan prediction & confidence ──
                        <>
                          <p>
                            <span className="metric-label">Prediction:</span>
                            <span
                              className="metric-value"
                              style={{ color: "#ffffff" }}
                            >
                              {predictionResult?.prediction || "N/A"}
                            </span>
                          </p>
                          <p>
                            <span className="metric-label">Confidence:</span>
                            <span className="metric-value">
                              {predictionResult?.confidence
                                ? `${(predictionResult.confidence * 100).toFixed(2)}%`
                                : "N/A"}
                            </span>
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="result-visuals">
                    <div className="result-visual-card">
                      <div className="result-visual-title">Original Image</div>
                      {selectedPreview ? (
                        <img
                          src={selectedPreview}
                          alt="Original"
                          className="result-visual-image"
                        />
                      ) : (
                        <div className="result-visual-empty">No image</div>
                      )}
                    </div>

                    <div className="result-visual-card">
                      <div className="result-visual-title">{heatmapLabel}</div>
                      {heatmapPreview ? (
                        <img
                          src={heatmapPreview}
                          alt={heatmapLabel}
                          className="result-visual-image"
                        />
                      ) : (
                        <div className="result-visual-empty">
                          {heatmapEmpty}
                        </div>
                      )}
                    </div>

                    <div className="result-visual-card">
                      <div className="result-visual-title">{overlayLabel}</div>
                      {overlayPreview ? (
                        <img
                          src={overlayPreview}
                          alt={overlayLabel}
                          className="result-visual-image"
                        />
                      ) : (
                        <div className="result-visual-empty">
                          {overlayEmpty}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <h2>How It Works</h2>

                <div className="steps-list">
                  <div className="step-item">
                    <h3>1. Upload Image</h3>
                    <p>Upload histopathology image of lung or colon tissue.</p>
                  </div>

                  <div className="step-item">
                    <h3>2. AI Analysis</h3>
                    <p>
                      AI performs classification to identify tissue categories
                      and uses Grad-CAM visualization to highlight regions of
                      interest that influenced the prediction.
                    </p>
                  </div>

                  <div className="step-item">
                    <h3>3. Result</h3>
                    <p>
                      Prediction results, Grad-CAM visualization, and
                      AI-generated medical description are displayed to support
                      early detection, not as a medical diagnosis.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {isAnalyzed && modelType !== "none" && predictionResult && (
          <button
            type="button"
            className="chatbot-trigger animate-in"
            onClick={() => setChatOpen(true)}
            aria-label="Open consultation chatbot"
            style={{ display: chatOpen ? "none" : "grid" }}
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
            </svg>
          </button>
        )}

        {isAnalyzed && modelType !== "none" && predictionResult && (
          <div className="analysis-description-card">
            <h3>
              AI Analysis Description for{" "}
              {modelType === "classification"
                ? "Classification"
                : "Segmentation"}
              :
            </h3>

            <div className="analysis-description-text">
              {getDescriptionText()}
            </div>

            <div className="analysis-disclaimer">
              <strong>⚠️ Disclaimer:</strong> This analysis is for research and
              educational purposes only. It should not be used as a substitute
              for professional medical diagnosis or treatment.
            </div>
          </div>
        )}
      </div>

      <div className={`chatbot-sidebar ${chatOpen ? "open" : ""}`}>
        <div className="chatbot-header">
          <div>AI Consultation Chat</div>
          <button
            type="button"
            className="chatbot-close"
            onClick={() => setChatOpen(false)}
            aria-label="Close consultation chatbot"
          >
            ×
          </button>
        </div>

        <div className="chatbot-messages">
          {chatMessages.length === 0 ? (
            <div className="chatbot-empty">
              Discuss the analysis results for{" "}
              {modelType === "classification"
                ? "classification"
                : "segmentation"}{" "}
              with the AI assistant.
            </div>
          ) : (
            <>
              {chatMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`chatbot-message ${message.role}`}
                >
                  <p>{message.text}</p>
                </div>
              ))}
              {isChatLoading ? (
                <div
                  className="chatbot-message assistant loading"
                  aria-live="polite"
                >
                  <div
                    className="chatbot-typing"
                    aria-label="Assistant is typing"
                  >
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <form className="chatbot-input" onSubmit={handleSendChat}>
          <input
            type="text"
            placeholder={
              isChatLoading
                ? "Waiting for assistant response..."
                : "Type your question..."
            }
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            disabled={isChatLoading}
          />
          <button type="submit" disabled={isChatLoading}>
            {isChatLoading ? "Sending..." : "Send"}
          </button>
        </form>
      </div>

      {chatOpen && (
        <div
          className="chatbot-backdrop"
          aria-hidden="true"
          onClick={() => setChatOpen(false)}
        />
      )}
    </div>
  );
};

export default AnalysisPage;

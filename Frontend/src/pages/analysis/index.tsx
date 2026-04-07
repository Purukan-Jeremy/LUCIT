import React, { useEffect, useRef, useState } from "react";
import "../../assets/style.css";
<<<<<<< Updated upstream
=======
import { hasActiveSession } from "../../utils/session";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";
const API_TARGET_LABEL = API_BASE_URL || "Vite proxy (/api -> 127.0.0.1:8000)";
const ANALYSIS_HISTORY_KEY = "lucit_analysis_history";
type ChatMessage = { role: "user" | "assistant"; text: string };

async function parseApiBody(response: Response) {
  const rawText = await response.text();
  if (!rawText) return {};

  try {
    return JSON.parse(rawText);
  } catch {
    return { error: rawText.slice(0, 240) };
  }
}

function formatPredictionLabel(prediction?: string) {
  switch ((prediction || "").trim()) {
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
      return prediction || "Unknown";
  }
}
>>>>>>> Stashed changes

const AnalysisPage: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string>("");
  const [resultPreview, setResultPreview] = useState<string>("");
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [modelType, setModelType] = useState<
    "none" | "classification" | "segmentation"
  >("none");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([]);

  const [predictionResult, setPredictionResult] = useState<{
    status?: string;
    prediction?: string;
    confidence?: number;
    gradcam_image?: string;
    segmentation_mask?: string;
    ai_description?: string;
    error?: string;
    message?: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<{ type: "info" | "error"; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedImage(file);
      setIsAnalyzed(false);
      setResultPreview("");
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
    window.clearTimeout((showNotice as any)._t);
    (showNotice as any)._t = window.setTimeout(() => setNotice(null), 3200);
  };

  const sendImageToBackend = async (file: File) => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("model_type", modelType);

    try {
      setIsLoading(true);
      setError("");

      const response = await fetch("http://localhost:8000/api/predict", {
        method: "POST",
        body: formData,
      });

      const data = await parseApiBody(response);

      if (!response.ok || data.status === "error") {
        throw new Error(data.message || data.error || "Analysis failed");
      }

      setPredictionResult(data);

      if (data.gradcam_image) {
        setResultPreview(`data:image/jpeg;base64,${data.gradcam_image}`);
      } else if (data.segmentation_mask) {
        setResultPreview(`data:image/png;base64,${data.segmentation_mask}`);
      }

      setIsAnalyzed(true);
    } catch (error) {
      console.error("Error uploading image:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Error analyzing image";
      setError(errorMessage);
      showNotice("error", `Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!selectedImage || !selectedPreview || modelType === "none") {
      showNotice("info", "Please select a model and upload an image first.");
      return;
    }

    await sendImageToBackend(selectedImage);
  };

  const handleReset = () => {
    setSelectedImage(null);
    setSelectedPreview("");
    setResultPreview("");
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

  const handleSendChat = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message) return;

    setChatMessages((prev) => [
      ...prev,
      { role: "user", text: message },
      {
        role: "assistant",
        text: "LLM is not connected yet. This is UI only.",
      },
    ]);
    setChatInput("");
  };

  useEffect(() => {
    if (!chatOpen) {
      document.body.classList.remove("chat-lock");
    }
  }, [chatOpen]);

  const handleChatMouseEnter = () => {
    document.body.classList.add("chat-lock");
  };

  const handleChatMouseLeave = () => {
    document.body.classList.remove("chat-lock");
  };

  return (
    <div className={`analysis-container ${chatOpen ? "chat-open" : ""}`}>
      <div className="analysis-stack">
        <div className="analysis-hero">
          <h1>AI Histopathology Analysis</h1>
          <p className="analysis-hero-subtitle">
            Select a model, upload a histopathology image, and review clear AI‑assisted
            insights for classification or segmentation.
          </p>
        </div>

        {notice && (
          <div className={`notice notice-top ${notice.type}`}>
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Close notification">
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

            <div className="model-select">
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
                style={{
                  width: "100%",
                  maxHeight: "200px",
                  objectFit: "contain",
                  borderRadius: "8px",
                  border: "2px solid #ddd",
                }}
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
            <p style={{ marginTop: "1rem", color: "#666", fontSize: "0.9rem" }}>
              File selected: <strong>{selectedImage.name}</strong>
            </p>
          )}

          {error && (
            <div
              style={{
                marginTop: "1rem",
                padding: "1rem",
                backgroundColor: "#f8d7da",
                color: "#721c24",
                borderRadius: "8px",
                fontSize: "0.9rem",
              }}
            >
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>

          <div className="card-right">
            {isAnalyzed && modelType !== "none" && predictionResult ? (
              <div className="analysis-result">
                <div className="result-summary-card">
                  <div className="result-preview">
                    {resultPreview ? (
                      <img
                        src={resultPreview}
                        alt="Analysis result"
                        className="result-preview-image"
                        style={{
                          width: "100%",
                          height: "auto",
                          borderRadius: "8px",
                        }}
                      />
                    ) : (
                      <p>No visualization available</p>
                    )}
                  </div>

                  <div className="result-metrics">
                    <h3 style={{ marginBottom: "0.5rem" }}>Analysis Results</h3>
                    <p>
                      <strong>Prediction:</strong>{" "}
                      <span
                        style={{
                          color: predictionResult?.prediction?.includes("Benign")
                            ? "#28a745"
                            : "#dc3545",
                          fontWeight: "bold",
                        }}
                      >
                        {predictionResult?.prediction || "N/A"}
                      </span>
                    </p>
                    <p>
                      <strong>Confidence:</strong>{" "}
                      {predictionResult?.confidence
                        ? `${(predictionResult.confidence * 100).toFixed(2)}%`
                        : "N/A"}
                    </p>
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
                      AI performs classification to identify tissue categories and
                      uses Grad-CAM visualization to highlight regions of interest
                      that influenced the prediction.
                    </p>
                  </div>

                  <div className="step-item">
                    <h3>3. Result</h3>
                    <p>
                      Prediction results, Grad-CAM visualization, and AI-generated
                      medical description are displayed to support early
                      detection, not as a medical diagnosis.
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
              {modelType === "classification" ? "Classification" : "Segmentation"}
              :
            </h3>

            <div className="analysis-description-text">
              {predictionResult?.ai_description ||
                "AI description is being generated..."}
            </div>

            <div className="analysis-disclaimer">
              <strong>⚠️ Disclaimer:</strong> This analysis is for research and
              educational purposes only. It should not be used as a substitute
              for professional medical diagnosis or treatment.
            </div>
          </div>
        )}
      </div>

      <div
        className={`chatbot-sidebar ${chatOpen ? "open" : ""}`}
        onMouseEnter={handleChatMouseEnter}
        onMouseLeave={handleChatMouseLeave}
      >
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
              {modelType === "classification" ? "classification" : "segmentation"}{" "}
              with the AI assistant.
            </div>
          ) : (
            chatMessages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`chatbot-message ${message.role}`}
              >
                <p>{message.text}</p>
              </div>
            ))
          )}
        </div>

        <form className="chatbot-input" onSubmit={handleSendChat}>
          <input
            type="text"
            placeholder="Type your question..."
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
          />
          <button type="submit">Send</button>
        </form>
      </div>

      {chatOpen && (
        <div className="chatbot-backdrop" aria-hidden="true" />
      )}
    </div>
  );
};

export default AnalysisPage;

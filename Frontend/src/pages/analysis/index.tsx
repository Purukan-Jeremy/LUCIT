import React, { useRef, useState } from "react";
import "../../assets/style.css";

const AnalysisPage: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string>("");
  const [resultPreview, setResultPreview] = useState<string>("");
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [modelType, setModelType] = useState<
    "none" | "classification" | "segmentation"
  >("none");

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

      const data = await response.json();

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
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!selectedImage || !selectedPreview || modelType === "none") {
      alert("Please select an image and model type");
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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="analysis-container">
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
              hidden
            />
            <label htmlFor="file-upload" className="upload-label">
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

              <div className="result-description-card">
                <h3>AI Analysis Description:</h3>

                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    lineHeight: "1.8",
                    textAlign: "justify",
                    color: "rgba(255, 255, 255, 0.95)",
                  }}
                >
                  {predictionResult?.ai_description ||
                    "AI description is being generated..."}
                </div>

                <div
                  style={{
                    marginTop: "1rem",
                    padding: "0.75rem",
                    backgroundColor: "#fff3cd",
                    color: "#000",
                    borderLeft: "4px solid #ffc107",
                    borderRadius: "4px",
                  }}
                >
                  <strong>⚠️ Disclaimer:</strong> This analysis is for research
                  and educational purposes only. It should not be used as a
                  substitute for professional medical diagnosis or treatment.
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
    </div>
  );
};

export default AnalysisPage;

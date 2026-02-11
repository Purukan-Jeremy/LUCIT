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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedImage(file);
      setIsAnalyzed(false);
      setResultPreview("");

      const reader = new FileReader();
      reader.onload = () => {
        setSelectedPreview((reader.result as string) || "");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartAnalysis = () => {
    if (!selectedImage || !selectedPreview || modelType !== "classification")
      return;
    setResultPreview(selectedPreview);
    setIsAnalyzed(true);
    setSelectedImage(null);
    setSelectedPreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="analysis-container">
      <div className="analysis-card">
        {/* BAGIAN KIRI (UPLOAD) */}
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
              >
                <option value="none">Select Model</option>
                <option value="classification">Classification</option>
                <option value="segmentation">Segmentation</option>
              </select>
            </div>
          </div>

          <button
            className="primary-btn start-analysis-btn"
            onClick={handleStartAnalysis}
            disabled={!selectedImage || modelType !== "classification"}
          >
            Start Analysis
          </button>

          {selectedImage && (
            <p style={{ marginTop: "1rem", color: "#666", fontSize: "0.9rem" }}>
              File selected: <strong>{selectedImage.name}</strong>
            </p>
          )}

          {modelType === "segmentation" && (
            <p style={{ color: "#666", fontSize: "0.9rem" }}>
              Dummy result saat ini hanya untuk model classification.
            </p>
          )}
        </div>

        {/* BAGIAN KANAN (HOW IT WORKS) */}
        <div className="card-right">
          {isAnalyzed && modelType === "classification" ? (
            <div className="analysis-result">
              <div className="result-summary-card">
                <div className="result-preview">
                  {resultPreview && (
                    <img
                      src={resultPreview}
                      alt="Uploaded histopathology preview"
                      className="result-preview-image"
                    />
                  )}
                </div>

                <div className="result-metrics">
                  <p>Prediction: Lorem ipsum</p>
                  <p>Confidence: 98.2%</p>
                </div>
              </div>

              <div className="result-description-card">
                <h3>Description :</h3>
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed
                  do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                  Ut enim ad minim veniam, quis nostrud exercitation ullamco
                  laboris nisi ut aliquip ex ea commodo consequat. Duis aute
                  irure dolor in reprehenderit in voluptate velit esse cillum
                  dolore eu fugiat nulla pariatur.
                </p>
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
                    segmentation to highlight potential abnormal regions.
                  </p>
                </div>

                <div className="step-item">
                  <h3>3. Result</h3>
                  <p>
                    Prediction results and segmentation outputs are displayed to
                    support early detection, not as a medical diagnosis.
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

import React, { useState } from "react";
import "../../assets/style.css";

const AnalysisPage: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [modelType, setModelType] = useState<
    "none" | "classification" | "segmentation"
  >("none");

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedImage(event.target.files[0]);
    }
  };

  return (
    <div className="analysis-container">
      <div className="analysis-card">
        {/* BAGIAN KIRI (PINK) */}
        <div className="card-left">
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
        </div>

        {/* BAGIAN KANAN (UPLOAD) */}
        <div className="card-right">
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

          <button className="primary-btn start-analysis-btn">
            Start Analysis
          </button>

          {selectedImage && (
            <p style={{ marginTop: "1rem", color: "#666", fontSize: "0.9rem" }}>
              File selected: <strong>{selectedImage.name}</strong>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisPage;

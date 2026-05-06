import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import "../../assets/style.css";
import { hasActiveSession } from "../../utils/session";
import { getApiUrl } from "../../utils/api";
const ANALYSIS_HISTORY_KEY = "lucit_analysis_history";
type ChatMessage = { role: "user" | "assistant"; text: string };

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

const AnalysisPage: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string>("");
  const [heatmapPreview, setHeatmapPreview] = useState<string>("");
  const [overlayPreview, setOverlayPreview] = useState<string>("");
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [modelType, setModelType] = useState<
    "none" | "classification" | "segmentation"
  >("none");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [predictionResult, setPredictionResult] = useState<{
    status?: string;
    model_type?: string;
    prediction?: string;
    confidence?: number;
    gradcam_heatmap?: string;
    gradcam_image?: string;
    ai_description?: string;
    warning?: string;
    mask_image?: string;
    overlay_image?: string;
    segmentation_mask?: string;
    area_stats?: {
      cancer_percent?: number;
      normal_percent?: number;
      cancer_pixels?: number;
      total_pixels?: number;
      cancer_area?: number;
      total_area?: number;
    };
    error?: string;
    message?: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [, setError] = useState<string>("");
  const [notice, setNotice] = useState<{
    type: "info" | "error";
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const dashboardMainRef = useRef<HTMLElement | null>(null);
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);
  const markdownContentRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  useEffect(() => {
    if (chatOpen && isAnalyzed && chatMessages.length === 0) {
      setChatMessages([
        {
          role: "assistant",
          text: "How can i help you with the analysis results? You can ask me to explain the diagnosis, confidence level, or any specific features in the image.",
        },
      ]);
    }
  }, [chatOpen, isAnalyzed, chatMessages.length]);

  // Enable mouse wheel + touchpad scrolling on dashboard-main
  useEffect(() => {
    const el = dashboardMainRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Check if the scroll is happening inside a scrollable child element
      const target = e.target as HTMLElement;
      const isInsideScrollable = target.closest('.markdown-content, .chatbot-messages, .description-widget');
      
      // If inside a scrollable child, let it handle its own scroll
      if (isInsideScrollable) {
        e.stopPropagation();
        return;
      }
      
      const { scrollTop, scrollHeight, clientHeight } = el;
      const atTop = scrollTop === 0 && e.deltaY < 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight && e.deltaY > 0;
      if (!atTop && !atBottom) {
        e.preventDefault();
      }
      el.scrollTop += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Enable mouse wheel scrolling on markdown content
  useEffect(() => {
    const el = markdownContentRef.current;
    if (!el) return;
    
    const onWheel = (e: WheelEvent) => {
      e.stopPropagation(); // Stop event from bubbling to parent
      
      const { scrollTop, scrollHeight, clientHeight } = el;
      const atTop = scrollTop === 0 && e.deltaY < 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight && e.deltaY > 0;
      
      // Only prevent default if we're not at the boundaries
      if (!atTop && !atBottom) {
        e.preventDefault();
        el.scrollTop += e.deltaY;
      } else if (!atTop || !atBottom) {
        // We're at a boundary but can still scroll in one direction
        e.preventDefault();
        el.scrollTop += e.deltaY;
      }
    };
    
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [predictionResult]);

  // Enable mouse wheel + touchpad scrolling on chatbot messages
  useEffect(() => {
    const el = chatMessagesRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const atTop = scrollTop === 0 && e.deltaY < 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight && e.deltaY > 0;
      if (!atTop && !atBottom) {
        e.preventDefault();
      }
      el.scrollTop += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [chatOpen]);

  const processImage = (file: File, type: string) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const size = type === "segmentation" ? 256 : 224;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, size, size);
          setSelectedPreview(canvas.toDataURL("image/jpeg", 0.95));
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedImage(file);
      setIsAnalyzed(false);
      setHeatmapPreview("");
      setOverlayPreview("");
      setPredictionResult(null);
      setError("");
      processImage(file, modelType);
    }
  };

  useEffect(() => {
    if (selectedImage && !isAnalyzed) {
      processImage(selectedImage, modelType);
    }
  }, [modelType, selectedImage, isAnalyzed]);

  const showNotice = (type: "info" | "error", text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 3500);
  };

  const saveAnalysisToHistory = (data: any) => {
    if (!data) return;
    const isSegmentation = data.model_type === "segmentation";
    const cancerPercent = data.area_stats?.cancer_percent ?? "N/A";
    const confidenceValue = isSegmentation
      ? `Cancer: ${cancerPercent}%`
      : `${(data.confidence * 100).toFixed(2)}%`;
    const entry = {
      id: Date.now(),
      prediction: isSegmentation
        ? `Segmentation: ${cancerPercent}% Cancer`
        : formatPredictionLabel(data.prediction),
      confidence: confidenceValue,
      createdAt: new Date().toISOString(),
      model: isSegmentation ? "Segmentation" : "Classification",
      description: data.ai_description || "No description.",
      originalImage: selectedPreview,
      heatmapImage: data.gradcam_heatmap
        ? `data:image/jpeg;base64,${data.gradcam_heatmap}`
        : data.segmentation_mask
          ? `data:image/png;base64,${data.segmentation_mask}`
          : "",
      overlayImage: data.gradcam_image
        ? `data:image/jpeg;base64,${data.gradcam_image}`
        : data.overlay_image
          ? `data:image/jpeg;base64,${data.overlay_image}`
          : "",
    };
    try {
      const raw = localStorage.getItem(ANALYSIS_HISTORY_KEY);
      const prev = raw ? JSON.parse(raw) : [];
      localStorage.setItem(
        ANALYSIS_HISTORY_KEY,
        JSON.stringify([entry, ...prev].slice(0, 50)),
      );
    } catch (e) {
      console.error(e);
    }
  };

  const sendImageToBackend = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("model_type", modelType);
    formData.append(
      "model_name",
      selectedModel || (modelType === "classification" ? "efficientnetb3" : "unet"),
    );
    try {
      setIsLoading(true);
      const res = await fetch(getApiUrl("/api/predict"), {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data.status === "error")
        throw new Error(data.message || "Failed");
      setPredictionResult(data);
      if (data.model_type === "segmentation") {
        setHeatmapPreview(
          data.mask_image
            ? `data:image/png;base64,${data.mask_image}`
            : `data:image/png;base64,${data.segmentation_mask}`,
        );
        setOverlayPreview(
          data.overlay_image
            ? `data:image/jpeg;base64,${data.overlay_image}`
            : `data:image/jpeg;base64,${data.gradcam_image}`,
        );
      } else {
        setHeatmapPreview(
          data.gradcam_heatmap
            ? `data:image/jpeg;base64,${data.gradcam_heatmap}`
            : "",
        );
        setOverlayPreview(
          data.gradcam_image
            ? `data:image/jpeg;base64,${data.gradcam_image}`
            : "",
        );
      }
      saveAnalysisToHistory(data);
      setIsAnalyzed(true);
    } catch (err: any) {
      setError(err.message);
      showNotice("error", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!hasActiveSession()) {
      showNotice("info", "Sign in required.");
      window.dispatchEvent(new Event("lucit:open-login"));
      return;
    }
    if (modelType === "none") {
      showNotice("info", "Please select a model first.");
      return;
    }
    if (!selectedImage) {
      showNotice("info", "Please upload a histopathology image.");
      return;
    }
    await sendImageToBackend(selectedImage);
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isChatLoading || !chatInput.trim()) return;
    const msg = chatInput.trim();
    const newMsgs = [...chatMessages, { role: "user" as const, text: msg }];
    setChatMessages(newMsgs);
    setChatInput("");
    setIsChatLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          analysis_context: {
            model_type: modelType,
            prediction: predictionResult?.prediction,
            confidence: predictionResult?.confidence,
            ai_description: predictionResult?.ai_description,
            area_stats: predictionResult?.area_stats,
          },
          chat_history: chatMessages,
        }),
      });
      const data = await res.json();
      const reply =
        data.status === "success" ? data.reply : "Error connecting to AI.";
      setChatMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Offline." },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return "#2e7d32"; // Green
    if (score >= 0.65) return "#ef6c00"; // Orange
    if (score >= 0.4) return "#fbc02d"; // Yellow
    return "#d32f2f"; // Red
  };

  const handleUploadClick = () => {
    if (modelType === "none") {
      showNotice("info", "Please select a model first.");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleModelTypeChange = (
    newType: "none" | "classification" | "segmentation",
  ) => {
    setModelType(newType);
    setSelectedModel(newType === "classification" ? "efficientnetb3" : "unet");
    if (isAnalyzed) {
      setIsAnalyzed(false);
      setPredictionResult(null);
      setHeatmapPreview("");
      setOverlayPreview("");
      setChatMessages([]);
      setChatOpen(false);
      setError("");
      if (selectedImage) {
        processImage(selectedImage, newType);
      }
    }
  };

  return (
    <div className="analysis-dashboard">
      <div className="bubble-background">
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
      </div>

      <aside className="dashboard-sidebar" style={{ position: "relative", width: sidebarCollapsed ? "60px" : "320px", minWidth: sidebarCollapsed ? "60px" : "320px", overflow: "hidden", transition: "width 0.3s ease, min-width 0.3s ease" }}>
        {/* ANALYSIS TYPE */}
        <div className="sidebar-section" style={{ position: "relative", zIndex: 3 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "space-between", marginBottom: "12px" }}>
            {!sidebarCollapsed && (
              <div className="sidebar-title" style={{ color: "#6a1b9a", fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.5px", marginBottom: 0 }}>
                ANALYSIS TYPE
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{
                background: "#ffffff",
                border: "2px solid rgba(106, 27, 154, 0.2)",
                cursor: "pointer",
                padding: "6px 8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "6px",
                color: "#6a1b9a",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(106, 27, 154, 0.1)";
                e.currentTarget.style.borderColor = "#6a1b9a";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#ffffff";
                e.currentTarget.style.borderColor = "rgba(106, 27, 154, 0.2)";
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          </div>
          {!sidebarCollapsed && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                onClick={() => handleModelTypeChange("classification")}
                disabled={isLoading}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  background: modelType === "classification" ? "#6a1b9a" : "#ffffff",
                  color: modelType === "classification" ? "#ffffff" : "#333333",
                  border: `2px solid ${modelType === "classification" ? "#6a1b9a" : "rgba(106, 27, 154, 0.2)"}`,
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  cursor: isLoading ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                }}
              >
                Classification
              </button>
              <button
                onClick={() => handleModelTypeChange("segmentation")}
                disabled={isLoading}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  background: modelType === "segmentation" ? "#6a1b9a" : "#ffffff",
                  color: modelType === "segmentation" ? "#ffffff" : "#333333",
                  border: `2px solid ${modelType === "segmentation" ? "#6a1b9a" : "rgba(106, 27, 154, 0.2)"}`,
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  cursor: isLoading ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                }}
              >
                Segmentation
              </button>
            </div>
          )}
        </div>

        {/* MODEL SELECTION - ABSOLUTE POSITIONED */}
        {!sidebarCollapsed && modelType !== "none" && (
        <div 
          className="sidebar-section" 
          style={{ 
            position: "absolute",
            top: "180px",
            left: "1.5rem",
            right: "1.5rem",
            transition: "opacity 0.3s",
            zIndex: 2,
          }}
        >
          <div className="sidebar-title" style={{ color: "#6a1b9a", fontWeight: 600, fontSize: "0.7rem", letterSpacing: "0.5px", marginBottom: "8px" }}>
            MODEL
          </div>
          <div style={{ 
            background: "#ffffff", 
            border: "2px solid rgba(106, 27, 154, 0.2)", 
            borderRadius: "10px", 
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "6px"
          }}>
            {modelType === "classification" ? (
              <>
                <button
                  onClick={() => setSelectedModel("efficientnetb3")}
                  disabled={isLoading}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    background: selectedModel === "efficientnetb3" ? "rgba(106, 27, 154, 0.1)" : "transparent",
                    border: `2px solid ${selectedModel === "efficientnetb3" ? "#6a1b9a" : "transparent"}`,
                    color: "#333333",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    cursor: isLoading ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>EfficientNetB3</span>
                  <span style={{ 
                    fontSize: "0.7rem", 
                    background: "rgba(106, 27, 154, 0.15)", 
                    color: "#6a1b9a", 
                    padding: "3px 8px", 
                    borderRadius: "4px",
                    fontWeight: 600
                  }}>
                    Best Model
                  </span>
                </button>
                <button
                  onClick={() => setSelectedModel("mobilenetv2")}
                  disabled={isLoading}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    background: selectedModel === "mobilenetv2" ? "rgba(106, 27, 154, 0.1)" : "transparent",
                    border: `2px solid ${selectedModel === "mobilenetv2" ? "#6a1b9a" : "transparent"}`,
                    color: "#333333",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    cursor: isLoading ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                    textAlign: "left",
                  }}
                >
                  MobileNetV2
                </button>
                <button
                  onClick={() => setSelectedModel("resnet50")}
                  disabled={isLoading}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    background: selectedModel === "resnet50" ? "rgba(106, 27, 154, 0.1)" : "transparent",
                    border: `2px solid ${selectedModel === "resnet50" ? "#6a1b9a" : "transparent"}`,
                    color: "#333333",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    cursor: isLoading ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                    textAlign: "left",
                  }}
                >
                  ResNet50
                </button>
                <button
                  onClick={() => setSelectedModel("vgg16")}
                  disabled={isLoading}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    background: selectedModel === "vgg16" ? "rgba(106, 27, 154, 0.1)" : "transparent",
                    border: `2px solid ${selectedModel === "vgg16" ? "#6a1b9a" : "transparent"}`,
                    color: "#333333",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    cursor: isLoading ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                    textAlign: "left",
                  }}
                >
                  VGG16
                </button>
              </>
            ) : modelType === "segmentation" ? (
              <button
                onClick={() => setSelectedModel("unet")}
                disabled={isLoading}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  background: "rgba(106, 27, 154, 0.1)",
                  border: "2px solid #6a1b9a",
                  color: "#333333",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  cursor: "default",
                  textAlign: "left",
                }}
              >
                U-Net
              </button>
            ) : null}
          </div>
        </div>
        )}

        {/* SAMPLE MANAGEMENT - ABSOLUTE POSITIONED */}
        {!sidebarCollapsed && (
        <div 
          className="sidebar-section" 
          style={{ 
            position: "absolute",
            bottom: "50px",
            left: "1.5rem",
            right: "1.5rem",
            zIndex: 1,
          }}
        >
          <div className="sidebar-title" style={{ color: "#6a1b9a", fontWeight: 600, fontSize: "0.7rem", letterSpacing: "0.5px", marginBottom: "8px" }}>
            SAMPLE MANAGEMENT
          </div>
          <div
            className={`mini-upload ${modelType === "none" ? "disabled" : ""}`}
            onClick={handleUploadClick}
            style={{ 
              background: "#ffffff",
              border: "2px dashed rgba(106, 27, 154, 0.3)",
              borderRadius: "10px",
              padding: "16px 12px",
              cursor: modelType === "none" ? "not-allowed" : "pointer",
              opacity: modelType === "none" ? 0.5 : 1,
              transition: "all 0.2s",
              height: "110px",
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              hidden
              accept="image/*"
            />
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6a1b9a"
              strokeWidth="2"
              style={{ marginBottom: "8px", display: "block", margin: "0 auto 8px" }}
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            <div
              style={{
                fontSize: "0.8rem",
                color: "#6a1b9a",
                fontWeight: 500,
                wordBreak: "break-all",
                overflowWrap: "break-word",
                whiteSpace: "normal",
                maxWidth: "100%",
                textAlign: "center",
              }}
            >
              {selectedImage
                ? selectedImage.name
                : "Upload Histopathology Images"}
            </div>
          </div>
        </div>
        )}

        {/* BUTTONS - ABSOLUTE POSITIONED AT BOTTOM */}
        {!sidebarCollapsed && (
        <div style={{ position: "absolute", bottom: "1.5rem", left: "1.5rem", right: "1.5rem", zIndex: 1, display: "flex", gap: "8px", flexDirection: isAnalyzed ? "row" : "column" }}>
          <button
            className="primary-btn submit-btn"
            onClick={handleStartAnalysis}
            disabled={isLoading || !selectedImage || modelType === "none"}
            style={{ 
              width: isAnalyzed ? "50%" : "100%",
              height: "44px",
              padding: "0 12px",
              background: "#e91e63",
              border: "none",
              borderRadius: "8px",
              color: "#ffffff",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: (isLoading || !selectedImage || modelType === "none") ? "not-allowed" : "pointer",
              opacity: (isLoading || !selectedImage || modelType === "none") ? 0.6 : 1,
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isLoading ? (
              <>
                <span className="button-spinner" /> Analyzing...
              </>
            ) : (
              "Start Analyzing"
            )}
          </button>

          {isAnalyzed && (
            <button
              className="secondary-btn"
              onClick={() => {
                setIsAnalyzed(false);
                setPredictionResult(null);
                setSelectedImage(null);
                setSelectedPreview("");
                setHeatmapPreview("");
                setOverlayPreview("");
                setChatMessages([]);
                setChatOpen(false);
                setModelType("none");
                setSelectedModel("");
                setError("");
              }}
              style={{
                width: "50%",
                height: "44px",
                padding: "0 12px",
                background: "#ffffff",
                border: "2px solid #e91e63",
                color: "#e91e63",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "0.75rem",
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                whiteSpace: "nowrap",
              }}
            >
              New Session
            </button>
          )}
        </div>
        )}
      </aside>

      {/* Floating Toggle Button when sidebar is collapsed - REMOVED, icon stays in sidebar */}

      <main
        ref={dashboardMainRef}
        className="dashboard-main"
        style={{
          marginRight: chatOpen ? "400px" : "0",
          transition: "margin-right 0.3s ease-in-out",
        }}
      >
        <header className="dashboard-header">
          <div>
            <h1>Analysis Workspace</h1>
            <div style={{ fontSize: "0.85rem", color: "#666" }}>
              LUCIT Medical Imaging v1.0
            </div>
          </div>
          <div
            className={`status-badge ${isAnalyzed ? "active" : ""}`}
            style={{
              background: isAnalyzed
                ? "rgba(0, 200, 100, 0.1)"
                : "rgba(0,0,0,0.05)",
              color: isAnalyzed ? "#00c864" : "#666",
            }}
          >
            {isLoading ? "PROCESSING" : isAnalyzed ? "COMPLETED" : "IDLE"}
          </div>
        </header>

        {notice && (
          <div
            className={`notice notice-top ${notice.type}`}
            style={{ position: "relative", top: 0, marginBottom: "1rem" }}
          >
            <span>{notice.text}</span>
          </div>
        )}

        {isLoading ? (
          <div className="analysis-loading-container">
            <div className="dots-loader">
              <div />
              <div />
              <div />
            </div>
            <div className="loading-label">
              AI is analyzing tissue patterns...
            </div>
          </div>
        ) : (
          <>
            <div className="analysis-viewport">
              <div className="viewport-card">
                <div className="viewport-card-header">Input Specimen</div>
                <div className="viewport-image-container">
                  {selectedPreview ? (
                    <img src={selectedPreview} alt="Specimen" />
                  ) : (
                    <div style={{ color: "#999" }}>Awaiting Specimen...</div>
                  )}
                </div>
              </div>
              <div className="viewport-card" style={{ position: "relative" }}>
                <div className="viewport-card-header">
                  {modelType === "segmentation"
                    ? "Binary Mask"
                    : "Heatmap Visualization"}
                </div>
                <div className="viewport-image-container">
                  {heatmapPreview ? (
                    <>
                      <img src={heatmapPreview} alt="Heatmap/Mask" />
                      {modelType === "segmentation" && (
                        <div className="viewport-legend">
                          <div className="legend-item">
                            <span className="legend-dot white" /> Cancer
                          </div>
                          <div className="legend-item">
                            <span className="legend-dot black" /> Normal
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ color: "#999" }}>
                      {modelType === "segmentation"
                        ? "No Mask Available"
                        : "No Heatmap Available"}
                    </div>
                  )}
                </div>
              </div>
              <div className="viewport-card" style={{ position: "relative" }}>
                <div className="viewport-card-header">
                  {modelType === "segmentation"
                    ? "Segmentation Overlay"
                    : "Grad-CAM Overlay"}
                </div>
                <div className="viewport-image-container">
                  {overlayPreview ? (
                    <>
                      <img src={overlayPreview} alt="Overlay" />
                      <div className="viewport-legend">
                        <div className="legend-item">
                          <span className="legend-dot cancer" /> Cancer ROI
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: "#999" }}>No Overlay Available</div>
                  )}
                </div>
              </div>
            </div>

            {isAnalyzed && predictionResult && (
              <div className="results-panel">
                <div className="metrics-widget">
                  <div
                    className="sidebar-title"
                    style={{ marginBottom: "1rem", color: "#6a1b9a" }}
                  >
                    Diagnostic Metrics
                  </div>
                  {predictionResult.model_type === "segmentation" ? (
                    <>
                      <div className="metric-row">
                        <span className="metric-label">Cancer Area</span>
                        <span
                          className="metric-value"
                          style={{ color: "#d32f2f" }}
                        >
                          {predictionResult.area_stats?.cancer_percent?.toFixed(
                            2,
                          )}
                          %
                        </span>
                      </div>
                      <div className="metric-row">
                        <span className="metric-label">Normal Area</span>
                        <span
                          className="metric-value"
                          style={{ color: "#2e7d32" }}
                        >
                          {predictionResult.area_stats?.normal_percent?.toFixed(
                            2,
                          )}
                          %
                        </span>
                      </div>

                      <div className="donut-chart-container">
                        <div className="donut-chart">
                          <svg width="180" height="180" viewBox="0 0 180 180">
                            <circle
                              className="donut-circle-bg donut-circle-normal"
                              cx="90"
                              cy="90"
                              r="78"
                            />
                            <circle
                              className="donut-circle-fg donut-circle-cancer"
                              cx="90"
                              cy="90"
                              r="78"
                              strokeDasharray="490"
                              strokeDashoffset={
                                490 -
                                490 *
                                  ((predictionResult.area_stats
                                    ?.cancer_percent || 0) /
                                    100)
                              }
                            />
                          </svg>
                          <div className="donut-text">
                            <span className="donut-percentage cancer">
                              {(
                                predictionResult.area_stats?.cancer_percent || 0
                              ).toFixed(1)}
                              %
                            </span>
                            <span className="donut-label">Cancer</span>
                          </div>
                        </div>

                        <div className="legend-container">
                          <div className="legend-item">
                            <span className="legend-dot cancer" /> Cancer
                          </div>
                          <div className="legend-item">
                            <span className="legend-dot normal" /> Normal
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="metric-row">
                        <span className="metric-label">Prediction</span>
                        <span className="metric-value">
                          {formatPredictionLabel(predictionResult.prediction)}
                        </span>
                      </div>

                      <div className="donut-chart-container">
                        <div className="donut-chart">
                          <svg width="180" height="180" viewBox="0 0 180 180">
                            <circle
                              className="donut-circle-bg"
                              cx="90"
                              cy="90"
                              r="78"
                            />
                            <circle
                              className="donut-circle-fg"
                              style={{
                                stroke: getConfidenceColor(
                                  predictionResult.confidence || 0,
                                ),
                              }}
                              cx="90"
                              cy="90"
                              r="78"
                              strokeDasharray="490"
                              strokeDashoffset={
                                490 - 490 * (predictionResult.confidence || 0)
                              }
                            />
                          </svg>
                          <div className="donut-text">
                            <span
                              className="donut-percentage"
                              style={{
                                color: getConfidenceColor(
                                  predictionResult.confidence || 0,
                                ),
                              }}
                            >
                              {(
                                (predictionResult.confidence || 0) * 100
                              ).toFixed(2)}
                              %
                            </span>
                            <span className="donut-label">Confidence</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="description-widget">
                  <div
                    className="sidebar-title"
                    style={{ 
                      marginBottom: "1rem", 
                      color: "#6a1b9a",
                      position: "sticky",
                      top: 0,
                      background: "#ffffff",
                      zIndex: 1,
                      paddingBottom: "0.5rem",
                      borderBottom: "1px solid rgba(106, 27, 154, 0.1)"
                    }}
                  >
                    AI Narrative Insights
                  </div>
                  <div
                    ref={markdownContentRef}
                    className="markdown-content"
                    data-lenis-prevent
                    style={{
                      fontSize: "0.95rem",
                      lineHeight: "1.85",
                      color: "#333",
                      flex: 1,
                      overflowY: "auto",
                      paddingRight: "10px",
                    }}
                  >
                    <ReactMarkdown
                      components={{
                        h2: ({ node, ...props }) => (
                          <h2
                            style={{
                              fontSize: "1.1rem",
                              fontWeight: 600,
                              color: "#6a1b9a",
                              marginTop: "1.8rem",
                              marginBottom: "0.8rem",
                              borderBottom: "2px solid rgba(106, 27, 154, 0.1)",
                              paddingBottom: "0.5rem",
                            }}
                            {...props}
                          />
                        ),
                        p: ({ node, ...props }) => (
                          <p
                            style={{
                              marginBottom: "1.2rem",
                              textAlign: "justify",
                              lineHeight: "1.85",
                              display: "block",
                            }}
                            {...props}
                          />
                        ),
                        ul: ({ node, ...props }) => (
                          <ul
                            style={{
                              marginLeft: "1.5rem",
                              marginBottom: "1.2rem",
                              marginTop: "0.8rem",
                              lineHeight: "1.8",
                            }}
                            {...props}
                          />
                        ),
                        li: ({ node, ...props }) => (
                          <li
                            style={{
                              marginBottom: "0.5rem",
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
                      {predictionResult.ai_description}
                    </ReactMarkdown>
                  </div>
                  <div
                    style={{
                      marginTop: "1.5rem",
                      padding: "10px",
                      background: "#fff9c4",
                      borderLeft: "4px solid #fbc02d",
                      color: "#5d4037",
                      fontSize: "0.85rem",
                      borderRadius: "4px",
                      position: "sticky",
                      bottom: 0,
                      zIndex: 1,
                    }}
                  >
                    <strong>MEDICAL DISCLAIMER:</strong> For research use only.
                    Not for diagnostic use.
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {isAnalyzed && (
        <div className="dashboard-chat-wrapper">
          <button
            className={`chat-bubble-toggle ${chatOpen ? "chat-open" : ""}`}
            onClick={() => setChatOpen(!chatOpen)}
            style={{ background: "#e91e63" }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>

          <div className={`dashboard-chatbot-panel ${chatOpen ? "open" : ""}`}>
            <div
              className="chatbot-header"
              style={{ padding: "15px", background: "#e91e63" }}
            >
              <div style={{ fontWeight: 600, color: "white" }}>
                Clinical Assistant
              </div>
              <button
                onClick={() => setChatOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "white",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
            <div
              ref={chatMessagesRef}
              className="chatbot-messages"
              data-lenis-prevent
              style={{
                flex: 1,
                overflowY: "scroll",
                padding: "15px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  className={`chatbot-message ${m.role}`}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                  }}
                >
                  {m.role === "assistant" ? (
                    <ReactMarkdown
                      components={{
                        p: ({ node, ...props }) => (
                          <p
                            style={{
                              marginBottom: "0.8rem",
                              lineHeight: "1.6",
                              display: "block",
                            }}
                            {...props}
                          />
                        ),
                        ul: ({ node, ...props }) => (
                          <ul
                            style={{
                              marginLeft: "1.2rem",
                              marginBottom: "0.8rem",
                              marginTop: "0.5rem",
                              lineHeight: "1.6",
                            }}
                            {...props}
                          />
                        ),
                        li: ({ node, ...props }) => (
                          <li
                            style={{
                              marginBottom: "0.3rem",
                            }}
                            {...props}
                          />
                        ),
                        strong: ({ node, ...props }) => (
                          <strong
                            style={{
                              color: "#e91e63",
                              fontWeight: 600,
                            }}
                            {...props}
                          />
                        ),
                      }}
                    >
                      {m.text}
                    </ReactMarkdown>
                  ) : (
                    m.text
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form
              className="chatbot-input"
              onSubmit={handleSendChat}
              style={{ padding: "15px" }}
            >
              <input
                type="text"
                placeholder="Ask about findings..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                style={{
                  width: "100%",
                  background: "#f8f9fa",
                  border: "1px solid rgba(106, 27, 154, 0.1)",
                  padding: "12px",
                  borderRadius: "8px",
                  color: "#333",
                }}
              />
              <button
                type="submit"
                className="hx-chat-send"
                disabled={isChatLoading || !chatInput.trim()}
                aria-label="Send message"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m22 2-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisPage;

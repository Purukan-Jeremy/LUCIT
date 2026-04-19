import React, { useEffect, useRef, useState } from "react";
import "../../assets/style.css";
import { hasActiveSession } from "../../utils/session";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";
const ANALYSIS_HISTORY_KEY = "lucit_analysis_history";
type ChatMessage = { role: "user" | "assistant"; text: string };

function formatPredictionLabel(prediction?: string) {
  switch ((prediction || "").trim()) {
    case "Colon N": return "Colon Normal";
    case "Colon ACA": return "Colon Adenocarcinoma";
    case "Lung ACA": return "Lung Adenocarcinoma";
    case "Lung N": return "Lung Normal";
    case "Lung SCC": return "Lung Squamous Cell Carcinoma";
    default: return prediction || "Unknown";
  }
}

const AnalysisPage: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string>("");
  const [heatmapPreview, setHeatmapPreview] = useState<string>("");
  const [overlayPreview, setOverlayPreview] = useState<string>("");
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [modelType, setModelType] = useState<"none" | "classification" | "segmentation">("none");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

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
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<{ type: "info" | "error"; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const dashboardMainRef = useRef<HTMLElement | null>(null);
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // Enable mouse wheel + touchpad scrolling on dashboard-main
  useEffect(() => {
    const el = dashboardMainRef.current;
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
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

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
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
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
  }, [modelType]);

  const showNotice = (type: "info" | "error", text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 3500);
  };

  const saveAnalysisToHistory = (data: any) => {
    if (!data) return;
    const isSegmentation = data.model_type === "segmentation";
    const cancerPercent = data.area_stats?.cancer_percent ?? "N/A";
    const confidenceValue = isSegmentation ? `Cancer: ${cancerPercent}%` : `${(data.confidence * 100).toFixed(2)}%`;
    const entry = {
      id: Date.now(),
      prediction: isSegmentation ? `Segmentation: ${cancerPercent}% Cancer` : formatPredictionLabel(data.prediction),
      confidence: confidenceValue,
      createdAt: new Date().toISOString(),
      model: isSegmentation ? "Segmentation" : "Classification",
      description: data.ai_description || "No description.",
      originalImage: selectedPreview,
      heatmapImage: data.gradcam_heatmap ? `data:image/jpeg;base64,${data.gradcam_heatmap}` : (data.segmentation_mask ? `data:image/png;base64,${data.segmentation_mask}` : ""),
      overlayImage: data.gradcam_image ? `data:image/jpeg;base64,${data.gradcam_image}` : (data.overlay_image ? `data:image/jpeg;base64,${data.overlay_image}` : ""),
    };
    try {
      const raw = localStorage.getItem(ANALYSIS_HISTORY_KEY);
      const prev = raw ? JSON.parse(raw) : [];
      localStorage.setItem(ANALYSIS_HISTORY_KEY, JSON.stringify([entry, ...prev].slice(0, 50)));
    } catch (e) { console.error(e); }
  };

  const sendImageToBackend = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("model_type", modelType);
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/predict`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || data.status === "error") throw new Error(data.message || "Failed");
      setPredictionResult(data);
      if (data.model_type === "segmentation") {
        setHeatmapPreview(data.mask_image ? `data:image/png;base64,${data.mask_image}` : `data:image/png;base64,${data.segmentation_mask}`);
        setOverlayPreview(data.overlay_image ? `data:image/jpeg;base64,${data.overlay_image}` : `data:image/jpeg;base64,${data.gradcam_image}`);
      } else {
        setHeatmapPreview(data.gradcam_heatmap ? `data:image/jpeg;base64,${data.gradcam_heatmap}` : "");
        setOverlayPreview(data.gradcam_image ? `data:image/jpeg;base64,${data.gradcam_image}` : "");
      }
      saveAnalysisToHistory(data);
      setIsAnalyzed(true);
    } catch (err: any) {
      setError(err.message);
      showNotice("error", err.message);
    } finally { setIsLoading(false); }
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
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
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
      const reply = data.status === "success" ? data.reply : "Error connecting to AI.";
      setChatMessages(prev => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", text: "Offline." }]);
    } finally { setIsChatLoading(false); }
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

  const handleModelTypeChange = (newType: "none" | "classification" | "segmentation") => {
    setModelType(newType);
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

      <aside className="dashboard-sidebar">
        <div className="sidebar-section">
          <div className="sidebar-title">Model Selection</div>
          <select 
            className="model-dropdown" 
            value={modelType} 
            onChange={(e) => handleModelTypeChange(e.target.value as any)}
            disabled={isLoading}
            style={{ 
              width: '100%', 
              padding: '12px', 
              borderRadius: '8px', 
              background: '#ffffff', 
              color: '#333333', 
              border: '1px solid rgba(106, 27, 154, 0.2)',
              fontSize: '0.9rem',
              fontWeight: 500
            }}
          >
            {modelType === "none" && <option value="none">Select Model Type</option>}
            <option value="classification">Classification Model</option>
            <option value="segmentation">Segmentation Model</option>
          </select>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-title">Sample Management</div>
          <div 
            className={`mini-upload ${modelType === "none" ? "disabled" : ""}`} 
            onClick={handleUploadClick} 
            style={{ background: '#ffffff' }}
          >
            <input type="file" ref={fileInputRef} onChange={handleImageChange} hidden accept="image/*" />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: '8px', opacity: 0.7 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
              {selectedImage ? selectedImage.name : "Upload Histopathology Image"}
            </div>
          </div>
        </div>

        <button 
          className="primary-btn submit-btn" 
          onClick={handleStartAnalysis} 
          disabled={isLoading || !selectedImage || modelType === "none"}
          style={{ width: '100%', marginTop: 'auto', padding: '14px' }}
        >
          {isLoading ? <><span className="button-spinner" /> Analyzing...</> : "Start Analyzing"}
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
              setError("");
            }}
            style={{ 
              width: '100%', 
              marginTop: '10px', 
              padding: '12px', 
              background: '#ffffff', 
              border: '1px solid rgba(106, 27, 154, 0.2)', 
              color: '#6a1b9a', 
              borderRadius: '8px',
              fontWeight: 600
            }}
          >
            New Session
          </button>
        )}
      </aside>

      <main ref={dashboardMainRef} className="dashboard-main" style={{ marginRight: chatOpen ? '400px' : '0', transition: 'margin-right 0.3s ease-in-out' }}>
        <header className="dashboard-header">
          <div>
            <h1>Analysis Workspace</h1>
            <div style={{ fontSize: '0.85rem', color: '#666' }}>LUCIT Medical Imaging v1.0</div>
          </div>
          <div className={`status-badge ${isAnalyzed ? 'active' : ''}`} style={{ background: isAnalyzed ? 'rgba(0, 200, 100, 0.1)' : 'rgba(0,0,0,0.05)', color: isAnalyzed ? '#00c864' : '#666' }}>
            {isLoading ? "PROCESSING" : isAnalyzed ? "COMPLETED" : "IDLE"}
          </div>
        </header>

        {notice && (
          <div className={`notice notice-top ${notice.type}`} style={{ position: 'relative', top: 0, marginBottom: '1rem' }}>
            <span>{notice.text}</span>
          </div>
        )}

        {isLoading ? (
          <div className="analysis-loading-container">
            <div className="dots-loader">
              <div /><div /><div />
            </div>
            <div className="loading-label">AI is analyzing tissue patterns...</div>
          </div>
        ) : (
          <>
            <div className="analysis-viewport">
              <div className="viewport-card">
                <div className="viewport-card-header">Input Specimen</div>
                <div className="viewport-image-container">
                  {selectedPreview ? <img src={selectedPreview} alt="Specimen" /> : <div style={{ color: '#999' }}>Awaiting Specimen...</div>}
                </div>
              </div>
              <div className="viewport-card" style={{ position: 'relative' }}>
                <div className="viewport-card-header">
                  {modelType === "segmentation" ? "Binary Mask" : "Heatmap Visualization"}
                </div>
                <div className="viewport-image-container">
                  {heatmapPreview ? (
                    <>
                      <img src={heatmapPreview} alt="Heatmap/Mask" />
                      {modelType === "segmentation" && (
                        <div className="viewport-legend">
                          <div className="legend-item"><span className="legend-dot white" /> Cancer</div>
                          <div className="legend-item"><span className="legend-dot black" /> Normal</div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ color: '#999' }}>{modelType === "segmentation" ? "No Mask Available" : "No Heatmap Available"}</div>
                  )}
                </div>
              </div>
              <div className="viewport-card" style={{ position: 'relative' }}>
                <div className="viewport-card-header">
                  {modelType === "segmentation" ? "Segmentation Overlay" : "Grad-CAM Overlay"}
                </div>
                <div className="viewport-image-container">
                  {overlayPreview ? (
                    <>
                      <img src={overlayPreview} alt="Overlay" />
                      <div className="viewport-legend">
                        <div className="legend-item"><span className="legend-dot cancer" /> Cancer ROI</div>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: '#999' }}>No Overlay Available</div>
                  )}
                </div>
              </div>
            </div>

            {isAnalyzed && predictionResult && (
              <div className="results-panel">
                <div className="metrics-widget">
                  <div className="sidebar-title" style={{ marginBottom: '1rem', color: '#6a1b9a' }}>Diagnostic Metrics</div>
                  {predictionResult.model_type === "segmentation" ? (
                    <>
                      <div className="metric-row">
                        <span className="metric-label">Cancer Area</span>
                        <span className="metric-value" style={{ color: '#d32f2f' }}>{predictionResult.area_stats?.cancer_percent?.toFixed(2)}%</span>
                      </div>
                      <div className="metric-row">
                        <span className="metric-label">Normal Area</span>
                        <span className="metric-value" style={{ color: '#2e7d32' }}>{predictionResult.area_stats?.normal_percent?.toFixed(2)}%</span>
                      </div>

                      <div className="donut-chart-container">
                        <div className="donut-chart">
                          <svg width="180" height="180" viewBox="0 0 180 180">
                            <circle className="donut-circle-bg donut-circle-normal" cx="90" cy="90" r="78" />
                            <circle 
                              className="donut-circle-fg donut-circle-cancer" 
                              cx="90" 
                              cy="90" 
                              r="78" 
                              strokeDasharray="490"
                              strokeDashoffset={490 - (490 * ((predictionResult.area_stats?.cancer_percent || 0) / 100))}
                            />
                          </svg>
                          <div className="donut-text">
                            <span className="donut-percentage cancer">{(predictionResult.area_stats?.cancer_percent || 0).toFixed(1)}%</span>
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
                        <span className="metric-value">{formatPredictionLabel(predictionResult.prediction)}</span>
                      </div>
                      
                      <div className="donut-chart-container">
                        <div className="donut-chart">
                          <svg width="180" height="180" viewBox="0 0 180 180">
                            <circle className="donut-circle-bg" cx="90" cy="90" r="78" />
                            <circle 
                              className="donut-circle-fg" 
                              style={{ stroke: getConfidenceColor(predictionResult.confidence || 0) }}
                              cx="90" 
                              cy="90" 
                              r="78" 
                              strokeDasharray="490"
                              strokeDashoffset={490 - (490 * (predictionResult.confidence || 0))}
                            />
                          </svg>
                          <div className="donut-text">
                            <span 
                              className="donut-percentage" 
                              style={{ color: getConfidenceColor(predictionResult.confidence || 0) }}
                            >
                              {((predictionResult.confidence || 0) * 100).toFixed(1)}%
                            </span>
                            <span className="donut-label">Confidence</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="description-widget">
                  <div className="sidebar-title" style={{ marginBottom: '1rem', color: '#6a1b9a' }}>AI Narrative Insights</div>
                  <div style={{ fontSize: '1.1rem', lineHeight: '1.7', color: '#333' }}>
                    {predictionResult.ai_description}
                  </div>
                  <div style={{ marginTop: '1.5rem', padding: '10px', background: '#fff9c4', borderLeft: '4px solid #fbc02d', color: '#5d4037', fontSize: '0.85rem', borderRadius: '4px' }}>
                    <strong>MEDICAL DISCLAIMER:</strong> For research use only. Not for diagnostic use.
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
            className={`chat-bubble-toggle ${chatOpen ? 'chat-open' : ''}`} 
            onClick={() => setChatOpen(!chatOpen)} 
            style={{ background: '#e91e63' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>

          <div className={`dashboard-chatbot-panel ${chatOpen ? 'open' : ''}`}>
            <div className="chatbot-header" style={{ padding: '15px', background: '#e91e63' }}>
              <div style={{ fontWeight: 600, color: 'white' }}>Clinical Assistant</div>
              <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <div ref={chatMessagesRef} className="chatbot-messages" style={{ flex: 1, overflowY: 'scroll', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {chatMessages.map((m, i) => (
                <div key={i} className={`chatbot-message ${m.role}`} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                  <div style={{ 
                    padding: '10px 14px', 
                    borderRadius: '12px', 
                    background: m.role === 'user' ? '#e91e63' : '#ffffff', 
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    border: 'none'
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form className="chatbot-input" onSubmit={handleSendChat} style={{ padding: '15px' }}>
              <input 
                type="text" 
                placeholder="Ask about findings..." 
                value={chatInput} 
                onChange={(e) => setChatInput(e.target.value)}
                style={{ 
                  width: '100%', 
                  background: '#f8f9fa', 
                  border: '1px solid rgba(106, 27, 154, 0.1)', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  color: '#333' 
                }}
              />
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisPage;
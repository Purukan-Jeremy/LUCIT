import "../../assets/style.css";

function AboutUs() {
  const sampleImages = [
    { title: "Colon Adenocarcinoma", src: "/images/colon_aca.png" },
    { title: "Colon Benign", src: "/images/colon_n.png" },
    { title: "Lung Adenocarcinoma", src: "/images/lung_aca.png" },
    { title: "Lung Benign", src: "/images/lung_n.png" },
    { title: "Lung Squamous Carcinoma", src: "/images/lung_scc.png" },
  ];

  const handleSeeMoreClick = () => {
    const showcaseSection = document.getElementById("about-showcase");
    showcaseSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="about-main-wrapper" id="about">
      <section className="about-hero-section">
        <div className="about-hero-container">
          <div className="about-hero-content">
            <span className="medical-badge">Classification & Segmentation</span>
            <h2 className="about-main-title">
              Advancing Digital Pathology with <span className="text-highlight">LUCIT</span>
            </h2>
            <p className="about-main-lead">
              LUCIT your histopathology Ai. LUCIT is a cutting-edge AI-powered diagnostic assistant designed to revolutionize the field of digital pathology.
              enhancing pathologists to analyze. Trained with the LC25000 dataset.
            </p>
            <div className="about-hero-actions">
              <button
                className="primary-btn cozy-btn"
                onClick={handleSeeMoreClick}
                type="button"
              >
                Explore Methodology
              </button>
              <div className="clinical-note">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                <span>Validated using LC25000 Dataset.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="methodology-section" id="about-showcase">
        <div className="methodology-grid">
          <div className="info-card">
            <div className="info-card-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            </div>
            <h3>The LC25000 Dataset</h3>
            <p>
              Our models are trained and validated on the <strong>LC25000 dataset</strong>, containing 25,000 color images 
              across five distinct classes: lung adenocarcinoma, squamous cell carcinoma, benign lung tissue, 
              colon adenocarcinoma, and benign colon tissue.
            </p>
          </div>
          <div className="info-card">
            <div className="info-card-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
            <h3>Model Architecture</h3>
            <p>
              We utilize <strong>CNN - Model Architecture</strong> for high-speed classification and <strong>U-Net</strong> for Segmentation. 
              Both models are optimized for 224x224 pixel input with optimizer
              achieve the best performance. The classification model achieves a validation accuracy that can be trusted, while the segmentation model provides precise localization of pathological features.
            </p>
          </div>
          <div className="info-card">
            <div className="info-card-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
            <h3>Explainability (Grad-CAM)</h3>
            <p>
              Our <strong>Gradient-weighted Class Activation Mapping</strong> highlights the pixels that influenced the AI's decision, 
              allowing pathologists to 
              visually correlate AI findings with biological markers.
            </p>
          </div>
        </div>

        <div className="stats-strip">
          <div className="stat-pill">
            <span className="stat-label">Dataset Size</span>
            <span className="stat-value">25,000 Images</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Model Type</span>
            <span className="stat-value">CNN - Model Architecture</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Input Resolution</span>
            <span className="stat-value">224 x 224</span>
          </div>
        </div>

        <div className="sample-gallery">
          <h3 className="section-subtitle">Visual Classification Reference</h3>
          <div className="gallery-grid">
            {sampleImages.map((item) => (
              <figure className="gallery-item" key={item.title}>
                <div className="gallery-img-wrapper">
                  <img alt={item.title} src={item.src} />
                </div>
                <figcaption>{item.title}</figcaption>
              </figure>
            ))}
          </div>
        </div>

        <div className="educational-row">
          <div className="video-container">
            <iframe
              src="https://www.youtube.com/embed/4DJm4NLECQs"
              title="How Histopathology Images Are Created"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
          <div className="educational-content">
            <h3>From Tissue to Digital Slide</h3>
            <p>
              Understanding the origin of histopathology images is crucial. The laboratory process involves 
              tissue fixation, embedding, microtomy (thin slicing), and H&E (Hematoxylin and Eosin) staining. 
              Our AI is trained to recognize the nuclear and cytoplasmic patterns resulting from this 
              centuries-old gold standard technique, now brought into the digital age.
            </p>
            <ul className="info-list">
              <li><strong>Precision Microtomy:</strong> 4-5 micron thickness slides.</li>
              <li><strong>H&E Staining:</strong> Highlighting cellular structure and pathology.</li>
              <li><strong>Digital Scanning:</strong> Whole slide imaging for AI processing.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AboutUs;

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
    <>
      <section className="aboutus-section" id="about">
        <div className="aboutus-left">
          <p className="aboutus-kicker">About The System</p>
          <h2 className="aboutus-title">
            <span className="aboutus-title-line">
              What is <span className="aboutus-lu">LU</span>
              <span className="aboutus-cit">CIT</span> AI for
            </span>
            <br />
            Cancer Detection?
          </h2>
          <p className="aboutus-description">
            LUCIT is an AI system designed to assist clinicians in detecting
            lung and colon cancer from histopathology images.
          </p>
          <button
            className="primary-btn aboutus-cta"
            onClick={handleSeeMoreClick}
            type="button"
          >
            See More
          </button>
        </div>
      </section>

      <section className="aboutus-showcase" id="about-showcase">
        <div className="aboutus-showcase-top">
          <div className="aboutus-stat-item">
            <span className="aboutus-stat-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path
                  d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </span>
            <span className="aboutus-stat-value">+ 25.000</span>
          </div>
          <div className="aboutus-stat-divider" />
          <div className="aboutus-stat-item">
            <span className="aboutus-stat-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  fill="none"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.8"
                />
              </svg>
            </span>
            <span className="aboutus-stat-value">EfficientNetV2</span>
          </div>
          <div className="aboutus-stat-divider" />
          <div className="aboutus-stat-item">
            <span className="aboutus-stat-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  fill="none"
                  r="8.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <circle
                  cx="12"
                  cy="12"
                  fill="none"
                  r="4.8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M12 12l6-6"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.8"
                />
              </svg>
            </span>
            <span className="aboutus-stat-value">99,99%</span>
          </div>
          <div className="aboutus-stat-divider" />
          <div className="aboutus-stat-item">
            <span className="aboutus-stat-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect
                  fill="none"
                  height="12"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  width="12"
                  x="6"
                  y="6"
                />
              </svg>
            </span>
            <span className="aboutus-stat-value">300 x 300</span>
          </div>
        </div>

        <h3 className="aboutus-sample-title">Sample Dataset Images</h3>

        <div className="aboutus-sample-grid">
          {sampleImages.map((item) => (
            <article className="aboutus-sample-card" key={item.title}>
              <img alt={item.title} src={item.src} />
              <p>{item.title}</p>
            </article>
          ))}
        </div>

        <div className="aboutus-video-row">
          <div className="aboutus-video-copy">
            <h3>How Histopathology Images Are Created</h3>
            <p>
              The video presented highlights the standard laboratory procedures
              involved in histopathological image preparation, including tissue
              processing, staining, and digital acquisition. The resulting
              dataset serves as the primary input for training our
              convolutional neural network model.
            </p>
          </div>
          <div className="aboutus-video-icon">
            <iframe
              src="https://www.youtube.com/embed/4DJm4NLECQs"
              title="How Histopathology Images Are Created"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      </section>

    </>
  );
}

export default AboutUs;

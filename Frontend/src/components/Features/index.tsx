type FeatureItem = {
  title: string;
  description: string;
  icon: string;
  iconClassName?: string;
};

const featureItems: FeatureItem[] = [
  {
    title: "AI-Based Cancer Classification",
    description:
      "The system utilizes deep learning models trained on the LC25000 dataset to classify histopathology images of lung and colon cancer. This feature helps identify cancer types efficiently, supporting doctors in making faster and more informed decisions.",
    icon: "/images/classification.png",
  },
  {
    title: "AI-Based Cancer Segmentation",
    description:
      "This feature highlights and segments cancerous regions within histopathology images. By providing clear visualization of affected areas, the system enhances interpretability and assists medical professionals in detailed analysis.",
    icon: "/images/segmentation.png",
    iconClassName: "features-icon-segmentation",
  },
  {
    title: "History",
    description:
      "All analysis results are securely stored and organized, allowing users to revisit previous classifications and segmentations. This ensures better tracking, comparison, and documentation of patient data over time.",
    icon: "/images/history (2).png",
  },
  {
    title: "AI Chatbot",
    description:
      "An AI-powered chatbot provides real-time assistance by explaining analysis results, offering information about lung and colon cancer, and guiding users in using the system effectively.",
    icon: "/images/chatbot.png",
  },
];

function Features() {
  return (
    <section className="features-section" id="features">
      <div className="features-shell">
        <div className="features-heading-block">
          <h2 className="features-heading">Features</h2>
          <p className="features-intro">
            Main tools in LUCIT for histopathology analysis, result review,
            and guided interpretation.
          </p>
        </div>

        <div className="features-grid">
          {featureItems.map((item) => (
            <article className="features-item" key={item.title}>
              <div className="features-item-header">
                <div className={`features-item-icon ${item.iconClassName ?? ""}`}>
                  <img src={item.icon} alt="" aria-hidden="true" />
                </div>
                <h3>{item.title}</h3>
              </div>

              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Features;

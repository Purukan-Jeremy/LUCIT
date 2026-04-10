import React from "react";
import "../../assets/style.css";

type FeatureItem = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

const featureItems: FeatureItem[] = [
  {
    title: "AI-Based Cancer Classification",
    description:
      "Our system leverages advanced deep learning to classify pulmonary and colorectal tissue with high precision. By identifying morphological abnormalities in cellular structures, it assists in the differentiation between malignant and benign samples.",
    icon: (
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="4" r="2" />

        <path d="M12 6 V9" />

        <path d="M12 9 L6 12" />
        <path d="M12 9 L12 12" />
        <path d="M12 9 L18 12" />

        <circle cx="6" cy="12" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="18" cy="12" r="1.6" />

        <path d="M6 13.5 L8 16.5" />
        <path d="M12 13.5 L12 16.5" />
        <path d="M18 13.5 L16 16.5" />

        <circle cx="6" cy="17.5" r="1.6" />
        <circle cx="12" cy="17.5" r="1.6" />
        <circle cx="18" cy="17.5" r="1.6" />
      </svg>
    ),
  },
  {
    title: "U-Net Segmentation for Cancer",
    description:
      "Our U-Net-based segmentation tool provides pixel-level delineation of cancer regions within histopathological images. This allows pathologists to visualize the extent and morphology of cancerous tissues, facilitating more accurate diagnoses and treatment planning.",
    icon: (
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />

        <path d="M12 2v20" />
      </svg>
    ),
  },
  {
    title: "Analysis History & Archiving",
    description:
      "Maintain a robust digital archive of all past analyses. This feature allows for chronological tracking of patient samples, facilitating comparative studies and ensuring that every prediction is documented for future reference.",
    icon: (
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 8v4l3 3" />
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
  },
  {
    title: "Context-Aware Medical Chatbot",
    description:
      "A specialized AI assistant integrated directly into the analysis workflow. The chatbot can interpret current results, provide definitions of pathological terms, and guide users through the implications of the AI findings.",
    icon: (
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

function Features() {
  return (
    <section className="features-section" id="features">
      <div className="features-shell">
        <div className="features-heading-block">
          <span className="features-kicker">Core Capabilities</span>
          <h2 className="features-heading">Intelligent Diagnostic Tools</h2>
          <p className="features-intro">
            LUCIT provides a comprehensive suite of tools designed to augment
            the digital pathology workflow with precision, clarity, and
            accountability.
          </p>
        </div>

        <div className="features-grid">
          {featureItems.map((item) => (
            <article className="features-item-cozy" key={item.title}>
              <div className="features-item-icon-cozy">{item.icon}</div>
              <div className="features-item-content">
                <h3>{item.title}</h3>
                <p className="features-description">{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Features;

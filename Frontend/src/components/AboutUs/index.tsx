function AboutUs() {
  return (
    <section className="aboutus-section" id="about">
      <div className="aboutus-left">
        <p className="aboutus-kicker">About The System</p>
        <h2 className="aboutus-title">
          What is
          <br />
          <span className="aboutus-lu">LU</span>
          <span className="aboutus-cit">CIT</span> AI for
          <br />
          Cancer Detection?
        </h2>
        <p className="aboutus-description">
          LUCIT is an AI system designed to assist clinicians in detecting lung
          and colon cancer from histopathology images.
        </p>
      </div>

      <div className="aboutus-right">
        <div className="aboutus-gallery">
          <div className="aboutus-gallery-left">
            <div className="aboutus-image-card aboutus-image-top">
              <img src="/images/2.png" alt="Medical team reviewing pathology" />
            </div>
            <div className="aboutus-image-card aboutus-image-bottom">
              <img src="/images/1.png" alt="Researcher working in laboratory" />
            </div>
          </div>

          <div className="aboutus-image-card aboutus-image-tall">
            <img src="/images/3.png" alt="Scientist using microscope" />
          </div>
        </div>

        <button className="aboutus-next" type="button" aria-label="Next slide">
          &#8250;
        </button>
      </div>
    </section>
  );
}

export default AboutUs;

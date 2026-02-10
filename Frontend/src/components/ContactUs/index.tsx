function ContactUs() {
  return (
    <section className="contact-section" id="contact">
      <div className="contact-container">
        <div className="contact-copy">
          <h2 className="contact-title">Get in Touch</h2>
          <p className="contact-subtitle">
            Have a question about LUCIT? Reach out to us, and we&apos;ll get back
            to you as quickly as possible.
          </p>
        </div>

        <form className="contact-form" aria-label="Contact form">
          <div className="contact-row">
            <label className="contact-field">
              <span>First name</span>
              <input type="text" name="firstName" autoComplete="given-name" />
            </label>
            <label className="contact-field">
              <span>Last name</span>
              <input type="text" name="lastName" autoComplete="family-name" />
            </label>
          </div>

          <label className="contact-field">
            <span>Email</span>
            <input type="email" name="email" autoComplete="email" />
          </label>

          <label className="contact-field">
            <span>Message</span>
            <textarea name="message" rows={5} />
          </label>

          <button className="contact-submit" type="submit">
            Submit
          </button>
        </form>
      </div>
    </section>
  );
}

export default ContactUs;

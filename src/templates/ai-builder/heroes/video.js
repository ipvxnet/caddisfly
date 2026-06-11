// Video Background Hero Template
// Hero with video background and overlay

export function heroVideoTemplate(data, config) {
  const { heading = 'Welcome', subheading = 'Your business tagline', cta_text, cta_url, cta_link, cta_link_new_tab = false, video_url, background_image } = data;
  const { primary_color: primaryColor = '#667eea', font_heading: fontHeading = 'Inter', font_body: fontBody = 'Inter' } = config;

  // Use background image as fallback if no video
  const backgroundStyle = video_url
    ? ''
    : `background: linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('${background_image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920'}') center/cover;`;

  return `
<section class="hero-video" style="${!video_url ? backgroundStyle : ''}">
  ${
    video_url
      ? `
  <video class="hero-video-bg" autoplay loop muted playsinline>
    <source src="${video_url}" type="video/mp4">
  </video>
  <div class="hero-video-overlay"></div>
  `
      : ''
  }
  <div class="hero-video-content">
    <div class="hero-video-container">
      <h1 class="hero-video-heading" style="font-family: ${fontHeading};">
        ${heading}
      </h1>
      <p class="hero-video-subheading" style="font-family: ${fontBody};">
        ${subheading}
      </p>
      ${
        cta_text
          ? `
      <a href="${cta_link || cta_url || '#contact'}"${cta_link_new_tab ? ' target="_blank" rel="noopener"' : ''} class="cta-button" style="background: ${primaryColor};">
        ${cta_text}
      </a>
      `
          : ''
      }
    </div>
  </div>
</section>

<style>
.hero-video {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.hero-video-bg {
  position: absolute;
  top: 50%;
  left: 50%;
  min-width: 100%;
  min-height: 100%;
  width: auto;
  height: auto;
  transform: translate(-50%, -50%);
  z-index: 0;
  object-fit: cover;
}

.hero-video-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1;
}

.hero-video-content {
  position: relative;
  z-index: 2;
  text-align: center;
  color: white;
  padding: 2rem;
  width: 100%;
}

.hero-video-container {
  max-width: 900px;
  margin: 0 auto;
  animation: fadeInUp 1s ease-out;
}

.hero-video-heading {
  font-size: 4rem;
  font-weight: 700;
  margin: 0 0 1.5rem 0;
  line-height: 1.2;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.hero-video-subheading {
  font-size: 1.5rem;
  margin: 0 0 2.5rem 0;
  line-height: 1.6;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.hero-video .cta-button {
  display: inline-block;
  padding: 1.125rem 3rem;
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1.125rem;
  transition: transform 0.3s, box-shadow 0.3s;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.hero-video .cta-button:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(40px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .hero-video {
    min-height: 70vh;
  }

  .hero-video-heading {
    font-size: 2.5rem;
  }

  .hero-video-subheading {
    font-size: 1.25rem;
  }

  .hero-video .cta-button {
    padding: 1rem 2rem;
    font-size: 1rem;
  }
}
</style>
  `;
}

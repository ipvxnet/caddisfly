// Timeline About Template
// Company history with visual timeline

export function aboutTimelineTemplate(data, config) {
  const { heading, description, milestones } = data;
  const { primaryColor, fontHeading, fontBody } = config;

  // Default milestones if not provided
  const timelineItems = milestones || [
    { year: '2020', title: 'Founded', description: 'Started with a vision to make a difference' },
    { year: '2021', title: 'First Milestone', description: 'Reached 100 satisfied customers' },
    { year: '2022', title: 'Growth', description: 'Expanded our team and services' },
    { year: '2023', title: 'Today', description: 'Leading the industry with innovation' },
  ];

  return `
<section class="about-timeline">
  <div class="about-timeline-container">
    <div class="about-timeline-header">
      <h2 style="font-family: ${fontHeading};">${heading}</h2>
      <p style="font-family: ${fontBody};">${description}</p>
    </div>

    <div class="timeline">
      ${timelineItems
        .map(
          (item, index) => `
        <div class="timeline-item" data-index="${index}">
          <div class="timeline-marker" style="background: ${primaryColor};"></div>
          <div class="timeline-content">
            <div class="timeline-year" style="color: ${primaryColor};">${item.year}</div>
            <h3 class="timeline-title">${item.title}</h3>
            <p class="timeline-description">${item.description}</p>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  </div>
</section>

<style>
.about-timeline {
  padding: 6rem 2rem;
  background: #f7fafc;
}

.about-timeline-container {
  max-width: 900px;
  margin: 0 auto;
}

.about-timeline-header {
  text-align: center;
  margin-bottom: 4rem;
}

.about-timeline-header h2 {
  font-size: 2.75rem;
  font-weight: 700;
  color: #1a202c;
  margin: 0 0 1rem 0;
}

.about-timeline-header p {
  font-size: 1.25rem;
  color: #4a5568;
  max-width: 700px;
  margin: 0 auto;
  line-height: 1.7;
}

.timeline {
  position: relative;
  padding-left: 2rem;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #e2e8f0;
}

.timeline-item {
  position: relative;
  padding-bottom: 3rem;
  padding-left: 2rem;
  opacity: 0;
  animation: fadeInLeft 0.6s ease-out forwards;
}

.timeline-item:nth-child(1) { animation-delay: 0.1s; }
.timeline-item:nth-child(2) { animation-delay: 0.2s; }
.timeline-item:nth-child(3) { animation-delay: 0.3s; }
.timeline-item:nth-child(4) { animation-delay: 0.4s; }

.timeline-marker {
  position: absolute;
  left: -2rem;
  top: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 4px solid white;
  box-shadow: 0 0 0 3px currentColor;
  z-index: 2;
}

.timeline-content {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: transform 0.3s, box-shadow 0.3s;
}

.timeline-content:hover {
  transform: translateX(8px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.timeline-year {
  font-size: 1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem;
}

.timeline-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0 0 0.75rem 0;
}

.timeline-description {
  font-size: 1rem;
  color: #4a5568;
  line-height: 1.6;
  margin: 0;
}

@keyframes fadeInLeft {
  from {
    opacity: 0;
    transform: translateX(-30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@media (max-width: 768px) {
  .about-timeline {
    padding: 4rem 1.5rem;
  }

  .about-timeline-header h2 {
    font-size: 2rem;
  }

  .about-timeline-header p {
    font-size: 1.125rem;
  }

  .timeline {
    padding-left: 1.5rem;
  }

  .timeline-item {
    padding-left: 1.5rem;
  }

  .timeline-marker {
    left: -1.65rem;
  }

  .timeline-content {
    padding: 1.5rem;
  }
}
</style>
  `;
}

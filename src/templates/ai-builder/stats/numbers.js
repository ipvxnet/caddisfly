// Stats Numbers Template
// Display impressive numbers and metrics

export function statsNumbersTemplate(data, config) {
  const { heading, stats } = data;
  const { primary_color: primaryColor = '#667eea', font_heading: fontHeading = 'Inter', font_body: fontBody = 'Inter' } = config;

  // Default stats if not provided
  const statsList = stats || [
    { number: '10K+', label: 'Happy Customers' },
    { number: '50K+', label: 'Projects Completed' },
    { number: '99.9%', label: 'Uptime Guarantee' },
    { number: '24/7', label: 'Customer Support' },
  ];

  return `
<section class="stats-numbers" style="background: linear-gradient(135deg, ${primaryColor}10, ${primaryColor}05);">
  <div class="stats-numbers-container">
    ${heading ? `<h2 class="stats-heading" style="font-family: ${fontHeading};">${heading}</h2>` : ''}

    <div class="stats-grid">
      ${statsList
        .map(
          (stat, index) => `
        <div class="stat-item" data-index="${index}">
          <div class="stat-number" style="color: ${primaryColor}; font-family: ${fontHeading};">
            ${stat.number}
          </div>
          <div class="stat-label" style="font-family: ${fontBody};">
            ${stat.label}
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  </div>
</section>

<style>
.stats-numbers {
  padding: 5rem 2rem;
}

.stats-numbers-container {
  max-width: 1200px;
  margin: 0 auto;
}

.stats-heading {
  font-size: 2.75rem;
  font-weight: 700;
  color: #1a202c;
  text-align: center;
  margin: 0 0 4rem 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 3rem;
}

.stat-item {
  text-align: center;
  opacity: 0;
  animation: fadeInUp 0.8s ease-out forwards;
}

.stat-item:nth-child(1) { animation-delay: 0.1s; }
.stat-item:nth-child(2) { animation-delay: 0.2s; }
.stat-item:nth-child(3) { animation-delay: 0.3s; }
.stat-item:nth-child(4) { animation-delay: 0.4s; }

.stat-number {
  font-size: 4rem;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 0.75rem;
  display: block;
  animation: countUp 1.5s ease-out;
}

.stat-label {
  font-size: 1.125rem;
  color: #4a5568;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-item:hover .stat-number {
  transform: scale(1.1);
  transition: transform 0.3s;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes countUp {
  from {
    opacity: 0;
    transform: scale(0.5);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (max-width: 768px) {
  .stats-numbers {
    padding: 4rem 1.5rem;
  }

  .stats-heading {
    font-size: 2rem;
  }

  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 2rem;
  }

  .stat-number {
    font-size: 3rem;
  }

  .stat-label {
    font-size: 1rem;
  }
}
</style>
  `;
}

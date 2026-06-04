// Team Grid About Template
// Team member showcase with photos and bios

export function aboutTeamTemplate(data, config) {
  const { heading, description = '', team_members } = data;
  const { primaryColor, fontHeading, fontBody } = config;

  // Default team members if not provided
  const members = team_members || [
    {
      name: 'Sarah Johnson',
      role: 'CEO & Founder',
      bio: 'Visionary leader with 15 years of industry experience',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    },
    {
      name: 'Michael Chen',
      role: 'CTO',
      bio: 'Technology expert driving innovation and excellence',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    },
    {
      name: 'Emily Rodriguez',
      role: 'Head of Design',
      bio: 'Creative director crafting exceptional user experiences',
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
    },
    {
      name: 'David Park',
      role: 'Head of Operations',
      bio: 'Operations specialist ensuring seamless execution',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
    },
  ];

  return `
<section class="about-team">
  <div class="about-team-container">
    <div class="about-team-header">
      <h2 style="font-family: ${fontHeading};">${heading}</h2>
      <p style="font-family: ${fontBody};">${description}</p>
    </div>

    <div class="team-grid">
      ${members
        .map(
          (member, index) => `
        <div class="team-card" data-index="${index}">
          <div class="team-image-wrapper">
            <img src="${member.image}" alt="${member.name}" class="team-image">
            <div class="team-overlay" style="background: linear-gradient(135deg, ${primaryColor}ee, ${primaryColor}99);"></div>
          </div>
          <div class="team-info">
            <h3 class="team-name">${member.name}</h3>
            <div class="team-role" style="color: ${primaryColor};">${member.role}</div>
            <p class="team-bio">${member.bio}</p>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  </div>
</section>

<style>
.about-team {
  padding: 6rem 2rem;
  background: white;
}

.about-team-container {
  max-width: 1200px;
  margin: 0 auto;
}

.about-team-header {
  text-align: center;
  margin-bottom: 4rem;
}

.about-team-header h2 {
  font-size: 2.75rem;
  font-weight: 700;
  color: #1a202c;
  margin: 0 0 1rem 0;
}

.about-team-header p {
  font-size: 1.25rem;
  color: #4a5568;
  max-width: 700px;
  margin: 0 auto;
  line-height: 1.7;
}

.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2.5rem;
}

.team-card {
  opacity: 0;
  animation: fadeInUp 0.6s ease-out forwards;
}

.team-card:nth-child(1) { animation-delay: 0.1s; }
.team-card:nth-child(2) { animation-delay: 0.2s; }
.team-card:nth-child(3) { animation-delay: 0.3s; }
.team-card:nth-child(4) { animation-delay: 0.4s; }

.team-image-wrapper {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  aspect-ratio: 1;
}

.team-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s;
}

.team-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0;
  transition: opacity 0.4s;
}

.team-card:hover .team-image {
  transform: scale(1.1);
}

.team-card:hover .team-overlay {
  opacity: 1;
}

.team-info {
  text-align: center;
}

.team-name {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0 0 0.5rem 0;
}

.team-role {
  font-size: 1rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
}

.team-bio {
  font-size: 0.95rem;
  color: #4a5568;
  line-height: 1.6;
  margin: 0;
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

@media (max-width: 768px) {
  .about-team {
    padding: 4rem 1.5rem;
  }

  .about-team-header h2 {
    font-size: 2rem;
  }

  .team-grid {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 2rem;
  }
}
</style>
  `;
}

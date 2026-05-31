// Pricing Tables Template
// Pricing plans comparison

export function pricingTablesTemplate(data, config) {
  const { heading, description, plans } = data;
  const { primaryColor, secondaryColor, fontHeading, fontBody } = config;

  // Default pricing plans if not provided
  const pricingPlans = plans || [
    {
      name: 'Starter',
      price: '$29',
      period: 'per month',
      features: ['5 Projects', '10 GB Storage', 'Email Support', 'Basic Analytics'],
      highlighted: false,
    },
    {
      name: 'Professional',
      price: '$79',
      period: 'per month',
      features: ['Unlimited Projects', '100 GB Storage', 'Priority Support', 'Advanced Analytics', 'Custom Domain'],
      highlighted: true,
    },
    {
      name: 'Enterprise',
      price: '$199',
      period: 'per month',
      features: ['Unlimited Everything', '1 TB Storage', '24/7 Phone Support', 'White Label', 'Dedicated Account Manager'],
      highlighted: false,
    },
  ];

  return `
<section class="pricing-tables">
  <div class="pricing-tables-container">
    <div class="pricing-tables-header">
      <h2 style="font-family: ${fontHeading};">${heading}</h2>
      <p style="font-family: ${fontBody};">${description}</p>
    </div>

    <div class="pricing-grid">
      ${pricingPlans
        .map(
          (plan, index) => `
        <div class="pricing-card ${plan.highlighted ? 'highlighted' : ''}" data-index="${index}">
          ${plan.highlighted ? `<div class="pricing-badge" style="background: ${primaryColor};">Most Popular</div>` : ''}
          <h3 class="pricing-name">${plan.name}</h3>
          <div class="pricing-price-wrapper">
            <span class="pricing-price" style="color: ${plan.highlighted ? primaryColor : '#1a202c'};">${plan.price}</span>
            <span class="pricing-period">${plan.period}</span>
          </div>
          <ul class="pricing-features">
            ${plan.features
              .map(
                (feature) => `
              <li class="pricing-feature">
                <span class="feature-check" style="color: ${primaryColor};">✓</span>
                ${feature}
              </li>
            `
              )
              .join('')}
          </ul>
          <button class="pricing-cta" style="background: ${plan.highlighted ? primaryColor : '#f7fafc'}; color: ${plan.highlighted ? 'white' : '#1a202c'};">
            Get Started
          </button>
        </div>
      `
        )
        .join('')}
    </div>
  </div>
</section>

<style>
.pricing-tables {
  padding: 6rem 2rem;
  background: #f7fafc;
}

.pricing-tables-container {
  max-width: 1200px;
  margin: 0 auto;
}

.pricing-tables-header {
  text-align: center;
  margin-bottom: 4rem;
}

.pricing-tables-header h2 {
  font-size: 2.75rem;
  font-weight: 700;
  color: #1a202c;
  margin: 0 0 1rem 0;
}

.pricing-tables-header p {
  font-size: 1.25rem;
  color: #4a5568;
  max-width: 700px;
  margin: 0 auto;
  line-height: 1.7;
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  align-items: start;
}

.pricing-card {
  background: white;
  padding: 2.5rem;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: transform 0.3s, box-shadow 0.3s;
  position: relative;
  opacity: 0;
  animation: fadeInUp 0.6s ease-out forwards;
}

.pricing-card:nth-child(1) { animation-delay: 0.1s; }
.pricing-card:nth-child(2) { animation-delay: 0.2s; }
.pricing-card:nth-child(3) { animation-delay: 0.3s; }

.pricing-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
}

.pricing-card.highlighted {
  border: 2px solid currentColor;
  transform: scale(1.05);
}

.pricing-card.highlighted:hover {
  transform: scale(1.05) translateY(-8px);
}

.pricing-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  color: white;
  padding: 0.5rem 1.5rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pricing-name {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0 0 1.5rem 0;
  text-align: center;
}

.pricing-price-wrapper {
  text-align: center;
  margin-bottom: 2rem;
}

.pricing-price {
  font-size: 3rem;
  font-weight: 700;
  display: block;
  line-height: 1;
}

.pricing-period {
  font-size: 0.95rem;
  color: #718096;
}

.pricing-features {
  list-style: none;
  padding: 0;
  margin: 0 0 2rem 0;
}

.pricing-feature {
  padding: 0.75rem 0;
  color: #4a5568;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.feature-check {
  font-weight: 700;
  font-size: 1.25rem;
}

.pricing-cta {
  width: 100%;
  padding: 1rem 2rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
}

.pricing-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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
  .pricing-tables {
    padding: 4rem 1.5rem;
  }

  .pricing-tables-header h2 {
    font-size: 2rem;
  }

  .pricing-grid {
    grid-template-columns: 1fr;
  }

  .pricing-card.highlighted {
    transform: scale(1);
  }

  .pricing-card.highlighted:hover {
    transform: translateY(-8px);
  }
}
</style>
  `;
}

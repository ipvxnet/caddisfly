// Admin dashboard route

import { htmlResponse } from '../../utils/response.js';
import { sanitizeInput } from '../../utils/validation.js';

/**
 * Handle admin dashboard
 * @param {object} ctx - Request context
 * @returns {Response} HTML response
 */
export async function handleAdminDashboard(ctx) {
  const { user } = ctx;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Admin Dashboard - Caddisfly</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background: #f5f5f5;
          min-height: 100vh;
        }

        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 1.5rem 2rem;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .header-content {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header h1 {
          font-size: 1.75rem;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .user-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid white;
        }

        .user-name {
          font-weight: 600;
        }

        .logout-btn {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          text-decoration: none;
          font-size: 0.9rem;
          transition: background 0.3s ease;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .logout-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .container {
          max-width: 1200px;
          margin: 2rem auto;
          padding: 0 2rem;
        }

        .welcome-card {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
        }

        .welcome-card h2 {
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
          color: #333;
        }

        .welcome-card p {
          color: #666;
          font-size: 1rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: white;
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .stat-card h3 {
          font-size: 0.9rem;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 0.5rem;
        }

        .stat-value {
          font-size: 2rem;
          font-weight: bold;
          color: #667eea;
        }

        .placeholder {
          background: white;
          border-radius: 12px;
          padding: 3rem 2rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          text-align: center;
          color: #888;
        }

        .placeholder h3 {
          margin-bottom: 0.5rem;
          color: #666;
        }

        @media (max-width: 768px) {
          .header-content {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }

          .user-info {
            flex-direction: column;
          }

          .container {
            padding: 0 1rem;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-content">
          <h1>Caddisfly Admin</h1>
          <div class="user-info">
            ${user.avatarUrl ? `<img src="${sanitizeInput(user.avatarUrl)}" alt="${sanitizeInput(user.name)}" class="user-avatar">` : ''}
            <span class="user-name">${sanitizeInput(user.name)}</span>
            <a href="/logout" class="logout-btn">Logout</a>
          </div>
        </div>
      </div>

      <div class="container">
        <div class="welcome-card">
          <h2>Welcome back, ${sanitizeInput(user.name.split(' ')[0])}!</h2>
          <p>Logged in as ${sanitizeInput(user.email)}</p>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <h3>Total Projects</h3>
            <div class="stat-value">0</div>
          </div>
          <div class="stat-card">
            <h3>Active Projects</h3>
            <div class="stat-value">0</div>
          </div>
          <div class="stat-card">
            <h3>Pending Previews</h3>
            <div class="stat-value">0</div>
          </div>
        </div>

        <div class="placeholder">
          <h3>Project Management</h3>
          <p>Project listing and management will be available in Phase 2</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return htmlResponse(html);
}

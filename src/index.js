// Caddisfly - Main Entry Point
// Phase 1: Foundation Setup

import { Router } from './router.js';
import { handleError } from './middleware/error-handler.js';
import { handleCorsPrelight, applyCorsHeaders } from './middleware/cors.js';
import { authMiddleware } from './middleware/auth.js';
import { notFound } from './utils/response.js';

// Import route handlers
import { handleLanding } from './routes/public/landing.js';
import { handleLogin } from './routes/admin/login.js';
import { handleGoogleCallback } from './routes/api/auth/google-callback.js';
import { handleLogout } from './routes/admin/logout.js';
import { handleAdminDashboard } from './routes/admin/dashboard.js';
import { handlePreviewCreate } from './routes/api/preview/create.js';
import { handleManualProfile } from './routes/api/preview/manual.js';
import { handlePreviewView } from './routes/public/preview.js';
import { handlePreviewHtml } from './routes/public/preview-html.js';
import { handlePreviewAsset } from './routes/public/preview-asset.js';
import { handleVerify } from './routes/public/verify.js';

// AI Builder route handlers
import { handleAIBuilderLanding } from './routes/public/ai-builder-landing.js';
import { handleAIBuilderChat } from './routes/public/ai-builder-chat.js';
import { handleAIBuilderGenerating } from './routes/public/ai-builder-generating.js';
import { handleAIBuilderCustomize } from './routes/public/ai-builder-customize.js';
import { handleAIPreview } from './routes/public/ai-preview.js';
import { handleAIBuilderCreate } from './routes/api/ai-builder/create.js';
import { handleAIBuilderRespond } from './routes/api/ai-builder/respond.js';
import { handleAIBuilderGenerate } from './routes/api/ai-builder/generate.js';
import { handleAIBuilderUpload } from './routes/api/ai-builder/upload.js';
import { handleAIBuilderSectionUpdate } from './routes/api/ai-builder/sections.js';
import { handleSectionsReorder } from './routes/api/ai-builder/sections-reorder.js';
import { handleGetSectionEditor } from './routes/api/ai-builder/section-editor.js';
import { handleUpdateColors } from './routes/api/ai-builder/config-colors.js';
import { handleApplyTemplate } from './routes/api/ai-builder/apply-template.js';
import { handleUpdateFonts } from './routes/api/ai-builder/config-fonts.js';
import { handleAIEditPropose, handleAIEditApply } from './routes/api/ai-builder/ai-edit.js';
import { handleListPages, handleCreatePage, handleReorderPages, handleUpdatePage, handleDeletePage } from './routes/api/ai-builder/pages.js';
import { handleAIBuilderDeploy } from './routes/api/ai-builder/deploy.js';

// Initialize router
const router = new Router();

// Public routes
router.get('/', handleLanding);
router.get('/login', handleLogin);
router.get('/auth/google/callback', handleGoogleCallback);
router.get('/preview/:preview_id', handlePreviewView);
router.get('/preview/:preview_id/html/:page_index/:type', handlePreviewHtml);
router.get('/verify/:token', handleVerify);
router.get('/preview-asset/:preview_id/:filename', handlePreviewAsset);

// AI Builder public routes
router.get('/ai-builder', handleAIBuilderLanding);
router.get('/ai-builder/chat/:project_id', handleAIBuilderChat);
router.get('/ai-builder/generating/:project_id', handleAIBuilderGenerating);
router.get('/ai-builder/customize/:project_id', handleAIBuilderCustomize);
router.get('/ai-preview/:project_id', handleAIPreview);
router.get('/ai-preview/:project_id/:page_slug', handleAIPreview);

// API routes
router.post('/api/preview/create', handlePreviewCreate);
router.post('/api/preview/manual/:token', handleManualProfile);

// AI Builder API routes
router.post('/api/ai-builder/create', handleAIBuilderCreate);
router.post('/api/ai-builder/:project_id/respond', handleAIBuilderRespond);
router.post('/api/ai-builder/:project_id/generate-preview', handleAIBuilderGenerate);
router.post('/api/ai-builder/:project_id/upload', handleAIBuilderUpload);
router.get('/api/ai-builder/:project_id/sections/:section_id/editor', handleGetSectionEditor);
router.post('/api/ai-builder/:project_id/sections/:section_id/ai-edit', handleAIEditPropose);
router.post('/api/ai-builder/:project_id/sections/:section_id/ai-edit/apply', handleAIEditApply);
router.put('/api/ai-builder/:project_id/sections/:section_id', handleAIBuilderSectionUpdate);
router.put('/api/ai-builder/:project_id/sections/reorder', handleSectionsReorder);
router.put('/api/ai-builder/:project_id/config/colors', handleUpdateColors);
router.put('/api/ai-builder/:project_id/config/fonts', handleUpdateFonts);
router.post('/api/ai-builder/:project_id/template', handleApplyTemplate);
router.get('/api/ai-builder/:project_id/pages', handleListPages);
router.post('/api/ai-builder/:project_id/pages', handleCreatePage);
router.put('/api/ai-builder/:project_id/pages/reorder', handleReorderPages);
router.put('/api/ai-builder/:project_id/pages/:page_id', handleUpdatePage);
router.delete('/api/ai-builder/:project_id/pages/:page_id', handleDeletePage);
router.post('/api/ai-builder/:project_id/deploy', handleAIBuilderDeploy);

// Protected admin routes
router.get('/logout', handleLogout, [authMiddleware]);
router.get('/admin', handleAdminDashboard, [authMiddleware]);

/**
 * Main fetch handler
 */
export default {
  async fetch(request, env, ctx) {
    try {
      // Handle CORS preflight requests
      if (request.method === 'OPTIONS') {
        return handleCorsPrelight();
      }

      // Route the request
      let response = await router.route(request, env, ctx);

      // If no route matched, return 404
      if (!response) {
        response = notFound('Page not found');
      }

      // Apply CORS headers to response
      response = applyCorsHeaders(response);

      return response;
    } catch (error) {
      // Global error handling
      console.error('Unhandled error in fetch:', error);
      return handleError(error, request, env);
    }
  },
};

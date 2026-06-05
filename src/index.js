// Caddisfly - Main Entry Point
// Phase 1: Foundation Setup

import { Router } from './router.js';
import { handleError } from './middleware/error-handler.js';
import { handleCorsPrelight, applyCorsHeaders } from './middleware/cors.js';
import { authMiddleware, adminMiddleware } from './middleware/auth.js';
import { notFound } from './utils/response.js';

// Import route handlers
import { handleLanding } from './routes/public/landing.js';
import { handlePricing } from './routes/public/pricing.js';
import { handleTerms } from './routes/public/terms.js';
import { handlePrivacy } from './routes/public/privacy.js';
import { handleLogin } from './routes/admin/login.js';
import { handleGoogleCallback } from './routes/api/auth/google-callback.js';
import { handleLogout } from './routes/admin/logout.js';
import { handleAdminDashboard } from './routes/admin/dashboard.js';
import { handlePreviewCreate } from './routes/api/preview/create.js';
import { handleManualProfile } from './routes/api/preview/manual.js';
import { handlePreviewStatus } from './routes/api/preview/status.js';
import { handleJoke } from './routes/api/fun.js';
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
import { handlePublishedSite } from './routes/public/published-site.js';
import { handleStaticAsset, handleWebmanifest, handleOgImage, handleRobots, handleSitemap } from './routes/public/static-assets.js';
import { handleSetLang } from './routes/public/lang.js';
import { handleAIBuilderCreate } from './routes/api/ai-builder/create.js';
import { handleAIBuilderRespond } from './routes/api/ai-builder/respond.js';
import { handleAIBuilderGenerate } from './routes/api/ai-builder/generate.js';
import { handleAIBuilderUpload } from './routes/api/ai-builder/upload.js';
import { handleAIBuilderSectionUpdate } from './routes/api/ai-builder/sections.js';
import { handleSectionsReorder } from './routes/api/ai-builder/sections-reorder.js';
import { handleGetSectionEditor } from './routes/api/ai-builder/section-editor.js';
import { handleAddSection, handleDeleteSection } from './routes/api/ai-builder/section-create.js';
import { handleUpdateColors } from './routes/api/ai-builder/config-colors.js';
import { handleApplyTemplate } from './routes/api/ai-builder/apply-template.js';
import { handleUpdateFonts } from './routes/api/ai-builder/config-fonts.js';
import { handleAIEditPropose, handleAIEditApply } from './routes/api/ai-builder/ai-edit.js';
import { handleListPages, handleCreatePage, handleReorderPages, handleUpdatePage, handleDeletePage } from './routes/api/ai-builder/pages.js';
import { handleAIBuilderDeploy } from './routes/api/ai-builder/deploy.js';
import { handleUpdateSeo } from './routes/api/ai-builder/seo.js';
import { handleAddDomain, handleDomainStatus, handleRemoveDomain } from './routes/api/ai-builder/domains.js';

// Billing (Stripe + magic-link) route handlers
import { handleBilling, handleBillingVerify, handleBillingLogout } from './routes/public/billing.js';
import { handleBillingLogin, handleBillingCheckout, handleBillingPortal, handleCreditCheckout } from './routes/api/billing.js';
import { handleDashboard } from './routes/public/dashboard.js';
import { handleTeamAccept } from './routes/public/team-accept.js';
import { handleTeamInvite, handleTeamRole, handleTeamRemove } from './routes/api/team.js';
import { handleHelp } from './routes/public/help.js';
import { handleSupport } from './routes/public/support.js';
import { handleCreateTicket, handleReplyTicket } from './routes/api/support.js';
import { handleAdminTickets, handleAdminTicketReply, handleAdminTicketStatus } from './routes/admin/tickets.js';
import { handleAdminLegal, handleAdminLegalSave } from './routes/admin/legal.js';
import { handleStripeWebhook } from './routes/api/stripe-webhook.js';
import { billingAuth } from './middleware/billing-auth.js';
import { projectAccess } from './middleware/project-access.js';
import { handleTrack } from './routes/api/track.js';
import { handleSiteAnalytics } from './routes/public/analytics.js';
import { handleFormSubmit, handleFormDelete } from './routes/api/forms.js';
import { handleFormsInbox } from './routes/public/forms-inbox.js';

// Initialize router
const router = new Router();

// Public routes
router.get('/', handleLanding);
router.get('/pricing', handlePricing);
router.get('/terms', handleTerms);
router.get('/privacy', handlePrivacy);

// Brand static assets (favicons + manifest + OG image)
router.get('/favicon.ico', handleStaticAsset);
router.get('/favicon-16x16.png', handleStaticAsset);
router.get('/favicon-32x32.png', handleStaticAsset);
router.get('/favicon-48x48.png', handleStaticAsset);
router.get('/favicon-96x96.png', handleStaticAsset);
router.get('/apple-touch-icon.png', handleStaticAsset);
router.get('/android-chrome-192x192.png', handleStaticAsset);
router.get('/android-chrome-512x512.png', handleStaticAsset);
router.get('/site.webmanifest', handleWebmanifest);
router.get('/og.png', handleOgImage);
router.get('/robots.txt', handleRobots);
router.get('/sitemap.xml', handleSitemap);
router.get('/api/lang', handleSetLang);
router.get('/login', handleLogin);
router.get('/auth/google/callback', handleGoogleCallback);
router.get('/preview/:preview_id', handlePreviewView);
router.get('/preview/:preview_id/html/:page_index/:type', handlePreviewHtml);
router.get('/verify/:token', handleVerify);
router.get('/preview-asset/:preview_id/:filename', handlePreviewAsset);

// AI Builder public routes
router.get('/ai-builder', handleAIBuilderLanding);
router.get('/ai-builder/chat/:project_id', handleAIBuilderChat, [billingAuth, projectAccess]);
router.get('/ai-builder/generating/:project_id', handleAIBuilderGenerating, [billingAuth, projectAccess]);
router.get('/ai-builder/customize/:project_id', handleAIBuilderCustomize, [billingAuth, projectAccess]);
router.get('/ai-builder/analytics/:project_id', handleSiteAnalytics);
router.get('/ai-preview/:project_id', handleAIPreview);
router.get('/ai-preview/:project_id/:page_slug', handleAIPreview);
router.get('/site/:project_id', handlePublishedSite);
router.get('/site/:project_id/:page_slug', handlePublishedSite);

// Billing (magic-link auth; billingAuth sets ctx.billingEmail, never blocks)
router.get('/billing', handleBilling, [billingAuth]);
router.get('/billing/verify/:token', handleBillingVerify);
router.get('/billing/logout', handleBillingLogout);

// Customer dashboard (websites + team) and team management
router.get('/dashboard', handleDashboard, [billingAuth]);
router.get('/team/accept/:token', handleTeamAccept);

// Help/docs (public) + support tickets (customer, magic-link auth)
router.get('/help', handleHelp);
router.get('/support', handleSupport, [billingAuth]);
router.post('/api/support/ticket', handleCreateTicket, [billingAuth]);
router.post('/api/support/ticket/:public_id/reply', handleReplyTicket, [billingAuth]);

// API routes
router.post('/api/preview/create', handlePreviewCreate);
router.post('/api/preview/manual/:token', handleManualProfile);
router.get('/api/preview/:preview_id/status', handlePreviewStatus);
router.get('/api/fun/joke', handleJoke);

// Analytics beacon (public, cookieless)
router.post('/api/track', handleTrack);

// Contact-form submissions from published sites (public, cross-origin like /api/track)
router.post('/api/forms/submit', handleFormSubmit);

// AI Builder API routes
router.post('/api/ai-builder/create', handleAIBuilderCreate);
// All project-scoped editing routes are gated [billingAuth, projectAccess]:
// signed-in non-members are blocked (cross-account); deploy/domains additionally
// check ctx.projectRole inside their handlers.
const PROJ = [billingAuth, projectAccess];
router.post('/api/ai-builder/:project_id/respond', handleAIBuilderRespond, PROJ);
router.post('/api/ai-builder/:project_id/generate-preview', handleAIBuilderGenerate, PROJ);
router.post('/api/ai-builder/:project_id/upload', handleAIBuilderUpload, PROJ);
router.get('/api/ai-builder/:project_id/sections/:section_id/editor', handleGetSectionEditor, PROJ);
router.post('/api/ai-builder/:project_id/sections/:section_id/ai-edit', handleAIEditPropose, PROJ);
router.post('/api/ai-builder/:project_id/sections/:section_id/ai-edit/apply', handleAIEditApply, PROJ);
router.put('/api/ai-builder/:project_id/sections/:section_id', handleAIBuilderSectionUpdate, PROJ);
router.put('/api/ai-builder/:project_id/sections/reorder', handleSectionsReorder, PROJ);
router.post('/api/ai-builder/:project_id/sections', handleAddSection, PROJ);
router.delete('/api/ai-builder/:project_id/sections/:section_id', handleDeleteSection, PROJ);
router.put('/api/ai-builder/:project_id/config/colors', handleUpdateColors, PROJ);
router.put('/api/ai-builder/:project_id/config/fonts', handleUpdateFonts, PROJ);
router.post('/api/ai-builder/:project_id/template', handleApplyTemplate, PROJ);
router.get('/api/ai-builder/:project_id/pages', handleListPages, PROJ);
router.post('/api/ai-builder/:project_id/pages', handleCreatePage, PROJ);
router.put('/api/ai-builder/:project_id/pages/reorder', handleReorderPages, PROJ);
router.put('/api/ai-builder/:project_id/pages/:page_id', handleUpdatePage, PROJ);
router.delete('/api/ai-builder/:project_id/pages/:page_id', handleDeletePage, PROJ);
router.put('/api/ai-builder/:project_id/seo', handleUpdateSeo, PROJ);
router.post('/api/ai-builder/:project_id/deploy', handleAIBuilderDeploy, PROJ);
router.post('/api/ai-builder/:project_id/domains', handleAddDomain, PROJ);
router.get('/api/ai-builder/:project_id/domains/:id/status', handleDomainStatus, PROJ);
router.delete('/api/ai-builder/:project_id/domains/:id', handleRemoveDomain, PROJ);

// Contact-form inbox (owner-facing; same access model as customize)
router.get('/ai-builder/forms/:project_id', handleFormsInbox, PROJ);
router.delete('/api/ai-builder/:project_id/forms/:id', handleFormDelete, PROJ);

// Billing API
router.post('/api/billing/login', handleBillingLogin);
router.post('/api/billing/checkout', handleBillingCheckout, [billingAuth]);
router.post('/api/billing/credits/checkout', handleCreditCheckout, [billingAuth]);
router.post('/api/billing/portal', handleBillingPortal, [billingAuth]);
router.post('/api/team/invite', handleTeamInvite, [billingAuth]);
router.post('/api/team/role', handleTeamRole, [billingAuth]);
router.post('/api/team/remove', handleTeamRemove, [billingAuth]);
router.post('/api/stripe/webhook', handleStripeWebhook);

// Protected admin routes
router.get('/logout', handleLogout, [authMiddleware]);
router.get('/admin', handleAdminDashboard, [authMiddleware, adminMiddleware]);
router.get('/admin/tickets', handleAdminTickets, [authMiddleware, adminMiddleware]);
router.post('/api/admin/tickets/:public_id/reply', handleAdminTicketReply, [authMiddleware, adminMiddleware]);
router.post('/api/admin/tickets/:public_id/status', handleAdminTicketStatus, [authMiddleware, adminMiddleware]);
router.get('/admin/legal', handleAdminLegal, [authMiddleware, adminMiddleware]);
router.post('/api/admin/legal/:slug', handleAdminLegalSave, [authMiddleware, adminMiddleware]);

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

# Phase 2 Testing Guide

## Quick Start Testing

### 1. Deploy to Preview Environment (Recommended)
```bash
npm run deploy:preview
```

The app will be deployed to: `https://caddisfly-preview.fabianodevtools.workers.dev`

**Why preview instead of localhost?**
- Saves local memory and CPU
- Tests in production-like environment
- Uses Cloudflare's infrastructure
- Faster iterations with remote database

### 2. Test the Landing Page
1. Open browser to `https://caddisfly-preview.fabianodevtools.workers.dev`
2. Verify the landing page loads with:
   - Caddisfly branding
   - Feature list
   - Preview request form (email + URL inputs)

### Alternative: Local Development (Not Recommended)
If you need to test locally:
```bash
npm run dev
# Visit http://localhost:8787
```

### 3. Test Preview Creation

#### Test Case 1: Valid Website
```
Email: test@example.com
URL: https://example.com
```

**Expected Result:**
- Form shows loading spinner
- Success message appears with preview link
- Console logs show scraping progress
- Database has new project record
- R2 has 4 HTML files
- Preview link works

#### Test Case 2: Invalid Email
```
Email: invalid-email
URL: https://example.com
```

**Expected Result:**
- Error message: "Please enter a valid email address"
- Form does not submit

#### Test Case 3: Invalid URL
```
Email: test@example.com
URL: not-a-url
```

**Expected Result:**
- Error message: "Please enter a valid website URL"
- Form does not submit

#### Test Case 4: Localhost URL (Should Fail)
```
Email: test@example.com
URL: http://localhost:3000
```

**Expected Result:**
- Error message: "Valid website URL is required"
- Form does not submit

### 4. Test Preview Display

1. After successful preview creation, click the preview link
2. Verify split-screen display:
   - Left side: Original HTML
   - Right side: Refactored HTML
   - Page tabs at top (Homepage, Page 2)
3. Click between page tabs
4. Test on mobile (resize browser to < 768px)
   - Should stack vertically
5. Test share button functionality

---

## Database Verification

### Check Projects Table
```bash
npx wrangler d1 execute caddisfly-db --local --command="SELECT id, preview_id, customer_email, website_url, status, created_at FROM projects"
```

**Expected Output:**
```
┌────┬──────────────────────────────────────┬─────────────────────┬────────────────────┬────────────────┬────────────┐
│ id │ preview_id                           │ customer_email      │ website_url        │ status         │ created_at │
├────┼──────────────────────────────────────┼─────────────────────┼────────────────────┼────────────────┼────────────┤
│ 1  │ abc123-def456-...                    │ test@example.com    │ https://example.com│ preview_ready  │ 1234567890 │
└────┴──────────────────────────────────────┴─────────────────────┴────────────────────┴────────────────┴────────────┘
```

### Check Scraped Pages Table
```bash
npx wrangler d1 execute caddisfly-db --local --command="SELECT id, project_id, page_url, page_index, original_r2_path, refactored_r2_path FROM scraped_pages"
```

**Expected Output:**
```
┌────┬────────────┬─────────────────────┬────────────┬──────────────────────────────────┬────────────────────────────────────┐
│ id │ project_id │ page_url            │ page_index │ original_r2_path                 │ refactored_r2_path                 │
├────┼────────────┼─────────────────────┼────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ 1  │ 1          │ https://example.com │ 0          │ projects/1/original/page-0.html  │ projects/1/refactored/page-0.html  │
│ 2  │ 1          │ https://example.com/about │ 1  │ projects/1/original/page-1.html  │ projects/1/refactored/page-1.html  │
└────┴────────────┴─────────────────────┴────────────┴──────────────────────────────────┴────────────────────────────────────┘
```

---

## R2 Storage Verification

### List R2 Objects
```bash
npx wrangler r2 object list caddisfly-storage --local
```

**Expected Output:**
```
projects/1/original/page-0.html
projects/1/original/page-1.html
projects/1/refactored/page-0.html
projects/1/refactored/page-1.html
```

### Download and Inspect Files (Optional)
```bash
# Download original homepage
npx wrangler r2 object get caddisfly-storage projects/1/original/page-0.html --local --file=test-original.html

# Download refactored homepage
npx wrangler r2 object get caddisfly-storage projects/1/refactored/page-0.html --local --file=test-refactored.html

# Compare files
diff test-original.html test-refactored.html
```

---

## API Testing with cURL

### Test Preview Creation
```bash
curl -X POST https://caddisfly-preview.fabianodevtools.workers.dev/api/preview/create \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "website": "https://example.com"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "previewId": "abc123-def456-...",
  "previewUrl": "https://caddisfly-preview.fabianodevtools.workers.dev/preview/abc123-def456-...",
  "message": "Preview created! Email pending - save this link.",
  "pagesProcessed": 2
}
```

### Test Invalid Email
```bash
curl -X POST https://caddisfly-preview.fabianodevtools.workers.dev/api/preview/create \
  -H "Content-Type: application/json" \
  -d '{
    "email": "invalid",
    "website": "https://example.com"
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Invalid request",
  "errors": ["Valid email address is required"]
}
```

### Test Preview Display
```bash
# Replace {preview_id} with actual preview ID
curl https://caddisfly-preview.fabianodevtools.workers.dev/preview/{preview_id}
```

**Expected Response:** HTML page with split-screen comparison

---

## Error Scenario Testing

### 1. Unreachable Website
```
Email: test@example.com
URL: https://thisdoesnotexist123456789.com
```

**Expected:**
- Error message about DNS or website not found
- Project status set to 'failed' in database

### 2. Timeout (Slow Website)
```
Email: test@example.com
URL: https://httpbin.org/delay/35
```

**Expected:**
- Timeout after 30 seconds
- Error message: "Unable to reach website (timeout)"

### 3. Website Returns 403
```
Email: test@example.com
URL: https://www.google.com (some sites may block bots)
```

**Expected:**
- Error message: "Website blocks automated access"

### 4. Very Large HTML (Edge Case)
Test with a website known to have large HTML files.

**Expected:**
- AI chunking kicks in
- Preview still created successfully (may take longer)

---

## AI Refactoring Testing

### Verify AI Output Quality

1. Create a preview for a simple website
2. Open preview in browser
3. Compare original vs refactored:

**Check for:**
- ✅ Modern HTML5 semantic tags (`<header>`, `<main>`, `<footer>`, etc.)
- ✅ Responsive CSS with flexbox/grid
- ✅ Mobile-friendly viewport meta tag
- ✅ Clean, organized CSS in `<style>` tag
- ✅ Content preserved exactly
- ✅ No inline styles
- ✅ Accessibility improvements (alt text, ARIA labels)

### Fallback Testing

To test the fallback mechanism:
1. Temporarily disable AI binding in wrangler.toml
2. Create a preview
3. Verify fallback CSS template is applied

---

## Mobile Responsiveness Testing

### Desktop (> 768px)
- Split-screen layout side-by-side
- Page tabs horizontal
- Both iframes visible simultaneously

### Mobile (< 768px)
- Stacked layout (vertical)
- Page tabs remain clickable
- One iframe visible at a time
- Touch-friendly interface

### Test Viewports
```
Desktop: 1920x1080
Tablet: 768x1024
Mobile: 375x667
```

---

## Performance Testing

### Timing Benchmarks
Expected times (will vary based on website):
- **Scraping**: 2-5 seconds per page
- **AI Refactoring**: 5-15 seconds per page
- **R2 Upload**: < 1 second per file
- **Total**: 30-60 seconds for complete preview

### Monitor Console Logs
```bash
npm run dev
```

Watch for:
```
Creating preview for test@example.com - https://example.com
Created project 1 with preview_id abc123...
Scraping homepage: https://example.com
Scraped 2 pages
Processing page 0: https://example.com
Refactored page 0 successfully
Uploaded page 0 to R2
Processing page 1: https://example.com/about
Refactored page 1 successfully
Uploaded page 1 to R2
Preview ready for project 1
```

---

## Email Testing (When Configured)

Once email binding is configured:

### Test Email Delivery
1. Create preview with your real email
2. Check inbox for email from `noreply@caddisfly.ai`
3. Verify email contains:
   - Preview link button
   - Proper branding
   - "View Your Preview" CTA
   - Footer with validity note

### Test Email Fallback
1. Cause email to fail (invalid binding)
2. Verify:
   - Preview still created
   - Success response includes warning
   - User can still access preview via URL

---

## Integration Testing Checklist

### End-to-End Flow
- [ ] User visits landing page
- [ ] User fills preview form
- [ ] Form validation works (client-side)
- [ ] API validates inputs (server-side)
- [ ] Project created in database
- [ ] Website scraped (2 pages)
- [ ] HTML refactored by AI
- [ ] Files uploaded to R2
- [ ] Database updated with paths
- [ ] Email sent (or gracefully skipped)
- [ ] Success response returned
- [ ] Preview link works
- [ ] Split-screen displays correctly
- [ ] Page tabs switch properly
- [ ] Mobile layout works
- [ ] Share button functions

### Error Handling
- [ ] Invalid email rejected
- [ ] Invalid URL rejected
- [ ] Unreachable website handled
- [ ] Timeout handled (30s)
- [ ] 403/500 errors handled
- [ ] AI failure falls back to template
- [ ] Email failure doesn't break flow
- [ ] R2 failure cleans up properly

---

## Deployment Testing

### Preview Environment
```bash
npm run deploy:preview
```

Test at: `https://caddisfly-preview.fabianodevtools.workers.dev`

### Production Environment
```bash
npm run deploy:prod
```

Test at: `https://caddisfly.ai`

### Pre-Deployment Checklist
- [ ] All tests pass locally
- [ ] Database migration applied
- [ ] Email binding configured (production)
- [ ] AI binding active
- [ ] R2 bucket accessible
- [ ] Environment variables set
- [ ] Secrets configured (if any)
- [ ] Domain configured (production)

---

## Troubleshooting

### "AI binding not available"
**Solution:** Ensure Workers AI is enabled in your Cloudflare account and binding is configured in wrangler.toml

### "Email binding not available"
**Solution:** This is expected in development. Email is optional and will be skipped gracefully.

### "Database error"
**Solution:** Run migration: `npx wrangler d1 execute caddisfly-db --local --file=./migrations/002_phase2_preview.sql`

### "R2 bucket not found"
**Solution:** Create bucket: `npm run r2:create`

### "Preview not found"
**Solution:** Check database for preview_id, verify it matches URL parameter

### Preview shows blank iframes
**Solution:** Check R2 for files, verify HTML content is valid, check browser console for errors

---

## Success Criteria

Phase 2 testing is complete when:
- ✅ All manual test cases pass
- ✅ API returns expected responses
- ✅ Database records are created correctly
- ✅ R2 files are stored and retrievable
- ✅ Preview display works on desktop and mobile
- ✅ Error handling works for all scenarios
- ✅ Performance is acceptable (< 60s per preview)
- ✅ AI refactoring produces quality output
- ✅ Email gracefully skips when binding unavailable
- ✅ Ready for production deployment

---

## Next Steps

1. Test with real websites (various sizes and complexities)
2. Configure email service for production
3. Deploy to preview environment
4. User acceptance testing
5. Deploy to production
6. Monitor logs and errors
7. Iterate based on user feedback

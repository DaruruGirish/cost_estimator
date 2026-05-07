# Staging Configuration Guide

## Problem
The frontend is trying to connect to a hardcoded EC2 URL that doesn't resolve: `http://ec2-54-123-45-67.compute-1.amazonaws.com:3000`

## Solutions

### Option 1: Runtime Configuration (No Rebuild Required) ✅ Recommended

Edit `index.html` and uncomment the script tag:

```html
<script>
  window.__API_BASE_URL__ = 'http://your-actual-staging-backend-url:3000';
</script>
```

Replace `your-actual-staging-backend-url` with your actual staging backend URL.

**Advantages:**
- No rebuild needed
- Can be changed without redeploying the entire frontend
- Works immediately after deployment

### Option 2: Environment Variable (Requires Rebuild)

1. Create a `.env` file in the `frontend` directory:
```bash
VITE_API_URL=http://your-actual-staging-backend-url:3000
```

2. Rebuild the frontend:
```bash
cd frontend
npm run build
```

3. Deploy the new build.

### Option 3: Docker Build Argument

If using Docker, pass the API URL as a build argument:

```bash
docker build --build-arg VITE_API_URL=http://your-staging-backend-url:3000 -t frontend .
```

## Finding Your Staging Backend URL

1. Check your staging backend deployment
2. Look for the backend service URL in your deployment configuration
3. Ensure the backend is accessible from the frontend's location
4. Verify CORS is configured correctly on the backend

## Quick Fix for Current Deployment

1. Edit `index.html` in your deployed frontend
2. Add the script tag with your correct staging backend URL
3. No rebuild needed - just update the HTML file


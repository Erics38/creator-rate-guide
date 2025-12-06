# Netlify Deployment Guide for RateQ

## Quick Setup

Your RateQ app is now ready to deploy to Netlify! Follow these steps:

### 1. Push Changes to GitHub

```bash
git add .
git commit -m "Add Netlify configuration and rename to RateQ"
git push
```

### 2. Configure Netlify Site Settings

Go to your Netlify dashboard for this site and configure:

#### Build Settings (should auto-detect from netlify.toml):
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: 18

#### Environment Variables

Add these environment variables in Netlify dashboard:
(Site Settings → Environment Variables)

```
VITE_API_URL=https://k0oldo3mk1.execute-api.us-east-1.amazonaws.com/prod
VITE_AWS_REGION=us-east-1
VITE_USER_POOL_ID=us-east-1_FFRYk7D24
VITE_USER_POOL_CLIENT_ID=7j6f0h3cmi4imtv9p9h9c7p73q
```

### 3. Deploy

Once you push to GitHub, Netlify will automatically:
1. Detect the push
2. Install dependencies
3. Build your app
4. Deploy to your custom URL

### 4. Get Your Live URL

After deployment, you'll get a URL like:
- `https://your-site-name.netlify.app`

You can customize this in Site Settings → Domain Management

## Files Added for Netlify

- **netlify.toml** - Netlify configuration file
  - Build settings
  - Redirect rules for SPA routing
  - Security headers
  - Cache control for assets

## Post-Deployment Checklist

- [ ] Push code to GitHub
- [ ] Add environment variables in Netlify dashboard
- [ ] Verify build succeeds
- [ ] Test login/signup functionality
- [ ] Test saving collaborations
- [ ] Verify data loads from DynamoDB
- [ ] Share URL with others!

## Updating CORS (Important!)

Once you have your Netlify URL, update your API Gateway CORS settings:

1. Go to `infrastructure/lib/infrastructure-stack.ts`
2. Find the CORS configuration (around line 115)
3. Replace `'*'` with your Netlify URL:

```typescript
allowOrigins: ['https://your-site-name.netlify.app']
```

4. Redeploy infrastructure:
```bash
cd infrastructure
cdk deploy
```

## Custom Domain (Optional)

To use a custom domain:
1. Go to Site Settings → Domain Management
2. Add your custom domain
3. Follow Netlify's DNS configuration instructions
4. Update CORS with your custom domain

## Troubleshooting

### Build fails
- Check that all environment variables are set
- Verify Node version is 18
- Check build logs for specific errors

### Auth not working
- Verify all 4 Cognito environment variables are set
- Check browser console for errors
- Ensure VITE_ prefix is present on all variables

### API calls failing
- Check CORS settings in API Gateway
- Verify API_URL environment variable is correct
- Check CloudWatch logs for Lambda errors

## Support

For issues, check:
- Build logs in Netlify dashboard
- Browser console (F12) for frontend errors
- CloudWatch logs for backend errors

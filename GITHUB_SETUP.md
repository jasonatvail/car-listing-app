# GitHub Setup Instructions

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `car-listing-app` (or your preferred name)
3. Description: "Modern car listing platform with React, FastAPI, and AWS ECS"
4. Make it **Public** (already built images in public ECR)
5. Do **NOT** initialize with README, .gitignore, or license (we have them locally)
6. Click "Create repository"

## Step 2: Add GitHub Secrets

After creating the repo, add these secrets:

1. Go to Settings → Secrets and variables → Actions
2. Add these **Repository secrets**:

```
AWS_ACCESS_KEY_ID = <your-aws-access-key>
AWS_SECRET_ACCESS_KEY = <your-aws-secret-key>
```

## Step 3: Push to GitHub

Run these commands locally:

```bash
cd /Users/jasonvail/Documents/SoftwareEngineering/CarListingVisualization

# Add GitHub as remote (replace USERNAME with your GitHub username)
git remote add origin https://github.com/USERNAME/car-listing-app.git

# Rename branch if needed (usually already 'main')
git branch -M main

# Push code
git push -u origin main
```

## Step 4: Create GitHub Environments (Optional but Recommended)

For safer production deployments:

1. Settings → Environments → New environment
2. Create `staging` environment
3. Create `production` environment
4. Add required reviewers for production (optional)

## Step 5: Test Deployments

**Test Dev Deployment:**
```bash
git push origin main
```

**Test Staging Deployment:**
```bash
git tag staging-1.0.0
git push origin staging-1.0.0
```

**Test Production Deployment:**
```bash
git tag v1.0.0
git push origin v1.0.0
```

## Deployment Flow

| Action | Trigger | Target | Auto-deploy? |
|--------|---------|--------|--------------|
| Push to main | `git push origin main` | Dev | ✅ Yes |
| Create staging tag | `git tag staging-*` | Staging | ✅ Yes |
| Create release tag | `git tag v*` | Production | ✅ Yes |

## GitHub Actions Features

✅ Automatic Docker builds  
✅ Push to AWS ECR Public  
✅ Update ECS services  
✅ Wait for deployment stability  
✅ Create GitHub releases  
✅ Deployment summaries

Check Actions tab after pushing to see workflow status.

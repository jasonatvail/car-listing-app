#!/bin/bash
# setup-credentials.sh - Configure secure credential storage

set -e

echo "🔐 Setting up secure credential management..."
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    echo "✅ Detected macOS"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    echo "✅ Detected Linux"
else
    echo "⚠️  Unsupported OS: $OSTYPE"
    OS="unknown"
fi

# 1. Setup Docker credential helper for ECR
echo ""
echo "📦 Step 1: Docker Credential Helper"
echo "-----------------------------------"

if [[ "$OS" == "macos" ]]; then
    if command -v brew &> /dev/null; then
        echo "Installing docker-credential-helper-ecr via Homebrew..."
        brew install docker-credential-helper-ecr || echo "Already installed or error occurred"
    else
        echo "⚠️  Homebrew not found. Please install manually:"
        echo "   Visit: https://github.com/awslabs/amazon-ecr-credential-helper"
    fi
elif [[ "$OS" == "linux" ]]; then
    echo "For Linux, install manually:"
    echo "  sudo apt-get install amazon-ecr-credential-helper"
    echo "  Or download from: https://github.com/awslabs/amazon-ecr-credential-helper/releases"
fi

# 2. Configure Docker config
echo ""
echo "🐳 Step 2: Configure Docker"
echo "---------------------------"

DOCKER_CONFIG="$HOME/.docker/config.json"
DOCKER_DIR="$HOME/.docker"

if [ ! -d "$DOCKER_DIR" ]; then
    mkdir -p "$DOCKER_DIR"
    echo "Created $DOCKER_DIR"
fi

if [ -f "$DOCKER_CONFIG" ]; then
    echo "⚠️  Docker config already exists at $DOCKER_CONFIG"
    echo "Backing up to $DOCKER_CONFIG.backup"
    cp "$DOCKER_CONFIG" "$DOCKER_CONFIG.backup"
fi

# Create or update config
cat > "$DOCKER_CONFIG" << 'EOF'
{
  "credHelpers": {
    "public.ecr.aws": "ecr-login"
  }
}
EOF

echo "✅ Docker config updated: $DOCKER_CONFIG"

# 3. Setup backend .env
echo ""
echo "📝 Step 3: Backend Environment Variables"
echo "----------------------------------------"

if [ ! -f "backend/.env" ]; then
    echo "Creating backend/.env from example..."
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env"
    echo "⚠️  IMPORTANT: Edit backend/.env with your actual database credentials!"
else
    echo "✅ backend/.env already exists"
fi

# 4. Verify .gitignore
echo ""
echo "🚫 Step 4: Verify .gitignore"
echo "----------------------------"

if grep -q "^\.env$" .gitignore; then
    echo "✅ .env is in .gitignore"
else
    echo "⚠️  .env is NOT in .gitignore - this is a security risk!"
fi

# 5. Check for exposed credentials
echo ""
echo "🔍 Step 5: Security Audit"
echo "-------------------------"

if git ls-files | grep -E "\.env$" > /dev/null; then
    echo "⚠️  WARNING: .env files are tracked in git!"
    echo "   Run: git rm --cached backend/.env"
else
    echo "✅ No .env files tracked in git"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env with your database credentials"
echo "2. Test Docker ECR login:"
echo "   aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws"
echo "3. Review SECURITY.md for more best practices"
echo ""

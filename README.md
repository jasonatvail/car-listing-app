# Car Listing Application

A modern car listing platform with React frontend, FastAPI backend, and PostgreSQL database.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Python FastAPI + uvicorn + psycopg2
- **Database**: PostgreSQL (AWS RDS)
- **Deployment**: AWS ECS Fargate + Application Load Balancer
- **CI/CD**: GitHub Actions
- **Container Registry**: AWS ECR Public

## Project Structure

```
├── src/                          # React frontend
│   ├── components/               # React components
│   ├── utils/                    # Utility functions
│   └── App.tsx                   # Main app component
├── backend/                      # FastAPI backend
│   ├── main.py                   # FastAPI app
│   ├── requirements.txt          # Python dependencies
│   └── Dockerfile                # Backend image
├── Dockerfile                    # Frontend image
├── docker-compose.yml            # Local development
├── docker-compose.ecs.yml        # ECS image build
├── template.yaml                 # CloudFormation template
└── .github/workflows/            # GitHub Actions
    ├── deploy-dev.yml            # Auto-deploy on main
    ├── deploy-staging.yml        # Deploy on staging-* tags
    └── deploy-prod.yml           # Deploy on v* tags
```

## Local Development

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- Python 3.11+

### Setup

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd CarListingVisualization
   ```

2. **Environment variables:**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your database credentials
   ```

3. **Start local stack:**
   ```bash
   docker-compose up
   ```

   - Frontend: http://localhost:5173
   - Backend: http://localhost:5001

## Deployment

### Automated Deployment with GitHub Actions

#### Dev (automatic)
Pushes to `main` branch automatically deploy to dev environment.

```bash
git push origin main
```

#### Staging
Create a staging tag to deploy to staging environment.

```bash
git tag staging-1.0.0
git push origin staging-1.0.0
```

#### Production
Create a release tag to deploy to production.

```bash
git tag v1.0.0
git push origin v1.0.0
```

### CloudFormation Template

The `template.yaml` defines:
- **ECS Cluster** for container orchestration
- **Application Load Balancer** for routing
- **ECS Services** for backend and frontend
- **CloudWatch Logs** for monitoring
- **Security Groups** for network isolation

### Deploy Infrastructure

```bash
aws cloudformation deploy \
  --template-file template.yaml \
  --stack-name car-listing-prod \
  --region us-east-2 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    DBHostParameter=<rds-host> \
    DBNameParameter=<db-name> \
    DBUserParameter=<db-user> \
    DBPasswordParameter=<db-password> \
    BackendImageUri=public.ecr.aws/c9g5y1u8/carswebapppublic:backend-prod \
    FrontendImageUri=public.ecr.aws/c9g5y1u8/carswebapppublic:frontend-prod \
    VpcId=<vpc-id> \
    PublicSubnets=subnet-xxx,subnet-yyy \
    TaskSubnets=subnet-xxx,subnet-yyy
```

## Environment Variables

### Backend (.env)

```env
PGHOST=your-database-host.rds.amazonaws.com
PGPORT=5432
PGDATABASE=your-database-name
PGUSER=your-username
PGPASSWORD=your-password
PORT=5001
```

## GitHub Actions Secrets

Required secrets in GitHub repository settings:

- `AWS_ACCESS_KEY_ID` - AWS IAM access key
- `AWS_SECRET_ACCESS_KEY` - AWS IAM secret key

## API Endpoints

### Backend API

- `GET /` - Health check
- `GET /api/listings` - Get listings with filters
- `GET /api/makes` - Get car makes
- `GET /api/models` - Get car models
- `GET /api/drives` - Get drive types
- `GET /api/transmissions` - Get transmission types
- `POST /api/remove-duplicates` - Remove duplicate listings (streaming)

### Frontend

- `/` - Main application
- `/api/*` - Proxied to backend

## Monitoring

### CloudWatch Logs

```bash
# View backend logs
aws logs tail /ecs/car-listing-prod/backend --follow --region us-east-2

# View frontend logs
aws logs tail /ecs/car-listing-prod/frontend --follow --region us-east-2
```

### ECS Service Health

```bash
# Check service status
aws ecs describe-services \
  --cluster car-listing-prod \
  --services prod-backend prod-frontend \
  --region us-east-2
```

## Troubleshooting

### Tasks not starting?

1. **Check security groups** - Verify ECS security group has access to RDS
2. **Check environment variables** - Ensure DB credentials are correct
3. **Check logs** - `aws logs tail /ecs/... --follow`
4. **Verify image exists** - Confirm ECR images were pushed successfully

### Database connection failing?

```bash
# Verify RDS security group inbound rule
# Allow ECS security group on port 5432

aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxx \
  --protocol tcp \
  --port 5432 \
  --source-group sg-yyyy
```

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -am 'Add feature'`
3. Push to branch: `git push origin feature/your-feature`
4. Create Pull Request

## Versioning

- **Dev**: Latest from `main` branch
- **Staging**: Tagged as `staging-*` (e.g., `staging-1.0.0`)
- **Production**: Tagged as `v*` (e.g., `v1.0.0`)

## License

MIT

# Build argument to choose between dev and lambda
ARG BUILD_TARGET=dev

# Development image - optimized
FROM python:3.11-alpine AS dev

WORKDIR /app

# Install only essential build dependencies
RUN apk add --no-cache \
    postgresql-client \
    gcc \
    musl-dev \
    postgresql-dev \
    && pip install --no-cache-dir --upgrade pip

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && apk del gcc musl-dev postgresql-dev

# Copy application code
COPY . .

# Expose port for local development
EXPOSE 5001

# Run uvicorn for development
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5001", "--reload"]

# Production image for ECS
FROM python:3.11-slim AS production

WORKDIR /app

# Install build deps for binary packages, install python deps, then remove build deps
COPY requirements.txt .
RUN apt-get update && apt-get install -y gcc libpq-dev build-essential curl ca-certificates \
    && pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && mkdir -p /app/certs \
    && curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o /app/certs/rds-global-bundle.pem \
    && apt-get remove -y build-essential gcc libpq-dev curl \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Copy application code
COPY . .

# Expose port for production
EXPOSE 5001

# Default CA bundle for RDS SSL verification
ENV PGSSLROOTCERT=/app/certs/rds-global-bundle.pem

# Run uvicorn for production
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5001"]

# Lambda image - optimized
FROM public.ecr.aws/lambda/python:3.11 AS lambda

# Copy requirements and install Python dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt --target ${LAMBDA_TASK_ROOT}

# Install Mangum for Lambda-FastAPI adapter
RUN pip install --no-cache-dir mangum --target ${LAMBDA_TASK_ROOT}

# Copy application code
COPY main.py ${LAMBDA_TASK_ROOT}/

# Lambda handler - uses Mangum to wrap FastAPI
CMD ["main.handler"]

# Final stage selection
FROM ${BUILD_TARGET} AS final
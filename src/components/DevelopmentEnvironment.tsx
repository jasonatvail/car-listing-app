import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Spinner } from './ui/spinner'

interface ServiceInfo {
  family: string
  taskRoleArn: string
  executionRoleArn: string
  networkMode: string
  revision: number
  volumes: any[]
  status: string
  requiresAttributes: any[]
  serviceName?: string
  clusterName?: string
  taskDefinitionArn?: string
  desiredCount?: number
  runningCount?: number
  pendingCount?: number
  cpu?: string
  memory?: string
  containerName?: string
  containerPort?: number
  imageUri?: string
}

export default function DevelopmentEnvironment() {
  const [backendServiceInfo, setBackendServiceInfo] = useState<ServiceInfo | null>(null)
  const [frontendServiceInfo, setFrontendServiceInfo] = useState<ServiceInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [latestFrontendTag, setLatestFrontendTag] = useState<string | null>(null)
  const [runningFrontendTag, setRunningFrontendTag] = useState<string | null>(null)
  const [latestBackendTag, setLatestBackendTag] = useState<string | null>(null)
  const [runningBackendTag, setRunningBackendTag] = useState<string | null>(null)
  const [updatingFrontend, setUpdatingFrontend] = useState(false)
  const [updatingBackend, setUpdatingBackend] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchServiceInfo()
  }, [])

  const fetchServiceInfo = async () => {
    try {
      setLoading(true)
      // Fetch latest ECR tag
      try {
        const ecrResponse = await fetch('/api/ecr/latest-frontend-image')
        if (ecrResponse.ok) {
          const ecrData = await ecrResponse.json()
          setLatestFrontendTag(ecrData.latest_tag)
        }
      } catch (ecrErr) {
        console.warn('Failed to fetch ECR latest tag:', ecrErr)
        setLatestFrontendTag(null)
      }

      // Fetch running ECS tag
      try {
        const ecsResponse = await fetch('/api/ecs/running-frontend-image')
        if (ecsResponse.ok) {
          const ecsData = await ecsResponse.json()
          setRunningFrontendTag(ecsData.running_tag)
        }
      } catch (ecsErr) {
        console.warn('Failed to fetch ECS running tag:', ecsErr)
        setRunningFrontendTag(null)
      }

      // Fetch latest backend ECR tag
      try {
        const backendEcrResponse = await fetch('/api/ecr/latest-backend-image')
        if (backendEcrResponse.ok) {
          const backendEcrData = await backendEcrResponse.json()
          setLatestBackendTag(backendEcrData.latest_tag)
        }
      } catch (backendEcrErr) {
        console.warn('Failed to fetch backend ECR latest tag:', backendEcrErr)
        setLatestBackendTag(null)
      }

      // Fetch running backend ECS tag
      try {
        const backendEcsResponse = await fetch('/api/ecs/running-backend-image')
        if (backendEcsResponse.ok) {
          const backendEcsData = await backendEcsResponse.json()
          setRunningBackendTag(backendEcsData.running_tag)
        }
      } catch (backendEcsErr) {
        console.warn('Failed to fetch backend ECS running tag:', backendEcsErr)
        setRunningBackendTag(null)
      }

      // In a real implementation, this would call your backend API
      // For now, we'll use the static data provided by the user
      const backendData: ServiceInfo = {
        family: "car-listing-dev-backend",
        taskRoleArn: "arn:aws:iam::585625007298:role/car-listing-dev-TaskRole-Clan3PLmgsOT",
        executionRoleArn: "arn:aws:iam::585625007298:role/car-listing-dev-TaskExecutionRole-wBpopvdJLN8l",
        networkMode: "awsvpc",
        revision: 16,
        volumes: [],
        status: "ACTIVE",
        requiresAttributes: [],
        serviceName: "car-listing-dev-backend",
        clusterName: "car-listing-dev",
        taskDefinitionArn: "arn:aws:ecs:us-east-2:585625007298:task-definition/car-listing-dev-backend:16",
        desiredCount: 1,
        runningCount: 1,
        pendingCount: 0,
        cpu: "512",
        memory: "1024",
        containerName: "backend",
        containerPort: 5001,
        imageUri: "public.ecr.aws/c9g5y1u8/carswebapppublic:backend-dev"
      }

      const frontendData: ServiceInfo = {
        family: "car-listing-dev-frontend",
        taskRoleArn: "arn:aws:iam::585625007298:role/car-listing-dev-TaskRole-Clan3PLmgsOT",
        executionRoleArn: "arn:aws:iam::585625007298:role/car-listing-dev-TaskExecutionRole-wBpopvdJLN8l",
        networkMode: "awsvpc",
        revision: 16,
        volumes: [],
        status: "ACTIVE",
        requiresAttributes: [],
        serviceName: "car-listing-dev-frontend",
        clusterName: "car-listing-dev",
        taskDefinitionArn: "arn:aws:ecs:us-east-2:585625007298:task-definition/car-listing-dev-frontend:16",
        desiredCount: 1,
        runningCount: 1,
        pendingCount: 0,
        cpu: "256",
        memory: "512",
        containerName: "frontend",
        containerPort: 80,
        imageUri: "public.ecr.aws/c9g5y1u8/carswebapppublic:frontend-dev"
      }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      setBackendServiceInfo(backendData)
      setFrontendServiceInfo(frontendData)
    } catch (err) {
      setError('Failed to fetch service information')
      console.error('Error fetching service info:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateFrontendService = async () => {
    try {
      setUpdatingFrontend(true)
      setUpdateError(null)
      setUpdateSuccess(null)

      const response = await fetch('/api/ecs/update-frontend-service', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (data.success) {
        setUpdateSuccess(data.message)
        // Refresh the data after a short delay
        setTimeout(() => {
          fetchServiceInfo()
        }, 2000)
      } else {
        setUpdateError(data.error || 'Failed to update frontend service')
      }
    } catch (err) {
      setUpdateError('Failed to update frontend service')
      console.error('Error updating frontend service:', err)
    } finally {
      setUpdatingFrontend(false)
    }
  }

  const updateBackendService = async () => {
    try {
      setUpdatingBackend(true)
      setUpdateError(null)
      setUpdateSuccess(null)

      const response = await fetch('/api/ecs/update-backend-service', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (data.success) {
        setUpdateSuccess(data.message)
        // Refresh the data after a short delay
        setTimeout(() => {
          fetchServiceInfo()
        }, 2000)
      } else {
        setUpdateError(data.error || 'Failed to update backend service')
      }
    } catch (err) {
      setUpdateError('Failed to update backend service')
      console.error('Error updating backend service:', err)
    } finally {
      setUpdatingBackend(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="text-center">
          <Spinner className="h-8 w-8 mx-auto mb-4" />
          <div className="text-lg text-slate-600">Loading Development Environment...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <div className="text-lg font-semibold text-red-600">Error</div>
          </CardHeader>
          <CardContent>
            <div className="text-slate-600 mb-4">{error}</div>
            <Button onClick={fetchServiceInfo} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      <header className="mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Development Environment</h1>
          <p className="text-slate-600 mt-1">ECS Services and Task Definitions Information</p>
        </div>
      </header>

      {/* Update Status Messages */}
      {updateSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <div className="text-green-800 font-medium">✓ {updateSuccess}</div>
            <button
              onClick={() => setUpdateSuccess(null)}
              className="ml-auto text-green-600 hover:text-green-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {updateError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <div className="text-red-800 font-medium">✗ {updateError}</div>
            <button
              onClick={() => setUpdateError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Backend Service Information */}
        <Card>
          <CardHeader>
            <div className="text-lg font-semibold">Backend Service</div>
            <div className="text-sm text-slate-600">FastAPI Application</div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-slate-600">Service Name</div>
                <div className="text-sm font-mono bg-slate-50 p-2 rounded">{backendServiceInfo?.serviceName}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">Container Name</div>
                <div className="text-sm font-mono bg-slate-50 p-2 rounded">{backendServiceInfo?.containerName}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">Container Port</div>
                <div className="text-sm">{backendServiceInfo?.containerPort}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">Desired Count</div>
                <div className="text-sm">{backendServiceInfo?.desiredCount}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">Running Count</div>
                <div className="text-sm">{backendServiceInfo?.runningCount}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">CPU/Memory</div>
                <div className="text-sm">{backendServiceInfo?.cpu} CPU / {backendServiceInfo?.memory} MB</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Frontend Service Information */}
        <Card>
          <CardHeader>
            <div className="text-lg font-semibold">Frontend Service</div>
            <div className="text-sm text-slate-600">React Application</div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-slate-600">Service Name</div>
                <div className="text-sm font-mono bg-slate-50 p-2 rounded">{frontendServiceInfo?.serviceName}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">Container Name</div>
                <div className="text-sm font-mono bg-slate-50 p-2 rounded">{frontendServiceInfo?.containerName}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">Container Port</div>
                <div className="text-sm">{frontendServiceInfo?.containerPort}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">Desired Count</div>
                <div className="text-sm">{frontendServiceInfo?.desiredCount}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">Running Count</div>
                <div className="text-sm">{frontendServiceInfo?.runningCount}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">CPU/Memory</div>
                <div className="text-sm">{frontendServiceInfo?.cpu} CPU / {frontendServiceInfo?.memory} MB</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Backend Task Definition */}
        <Card>
          <CardHeader>
            <div className="text-lg font-semibold">Backend Task Definition</div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-slate-600">Family</div>
                <div className="text-sm font-mono bg-slate-50 p-2 rounded">{backendServiceInfo?.family}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">Revision</div>
                <div className="text-sm">{backendServiceInfo?.revision}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">Status</div>
                <div className="text-sm">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    backendServiceInfo?.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {backendServiceInfo?.status}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">Network Mode</div>
                <div className="text-sm font-mono bg-slate-50 p-2 rounded">{backendServiceInfo?.networkMode}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">Image URI</div>
                <div className="text-xs font-mono bg-slate-50 p-2 rounded break-all">{backendServiceInfo?.imageUri}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">Running Tag</div>
                <div className="text-sm font-mono bg-slate-50 p-2 rounded">{runningBackendTag || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">Latest ECR Tag</div>
                <div className={`text-sm font-mono p-2 rounded ${
                  latestBackendTag && runningBackendTag && latestBackendTag === runningBackendTag
                    ? 'bg-green-50 text-green-800'
                    : latestBackendTag && runningBackendTag && latestBackendTag !== runningBackendTag
                    ? 'bg-yellow-50 text-yellow-800'
                    : 'bg-slate-50'
                }`}>
                  {latestBackendTag || 'N/A'}
                  {latestBackendTag && runningBackendTag && latestBackendTag !== runningBackendTag && (
                    <span className="ml-2 text-xs text-red-600 font-normal">⚠️ Update needed</span>
                  )}
                </div>
                {latestBackendTag && runningBackendTag && latestBackendTag !== runningBackendTag && (
                  <div className="mt-2">
                    <Button
                      onClick={updateBackendService}
                      disabled={updatingBackend}
                      size="sm"
                      className="w-full"
                    >
                      {updatingBackend ? 'Updating...' : 'Deploy Latest Version'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Frontend Task Definition */}
        <Card>
          <CardHeader>
            <div className="text-lg font-semibold">Frontend Task Definition</div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-slate-600">Family</div>
                <div className="text-sm font-mono bg-slate-50 p-2 rounded">{frontendServiceInfo?.family}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">Revision</div>
                <div className="text-sm">{frontendServiceInfo?.revision}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">Status</div>
                <div className="text-sm">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    frontendServiceInfo?.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {frontendServiceInfo?.status}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">Network Mode</div>
                <div className="text-sm font-mono bg-slate-50 p-2 rounded">{frontendServiceInfo?.networkMode}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">Image URI</div>
                <div className="text-xs font-mono bg-slate-50 p-2 rounded break-all">{frontendServiceInfo?.imageUri}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">Running Tag</div>
                <div className="text-sm font-mono bg-slate-50 p-2 rounded">{runningFrontendTag || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">Latest ECR Tag</div>
                <div className={`text-sm font-mono p-2 rounded ${
                  latestFrontendTag && runningFrontendTag && latestFrontendTag === runningFrontendTag
                    ? 'bg-green-50 text-green-800'
                    : latestFrontendTag && runningFrontendTag && latestFrontendTag !== runningFrontendTag
                    ? 'bg-yellow-50 text-yellow-800'
                    : 'bg-slate-50'
                }`}>
                  {latestFrontendTag || 'N/A'}
                  {latestFrontendTag && runningFrontendTag && latestFrontendTag !== runningFrontendTag && (
                    <span className="ml-2 text-xs text-red-600 font-normal">⚠️ Update needed</span>
                  )}
                </div>
                {latestFrontendTag && runningFrontendTag && latestFrontendTag !== runningFrontendTag && (
                  <div className="mt-2">
                    <Button
                      onClick={updateFrontendService}
                      disabled={updatingFrontend}
                      size="sm"
                      className="w-full"
                    >
                      {updatingFrontend ? 'Updating...' : 'Deploy Latest Version'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shared IAM Roles */}
      <Card className="mb-6">
        <CardHeader>
          <div className="text-lg font-semibold">Shared IAM Roles</div>
          <div className="text-sm text-slate-600">Used by both Backend and Frontend Services</div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-slate-600 mb-2">Task Role ARN</div>
              <div className="text-xs font-mono bg-slate-50 p-3 rounded break-all">{backendServiceInfo?.taskRoleArn}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-600 mb-2">Execution Role ARN</div>
              <div className="text-xs font-mono bg-slate-50 p-3 rounded break-all">{backendServiceInfo?.executionRoleArn}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task Definition ARNs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="text-lg font-semibold">Backend Task Definition ARN</div>
          </CardHeader>
          <CardContent>
            <div className="text-xs font-mono bg-slate-50 p-3 rounded break-all">
              {backendServiceInfo?.taskDefinitionArn}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-lg font-semibold">Frontend Task Definition ARN</div>
          </CardHeader>
          <CardContent>
            <div className="text-xs font-mono bg-slate-50 p-3 rounded break-all">
              {frontendServiceInfo?.taskDefinitionArn}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
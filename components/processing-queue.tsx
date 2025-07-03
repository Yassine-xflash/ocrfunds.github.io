"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Play, Pause, RotateCw, Clock, CheckCircle, AlertCircle, X } from 'lucide-react'
import { localStorageManager } from '@/lib/storage/local-storage'

interface QueueJob {
  id: string
  name: string
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'
  progress: number
  data: {
    fileName: string
    fileSize: number
    uploadedAt: string
  }
  processedAt?: string
  completedAt?: string
  failedReason?: string
  attemptsMade: number
  estimatedTime?: number
}

export function ProcessingQueue() {
  const [jobs, setJobs] = useState<QueueJob[]>([])
  const [queueStatus, setQueueStatus] = useState<'running' | 'paused'>('running')
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    console.log('ProcessingQueue component mounted, loading jobs from local storage')
    loadJobsFromLocalStorage()
    
    // Update jobs every 5 seconds to reflect real-time changes
    const interval = setInterval(loadJobsFromLocalStorage, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadJobsFromLocalStorage = () => {
    try {
      console.log('ProcessingQueue: Loading uploaded files from local storage')
      const uploadedFiles = localStorageManager.getUploadedFiles()
      
      // Convert uploaded files to queue jobs format
      const queueJobs: QueueJob[] = uploadedFiles.map(file => ({
        id: file.id,
        name: 'OCR Processing',
        status: convertFileStatusToJobStatus(file.status),
        progress: file.progress,
        data: {
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: file.uploadedAt
        },
        processedAt: file.status !== 'pending' ? file.uploadedAt : undefined,
        completedAt: file.status === 'completed' ? file.uploadedAt : undefined,
        failedReason: file.errors?.[0],
        attemptsMade: file.status === 'error' ? 1 : 0,
        estimatedTime: calculateEstimatedTime(file.size, file.status)
      }))
      
      setJobs(queueJobs)
      console.log(`ProcessingQueue: Loaded ${queueJobs.length} jobs from local storage`)
    } catch (error) {
      console.error('ProcessingQueue: Error loading jobs from local storage:', error)
      setJobs([])
    }
  }

  const convertFileStatusToJobStatus = (fileStatus: string): QueueJob['status'] => {
    switch (fileStatus) {
      case 'pending': return 'waiting'
      case 'processing': return 'active'
      case 'completed': return 'completed'
      case 'error': return 'failed'
      default: return 'waiting'
    }
  }

  const calculateEstimatedTime = (fileSize: number, status: string): number => {
    if (status === 'completed' || status === 'error') return 0
    // Estimate 1 second per 100KB for processing
    return Math.ceil(fileSize / 100000)
  }

  const getStatusIcon = (status: QueueJob['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      case 'active':
        return <Clock className="w-5 h-5 text-blue-600 animate-spin" />
      case 'waiting':
        return <Clock className="w-5 h-5 text-amber-600" />
      case 'delayed':
        return <RotateCw className="w-5 h-5 text-slate-400" />
      default:
        return <Clock className="w-5 h-5 text-slate-400" />
    }
  }

  const getStatusBadge = (status: QueueJob['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      case 'active':
        return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>
      case 'waiting':
        return <Badge className="bg-amber-100 text-amber-800">Waiting</Badge>
      case 'delayed':
        return <Badge variant="secondary">Delayed</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const filteredJobs = jobs.filter(job => {
    switch (activeTab) {
      case 'active':
        return job.status === 'active' || job.status === 'waiting'
      case 'completed':
        return job.status === 'completed'
      case 'failed':
        return job.status === 'failed'
      default:
        return true
    }
  })

  const pauseQueue = () => {
    console.log('Pausing job queue')
    setQueueStatus('paused')
  }

  const resumeQueue = () => {
    console.log('Resuming job queue')
    setQueueStatus('running')
  }

  const retryJob = (jobId: string) => {
    console.log(`Retrying job: ${jobId}`)
    setJobs(prevJobs => 
      prevJobs.map(job => 
        job.id === jobId 
          ? { ...job, status: 'waiting', progress: 0, failedReason: undefined, attemptsMade: job.attemptsMade + 1 }
          : job
      )
    )
  }

  const removeJob = (jobId: string) => {
    console.log(`Removing job: ${jobId}`)
    setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId))
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-6">
      {/* Queue Controls */}
      <Card className="bg-white/60 backdrop-blur border-slate-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg text-slate-900">Processing Queue</CardTitle>
              <CardDescription className="text-slate-600">
                Real-time OCR job queue management powered by BullMQ
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={queueStatus === 'running' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                {queueStatus === 'running' ? 'Running' : 'Paused'}
              </Badge>
              {queueStatus === 'running' ? (
                <Button size="sm" variant="outline" onClick={pauseQueue}>
                  <Pause className="w-4 h-4 mr-1" />
                  Pause
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={resumeQueue}>
                  <Play className="w-4 h-4 mr-1" />
                  Resume
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Queue Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/60 backdrop-blur border-slate-200">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {jobs.filter(j => j.status === 'active' || j.status === 'waiting').length}
            </div>
            <p className="text-sm text-slate-600">Active Jobs</p>
          </CardContent>
        </Card>
        <Card className="bg-white/60 backdrop-blur border-slate-200">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {jobs.filter(j => j.status === 'completed').length}
            </div>
            <p className="text-sm text-slate-600">Completed</p>
          </CardContent>
        </Card>
        <Card className="bg-white/60 backdrop-blur border-slate-200">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {jobs.filter(j => j.status === 'failed').length}
            </div>
            <p className="text-sm text-slate-600">Failed</p>
          </CardContent>
        </Card>
        <Card className="bg-white/60 backdrop-blur border-slate-200">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-900">
              {jobs.find(j => j.status === 'active')?.estimatedTime || 0}s
            </div>
            <p className="text-sm text-slate-600">Est. Time</p>
          </CardContent>
        </Card>
      </div>

      {/* Job List */}
      <Card className="bg-white/60 backdrop-blur border-slate-200">
        <CardHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 bg-white/60 backdrop-blur border border-slate-200">
              <TabsTrigger value="all">All Jobs</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="failed">Failed</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredJobs.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No processing jobs found</p>
                <p className="text-xs text-slate-400 mt-1">Upload some files to see them appear here</p>
              </div>
            ) : (
              filteredJobs.map(job => (
              <div key={job.id} className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white/40">
                <div className="flex items-center space-x-3 flex-1">
                  {getStatusIcon(job.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {job.data.fileName}
                      </p>
                      {getStatusBadge(job.status)}
                    </div>
                    <div className="flex items-center space-x-4 mt-1">
                      <p className="text-xs text-slate-500">
                        {(job.data.fileSize / 1024 / 1024).toFixed(1)} MB
                      </p>
                      <p className="text-xs text-slate-500">
                        Attempts: {job.attemptsMade}
                      </p>
                      {job.estimatedTime && job.status === 'active' && (
                        <p className="text-xs text-blue-600">
                          ETA: {formatTime(job.estimatedTime)}
                        </p>
                      )}
                    </div>
                    {job.status === 'active' && (
                      <Progress value={job.progress} className="w-full mt-2" />
                    )}
                    {job.failedReason && (
                      <p className="text-xs text-red-600 mt-1">{job.failedReason}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {job.status === 'failed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => retryJob(job.id)}
                      className="text-xs"
                    >
                      <RotateCw className="w-3 h-3 mr-1" />
                      Retry
                    </Button>
                  )}
                  {(job.status === 'completed' || job.status === 'failed') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeJob(job.id)}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
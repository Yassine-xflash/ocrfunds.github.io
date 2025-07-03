interface JobData {
  jobId: string
  fileName: string
  fileBuffer: Buffer
  fileSize: number
  mimeType: string
  uploadedAt: string
}

interface JobStatus {
  id: string
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'
  progress: number
  data: JobData
  processedAt?: string
  completedAt?: string
  failedReason?: string
  attemptsMade: number
}

/**
 * QueueManager
 * 
 * Manages the BullMQ job queue system for OCR processing tasks.
 * In a production environment, this would integrate with Redis and BullMQ.
 * For the MVP, we simulate the queue behavior with in-memory storage.
 */
export class QueueManager {
  private jobs: Map<string, JobStatus> = new Map()
  private isProcessing: boolean = false

  constructor() {
    console.log('QueueManager: Initializing job queue system')
    this.startQueueProcessor()
  }

  /**
   * Add a new processing job to the queue
   */
  async addProcessingJob(jobData: JobData): Promise<void> {
    console.log(`QueueManager: Adding job to queue: ${jobData.jobId}`)
    
    const jobStatus: JobStatus = {
      id: jobData.jobId,
      status: 'waiting',
      progress: 0,
      data: jobData,
      attemptsMade: 0
    }
    
    this.jobs.set(jobData.jobId, jobStatus)
    
    console.log(`QueueManager: Job ${jobData.jobId} added to queue, total jobs: ${this.jobs.size}`)
    
    // In production, this would be:
    // await this.bullQueue.add('process-form', jobData, {
    //   attempts: 3,
    //   backoff: 'exponential',
    //   delay: 0
    // })
  }

  /**
   * Get status of a specific job
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const job = this.jobs.get(jobId)
    if (!job) {
      console.log(`QueueManager: Job ${jobId} not found`)
      return null
    }
    
    console.log(`QueueManager: Retrieved status for job ${jobId}: ${job.status}`)
    return job
  }

  /**
   * Get all jobs in the queue
   */
  async getAllJobs(): Promise<JobStatus[]> {
    const allJobs = Array.from(this.jobs.values())
    console.log(`QueueManager: Retrieved ${allJobs.length} total jobs`)
    return allJobs
  }

  /**
   * Update job progress
   */
  async updateJobProgress(jobId: string, progress: number): Promise<void> {
    const job = this.jobs.get(jobId)
    if (job) {
      job.progress = progress
      job.status = progress >= 100 ? 'completed' : 'active'
      console.log(`QueueManager: Updated job ${jobId} progress to ${progress}%`)
    }
  }

  /**
   * Mark job as completed
   */
  async completeJob(jobId: string, result?: any): Promise<void> {
    const job = this.jobs.get(jobId)
    if (job) {
      job.status = 'completed'
      job.progress = 100
      job.completedAt = new Date().toISOString()
      console.log(`QueueManager: Job ${jobId} marked as completed`)
    }
  }

  /**
   * Mark job as failed
   */
  async failJob(jobId: string, reason: string): Promise<void> {
    const job = this.jobs.get(jobId)
    if (job) {
      job.status = 'failed'
      job.failedReason = reason
      job.attemptsMade += 1
      console.log(`QueueManager: Job ${jobId} marked as failed: ${reason}`)
    }
  }

  /**
   * Start the queue processor (simulated for MVP)
   * In production, this would be handled by BullMQ workers
   */
  private startQueueProcessor(): void {
    console.log('QueueManager: Starting queue processor')
    
    // Simulate queue processing every 2 seconds
    setInterval(() => {
      this.processNextJob()
    }, 2000)
  }

  /**
   * Process the next waiting job in the queue
   */
  private async processNextJob(): Promise<void> {
    if (this.isProcessing) {
      return
    }

    // Find next waiting job
    const nextJob = Array.from(this.jobs.values()).find(job => job.status === 'waiting')
    
    if (!nextJob) {
      return // No jobs waiting
    }

    this.isProcessing = true
    console.log(`QueueManager: Starting processing for job ${nextJob.id}`)
    
    try {
      // Mark job as active
      nextJob.status = 'active'
      nextJob.processedAt = new Date().toISOString()
      
      // Simulate OCR processing with progress updates
      await this.simulateProcessing(nextJob)
      
      // Complete the job
      await this.completeJob(nextJob.id)
      
    } catch (error) {
      console.error(`QueueManager: Error processing job ${nextJob.id}:`, error)
      await this.failJob(nextJob.id, error instanceof Error ? error.message : 'Unknown error')
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Simulate OCR processing with progress updates
   * In production, this would call the actual OCR pipeline
   */
  private async simulateProcessing(job: JobStatus): Promise<void> {
    console.log(`QueueManager: Simulating OCR processing for ${job.data.fileName}`)
    
    // Simulate processing stages with progress updates
    const stages = [
      { name: 'Image Preprocessing', duration: 1000, progress: 20 },
      { name: 'Text Detection', duration: 2000, progress: 50 },
      { name: 'OCR Recognition', duration: 2000, progress: 80 },
      { name: 'Data Extraction', duration: 1000, progress: 100 }
    ]
    
    for (const stage of stages) {
      console.log(`QueueManager: Processing stage "${stage.name}" for job ${job.id}`)
      
      // Update progress
      await this.updateJobProgress(job.id, stage.progress)
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, stage.duration))
    }
    
    console.log(`QueueManager: OCR processing completed for job ${job.id}`)
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const stats = {
      total: this.jobs.size,
      waiting: Array.from(this.jobs.values()).filter(j => j.status === 'waiting').length,
      active: Array.from(this.jobs.values()).filter(j => j.status === 'active').length,
      completed: Array.from(this.jobs.values()).filter(j => j.status === 'completed').length,
      failed: Array.from(this.jobs.values()).filter(j => j.status === 'failed').length
    }
    
    console.log('QueueManager: Queue statistics:', stats)
    return stats
  }
}
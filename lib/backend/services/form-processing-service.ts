import { QueueManager } from '../queue/queue-manager'
import { OCRPipeline } from '../pipeline/ocr-pipeline'

interface UploadedFileData {
  fileName: string
  fileBuffer: Buffer
  fileSize: number
  mimeType: string
}

interface ProcessingResult {
  jobId: string
  fileName: string
  extractedForms: ExtractedFormData[]
  processingTime: number
  errors?: string[]
}

interface ExtractedFormData {
  formNumber: number
  confidence: number
  fields: {
    donorName: string
    email: string
    phone: string
    address: string
    amount: number
    paymentMethod: string
    date: string
    recurring: boolean
    anonymous: boolean
  }
  issues?: string[]
}

/**
 * FormProcessingService
 * 
 * Core service that orchestrates the entire donation form processing workflow.
 * This service acts as the main coordinator between file uploads, job queuing,
 * and the OCR processing pipeline.
 */
export class FormProcessingService {
  private queueManager: QueueManager
  private ocrPipeline: OCRPipeline

  constructor() {
    console.log('FormProcessingService: Initializing service components')
    this.queueManager = new QueueManager()
    this.ocrPipeline = new OCRPipeline()
  }

  /**
   * Process an uploaded file through the complete OCR pipeline
   * @param fileData - The uploaded file data and metadata
   * @returns Job ID for tracking processing status
   */
  async processUploadedFile(fileData: UploadedFileData): Promise<string> {
    console.log(`FormProcessingService: Starting processing for file: ${fileData.fileName}`)
    
    try {
      // Validate file type and size
      this.validateFile(fileData)
      
      // Generate unique job ID
      const jobId = this.generateJobId()
      
      // Add job to processing queue
      await this.queueManager.addProcessingJob({
        jobId,
        fileName: fileData.fileName,
        fileBuffer: fileData.fileBuffer,
        fileSize: fileData.fileSize,
        mimeType: fileData.mimeType,
        uploadedAt: new Date().toISOString()
      })
      
      console.log(`FormProcessingService: File ${fileData.fileName} queued with job ID: ${jobId}`)
      return jobId
      
    } catch (error) {
      console.error(`FormProcessingService: Error processing file ${fileData.fileName}:`, error)
      throw new Error(`Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Execute the OCR processing pipeline for a queued job
   * This method is called by the queue worker when processing a job
   */
  async executeProcessingPipeline(jobData: any): Promise<ProcessingResult> {
    const startTime = Date.now()
    console.log(`FormProcessingService: Executing OCR pipeline for job: ${jobData.jobId}`)
    
    try {
      // Run the complete OCR pipeline
      const extractedForms = await this.ocrPipeline.processDocument({
        fileName: jobData.fileName,
        fileBuffer: jobData.fileBuffer,
        mimeType: jobData.mimeType
      })
      
      const processingTime = (Date.now() - startTime) / 1000
      
      const result: ProcessingResult = {
        jobId: jobData.jobId,
        fileName: jobData.fileName,
        extractedForms,
        processingTime
      }
      
      console.log(`FormProcessingService: Pipeline completed for ${jobData.fileName} in ${processingTime}s, extracted ${extractedForms.length} forms`)
      
      // Store results in database (in production)
      await this.storeProcessingResults(result)
      
      return result
      
    } catch (error) {
      console.error(`FormProcessingService: Pipeline error for job ${jobData.jobId}:`, error)
      
      const processingTime = (Date.now() - startTime) / 1000
      
      return {
        jobId: jobData.jobId,
        fileName: jobData.fileName,
        extractedForms: [],
        processingTime,
        errors: [error instanceof Error ? error.message : 'Unknown processing error']
      }
    }
  }

  /**
   * Get processing status for a specific job
   */
  async getJobStatus(jobId: string) {
    console.log(`FormProcessingService: Getting status for job: ${jobId}`)
    return await this.queueManager.getJobStatus(jobId)
  }

  /**
   * Get all processing jobs with their current status
   */
  async getAllJobs() {
    console.log('FormProcessingService: Fetching all processing jobs')
    return await this.queueManager.getAllJobs()
  }

  /**
   * Validate uploaded file meets requirements
   */
  private validateFile(fileData: UploadedFileData): void {
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    
    if (fileData.fileSize > MAX_FILE_SIZE) {
      throw new Error(`File size ${fileData.fileSize} exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes`)
    }
    
    if (!ALLOWED_TYPES.includes(fileData.mimeType)) {
      throw new Error(`File type ${fileData.mimeType} is not supported. Allowed types: ${ALLOWED_TYPES.join(', ')}`)
    }
    
    console.log(`FormProcessingService: File validation passed for ${fileData.fileName}`)
  }

  /**
   * Generate unique job ID for tracking
   */
  private generateJobId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `job_${timestamp}_${random}`
  }

  /**
   * Store processing results in database
   * In production, this would save to PostgreSQL/MongoDB
   */
  private async storeProcessingResults(result: ProcessingResult): Promise<void> {
  console.log(`FormProcessingService: Storing results for job ${result.jobId} in browser IndexedDB`)

  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('FormProcessingDB', 1)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('processingResults')) {
        db.createObjectStore('processingResults', { keyPath: 'jobId' })
      }
    }

    request.onerror = () => {
      console.error('FormProcessingService: Failed to open IndexedDB')
      reject(new Error('IndexedDB open error'))
    }

    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction('processingResults', 'readwrite')
      const store = transaction.objectStore('processingResults')

      const data = {
        jobId: result.jobId,
        fileName: result.fileName,
        processingTime: result.processingTime,
        extractedForms: result.extractedForms,
        errors: result.errors || null,
        storedAt: new Date().toISOString()
      }

      const putRequest = store.put(data)

      putRequest.onsuccess = () => {
        console.log(`FormProcessingService: Successfully stored job ${result.jobId} in IndexedDB`)
        db.close()
        resolve()
      }

      putRequest.onerror = () => {
        console.error(`FormProcessingService: Failed to store job ${result.jobId} in IndexedDB`)
        db.close()
        reject(new Error('Failed to store processing results in IndexedDB'))
      }
    }
  })
}

}
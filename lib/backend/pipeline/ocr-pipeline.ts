import { Preprocessor } from './preprocessor'
import { Detector } from './detector'
import { Segmenter } from './segmenter'
import { Extractor } from './extractor'

interface DocumentData {
  fileName: string
  fileBuffer: Buffer
  mimeType: string
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

interface ProcessedImage {
  imageBuffer: Buffer
  width: number
  height: number
  pageNumber: number
}

/**
 * OCRPipeline
 * 
 * Core OCR processing pipeline that orchestrates the complete document processing workflow.
 * This pipeline handles the entire flow from raw document input to extracted donation data.
 * 
 * Pipeline stages:
 * 1. Preprocessing - Image enhancement, deskewing, noise reduction
 * 2. Detection - Checkbox detection, field boundary detection
 * 3. Segmentation - Individual form isolation and field segmentation
 * 4. Extraction - OCR text recognition and data extraction
 */
export class OCRPipeline {
  private preprocessor: Preprocessor
  private detector: Detector
  private segmenter: Segmenter
  private extractor: Extractor

  constructor() {
    console.log('OCRPipeline: Initializing OCR processing pipeline')
    this.preprocessor = new Preprocessor()
    this.detector = new Detector()
    this.segmenter = new Segmenter()
    this.extractor = new Extractor()
  }

  /**
   * Process a complete document through the OCR pipeline
   * @param documentData - Raw document data and metadata
   * @returns Array of extracted form data
   */
  async processDocument(documentData: DocumentData): Promise<ExtractedFormData[]> {
    console.log(`OCRPipeline: Starting document processing for ${documentData.fileName}`)
    const startTime = Date.now()
    
    try {
      // Stage 1: Document Preprocessing
      console.log('OCRPipeline: Stage 1 - Document preprocessing')
      const processedImages = await this.preprocessor.processDocument(documentData)
      console.log(`OCRPipeline: Preprocessed ${processedImages.length} pages`)

      // Stage 2: Form Detection and Layout Analysis
      console.log('OCRPipeline: Stage 2 - Form detection and layout analysis')
      const detectedForms = await this.detector.detectForms(processedImages)
      console.log(`OCRPipeline: Detected ${detectedForms.length} forms`)

      // Stage 3: Field Segmentation
      console.log('OCRPipeline: Stage 3 - Field segmentation')
      const segmentedForms = await this.segmenter.segmentFormFields(detectedForms)
      console.log(`OCRPipeline: Segmented fields for ${segmentedForms.length} forms`)

      // Stage 4: Data Extraction and Recognition
      console.log('OCRPipeline: Stage 4 - Data extraction and recognition')
      const extractedData = await this.extractor.extractFormData(segmentedForms)
      console.log(`OCRPipeline: Extracted data from ${extractedData.length} forms`)

      const processingTime = (Date.now() - startTime) / 1000
      console.log(`OCRPipeline: Document processing completed in ${processingTime}s`)

      return extractedData

    } catch (error) {
      console.error(`OCRPipeline: Error processing document ${documentData.fileName}:`, error)
      throw new Error(`OCR Pipeline failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Process a single page through the pipeline
   * Useful for testing or processing individual pages
   */
  async processPage(imageBuffer: Buffer, pageNumber: number): Promise<ExtractedFormData[]> {
    console.log(`OCRPipeline: Processing single page ${pageNumber}`)
    
    const processedImage: ProcessedImage = {
      imageBuffer,
      width: 0, // Will be determined by preprocessor
      height: 0,
      pageNumber
    }

    // Run through pipeline stages
    const enhancedImage = await this.preprocessor.enhanceImage(processedImage)
    const detectedForms = await this.detector.detectForms([enhancedImage])
    const segmentedForms = await this.segmenter.segmentFormFields(detectedForms)
    const extractedData = await this.extractor.extractFormData(segmentedForms)

    return extractedData
  }

  /**
   * Get pipeline performance metrics
   */
  getPerformanceMetrics() {
    return {
      preprocessor: this.preprocessor.getMetrics(),
      detector: this.detector.getMetrics(),
      segmenter: this.segmenter.getMetrics(),
      extractor: this.extractor.getMetrics()
    }
  }

  /**
   * Validate pipeline configuration and dependencies
   */
  async validatePipeline(): Promise<boolean> {
    console.log('OCRPipeline: Validating pipeline configuration')
    
    try {
      // Check if all components are properly initialized
      const validations = await Promise.all([
        this.preprocessor.validate(),
        this.detector.validate(),
        this.segmenter.validate(),
        this.extractor.validate()
      ])

      const isValid = validations.every(v => v)
      console.log(`OCRPipeline: Pipeline validation ${isValid ? 'passed' : 'failed'}`)
      
      return isValid
      
    } catch (error) {
      console.error('OCRPipeline: Validation failed:', error)
      return false
    }
  }
}
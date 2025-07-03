import cvReady from '@techstark/opencv-js'
import Tesseract from 'tesseract.js'

interface ProcessedImage {
  imageBuffer: Buffer
  width: number
  height: number
  pageNumber: number
}

interface DetectedForm {
  formId: string
  pageNumber: number
  boundingBox: BoundingBox
  confidence: number
  imageBuffer: Buffer
  detectedElements: DetectedElement[]
}

interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

interface DetectedElement {
  type: 'text_field' | 'checkbox' | 'signature_area' | 'amount_field' | 'date_field'
  boundingBox: BoundingBox
  confidence: number
  label?: string
  text?: string // OCR extracted text
}

interface DetectionMetrics {
  totalForms: number
  averageConfidence: number
  detectionTime: number
  elementsDetected: number
}

interface ContourInfo {
  contour: any // OpenCV contour
  area: number
  boundingRect: BoundingBox
  aspectRatio: number
}

/**
 * Detector
 * 
 * Computer vision module responsible for detecting and locating donation forms
 * and their constituent elements within processed images using real CV processing.
 */
export class Detector {
  private metrics: DetectionMetrics = {
    totalForms: 0,
    averageConfidence: 0,
    detectionTime: 0,
    elementsDetected: 0
  }

  private isInitialized = false
  private tesseractWorker: Tesseract.Worker | null = null

  constructor() {
    console.log('Detector: Initializing real computer vision form detection module')
  }

  /**
   * Initialize OpenCV and Tesseract
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    console.log('Detector: Initializing OpenCV and Tesseract...')
    
    try {
      // Initialize OpenCV
      const cv = await cvReady
      
      // Initialize Tesseract worker
      this.tesseractWorker = await Tesseract.createWorker('eng', 1, {
        logger: m => console.log('Tesseract:', m)
      })
      
      await this.tesseractWorker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,@$()-/: '
      })

      this.isInitialized = true
      console.log('Detector: Initialization complete')
      
    } catch (error) {
      console.error('Detector: Initialization failed:', error)
      throw new Error(`Failed to initialize detector: ${error}`)
    }
  }

  /**
   * Detect donation forms within processed images
   */
  async detectForms(processedImages: ProcessedImage[]): Promise<DetectedForm[]> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    console.log(`Detector: Starting real form detection on ${processedImages.length} images`)
    const startTime = Date.now()
    
    try {
      const detectedForms: DetectedForm[] = []
      
      for (const image of processedImages) {
        const formsInImage = await this.detectFormsInImage(image)
        detectedForms.push(...formsInImage)
      }
      
      const detectionTime = Date.now() - startTime
      this.updateMetrics(detectedForms, detectionTime)
      
      console.log(`Detector: Detected ${detectedForms.length} forms in ${detectionTime}ms`)
      return detectedForms
      
    } catch (error) {
      console.error('Detector: Error during form detection:', error)
      throw new Error(`Form detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Detect forms within a single image using real computer vision
   */
  private async detectFormsInImage(image: ProcessedImage): Promise<DetectedForm[]> {
    console.log(`Detector: Analyzing image page ${image.pageNumber} for forms`)
    
    try {
      // Convert buffer to OpenCV Mat
      const mat = this.bufferToMat(image.imageBuffer, image.width, image.height)
      
      // Find form regions using contour detection
      const formRegions = await this.findFormRegionsCV(mat)
      console.log(`Detector: Found ${formRegions.length} potential form regions on page ${image.pageNumber}`)
      
      const detectedForms: DetectedForm[] = []
      
      for (let i = 0; i < formRegions.length; i++) {
        const region = formRegions[i]
        
        // Extract form image from region
        const formMat = this.extractFormRegion(mat, region)
        const formBuffer = this.matToBuffer(formMat)
        
        // Detect elements within the form
        const elements = await this.detectElementsInFormCV(formMat, region)
        
        const detectedForm: DetectedForm = {
          formId: `form_${image.pageNumber}_${i + 1}`,
          pageNumber: image.pageNumber,
          boundingBox: region,
          confidence: this.calculateFormConfidence(elements),
          imageBuffer: formBuffer,
          detectedElements: elements
        }
        
        detectedForms.push(detectedForm)
        console.log(`Detector: Form ${detectedForm.formId} detected with ${elements.length} elements`)
        
        // Clean up form mat
        formMat.delete()
      }
      
      // Clean up main mat
      mat.delete()
      
      return detectedForms
      
    } catch (error) {
      console.error(`Detector: Error detecting forms in page ${image.pageNumber}:`, error)
      return []
    }
  }

  /**
   * Find form regions using OpenCV contour detection
   */
  private async findFormRegionsCV(mat: any): Promise<BoundingBox[]> {
    console.log('Detector: Finding form regions using contour detection')
    
    try {
      // Convert to grayscale
      const gray = new cv.Mat()
      cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY)
      
      // Apply Gaussian blur to reduce noise
      const blurred = new cv.Mat()
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0)
      
      // Apply adaptive threshold
      const thresh = new cv.Mat()
      cv.adaptiveThreshold(blurred, thresh, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2)
      
      // Find contours
      const contours = new cv.MatVector()
      const hierarchy = new cv.Mat()
      cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
      
      const formRegions: BoundingBox[] = []
      const minFormArea = 50000 // Minimum area for a form
      const maxFormArea = mat.rows * mat.cols * 0.8 // Maximum 80% of image
      
      // Analyze contours
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i)
        const area = cv.contourArea(contour)
        
        if (area > minFormArea && area < maxFormArea) {
          const boundingRect = cv.boundingRect(contour)
          const aspectRatio = boundingRect.width / boundingRect.height
          
          // Filter by aspect ratio (forms are typically wider than tall or square)
          if (aspectRatio > 0.3 && aspectRatio < 3.0) {
            // Check if this region has form-like characteristics
            const formLikelihood = await this.assessFormLikelihood(mat, boundingRect)
            
            if (formLikelihood > 0.5) {
              formRegions.push({
                x: boundingRect.x,
                y: boundingRect.y,
                width: boundingRect.width,
                height: boundingRect.height
              })
            }
          }
        }
        
        contour.delete()
      }
      
      // Clean up
      gray.delete()
      blurred.delete()
      thresh.delete()
      contours.delete()
      hierarchy.delete()
      
      return formRegions
      
    } catch (error) {
      console.error('Detector: Error in contour detection:', error)
      return []
    }
  }

  /**
   * Assess if a region is likely to contain a form
   */
  private async assessFormLikelihood(mat: any, region: any): Promise<number> {
    try {
      // Extract region
      const roi = mat.roi(region)
      
      // Convert to grayscale
      const gray = new cv.Mat()
      cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY)
      
      // Detect horizontal and vertical lines (common in forms)
      const horizontalKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(40, 1))
      const verticalKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, 40))
      
      const horizontalLines = new cv.Mat()
      const verticalLines = new cv.Mat()
      
      cv.morphologyEx(gray, horizontalLines, cv.MORPH_OPEN, horizontalKernel)
      cv.morphologyEx(gray, verticalLines, cv.MORPH_OPEN, verticalKernel)
      
      // Count non-zero pixels (lines)
      const horizontalPixels = cv.countNonZero(horizontalLines)
      const verticalPixels = cv.countNonZero(verticalLines)
      const totalPixels = region.width * region.height
      
      // Calculate form likelihood based on line density
      const lineRatio = (horizontalPixels + verticalPixels) / totalPixels
      const likelihood = Math.min(lineRatio * 10, 1.0) // Scale to 0-1
      
      // Clean up
      roi.delete()
      gray.delete()
      horizontalLines.delete()
      verticalLines.delete()
      horizontalKernel.delete()
      verticalKernel.delete()
      
      return likelihood
      
    } catch (error) {
      console.error('Detector: Error assessing form likelihood:', error)
      return 0
    }
  }

  /**
   * Extract form region from full image
   */
  private extractFormRegion(mat: any, region: BoundingBox): any {
    const rect = new cv.Rect(region.x, region.y, region.width, region.height)
    return mat.roi(rect)
  }

  /**
   * Detect elements within a form using computer vision and OCR
   */
  private async detectElementsInFormCV(formMat: any, formRegion: BoundingBox): Promise<DetectedElement[]> {
    console.log('Detector: Detecting elements within form using CV')
    
    try {
      const elements: DetectedElement[] = []
      
      // Convert to grayscale for processing
      const gray = new cv.Mat()
      cv.cvtColor(formMat, gray, cv.COLOR_RGBA2GRAY)
      
      // Detect checkboxes
      const checkboxes = await this.detectCheckboxes(gray)
      elements.push(...checkboxes)
      
      // Detect text fields
      const textFields = await this.detectTextFields(gray)
      elements.push(...textFields)
      
      // Detect signature areas
      const signatureAreas = await this.detectSignatureAreas(gray)
      elements.push(...signatureAreas)
      
      // Run OCR to extract text and identify field types
      await this.enhanceElementsWithOCR(formMat, elements)
      
      // Clean up
      gray.delete()
      
      console.log(`Detector: Detected ${elements.length} elements in form`)
      return elements
      
    } catch (error) {
      console.error('Detector: Error detecting form elements:', error)
      return []
    }
  }

  /**
   * Detect checkboxes using template matching and contour analysis
   */
  private async detectCheckboxes(grayMat: any): Promise<DetectedElement[]> {
    const checkboxes: DetectedElement[] = []
    
    try {
      // Apply threshold
      const thresh = new cv.Mat()
      cv.threshold(grayMat, thresh, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU)
      
      // Find contours
      const contours = new cv.MatVector()
      const hierarchy = new cv.Mat()
      cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
      
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i)
        const area = cv.contourArea(contour)
        
        // Checkbox size constraints
        if (area > 100 && area < 2000) {
          const boundingRect = cv.boundingRect(contour)
          const aspectRatio = boundingRect.width / boundingRect.height
          
          // Square-like shape (checkboxes are typically square)
          if (aspectRatio > 0.7 && aspectRatio < 1.4) {
            checkboxes.push({
              type: 'checkbox',
              boundingBox: {
                x: boundingRect.x,
                y: boundingRect.y,
                width: boundingRect.width,
                height: boundingRect.height
              },
              confidence: 0.8 // Base confidence, will be refined
            })
          }
        }
        
        contour.delete()
      }
      
      // Clean up
      thresh.delete()
      contours.delete()
      hierarchy.delete()
      
    } catch (error) {
      console.error('Detector: Error detecting checkboxes:', error)
    }
    
    return checkboxes
  }

  /**
   * Detect text fields using line detection
   */
  private async detectTextFields(grayMat: any): Promise<DetectedElement[]> {
    const textFields: DetectedElement[] = []
    
    try {
      // Detect horizontal lines (underlines for text fields)
      const horizontalKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(50, 1))
      const horizontalLines = new cv.Mat()
      cv.morphologyEx(grayMat, horizontalLines, cv.MORPH_OPEN, horizontalKernel)
      
      // Find contours of horizontal lines
      const contours = new cv.MatVector()
      const hierarchy = new cv.Mat()
      cv.findContours(horizontalLines, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
      
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i)
        const boundingRect = cv.boundingRect(contour)
        
        // Text field constraints
        if (boundingRect.width > 80 && boundingRect.height < 20) {
          textFields.push({
            type: 'text_field',
            boundingBox: {
              x: boundingRect.x,
              y: Math.max(0, boundingRect.y - 25), // Include space above line
              width: boundingRect.width,
              height: 35 // Text + line
            },
            confidence: 0.7
          })
        }
        
        contour.delete()
      }
      
      // Clean up
      horizontalKernel.delete()
      horizontalLines.delete()
      contours.delete()
      hierarchy.delete()
      
    } catch (error) {
      console.error('Detector: Error detecting text fields:', error)
    }
    
    return textFields
  }

  /**
   * Detect signature areas
   */
  private async detectSignatureAreas(grayMat: any): Promise<DetectedElement[]> {
    const signatureAreas: DetectedElement[] = []
    
    try {
      // Look for rectangular regions that might be signature areas
      const thresh = new cv.Mat()
      cv.threshold(grayMat, thresh, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU)
      
      const contours = new cv.MatVector()
      const hierarchy = new cv.Mat()
      cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
      
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i)
        const area = cv.contourArea(contour)
        const boundingRect = cv.boundingRect(contour)
        const aspectRatio = boundingRect.width / boundingRect.height
        
        // Signature area constraints (larger rectangular areas)
        if (area > 5000 && aspectRatio > 2 && aspectRatio < 5) {
          signatureAreas.push({
            type: 'signature_area',
            boundingBox: {
              x: boundingRect.x,
              y: boundingRect.y,
              width: boundingRect.width,
              height: boundingRect.height
            },
            confidence: 0.6
          })
        }
        
        contour.delete()
      }
      
      // Clean up
      thresh.delete()
      contours.delete()
      hierarchy.delete()
      
    } catch (error) {
      console.error('Detector: Error detecting signature areas:', error)
    }
    
    return signatureAreas
  }

  /**
   * Enhance detected elements with OCR text recognition
   */
  private async enhanceElementsWithOCR(formMat: any, elements: DetectedElement[]): Promise<void> {
    if (!this.tesseractWorker) return
    
    try {
      // Convert mat to image buffer for Tesseract
      const imageBuffer = this.matToBuffer(formMat)
      
      // Run OCR on the entire form
      const ocrResult = await this.tesseractWorker.recognize(imageBuffer)
      const words = (ocrResult.data as any).lines?.flatMap((line: any) => line.words) || []
      
      // Match OCR words to detected elements and classify them
      for (const element of elements) {
        const nearbyWords = words.filter((word: any) => 
          this.isWordNearElement(word.bbox, element.boundingBox)
        )
        
        if (nearbyWords.length > 0) {
          const text = nearbyWords.map((w: any) => w.text).join(' ').trim()
          element.text = text
          
          // Classify element type based on nearby text
          element.label = this.classifyElementByContext(text, element.type)
          
          // Refine element type based on content
          const refinedType = this.refineElementType(text, element.type)
          if (refinedType !== element.type) {
            element.type = refinedType
            element.confidence *= 0.9 // Slightly reduce confidence for type changes
          }
          
          // Boost confidence if we found relevant text
          element.confidence = Math.min(element.confidence + 0.1, 1.0)
        }
      }
      
    } catch (error) {
      console.error('Detector: Error in OCR processing:', error)
    }
  }

  /**
   * Check if OCR word is near a detected element
   */
  private isWordNearElement(wordBbox: any, elementBbox: BoundingBox): boolean {
    const threshold = 50 // pixels
    
    const wordCenterX = wordBbox.x0 + (wordBbox.x1 - wordBbox.x0) / 2
    const wordCenterY = wordBbox.y0 + (wordBbox.y1 - wordBbox.y0) / 2
    
    const elementCenterX = elementBbox.x + elementBbox.width / 2
    const elementCenterY = elementBbox.y + elementBbox.height / 2
    
    const distance = Math.sqrt(
      Math.pow(wordCenterX - elementCenterX, 2) + 
      Math.pow(wordCenterY - elementCenterY, 2)
    )
    
    return distance < threshold
  }

  /**
   * Classify element based on nearby text context
   */
  private classifyElementByContext(text: string, currentType: string): string {
    const lowerText = text.toLowerCase()
    
    if (lowerText.includes('name') || lowerText.includes('donor')) return 'donor_name'
    if (lowerText.includes('email') || lowerText.includes('e-mail')) return 'email'
    if (lowerText.includes('phone') || lowerText.includes('tel')) return 'phone'
    if (lowerText.includes('address') || lowerText.includes('street')) return 'address'
    if (lowerText.includes('amount') || lowerText.includes('$') || lowerText.includes('donation')) return 'amount'
    if (lowerText.includes('date') || lowerText.includes('when')) return 'date'
    if (lowerText.includes('signature') || lowerText.includes('sign')) return 'signature'
    if (lowerText.includes('recurring') || lowerText.includes('monthly')) return 'recurring'
    if (lowerText.includes('anonymous') || lowerText.includes('private')) return 'anonymous'
    if (lowerText.includes('credit') || lowerText.includes('card')) return 'payment_credit_card'
    if (lowerText.includes('check') || lowerText.includes('cheque')) return 'payment_check'
    
    return `unknown_${currentType}`
  }

  /**
   * Refine element type based on OCR content
   */
  private refineElementType(text: string, currentType: string): DetectedElement['type'] {
    const lowerText = text.toLowerCase()
    
    // Look for patterns that indicate specific field types
    if (/\$\d+|\d+\.\d{2}/.test(text)) return 'amount_field'
    if (/\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4}/.test(text)) return 'date_field'
    if (lowerText.includes('signature') || lowerText.includes('sign here')) return 'signature_area'
    
    return currentType as DetectedElement['type']
  }

  /**
   * Convert buffer to OpenCV Mat
   */
  private bufferToMat(buffer: Buffer, width: number, height: number): any {
    const uint8Array = new Uint8Array(buffer)
    return cv.matFromArray(height, width, cv.CV_8UC4, uint8Array)
  }

  /**
   * Convert OpenCV Mat to buffer
   */
  private matToBuffer(mat: any): Buffer {
    const uint8Array = new Uint8Array(mat.data)
    return Buffer.from(uint8Array)
  }

  /**
   * Calculate form confidence based on detected elements
   */
  private calculateFormConfidence(elements: DetectedElement[]): number {
    if (elements.length === 0) return 0
    
    const totalConfidence = elements.reduce((sum, element) => sum + element.confidence, 0)
    let averageConfidence = totalConfidence / elements.length
    
    // Boost confidence for having key elements
    const hasKeyElements = elements.some(e => e.label?.includes('name')) &&
                          elements.some(e => e.label?.includes('amount'))
    
    if (hasKeyElements) {
      averageConfidence = Math.min(averageConfidence + 0.15, 1.0)
    }
    
    // Additional boost for having multiple element types
    const elementTypes = new Set(elements.map(e => e.type))
    if (elementTypes.size >= 3) {
      averageConfidence = Math.min(averageConfidence + 0.1, 1.0)
    }
    
    console.log(`Detector: Calculated form confidence: ${averageConfidence.toFixed(2)}`)
    return averageConfidence
  }

  /**
   * Update detection metrics
   */
  private updateMetrics(detectedForms: DetectedForm[], detectionTime: number): void {
    const totalElements = detectedForms.reduce((sum, form) => sum + form.detectedElements.length, 0)
    const totalConfidence = detectedForms.reduce((sum, form) => sum + form.confidence, 0)
    
    this.metrics.totalForms += detectedForms.length
    this.metrics.elementsDetected += totalElements
    this.metrics.detectionTime += detectionTime
    
    if (detectedForms.length > 0) {
      this.metrics.averageConfidence = totalConfidence / detectedForms.length
    }
  }

  /**
   * Get detection performance metrics
   */
  getMetrics(): DetectionMetrics {
    return { ...this.metrics }
  }

  /**
   * Validate detector configuration
   */
  async validate(): Promise<boolean> {
    console.log('Detector: Validating configuration')
    
    try {
      // Check OpenCV availability
      if (typeof cv === 'undefined') {
        console.error('Detector: OpenCV not available')
        return false
      }
      
      // Check Tesseract worker
      if (!this.tesseractWorker) {
        console.error('Detector: Tesseract worker not initialized')
        return false
      }
      
      console.log('Detector: Configuration valid')
      return true
      
    } catch (error) {
      console.error('Detector: Validation failed:', error)
      return false
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    console.log('Detector: Cleaning up resources')
    
    try {
      if (this.tesseractWorker) {
        await this.tesseractWorker.terminate()
        this.tesseractWorker = null
      }
      
      this.isInitialized = false
      console.log('Detector: Cleanup complete')
      
    } catch (error) {
      console.error('Detector: Error during cleanup:', error)
    }
  }
}
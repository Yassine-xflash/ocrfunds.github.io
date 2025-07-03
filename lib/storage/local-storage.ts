/**
 * Local Storage Utility for Donation Form OCR Platform
 * 
 * Manages uploaded forms and extracted data locally in the browser
 */

export interface StoredFormData {
  id: string
  fileName: string
  formNumber: number
  confidence: number
  status: 'uploaded' | 'processing' | 'completed' | 'error' | 'validated' | 'needs-review' | 'rejected'
  fields: {
    donorName: string
    email: string
    phone: string
    address: string
    amount: number
    paymentMethod: string
    paymentDetails: {
      cardType?: string
      cardNumber?: string
      expiryDate?: string
      cvv?: string
      cardholderName?: string
    }
    date: string
    recurring: boolean
    anonymous: boolean
  }
  issues?: string[]
  uploadedAt: string
  extractedAt?: string
  fileSize?: number
}

export interface UploadedFileInfo {
  id: string
  name: string
  size: number
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
  extractedForms?: number
  errors?: string[]
  uploadedAt: string
}

const STORAGE_KEYS = {
  UPLOADED_FILES: 'ocr_uploaded_files',
  EXTRACTED_FORMS: 'ocr_extracted_forms',
  APP_SETTINGS: 'ocr_app_settings'
} as const

/**
 * Local Storage Manager Class
 */
export class LocalStorageManager {
  private static instance: LocalStorageManager
  
  private constructor() {
    console.log('LocalStorageManager: Initializing local storage manager')
  }
  
  static getInstance(): LocalStorageManager {
    if (!LocalStorageManager.instance) {
      LocalStorageManager.instance = new LocalStorageManager()
    }
    return LocalStorageManager.instance
  }

  /**
   * Check if localStorage is available
   */
  private isLocalStorageAvailable(): boolean {
    try {
      if (typeof window === 'undefined') return false
      const test = '__localStorage_test__'
      localStorage.setItem(test, test)
      localStorage.removeItem(test)
      return true
    } catch {
      return false
    }
  }

  /**
   * Store uploaded file information
   */
  storeUploadedFile(fileInfo: UploadedFileInfo): void {
    if (!this.isLocalStorageAvailable()) {
      console.warn('LocalStorageManager: localStorage not available')
      return
    }

    try {
      const existingFiles = this.getUploadedFiles()
      const updatedFiles = existingFiles.filter(f => f.id !== fileInfo.id)
      updatedFiles.push(fileInfo)
      
      localStorage.setItem(STORAGE_KEYS.UPLOADED_FILES, JSON.stringify(updatedFiles))
      console.log(`LocalStorageManager: Stored uploaded file info: ${fileInfo.name}`)
    } catch (error) {
      console.error('LocalStorageManager: Error storing uploaded file:', error)
    }
  }

  /**
   * Get all uploaded files
   */
  getUploadedFiles(): UploadedFileInfo[] {
    if (!this.isLocalStorageAvailable()) return []

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.UPLOADED_FILES)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('LocalStorageManager: Error retrieving uploaded files:', error)
      return []
    }
  }

  /**
   * Update uploaded file status
   */
  updateUploadedFile(fileId: string, updates: Partial<UploadedFileInfo>): void {
    if (!this.isLocalStorageAvailable()) return

    try {
      const files = this.getUploadedFiles()
      const fileIndex = files.findIndex(f => f.id === fileId)
      
      if (fileIndex !== -1) {
        files[fileIndex] = { ...files[fileIndex], ...updates }
        localStorage.setItem(STORAGE_KEYS.UPLOADED_FILES, JSON.stringify(files))
        console.log(`LocalStorageManager: Updated file ${fileId}:`, updates)
      }
    } catch (error) {
      console.error('LocalStorageManager: Error updating uploaded file:', error)
    }
  }

  /**
   * Store extracted form data
   */
  storeExtractedForm(formData: StoredFormData): void {
    if (!this.isLocalStorageAvailable()) return

    try {
      const existingForms = this.getExtractedForms()
      const updatedForms = existingForms.filter(f => f.id !== formData.id)
      updatedForms.push(formData)
      
      localStorage.setItem(STORAGE_KEYS.EXTRACTED_FORMS, JSON.stringify(updatedForms))
      console.log(`LocalStorageManager: Stored extracted form data: ${formData.fileName}`)
    } catch (error) {
      console.error('LocalStorageManager: Error storing extracted form:', error)
    }
  }

  /**
   * Get all extracted forms (only user uploaded ones)
   */
  getExtractedForms(): StoredFormData[] {
    if (!this.isLocalStorageAvailable()) return []

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.EXTRACTED_FORMS)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('LocalStorageManager: Error retrieving extracted forms:', error)
      return []
    }
  }

  /**
   * Update extracted form data
   */
  updateExtractedForm(formId: string, updates: Partial<StoredFormData>): void {
    if (!this.isLocalStorageAvailable()) return

    try {
      const forms = this.getExtractedForms()
      const formIndex = forms.findIndex(f => f.id === formId)
      
      if (formIndex !== -1) {
        forms[formIndex] = { ...forms[formIndex], ...updates }
        localStorage.setItem(STORAGE_KEYS.EXTRACTED_FORMS, JSON.stringify(forms))
        console.log(`LocalStorageManager: Updated form ${formId}:`, updates)
      }
    } catch (error) {
      console.error('LocalStorageManager: Error updating extracted form:', error)
    }
  }

  /**
   * Remove a specific extracted form
   */
  removeExtractedForm(formId: string): void {
    if (!this.isLocalStorageAvailable()) return

    try {
      const forms = this.getExtractedForms()
      const filteredForms = forms.filter(f => f.id !== formId)
      localStorage.setItem(STORAGE_KEYS.EXTRACTED_FORMS, JSON.stringify(filteredForms))
      console.log(`LocalStorageManager: Removed form ${formId}`)
    } catch (error) {
      console.error('LocalStorageManager: Error removing extracted form:', error)
    }
  }

  /**
   * Clear all uploaded files and extracted forms
   */
  clearAllData(): void {
    if (!this.isLocalStorageAvailable()) return

    try {
      localStorage.removeItem(STORAGE_KEYS.UPLOADED_FILES)
      localStorage.removeItem(STORAGE_KEYS.EXTRACTED_FORMS)
      console.log('LocalStorageManager: Cleared all OCR data')
    } catch (error) {
      console.error('LocalStorageManager: Error clearing data:', error)
    }
  }

  /**
   * Get upload statistics
   */
  getUploadStats(): {
    totalUploaded: number
    totalExtracted: number
    successRate: number
    lastUpload?: string
  } {
    const uploadedFiles = this.getUploadedFiles()
    const extractedForms = this.getExtractedForms()
    
    const completedUploads = uploadedFiles.filter(f => f.status === 'completed').length
    const successRate = uploadedFiles.length > 0 ? (completedUploads / uploadedFiles.length) * 100 : 0
    
    const lastUpload = uploadedFiles.length > 0 
      ? uploadedFiles.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0].uploadedAt
      : undefined

    return {
      totalUploaded: uploadedFiles.length,
      totalExtracted: extractedForms.length,
      successRate,
      lastUpload
    }
  }
}

// Export singleton instance
export const localStorageManager = LocalStorageManager.getInstance()
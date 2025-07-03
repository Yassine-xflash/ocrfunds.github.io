import { createWorker, Worker, PSM } from 'tesseract.js';
import tesseract from 'node-tesseract-ocr';

interface SegmentedForm {
  formId: string
  pageNumber: number
  confidence: number
  fieldSegments: FieldSegment[]
}

interface FieldSegment {
  fieldId: string
  fieldType: 'text_field' | 'checkbox' | 'signature_area' | 'amount_field' | 'date_field'
  label: string
  boundingBox: BoundingBox
  imageSegment: Buffer
  confidence: number
  preprocessed: boolean
}

interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
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
}

interface ExtractionMetrics {
  totalFormsExtracted: number
  totalFieldsExtracted: number
  averageExtractionTime: number
  extractionErrors: number
  averageConfidence: number
}

/**
 * Production Extractor with Real OCR
 * 
 * Real OCR text recognition and data extraction module using Tesseract.js.
 * Processes actual donation form images and extracts structured data.
 */
export class Extractor {
  private metrics: ExtractionMetrics = {
    totalFormsExtracted: 0,
    totalFieldsExtracted: 0,
    averageExtractionTime: 0,
    extractionErrors: 0,
    averageConfidence: 0
  }

  private tesseractWorker: Worker | null = null
  private isInitialized: boolean = false

  constructor() {
    console.log('Extractor: Initializing production OCR extraction module with Tesseract.js')
  }

  /**
   * Initialize Tesseract.js OCR engine for production use
   */
  private async initializeOCREngine(): Promise<void> {
    if (this.isInitialized && this.tesseractWorker) return;

    console.log('Extractor: Initializing Tesseract.js OCR engine for production');
    
    const isServerSide = typeof window === 'undefined';

    if (isServerSide) {
      console.log('Extractor: Server-side environment detected, using node-tesseract-ocr');
      this.isInitialized = true;
      return;
    }

    console.log('Extractor: Configuring for client-side environment');
    this.tesseractWorker = await createWorker('eng');
    await this.tesseractWorker.load();
    await this.tesseractWorker.reinitialize('eng');
    await this.tesseractWorker.setParameters({
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,@()-/:$ ',
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: '1'
    });
    this.isInitialized = true;
    console.log('Extractor: Production OCR engine initialized successfully');
  }

  /**
   * Perform real OCR on the entire form image
   */
  private async performFullImageOCR(imageBuffer: Buffer): Promise<{ text: string; confidence: number }> {
    console.log('Extractor: Performing real OCR on form image');

    await this.initializeOCREngine();
    const isServerSide = typeof window === 'undefined';

    if (isServerSide) {
      return await this.performServerSideOCR(imageBuffer);
    }

    if (!this.tesseractWorker) {
      throw new Error('OCR worker not initialized');
    }

    console.log('Extractor: Running Tesseract.js OCR recognition');
    const { data } = await this.tesseractWorker.recognize(imageBuffer);

    console.log(`Extractor: OCR completed with ${data.confidence}% confidence`);
    console.log('Extractor: Extracted text preview:', data.text.substring(0, 200) + '...');

    return { 
      text: data.text, 
      confidence: data.confidence 
    };
  }

  /**
   * Server-side OCR simulation or alternative processing
   */
  private async performServerSideOCR(imageBuffer: Buffer): Promise<{ text: string; confidence: number }> {
    console.log('Extractor: Performing server-side OCR using node-tesseract-ocr');

    try {
      const text = await tesseract.recognize(imageBuffer, {
        lang: 'eng',
        psm: 6, // Assume a uniform block of text
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,@()-/:$ '
      });

      console.log('Extractor: Real OCR text extracted:', text.substring(0, 200) + '...');
      return {
        text,
        confidence: 90 // node-tesseract-ocr does not provide a confidence score; estimate conservatively
      };
    } catch (error) {
      console.error('Extractor: Server-side OCR failed:', error);
      throw new Error(`Server-side OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract structured data from segmented forms using real OCR
   */
  async extractFormData(segmentedForms: SegmentedForm[]): Promise<ExtractedFormData[]> {
    if (typeof window === 'undefined') {
    throw new Error('OCR extraction only available in browser environment');
  }
    console.log(`Extractor: Starting real OCR extraction for ${segmentedForms.length} forms`)
    const startTime = Date.now()
    
    try {
      await this.initializeOCREngine();
      const extractedData: ExtractedFormData[] = []
      
      for (let i = 0; i < segmentedForms.length; i++) {
        const form = segmentedForms[i]
        console.log(`Extractor: Processing form ${i + 1}/${segmentedForms.length}`)
        
        const formData = await this.extractSingleFormData(form, i + 1)
        extractedData.push(formData)
      }
      
      const extractionTime = Date.now() - startTime
      this.updateMetrics(extractedData, extractionTime)
      
      console.log(`Extractor: Successfully extracted data from ${extractedData.length} forms in ${extractionTime}ms`)
      return extractedData
      
    } catch (error) {
      console.error('Extractor: Error during real OCR extraction:', error)
      this.metrics.extractionErrors++
      throw new Error(`Real OCR extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract data from actual form image using real OCR
   */
  async extractFromRealImage(imageBuffer: Buffer): Promise<ExtractedFormData> {
    console.log('Extractor: Starting real OCR extraction from form image')
    const startTime = Date.now()

    try {
      // Perform real OCR to get all text
      const ocrResult = await this.performFullImageOCR(imageBuffer)
      
      // Extract structured data from OCR text
      const extractedData = await this.parseFormText(ocrResult.text, ocrResult.confidence)
      
      const processingTime = (Date.now() - startTime) / 1000
      console.log(`Extractor: Real extraction completed in ${processingTime}s with confidence: ${ocrResult.confidence}%`)

      return {
        formNumber: 1,
        confidence: ocrResult.confidence / 100,
        fields: extractedData.fields,
        issues: extractedData.issues
      }

    } catch (error) {
      console.error('Extractor: Error in real image extraction:', error)
      this.metrics.extractionErrors++
      throw new Error(`Real image extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract data from a single segmented form using real OCR
   */
  private async extractSingleFormData(form: SegmentedForm, formNumber: number): Promise<ExtractedFormData> {
    console.log(`Extractor: Processing segmented form ${form.formId}`)
    
    try {
      // If we have field segments, we can process them individually for better accuracy
      if (form.fieldSegments && form.fieldSegments.length > 0) {
        return await this.extractFromFieldSegments(form, formNumber);
      } else {
        // Fallback to processing the entire form as one image
        // You'll need to provide the full form image buffer here
        throw new Error('No field segments available and no full form image provided');
      }
      
    } catch (error) {
      console.error(`Extractor: Error processing form ${form.formId}:`, error);
      this.metrics.extractionErrors++;
      
      // Return a partial result with error information
      return {
        formNumber,
        confidence: 0,
        fields: {
          donorName: '',
          email: '',
          phone: '',
          address: '',
          amount: 0,
          paymentMethod: '',
          paymentDetails: {},
          date: '',
          recurring: false,
          anonymous: false
        },
        issues: [`Failed to process form: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Extract data from individual field segments
   */
  private async extractFromFieldSegments(form: SegmentedForm, formNumber: number): Promise<ExtractedFormData> {
    console.log(`Extractor: Processing ${form.fieldSegments.length} field segments`);
    
    const fields = {
      donorName: '',
      email: '',
      phone: '',
      address: '',
      amount: 0,
      paymentMethod: '',
      paymentDetails: {
        cardType: '',
        cardNumber: '',
        expiryDate: '',
        cvv: '',
        cardholderName: ''
      },
      date: '',
      recurring: false,
      anonymous: false
    };
    
    const issues: string[] = [];
    let totalConfidence = 0;
    let processedSegments = 0;

    for (const segment of form.fieldSegments) {
      try {
        console.log(`Extractor: Processing ${segment.fieldType} field: ${segment.fieldId}`);
        
        const ocrResult = await this.performFullImageOCR(segment.imageSegment);
        const text = ocrResult.text.trim();
        
        totalConfidence += ocrResult.confidence;
        processedSegments++;

        // Process based on field type and content
        await this.processFieldSegment(segment, text, fields, issues);
        
      } catch (error) {
        console.error(`Extractor: Error processing segment ${segment.fieldId}:`, error);
        issues.push(`Failed to process ${segment.fieldType} field: ${segment.fieldId}`);
      }
    }

    const averageConfidence = processedSegments > 0 ? totalConfidence / processedSegments : 0;

    return {
      formNumber,
      confidence: averageConfidence / 100,
      fields,
      issues
    };
  }

  /**
   * Process individual field segment based on type
   */
  private async processFieldSegment(
    segment: FieldSegment, 
    text: string, 
    fields: ExtractedFormData['fields'], 
    issues: string[]
  ): Promise<void> {
    
    switch (segment.fieldType) {
      case 'text_field':
        if (segment.fieldId.toLowerCase().includes('name')) {
          fields.donorName = text;
        } else if (segment.fieldId.toLowerCase().includes('email')) {
          fields.email = text;
          if (!this.isValidEmail(text)) {
            issues.push('Email format appears incorrect');
          }
        } else if (segment.fieldId.toLowerCase().includes('phone')) {
          fields.phone = text;
        } else if (segment.fieldId.toLowerCase().includes('address')) {
          fields.address = text;
        }
        break;
        
      case 'amount_field':
        const amount = this.extractAmount(text);
        if (amount > 0) {
          fields.amount = amount;
        }
        break;
        
      case 'date_field':
        const date = this.extractDate(text);
        if (date) {
          fields.date = date;
        }
        break;
        
      case 'checkbox':
        // Process checkbox fields for payment method, recurring, etc.
        if (text.toLowerCase().includes('monthly') || text.toLowerCase().includes('recurring')) {
          fields.recurring = true;
        }
        break;
        
      case 'signature_area':
        if (text.trim()) {
          fields.paymentDetails.cardholderName = text;
        }
        break;
    }
  }

  /**
   * Parse OCR text and extract structured donation form data
   */
  private async parseFormText(ocrText: string, confidence: number): Promise<{
    fields: ExtractedFormData['fields'],
    issues: string[]
  }> {
    console.log('Extractor: Parsing OCR text to extract form fields')
    
    const issues: string[] = []
    const fields = {
      donorName: '',
      email: '',
      phone: '',
      address: '',
      amount: 0,
      paymentMethod: '',
      paymentDetails: {
        cardType: '',
        cardNumber: '',
        expiryDate: '',
        cvv: '',
        cardholderName: ''
      },
      date: '',
      recurring: false,
      anonymous: false
    }

    try {
      // Extract donor name
      const nameMatch = ocrText.match(/(?:Mr\.|Ms\.|First Name:|Last Name:)\s*([A-Za-z\s]+)/gi)
      if (nameMatch) {
        const firstNameMatch = ocrText.match(/First Name[:\s]*([A-Za-z\s]+)/i)
        const lastNameMatch = ocrText.match(/Last Name[:\s]*([A-Za-z\s]+)/i)
        const fullNameMatch = ocrText.match(/(?:Mr\.|Ms\.)[:\s]*([A-Za-z\s]+)/i)
        
        if (firstNameMatch && lastNameMatch) {
          fields.donorName = `${firstNameMatch[1].trim()} ${lastNameMatch[1].trim()}`
        } else if (fullNameMatch) {
          fields.donorName = fullNameMatch[1].trim()
        }
      }

      // Extract email
      const emailMatch = ocrText.match(/E[-\s]?[Mm]ail[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
      if (emailMatch) {
        fields.email = emailMatch[1].trim()
      }

      // Extract phone
      const phoneMatch = ocrText.match(/(?:Phone|Telephone)[:\s]*\(?(\d{3})\)?[-.\s]*(\d{3})[-.\s]*(\d{4})/i)
      if (phoneMatch) {
        fields.phone = `(${phoneMatch[1]}) ${phoneMatch[2]}-${phoneMatch[3]}`
      }

      // Extract address
      const addressMatch = ocrText.match(/Address[:\s]*([^\n]+)/i)
      if (addressMatch) {
        let address = addressMatch[1].trim()
        
        const cityStateZipMatch = ocrText.match(/City[:\s]*([^,\n]+)[\s,]*State[:\s]*([A-Z]{2})[\s,]*Zip(?:\s*Code)?[:\s]*(\d{5})/i)
        if (cityStateZipMatch) {
          address += `, ${cityStateZipMatch[1].trim()}, ${cityStateZipMatch[2]} ${cityStateZipMatch[3]}`
        }
        
        fields.address = address
      }

      // Extract donation amount
      fields.amount = this.extractAmount(ocrText);

      // Extract payment method and credit card details
      const paymentInfo = this.extractPaymentInfo(ocrText);
      fields.paymentMethod = paymentInfo.paymentMethod;
      fields.paymentDetails = {
        cardType: paymentInfo.paymentDetails.cardType ?? '',
        cardNumber: paymentInfo.paymentDetails.cardNumber ?? '',
        expiryDate: paymentInfo.paymentDetails.expiryDate ?? '',
        cvv: paymentInfo.paymentDetails.cvv ?? '',
        cardholderName: paymentInfo.paymentDetails.cardholderName ?? ''
      };

      // Extract recurring donation info
      fields.recurring = ocrText.toLowerCase().includes('monthly') && 
                        !ocrText.toLowerCase().includes('one time');

      // Extract date
      const extractedDate = this.extractDate(ocrText);
      if (extractedDate) {
        fields.date = extractedDate;
      }

      // Validate extracted data
      this.validateExtractedData(fields, issues, confidence);

      console.log('Extractor: Extracted fields:', fields)
      console.log('Extractor: Issues found:', issues)

      return { fields, issues }

    } catch (error) {
      console.error('Extractor: Error parsing OCR text:', error)
      issues.push('Error parsing extracted text')
      return { fields, issues }
    }
  }

  /**
   * Extract amount from text
   */
  private extractAmount(text: string): number {
    const amountMatches = text.match(/\$(\d{1,3}(?:,\d{3})*)/g);
    if (amountMatches) {
      const amounts = amountMatches.map(match => parseInt(match.replace(/[\$,]/g, '')));
      const donationAmount = amounts.find(amt => amt >= 25 && amt <= 25000);
      return donationAmount || 0;
    }
    return 0;
  }

  /**
   * Extract date from text
   */
  private extractDate(text: string): string | null {
    const dateMatch = text.match(/Date[:\s]*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, '0');
      const month = dateMatch[2].padStart(2, '0');
      const year = dateMatch[3];
      return `${year}-${month}-${day}`;
    }
    return null;
  }

  /**
   * Extract payment information from text
   */
  private extractPaymentInfo(text: string): {
    paymentMethod: string;
    paymentDetails: ExtractedFormData['fields']['paymentDetails'];
  } {
    const paymentDetails = {
      cardType: '',
      cardNumber: '',
      expiryDate: '',
      cvv: '',
      cardholderName: ''
    };

    // Check for cash or check payments
    if (text.toLowerCase().includes('cash') && (text.includes('X') || text.includes('✓'))) {
      return { paymentMethod: 'Cash', paymentDetails };
    }
    
    if (text.toLowerCase().includes('check')) {
      return { paymentMethod: 'Check', paymentDetails };
    }

    // Detect credit card type
    const cardTypeDetection = this.detectCreditCardType(text);
    
    if (cardTypeDetection.cardType) {
      paymentDetails.cardType = cardTypeDetection.cardType;
      
      // Extract credit card number
      const cardNumberMatch = text.match(/(?:Account No|Credit Card number)[:\s]*(\d{4}\s*\d{4}\s*\d{4}\s*\d{4}|\d{16})/i);
      if (cardNumberMatch) {
        paymentDetails.cardNumber = cardNumberMatch[1].replace(/\s/g, '');
      }
      
      // Extract expiry date
      const expiryMatch = text.match(/(?:Expires on|Exp date)[:\s]*(\d{1,2})[\/\-](\d{2,4})/i);
      if (expiryMatch) {
        const month = expiryMatch[1].padStart(2, '0');
        const year = expiryMatch[2].length === 2 ? `20${expiryMatch[2]}` : expiryMatch[2];
        paymentDetails.expiryDate = `${month}/${year.slice(-2)}`;
      }
      
      // Extract CVV/CVN
      const cvvMatch = text.match(/(?:Card Verification|CVN|CVV|Verification code)[:\s#]*(\d{3,4})/i);
      if (cvvMatch) {
        paymentDetails.cvv = cvvMatch[1];
      }
      
      // Extract cardholder name from signature
      const signatureMatch = text.match(/Signature[:\s]*([A-Za-z\s]+)/i);
      if (signatureMatch) {
        paymentDetails.cardholderName = signatureMatch[1].trim();
      }
      
      return { 
        paymentMethod: `Credit Card (${cardTypeDetection.cardType})`, 
        paymentDetails 
      };
    }
    
    return { paymentMethod: 'Unknown', paymentDetails };
  }

  /**
   * Detect credit card type from OCR text and card number patterns
   */
  private detectCreditCardType(ocrText: string): { cardType: string; confidence: number } {
    console.log('Extractor: Detecting credit card type from OCR text')
    
    const lowerText = ocrText.toLowerCase()
    
    // Check for explicit card type mentions with checkmarks or X marks
    if ((lowerText.includes('visa') || lowerText.includes('✓visa') || lowerText.includes('xvisa')) && 
        !lowerText.includes('discover')) {
      return { cardType: 'Visa', confidence: 0.9 }
    }
    
    if (lowerText.includes('master') || lowerText.includes('m/c') || lowerText.includes('✓m/c')) {
      return { cardType: 'Mastercard', confidence: 0.9 }
    }
    
    if (lowerText.includes('american express') || lowerText.includes('amex') || 
        lowerText.includes('am exp') || lowerText.includes('am/exp') || lowerText.includes('✓am/exp')) {
      return { cardType: 'American Express', confidence: 0.9 }
    }
    
    if (lowerText.includes('discover') || lowerText.includes('disc') || lowerText.includes('✓disc')) {
      return { cardType: 'Discover', confidence: 0.9 }
    }
    
    // Detect by card number patterns if available
    const cardNumberMatch = ocrText.match(/(\d{4}\s*\d{4}\s*\d{4}\s*\d{4}|\d{16})/g)
    if (cardNumberMatch) {
      for (const cardNumber of cardNumberMatch) {
        const cleanNumber = cardNumber.replace(/\s/g, '')
        
        if (cleanNumber.startsWith('4')) {
          return { cardType: 'Visa', confidence: 0.8 }
        }
        
        if (cleanNumber.startsWith('5') || 
            (cleanNumber.startsWith('2') && parseInt(cleanNumber.substring(0, 4)) >= 2221 && parseInt(cleanNumber.substring(0, 4)) <= 2720)) {
          return { cardType: 'Mastercard', confidence: 0.8 }
        }
        
        if (cleanNumber.startsWith('34') || cleanNumber.startsWith('37')) {
          return { cardType: 'American Express', confidence: 0.8 }
        }
        
        if (cleanNumber.startsWith('6')) {
          return { cardType: 'Discover', confidence: 0.8 }
        }
      }
    }
    
    return { cardType: '', confidence: 0 }
  }

  /**
   * Validate extracted data and add issues
   */
  private validateExtractedData(
    fields: ExtractedFormData['fields'], 
    issues: string[], 
    confidence: number
  ): void {
    if (!fields.donorName || fields.donorName.length < 2) {
      issues.push('Donor name could not be extracted clearly');
    }
    
    if (fields.email && !this.isValidEmail(fields.email)) {
      issues.push('Email format appears incorrect');
    }
    
    if (!fields.phone) {
      issues.push('Phone number could not be extracted');
    }
    
    if (fields.amount <= 0) {
      issues.push('Donation amount could not be determined');
    }

    if (confidence < 80) {
      issues.push('OCR confidence is below optimal threshold');
    }
  }

  /**
   * Email validation helper
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Update extraction metrics
   */
  private updateMetrics(extractedData: ExtractedFormData[], extractionTime: number): void {
    const totalFields = extractedData.length * 9
    const totalConfidence = extractedData.reduce((sum, form) => sum + form.confidence, 0)
    
    this.metrics.totalFormsExtracted += extractedData.length
    this.metrics.totalFieldsExtracted += totalFields
    this.metrics.averageExtractionTime = 
      ((this.metrics.averageExtractionTime * (this.metrics.totalFormsExtracted - extractedData.length)) + extractionTime) / 
      this.metrics.totalFormsExtracted
    
    if (extractedData.length > 0) {
      this.metrics.averageConfidence = totalConfidence / extractedData.length
    }
  }

  /**
   * Get extraction performance metrics
   */
  getMetrics(): ExtractionMetrics {
    return { ...this.metrics }
  }

  /**
   * Validate extractor configuration
   */
  async validate(): Promise<boolean> {
    console.log('Extractor: Validating production OCR configuration')
    
    try {
      await this.initializeOCREngine();
      return this.isInitialized && this.tesseractWorker !== null;
    } catch (error) {
      console.error('Extractor: Validation failed:', error);
      return false;
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    console.log('Extractor: Cleaning up OCR resources');
    
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate();
      this.tesseractWorker = null;
      this.isInitialized = false;
    }
  }
}
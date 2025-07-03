
import path from 'path';
import fs from 'fs/promises';
import { fromBuffer } from 'pdf2pic';
import { Jimp } from 'jimp';

interface DocumentData {
  fileName: string
  fileBuffer: Buffer
  mimeType: string
}

interface ProcessedImage {
  imageBuffer: Buffer
  width: number
  height: number
  pageNumber: number
}

interface PreprocessingMetrics {
  totalProcessed: number
  averageProcessingTime: number
  enhancementOperations: number
}

/**
 * Preprocessor
 * 
 * Handles image preprocessing operations to optimize images for OCR.
 * This includes image enhancement, deskewing, noise reduction, and format conversion.
 * 
 * Key operations:
 * - PDF to image conversion
 * - Image deskewing and rotation correction
 * - Contrast and brightness optimization
 * - Noise reduction and cleanup
 * - Resolution standardization
 */
export class Preprocessor {
  private metrics: PreprocessingMetrics = {
    totalProcessed: 0,
    averageProcessingTime: 0,
    enhancementOperations: 0
  }

  constructor() {
    console.log('Preprocessor: Initializing image preprocessing module')
  }

  /**
   * Process a complete document, converting PDF pages to optimized images
   * @param documentData - Raw document data
   * @returns Array of processed images ready for OCR
   */
  async processDocument(documentData: DocumentData): Promise<ProcessedImage[]> {
    console.log(`Preprocessor: Processing document ${documentData.fileName}`);
    const startTime = Date.now();

    try {
      let processedImages: ProcessedImage[] = [];

      if (documentData.mimeType === 'application/pdf') {
        processedImages = await this.convertPdfToImages(documentData.fileBuffer);
      } else if (documentData.mimeType.startsWith('image/')) {
        const processedImage = await this.processImageBuffer(documentData.fileBuffer, 1);
        processedImages = [processedImage];
      } else {
        throw new Error(`Unsupported file type: ${documentData.mimeType}`);
      }

      const enhancedImages = await Promise.all(
        processedImages.map(img => this.enhanceImage(img))
      );

      const processingTime = Date.now() - startTime;
      this.updateMetrics(enhancedImages.length, processingTime);

      console.log(`Preprocessor: Processed ${enhancedImages.length} images in ${processingTime}ms`);
      return enhancedImages;

    } catch (error) {
      console.error(`Preprocessor: Error processing document:`, error);
      throw new Error(`Preprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enhance a single image for optimal OCR performance
   */
  private async getImageSize(imageBuffer: Buffer): Promise<{ width: number; height: number }> {
    const image = await Jimp.read(imageBuffer);
    return { width: image.width, height: image.height };
  }
  async enhanceImage(image: ProcessedImage): Promise<ProcessedImage> {
    console.log(`Preprocessor: Enhancing image page ${image.pageNumber}`);

    try {
      let enhancedBuffer = image.imageBuffer;

      enhancedBuffer = await this.deskewImage(enhancedBuffer);
      enhancedBuffer = await this.optimizeContrast(enhancedBuffer);
      enhancedBuffer = await this.reduceNoise(enhancedBuffer);
      enhancedBuffer = await this.standardizeResolution(enhancedBuffer);

      this.metrics.enhancementOperations += 4;

      const { width, height } = await this.getImageSize(enhancedBuffer);

      const enhancedImage: ProcessedImage = {
        ...image,
        imageBuffer: enhancedBuffer,
        width,
        height,
      };

      console.log(`Preprocessor: Image enhancement completed for page ${image.pageNumber}`);
      return enhancedImage;

    } catch (error) {
      console.error(`Preprocessor: Error enhancing image page ${image.pageNumber}:`, error);
      return image;
    }
  }
  

  /**
   * Convert PDF buffer to array of image buffers
   */
  /**
   * Convert PDF buffer to array of image buffers
   */
  private async convertPdfToImages(pdfBuffer: Buffer): Promise<ProcessedImage[]> {
    console.log("Preprocessor: Converting PDF to images with pdf2pic");
 
    const convert = fromBuffer(pdfBuffer, {
      density: 300,
      format: "png",
      savePath: "./temp", // pdf2pic requires a save path
    });
 
    const images: ProcessedImage[] = [];
    let pageNumber = 1;
 
    // Try to convert pages until we get an error (indicating no more pages)
    while (true) {
      try {
        const result = await convert(pageNumber);
 
        // --- FIX START ---
        // Add a check to ensure result and result.path are valid
        if (result && result.path) {
          const imageBuffer = await fs.readFile(result.path);
          const { width, height } = await this.getImageSize(imageBuffer);
 
          images.push({
            imageBuffer,
            width,
            height,
            pageNumber,
          });
 
          // Clean up temporary file
          await fs.unlink(result.path);
          pageNumber++;
        } else {
            // If result.path is not valid, assume there are no more pages and break the loop.
            break;
        }
        // --- FIX END ---
      } catch (error) {
        // Stop when we can't convert any more pages
        break;
      }
    }
 
    console.log(`Preprocessor: Converted PDF to ${images.length} images`);
    return images;
  }


  /**
   * Process a raw image buffer
   */
  private async processImageBuffer(imageBuffer: Buffer, pageNumber: number): Promise<ProcessedImage> {
    console.log(`Preprocessor: Processing image buffer for page ${pageNumber}`);
    const { width, height } = await this.getImageSize(imageBuffer);

    return {
      imageBuffer,
      width,
      height,
      pageNumber
    };
  }


  /**
   * Simulate PDF page conversion
   */
  private async simulatePdfPageConversion(pdfBuffer: Buffer, pageNumber: number): Promise<Buffer> {
    console.log(`Preprocessor: Converting PDF page ${pageNumber}`)
    
    // In production, this would extract the actual page as an image
    // For MVP, we return a simulated image buffer
    
    await new Promise(resolve => setTimeout(resolve, 500)) // Simulate processing time
    
    // Return original buffer as placeholder (in production, this would be the converted image)
    return pdfBuffer
  }

  /**
   * Correct image skew and rotation
   */
  private async deskewImage(imageBuffer: Buffer): Promise<Buffer> {
    console.log('Preprocessor: Deskewing image');
    const image = await Jimp.read(imageBuffer);

    const skewAngle = 0; // Replace with actual detection if needed
    if (Math.abs(skewAngle) > 0.5) {
      image.rotate(-skewAngle);
    }

    return await image.getBuffer('image/png');
  }


  /**
   * Optimize image contrast and brightness
   */
  private async optimizeContrast(imageBuffer: Buffer): Promise<Buffer> {
    console.log('Preprocessor: Optimizing contrast');
    const image = await Jimp.read(imageBuffer);

    image.contrast(0.5).brightness(0.1);

    return await image.getBuffer('image/png');
  }

  /**
   * Reduce image noise
   */
  private async reduceNoise(imageBuffer: Buffer): Promise<Buffer> {
    console.log('Preprocessor: Reducing noise');
    const image = await Jimp.read(imageBuffer);

    image.blur(1);

    return await image.getBuffer('image/png');
  }


  /**
   * Standardize image resolution for consistent OCR performance
   */
  private async standardizeResolution(imageBuffer: Buffer): Promise<Buffer> {
    console.log('Preprocessor: Standardizing resolution');
    const image = await Jimp.read(imageBuffer);

    const targetWidth = 2480;  
    const targetHeight = 3508; 
    image.resize({ w: targetWidth, h: targetHeight });

    return await image.getBuffer('image/png');
  }

  /**
   * Update preprocessing metrics
   */
  private updateMetrics(imagesProcessed: number, processingTime: number): void {
    this.metrics.totalProcessed += imagesProcessed
    
    // Calculate running average of processing time
    const oldAvg = this.metrics.averageProcessingTime
    const newCount = this.metrics.totalProcessed
    this.metrics.averageProcessingTime = ((oldAvg * (newCount - imagesProcessed)) + processingTime) / newCount
  }

  /**
   * Get preprocessing performance metrics
   */
  getMetrics(): PreprocessingMetrics {
    return { ...this.metrics }
  }

  /**
   * Validate preprocessor configuration
   */
  async validate(): Promise<boolean> {
    console.log('Preprocessor: Validating configuration');
    try {
      require.resolve('pdf2pic');
      require.resolve('jimp');
      return true;
    } catch (e) {
      console.error('Preprocessor: Required libraries not available', e);
      return false;
    }
  }
}
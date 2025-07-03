import { NextRequest, NextResponse } from 'next/server'
import { Extractor } from '@/lib/backend/pipeline/extractor'

export async function POST(request: NextRequest) {
  try {
    console.log('OCR Test: Initializing Tesseract.js test')
    
    // Create a simple test image buffer (small 1x1 pixel image)
    // This is just to test if Tesseract.js initializes correctly
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x5C, 0xC2, 0x8D, 0xB8, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ])
    
    const extractor = new Extractor()
    
    // Test if the extractor can be initialized and validated
    console.log('OCR Test: Validating extractor configuration')
    const isValid = await extractor.validate()
    
    if (isValid) {
      console.log('OCR Test: Tesseract.js configuration is valid')
      await extractor.cleanup()
      
      return NextResponse.json({
        success: true,
        message: 'Tesseract.js is properly configured and working',
        timestamp: new Date().toISOString()
      })
    } else {
      console.log('OCR Test: Tesseract.js configuration validation failed')
      return NextResponse.json({
        success: false,
        message: 'Tesseract.js configuration validation failed',
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('OCR Test: Error during test:', error)
    return NextResponse.json({
      success: false,
      message: `OCR test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

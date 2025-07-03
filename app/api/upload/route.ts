import { NextRequest, NextResponse } from 'next/server'
import { Extractor } from '@/lib/backend/pipeline/extractor'

export async function POST(request: NextRequest) {
  console.log('Upload API: Received file upload request for real OCR processing')
  
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    
    if (!files || files.length === 0) {
      console.log('Upload API: No files provided')
      return NextResponse.json(
        { success: false, error: 'No files provided' },
        { status: 400 }
      )
    }

    console.log(`Upload API: Starting real OCR processing for ${files.length} files`)
    
    const processedFiles: any[] = []
    const extractor = new Extractor()

    for (const file of files) {
      console.log(`Upload API: Processing file ${file.name} (${file.size} bytes) with real OCR`)
      
      try {
        // Convert file to buffer for OCR processing
        const buffer = await file.arrayBuffer()
        const fileBuffer = Buffer.from(buffer)
        
        // Validate file type
        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
          throw new Error(`Unsupported file type: ${file.type}`)
        }
        
        // Perform real OCR extraction
        const extractedData = await extractor.extractFromRealImage(fileBuffer)
        
        console.log(`Upload API: OCR extraction completed for ${file.name}`)
        console.log(`Upload API: Extracted data:`, extractedData.fields)
        
        // Extracted data will be stored in local storage by the client
        console.log(`Upload API: Extracted data ready for client storage:`, {
          fileName: file.name,
          confidence: extractedData.confidence,
          hasPaymentDetails: Boolean(extractedData.fields.paymentDetails?.cardType)
        })
        
        processedFiles.push({
          fileName: file.name,
          fileSize: file.size,
          status: 'completed',
          extractedForms: 1,
          confidence: extractedData.confidence,
          extractedData: extractedData.fields,
          issues: extractedData.issues
        })
        
      } catch (fileError) {
        console.error(`Upload API: Error processing file ${file.name}:`, fileError)
        
        processedFiles.push({
          fileName: file.name,
          fileSize: file.size,
          status: 'error',
          error: fileError instanceof Error ? fileError.message : 'Processing failed'
        })
      }
    }

    // Check if any files were successfully processed
    const successfulFiles = processedFiles.filter(f => f.status === 'completed')
    const failedFiles = processedFiles.filter(f => f.status === 'error')

    return NextResponse.json({
      success: true,
      data: {
        processedFiles,
        successfulCount: successfulFiles.length,
        failedCount: failedFiles.length,
        message: `${successfulFiles.length} file(s) processed successfully via real OCR`
      }
    })
    
  } catch (error) {
    console.error('Upload API: Error in real OCR processing:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process files with real OCR'
      },
      { status: 500 }
    )
  }
}

// Handle preflight OPTIONS requests for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
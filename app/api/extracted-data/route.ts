import { NextRequest, NextResponse } from 'next/server'

// In production, this would be stored in a database
let extractedFormsData: any[] = []

export async function GET(request: NextRequest) {
  console.log('Extracted Data API: This endpoint now serves as backup - forms are stored in client local storage')
  
  try {
    // Return the server-stored data (if any) for backup/sync purposes
    // Real data is now stored and retrieved from client-side local storage
    
    console.log(`Extracted Data API: Returning ${extractedFormsData.length} server-stored forms`)
    
    return NextResponse.json({
      success: true,
      data: extractedFormsData,
      message: 'Server backup data - primary data is in client local storage'
    })
    
  } catch (error) {
    console.error('Extracted Data API: Error fetching data:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch extracted data'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  console.log('Extracted Data API: Storing new extracted form data')
  
  try {
    const newFormData = await request.json()
    
    // Add unique ID and timestamp
    const formWithMetadata = {
      ...newFormData,
      id: `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      extractedAt: new Date().toISOString(),
      status: 'needs-review' // Default status for new extractions
    }
    
    // Store in memory (in production, save to database)
    extractedFormsData.push(formWithMetadata)
    
    console.log(`Extracted Data API: Stored new form data with ID: ${formWithMetadata.id}`)
    
    return NextResponse.json({
      success: true,
      data: formWithMetadata
    })
    
  } catch (error) {
    console.error('Extracted Data API: Error storing data:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to store extracted data'
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  console.log('Extracted Data API: Updating form data')
  
  try {
    const { id, ...updateData } = await request.json()
    
    const formIndex = extractedFormsData.findIndex(form => form.id === id)
    
    if (formIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Form not found' },
        { status: 404 }
      )
    }
    
    // Update the form data
    extractedFormsData[formIndex] = {
      ...extractedFormsData[formIndex],
      ...updateData,
      updatedAt: new Date().toISOString()
    }
    
    console.log(`Extracted Data API: Updated form with ID: ${id}`)
    
    return NextResponse.json({
      success: true,
      data: extractedFormsData[formIndex]
    })
    
  } catch (error) {
    console.error('Extracted Data API: Error updating data:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update extracted data'
      },
      { status: 500 }
    )
  }
}
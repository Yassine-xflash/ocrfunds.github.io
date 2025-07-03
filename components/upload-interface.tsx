"use client"

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Upload, FileText, X, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { localStorageManager } from '@/lib/storage/local-storage'
import type { UploadedFileInfo } from '@/lib/storage/local-storage'
import { useDashboardRefresh } from '@/hooks/use-dashboard-data'

export function UploadInterface() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const { toast } = useToast()
  const { triggerRefresh } = useDashboardRefresh()

  // Load uploaded files from local storage on mount
  useEffect(() => {
    console.log('UploadInterface: Loading uploaded files from local storage')
    const storedFiles = localStorageManager.getUploadedFiles()
    setUploadedFiles(storedFiles)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    handleFiles(files)
  }, [])

  const handleFiles = async (files: File[]) => {
    console.log(`Processing ${files.length} uploaded files`)
    
    const newFiles: UploadedFileInfo[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      status: 'pending',
      progress: 0,
      uploadedAt: new Date().toISOString()
    }))

    // Store files in local storage
    newFiles.forEach(fileInfo => {
      localStorageManager.storeUploadedFile(fileInfo)
    })

    setUploadedFiles(prev => [...prev, ...newFiles])

    // Process files through real API
    for (const file of files) {
      const uploadedFile = newFiles.find(f => f.name === file.name)
      if (uploadedFile) {
        await processFileWithRealOCR(uploadedFile.id, file)
      }
    }

    toast({
      title: "Files uploaded successfully",
      description: `${files.length} file(s) added to real OCR processing`,
    })
  }

  const processFileWithRealOCR = async (fileId: string, file: File) => {
    console.log(`Starting real OCR processing for file: ${fileId}`)
    
    try {
      // Update status to processing
      const processingUpdate = { status: 'processing' as const }
      localStorageManager.updateUploadedFile(fileId, processingUpdate)
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, ...processingUpdate } : f
      ))

      // Create FormData for upload
      const formData = new FormData()
      formData.append('files', file)

      // Progress updates during upload
      for (let progress = 0; progress <= 70; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 300))
        const progressUpdate = { progress }
        localStorageManager.updateUploadedFile(fileId, progressUpdate)
        setUploadedFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, ...progressUpdate } : f
        ))
      }

      // Send to real OCR API
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      // Complete progress
      const progressCompleteUpdate = { progress: 100 }
      localStorageManager.updateUploadedFile(fileId, progressCompleteUpdate)
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, ...progressCompleteUpdate } : f
      ))

      if (result.success) {
        const extractedForms = result.data?.processedFiles?.[0]?.extractedForms || 1
        const extractedData = result.data?.processedFiles?.[0]?.extractedData
        
        // Store extracted form data in local storage for validation interface
        if (extractedData) {
          console.log(`Storing extracted data for ${file.name}:`, extractedData)
          
          const storedFormData = {
            id: `extracted_${fileId}`,
            fileName: file.name,
            formNumber: 1,
            confidence: result.data?.processedFiles?.[0]?.confidence || 0.8,
            status: 'needs-review' as const,
            fields: extractedData,
            issues: result.data?.processedFiles?.[0]?.issues,
            uploadedAt: new Date().toISOString(),
            extractedAt: new Date().toISOString(),
            fileSize: file.size
          }
          
          localStorageManager.storeExtractedForm(storedFormData)
          
          // Trigger dashboard refresh after successful extraction
          triggerRefresh()
        }
        
        const completedUpdate = {
          status: 'completed' as const,
          extractedForms,
          errors: result.data?.issues
        }
        
        localStorageManager.updateUploadedFile(fileId, completedUpdate)
        setUploadedFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, ...completedUpdate } : f
        ))

        console.log(`Real OCR processing completed: ${fileId}, extracted ${extractedForms} forms`)
      } else {
        throw new Error(result.error || 'Processing failed')
      }

    } catch (error) {
      console.error(`Real OCR processing failed for ${fileId}:`, error)
      
      const errorUpdate = {
        status: 'error' as const,
        errors: [error instanceof Error ? error.message : 'Processing failed']
      }
      
      localStorageManager.updateUploadedFile(fileId, errorUpdate)
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, ...errorUpdate } : f
      ))
    }
  }

  const processFile = async (fileId: string) => {
    // Legacy method - redirect to real OCR processing
    const file = uploadedFiles.find(f => f.id === fileId)
    if (file) {
      // Create a mock file for retry
      const mockFile = new File([''], file.name, { type: 'image/jpeg' })
      await processFileWithRealOCR(fileId, mockFile)
    }
  }

  const loadDemoForm = async (formType: 'chicago' | 'donation') => {
    console.log(`Loading demo form: ${formType}`)
    
    try {
      const imageUrl = formType === 'chicago' 
        ? 'https://assets.macaly-user-data.dev/qmoiiwyqd0z46bdf1v5t59ln/bl08stv28z8k3y5xq7xa19qz/rA60xDQYvC87l2x4x9EBO/form2.jpg'
        : 'https://assets.macaly-user-data.dev/qmoiiwyqd0z46bdf1v5t59ln/bl08stv28z8k3y5xq7xa19qz/UAU3YCRppTPQTrMQ31eQx/formmm.jpg'
      
      // Fetch the image
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const file = new File([blob], `${formType}_demo_form.jpg`, { type: 'image/jpeg' })
      
      // Process as regular upload
      handleFiles([file])
      
      toast({
        title: "Demo form loaded",
        description: `${formType === 'chicago' ? 'Chicago Mosque' : 'Donation'} form loaded for OCR processing`,
      })
      
    } catch (error) {
      console.error('Error loading demo form:', error)
      toast({
        title: "Error loading demo form",
        description: "Please try uploading the form manually",
        variant: "destructive"
      })
    }
  }

  const removeFile = (fileId: string) => {
    console.log(`Removing file: ${fileId}`)
    // Remove from local storage
    const currentFiles = localStorageManager.getUploadedFiles()
    const updatedFiles = currentFiles.filter(file => file.id !== fileId)
    currentFiles.forEach(file => {
      if (file.id !== fileId) {
        localStorageManager.storeUploadedFile(file)
      }
    })
    
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId))
  }

  const retryFile = (fileId: string) => {
    console.log(`Retrying file processing: ${fileId}`)
    
    const retryUpdate = { 
      status: 'pending' as const, 
      progress: 0, 
      errors: undefined 
    }
    
    localStorageManager.updateUploadedFile(fileId, retryUpdate)
    setUploadedFiles(prev => prev.map(file => 
      file.id === fileId ? { ...file, ...retryUpdate } : file
    ))
    processFile(fileId)
  }

  const getStatusIcon = (status: UploadedFileInfo['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      case 'processing':
        return <Clock className="w-5 h-5 text-blue-600 animate-spin" />
      default:
        return <FileText className="w-5 h-5 text-slate-400" />
    }
  }

  const getStatusBadge = (file: UploadedFileInfo) => {
    switch (file.status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>
      default:
        return <Badge variant="secondary">Pending</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <Card className="bg-white/60 backdrop-blur border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Upload Donation Forms</CardTitle>
          <CardDescription className="text-slate-600">
            Upload PDF or image files containing donation forms for OCR processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ${
              isDragOver 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              Drop files here or click to upload
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Supports PDF, PNG, JPG files up to 10MB each
            </p>
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
            />
            <div className="space-y-2">
              <Button asChild variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                <label htmlFor="file-upload" className="cursor-pointer">
                  Select Files
                </label>
              </Button>
              
              <div className="flex gap-2 justify-center">
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={() => loadDemoForm('chicago')}
                  className="text-xs"
                >
                  Try Chicago Mosque Form
                </Button>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={() => loadDemoForm('donation')}
                  className="text-xs"
                >
                  Try Donation Form
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {uploadedFiles.length > 0 && (
        <Card className="bg-white/60 backdrop-blur border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">Processing Queue</CardTitle>
            <CardDescription className="text-slate-600">
              {uploadedFiles.filter(f => f.status === 'completed').length} of {uploadedFiles.length} files processed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {uploadedFiles.map(file => (
              <div key={file.id} className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white/40">
                <div className="flex items-center space-x-3 flex-1">
                  {getStatusIcon(file.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <p className="text-xs text-slate-500">
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                      {file.extractedForms && (
                        <Badge variant="secondary" className="text-xs">
                          {file.extractedForms} forms
                        </Badge>
                      )}
                    </div>
                    {file.status === 'processing' && (
                      <Progress value={file.progress} className="w-full mt-2" />
                    )}
                    {file.errors && (
                      <div className="mt-2 space-y-1">
                        {file.errors.map((error, index) => (
                          <p key={index} className="text-xs text-red-600">{error}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(file)}
                  {file.status === 'error' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => retryFile(file.id)}
                      className="text-xs"
                    >
                      Retry
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeFile(file.id)}
                    className="text-slate-400 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
"use client"

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { localStorageManager } from '@/lib/storage/local-storage'
import type { UploadedFileInfo, StoredFormData } from '@/lib/storage/local-storage'

export function RecentActivityList() {
  const [recentFiles, setRecentFiles] = useState<UploadedFileInfo[]>([])
  const [extractedForms, setExtractedForms] = useState<StoredFormData[]>([])

  useEffect(() => {
    console.log('RecentActivityList: Loading recent activity from local storage')
    loadRecentActivity()
  }, [])

  const loadRecentActivity = () => {
    try {
      const uploadedFiles = localStorageManager.getUploadedFiles()
      const forms = localStorageManager.getExtractedForms()
      
      // Sort by upload date, get most recent 3
      const sortedFiles = uploadedFiles
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
        .slice(0, 3)
      
      setRecentFiles(sortedFiles)
      setExtractedForms(forms)
      
      console.log(`RecentActivityList: Loaded ${sortedFiles.length} recent files`)
    } catch (error) {
      console.error('RecentActivityList: Error loading recent activity:', error)
      setRecentFiles([])
      setExtractedForms([])
    }
  }

  const getFileIcon = (file: UploadedFileInfo) => {
    switch (file.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      case 'processing':
        return <Clock className="w-5 h-5 text-blue-600 animate-spin" />
      default:
        return <Clock className="w-5 h-5 text-amber-600" />
    }
  }

  const getStatusBadge = (file: UploadedFileInfo) => {
    const formsNeedingReview = extractedForms.filter(form => 
      form.fileName === file.name && form.status === 'needs-review'
    ).length

    switch (file.status) {
      case 'completed':
        if (formsNeedingReview > 0) {
          return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Review</Badge>
        }
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Complete</Badge>
      case 'error':
        return <Badge variant="destructive">Failed</Badge>
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>
      default:
        return <Badge variant="secondary">Pending</Badge>
    }
  }

  const getFileDescription = (file: UploadedFileInfo) => {
    const fileExtractedForms = extractedForms.filter(form => form.fileName === file.name)
    const formsNeedingReview = fileExtractedForms.filter(form => form.status === 'needs-review').length
    
    switch (file.status) {
      case 'completed':
        if (formsNeedingReview > 0) {
          return `${formsNeedingReview} forms require validation`
        }
        return `${file.extractedForms || fileExtractedForms.length} forms processed successfully`
      case 'error':
        return file.errors?.[0] || 'Processing failed'
      case 'processing':
        return 'Currently processing...'
      default:
        return 'Waiting to process'
    }
  }

  if (recentFiles.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">No recent uploads</p>
        <p className="text-xs text-slate-400 mt-1">Upload some forms to see activity here</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {recentFiles.map(file => (
        <div key={file.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50/50 border border-slate-100">
          <div className="flex items-center space-x-3">
            {getFileIcon(file)}
            <div>
              <p className="text-sm font-medium text-slate-900">{file.name}</p>
              <p className="text-xs text-slate-500">{getFileDescription(file)}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {file.status === 'processing' && file.progress > 0 && (
              <Progress value={file.progress} className="w-20" />
            )}
            {getStatusBadge(file)}
          </div>
        </div>
      ))}
    </div>
  )
}
"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, CheckCircle, AlertCircle, Edit, Save, X, Eye, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { localStorageManager } from '@/lib/storage/local-storage'
import type { StoredFormData } from '@/lib/storage/local-storage'
import { useDashboardRefresh } from '@/hooks/use-dashboard-data'

// Payment method options
const PAYMENT_METHODS = [
  { value: 'credit-card', label: 'Credit Card' },
  { value: 'debit-card', label: 'Debit Card' },
  { value: 'bank-transfer', label: 'Bank Transfer' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'check', label: 'Check' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' }
]

// Card type options (for credit/debit cards)
const CARD_TYPES = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'american-express', label: 'American Express' },
  { value: 'discover', label: 'Discover' },
  { value: 'jcb', label: 'JCB' },
  { value: 'diners-club', label: 'Diners Club' },
  { value: 'other', label: 'Other' }
]

interface ExtractedData {
  id: string
  fileName: string
  formNumber: number
  confidence: number
  status: 'validated' | 'needs-review' | 'rejected' | 'uploaded' | 'processing' | 'completed' | 'error'
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
  originalFields?: {
    [key: string]: string
  }
  issues?: string[]
}

export function DataValidation() {
  const [extractedData, setExtractedData] = useState<ExtractedData[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('all')
  const { toast } = useToast()
  const { triggerRefresh } = useDashboardRefresh()

  // Helper function to check if payment method requires card details
  const requiresCardDetails = (paymentMethod: string) => {
    const method = paymentMethod.toLowerCase()
    return method.includes('credit') || 
           method.includes('debit') || 
           method.includes('card') ||
           paymentMethod === 'credit-card' ||
           paymentMethod === 'debit-card'
  }

  useEffect(() => {
    console.log('DataValidation component mounted, loading extracted data from local storage')
    fetchExtractedData()
  }, [])

  const fetchExtractedData = async () => {
    try {
      console.log('DataValidation: Refreshing extracted data from local storage')
      
      // Force refresh from local storage
      const storedForms = localStorageManager.getExtractedForms()
      
      // Convert StoredFormData to ExtractedData format
      const extractedForms: ExtractedData[] = storedForms.map(form => ({
        id: form.id,
        fileName: form.fileName,
        formNumber: form.formNumber,
        confidence: form.confidence,
        status: form.status as ExtractedData['status'],
        fields: form.fields,
        issues: form.issues
      }))
      
      setExtractedData(extractedForms)
      console.log(`DataValidation: Refreshed ${extractedForms.length} extracted forms from local storage`)
      
      toast({
        title: "Data refreshed",
        description: `Loaded ${extractedForms.length} forms from local storage`,
      })
      
    } catch (error) {
      console.error('DataValidation: Error refreshing extracted data:', error)
      setExtractedData([])
      toast({
        title: "Refresh failed",
        description: "Failed to refresh data from local storage",
        variant: "destructive"
      })
    }
  }

  const handleEdit = (id: string) => {
    console.log(`Starting edit for form: ${id}`)
    setEditingId(id)
  }

  const handleSave = async (id: string) => {
    console.log(`Saving changes for form: ${id}`)
    
    try {
      const formToUpdate = extractedData.find(item => item.id === id)
      if (!formToUpdate) return

      // Update form in local storage
      localStorageManager.updateExtractedForm(id, {
        ...formToUpdate,
        status: 'validated',
        issues: undefined
      })

      // Update local state
      setExtractedData(prev => 
        prev.map(item => 
          item.id === id 
            ? { ...item, status: 'validated', issues: undefined }
            : item
        )
      )
      
      setEditingId(null)
      
      // Trigger dashboard refresh
      triggerRefresh()
      
      toast({
        title: "Changes saved",
        description: "Form data has been validated and saved locally",
      })
    } catch (error) {
      console.error('Error saving form data:', error)
      toast({
        title: "Save failed",
        description: "Failed to save changes locally",
        variant: "destructive"
      })
    }
  }

  const handleFieldChange = (id: string, field: keyof ExtractedData['fields'] | string, value: any) => {
    console.log(`Updating field ${field} for form ${id}:`, value)
    
    setExtractedData(prev => 
      prev.map(item => {
        if (item.id === id) {
          let updatedItem = { ...item }
          
          // Handle nested payment details fields
          if (field.startsWith('paymentDetails.')) {
            const paymentField = field.replace('paymentDetails.', '') as keyof ExtractedData['fields']['paymentDetails']
            updatedItem = {
              ...item,
              fields: {
                ...item.fields,
                paymentDetails: {
                  ...item.fields.paymentDetails,
                  [paymentField]: value
                }
              }
            }
          } else if (field === 'paymentMethod') {
            // When payment method changes, initialize payment details if it's a card payment
            const requiresCard = requiresCardDetails(value)
            updatedItem = {
              ...item,
              fields: { 
                ...item.fields, 
                [field]: value,
                // Initialize payment details for card payments
                paymentDetails: requiresCard ? {
                  cardType: item.fields.paymentDetails?.cardType || '',
                  cardNumber: item.fields.paymentDetails?.cardNumber || '',
                  expiryDate: item.fields.paymentDetails?.expiryDate || '',
                  cvv: item.fields.paymentDetails?.cvv || '',
                  cardholderName: item.fields.paymentDetails?.cardholderName || ''
                } : item.fields.paymentDetails
              }
            }
          } else {
            // Handle regular fields
            updatedItem = {
              ...item,
              fields: { ...item.fields, [field]: value }
            }
          }
          
          // Also update in local storage
          localStorageManager.updateExtractedForm(id, updatedItem)
          return updatedItem
        }
        return item
      })
    )
  }

  const handleReject = (id: string) => {
    console.log(`Rejecting form: ${id}`)
    setExtractedData(prev => 
      prev.map(item => 
        item.id === id 
          ? { ...item, status: 'rejected' }
          : item
      )
    )
    toast({
      title: "Form rejected",
      description: "Form has been marked as rejected",
      variant: "destructive"
    })
  }

  const exportToCSV = () => {
    console.log('Exporting validated data to CSV')
    const validatedData = extractedData.filter(item => item.status === 'validated')
    
    if (validatedData.length === 0) {
      toast({
        title: "No data to export",
        description: "Please validate at least one form before exporting",
        variant: "destructive"
      })
      return
    }

    // Create comprehensive CSV content including payment details
    const headers = [
      'Donor Name', 'Email', 'Phone', 'Address', 'Amount', 'Payment Method', 
      'Card Type', 'Card Number (Last 4)', 'Expiry Date', 'Cardholder Name',
      'Date', 'Recurring', 'Anonymous', 'Confidence'
    ]
    
    const csvContent = [
      headers.join(','),
      ...validatedData.map(item => [
        `"${item.fields.donorName}"`,
        `"${item.fields.email}"`,
        `"${item.fields.phone}"`,
        `"${item.fields.address}"`,
        item.fields.amount,
        `"${PAYMENT_METHODS.find(m => m.value === item.fields.paymentMethod)?.label || item.fields.paymentMethod}"`,
        `"${CARD_TYPES.find(c => c.value === item.fields.paymentDetails?.cardType)?.label || item.fields.paymentDetails?.cardType || 'N/A'}"`,
        `"${item.fields.paymentDetails?.cardNumber ? '****' + item.fields.paymentDetails.cardNumber.slice(-4) : 'N/A'}"`,
        `"${item.fields.paymentDetails?.expiryDate || 'N/A'}"`,
        `"${item.fields.paymentDetails?.cardholderName || 'N/A'}"`,
        item.fields.date,
        item.fields.recurring,
        item.fields.anonymous,
        `${(item.confidence * 100).toFixed(1)}%`
      ].join(','))
    ].join('\n')

    try {
      // Download CSV with proper error handling
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `validated_donations_${new Date().toISOString().split('T')[0]}.csv`
      link.style.display = 'none'
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      console.log(`CSV export successful: ${validatedData.length} records exported`)
      toast({
        title: "Export successful",
        description: `${validatedData.length} validated records exported to CSV`,
      })
    } catch (error) {
      console.error('CSV export error:', error)
      toast({
        title: "Export failed",
        description: "Failed to download CSV file",
        variant: "destructive"
      })
    }
  }

  const getStatusBadge = (status: ExtractedData['status']) => {
    switch (status) {
      case 'validated':
        return <Badge className="bg-green-100 text-green-800">Validated</Badge>
      case 'needs-review':
        return <Badge className="bg-amber-100 text-amber-800">Needs Review</Badge>
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600'
    if (confidence >= 0.7) return 'text-amber-600'
    return 'text-red-600'
  }

  const filteredData = extractedData.filter(item => {
    switch (activeTab) {
      case 'review':
        return item.status === 'needs-review'
      case 'validated':
        return item.status === 'validated'
      case 'rejected':
        return item.status === 'rejected'
      default:
        return true
    }
  })

  return (
    <div className="space-y-6">
      {/* Header & Export */}
      <Card className="bg-white/60 backdrop-blur border-slate-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg text-slate-900">Data Validation & Export</CardTitle>
              <CardDescription className="text-slate-600">
                Review and validate extracted donation form data before export
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={fetchExtractedData} 
                variant="outline" 
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Data
              </Button>
              <Button onClick={exportToCSV} className="bg-blue-600 hover:bg-blue-700">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/60 backdrop-blur border-slate-200">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-900">
              {extractedData.length}
            </div>
            <p className="text-sm text-slate-600">Total Forms</p>
          </CardContent>
        </Card>
        <Card className="bg-white/60 backdrop-blur border-slate-200">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {extractedData.filter(d => d.status === 'validated').length}
            </div>
            <p className="text-sm text-slate-600">Validated</p>
          </CardContent>
        </Card>
        <Card className="bg-white/60 backdrop-blur border-slate-200">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-600">
              {extractedData.filter(d => d.status === 'needs-review').length}
            </div>
            <p className="text-sm text-slate-600">Need Review</p>
          </CardContent>
        </Card>
        <Card className="bg-white/60 backdrop-blur border-slate-200">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-900">
              ${extractedData.filter(d => d.status === 'validated').reduce((sum, d) => sum + d.fields.amount, 0).toLocaleString()}
            </div>
            <p className="text-sm text-slate-600">Validated Amount</p>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card className="bg-white/60 backdrop-blur border-slate-200">
        <CardHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 bg-white/60 backdrop-blur border border-slate-200">
              <TabsTrigger value="all">All Forms</TabsTrigger>
              <TabsTrigger value="review">Need Review</TabsTrigger>
              <TabsTrigger value="validated">Validated</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredData.map(item => (
              <div key={item.id} className="border border-slate-200 rounded-lg bg-white/40 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {item.fileName} - Form #{item.formNumber}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          {getStatusBadge(item.status)}
                          <span className={`text-xs font-medium ${getConfidenceColor(item.confidence)}`}>
                            {(item.confidence * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {item.status === 'needs-review' && !editingId && (
                        <Button size="sm" variant="outline" onClick={() => handleEdit(item.id)}>
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      )}
                      {editingId === item.id && (
                        <Button size="sm" onClick={() => handleSave(item.id)}>
                          <Save className="w-4 h-4 mr-1" />
                          Save
                        </Button>
                      )}
                      {item.status !== 'rejected' && (
                        <Button size="sm" variant="destructive" onClick={() => handleReject(item.id)}>
                          <X className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      )}
                    </div>
                  </div>
                  {item.issues && (
                    <div className="mt-2 space-y-1">
                      {item.issues.map((issue, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <p className="text-xs text-amber-700">{issue}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`${item.id}-name`} className="text-xs font-medium text-slate-600">
                        Donor Name
                      </Label>
                      {editingId === item.id ? (
                        <Input
                          id={`${item.id}-name`}
                          value={item.fields.donorName}
                          onChange={(e) => handleFieldChange(item.id, 'donorName', e.target.value)}
                          className="text-sm"
                        />
                      ) : (
                        <p className="text-sm text-slate-900">{item.fields.donorName}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${item.id}-email`} className="text-xs font-medium text-slate-600">
                        Email
                      </Label>
                      {editingId === item.id ? (
                        <Input
                          id={`${item.id}-email`}
                          value={item.fields.email}
                          onChange={(e) => handleFieldChange(item.id, 'email', e.target.value)}
                          className="text-sm"
                        />
                      ) : (
                        <p className="text-sm text-slate-900">{item.fields.email}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${item.id}-phone`} className="text-xs font-medium text-slate-600">
                        Phone
                      </Label>
                      {editingId === item.id ? (
                        <Input
                          id={`${item.id}-phone`}
                          value={item.fields.phone}
                          onChange={(e) => handleFieldChange(item.id, 'phone', e.target.value)}
                          className="text-sm"
                        />
                      ) : (
                        <p className="text-sm text-slate-900">{item.fields.phone}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${item.id}-amount`} className="text-xs font-medium text-slate-600">
                        Amount
                      </Label>
                      {editingId === item.id ? (
                        <Input
                          id={`${item.id}-amount`}
                          type="number"
                          value={item.fields.amount}
                          onChange={(e) => handleFieldChange(item.id, 'amount', parseFloat(e.target.value))}
                          className="text-sm"
                        />
                      ) : (
                        <p className="text-sm font-medium text-green-600">${item.fields.amount}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${item.id}-payment`} className="text-xs font-medium text-slate-600">
                        Payment Method
                      </Label>
                      {editingId === item.id ? (
                        <Select
                          value={item.fields.paymentMethod}
                          onValueChange={(value) => handleFieldChange(item.id, 'paymentMethod', value)}
                        >
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.map((method) => (
                              <SelectItem key={method.value} value={method.value}>
                                {method.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm text-slate-900">
                          {PAYMENT_METHODS.find(m => m.value === item.fields.paymentMethod)?.label || item.fields.paymentMethod}
                        </p>
                      )}
                    </div>

                    {/* Credit Card Details Section */}
                    {requiresCardDetails(item.fields.paymentMethod) && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor={`${item.id}-cardType`} className="text-xs font-medium text-slate-600">
                            Card Type
                          </Label>
                          {editingId === item.id ? (
                            <Select
                              value={item.fields.paymentDetails?.cardType || ''}
                              onValueChange={(value) => handleFieldChange(item.id, 'paymentDetails.cardType', value)}
                            >
                              <SelectTrigger className="text-sm">
                                <SelectValue placeholder="Select card type" />
                              </SelectTrigger>
                              <SelectContent>
                                {CARD_TYPES.map((cardType) => (
                                  <SelectItem key={cardType.value} value={cardType.value}>
                                    {cardType.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-sm text-slate-900">
                              {CARD_TYPES.find(c => c.value === item.fields.paymentDetails?.cardType)?.label || 
                               item.fields.paymentDetails?.cardType || 'Not specified'}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${item.id}-cardNumber`} className="text-xs font-medium text-slate-600">
                            Card Number
                          </Label>
                          {editingId === item.id ? (
                            <Input
                              id={`${item.id}-cardNumber`}
                              value={item.fields.paymentDetails?.cardNumber || ''}
                              onChange={(e) => handleFieldChange(item.id, 'paymentDetails.cardNumber', e.target.value)}
                              className="text-sm"
                              placeholder="1234567890123456"
                              maxLength={19}
                            />
                          ) : (
                            <p className="text-sm text-slate-900 font-mono">
                              {item.fields.paymentDetails?.cardNumber ? 
                                `****-****-****-${item.fields.paymentDetails.cardNumber.slice(-4)}` : 
                                'Not provided'
                              }
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${item.id}-expiryDate`} className="text-xs font-medium text-slate-600">
                            Expiry Date
                          </Label>
                          {editingId === item.id ? (
                            <Input
                              id={`${item.id}-expiryDate`}
                              value={item.fields.paymentDetails?.expiryDate || ''}
                              onChange={(e) => handleFieldChange(item.id, 'paymentDetails.expiryDate', e.target.value)}
                              className="text-sm"
                              placeholder="MM/YY"
                              maxLength={5}
                            />
                          ) : (
                            <p className="text-sm text-slate-900">
                              {item.fields.paymentDetails?.expiryDate || 'Not provided'}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${item.id}-cvv`} className="text-xs font-medium text-slate-600">
                            CVV
                          </Label>
                          {editingId === item.id ? (
                            <Input
                              id={`${item.id}-cvv`}
                              value={item.fields.paymentDetails?.cvv || ''}
                              onChange={(e) => handleFieldChange(item.id, 'paymentDetails.cvv', e.target.value)}
                              className="text-sm"
                              placeholder="123"
                              maxLength={4}
                            />
                          ) : (
                            <p className="text-sm text-slate-900">
                              {item.fields.paymentDetails?.cvv ? '***' : 'Not provided'}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${item.id}-cardholderName`} className="text-xs font-medium text-slate-600">
                            Cardholder Name
                          </Label>
                          {editingId === item.id ? (
                            <Input
                              id={`${item.id}-cardholderName`}
                              value={item.fields.paymentDetails?.cardholderName || ''}
                              onChange={(e) => handleFieldChange(item.id, 'paymentDetails.cardholderName', e.target.value)}
                              className="text-sm"
                              placeholder="Name as it appears on card"
                            />
                          ) : (
                            <p className="text-sm text-slate-900">
                              {item.fields.paymentDetails?.cardholderName || 'Not provided'}
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor={`${item.id}-date`} className="text-xs font-medium text-slate-600">
                        Date
                      </Label>
                      {editingId === item.id ? (
                        <Input
                          id={`${item.id}-date`}
                          type="date"
                          value={item.fields.date}
                          onChange={(e) => handleFieldChange(item.id, 'date', e.target.value)}
                          className="text-sm"
                        />
                      ) : (
                        <p className="text-sm text-slate-900">{item.fields.date}</p>
                      )}
                    </div>

                    <div className="col-span-full space-y-2">
                      <Label htmlFor={`${item.id}-address`} className="text-xs font-medium text-slate-600">
                        Address
                      </Label>
                      {editingId === item.id ? (
                        <Input
                          id={`${item.id}-address`}
                          value={item.fields.address}
                          onChange={(e) => handleFieldChange(item.id, 'address', e.target.value)}
                          className="text-sm"
                        />
                      ) : (
                        <p className="text-sm text-slate-900">{item.fields.address}</p>
                      )}
                    </div>

                    <div className="col-span-full flex items-center space-x-6">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`${item.id}-recurring`}
                          checked={item.fields.recurring}
                          onCheckedChange={(checked) => handleFieldChange(item.id, 'recurring', checked)}
                          disabled={editingId !== item.id}
                        />
                        <Label htmlFor={`${item.id}-recurring`} className="text-sm text-slate-700">
                          Recurring Donation
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`${item.id}-anonymous`}
                          checked={item.fields.anonymous}
                          onCheckedChange={(checked) => handleFieldChange(item.id, 'anonymous', checked)}
                          disabled={editingId !== item.id}
                        />
                        <Label htmlFor={`${item.id}-anonymous`} className="text-sm text-slate-700">
                          Anonymous Donation
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
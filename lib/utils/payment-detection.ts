/**
 * Payment Method Detection Utility
 * 
 * Detects credit card types and extracts payment information
 */

export interface CardType {
  name: string
  pattern: RegExp
  gaps: number[]
  lengths: number[]
  code: {
    name: string
    size: number
  }
}

export const CARD_TYPES: { [key: string]: CardType } = {
  visa: {
    name: 'Visa',
    pattern: /^4/,
    gaps: [4, 8, 12],
    lengths: [13, 16, 19],
    code: { name: 'CVV', size: 3 }
  },
  mastercard: {
    name: 'Mastercard',
    pattern: /^(5[1-5]|2[2-7])/,
    gaps: [4, 8, 12],
    lengths: [16],
    code: { name: 'CVC', size: 3 }
  },
  amex: {
    name: 'American Express',
    pattern: /^3[47]/,
    gaps: [4, 10],
    lengths: [15],
    code: { name: 'CID', size: 4 }
  },
  discover: {
    name: 'Discover',
    pattern: /^(6011|65|64[4-9]|622)/,
    gaps: [4, 8, 12],
    lengths: [16],
    code: { name: 'CID', size: 3 }
  },
  dinersclub: {
    name: 'Diners Club',
    pattern: /^(30[0-5]|36|38)/,
    gaps: [4, 10],
    lengths: [14],
    code: { name: 'CVV', size: 3 }
  },
  jcb: {
    name: 'JCB',
    pattern: /^35/,
    gaps: [4, 8, 12],
    lengths: [16],
    code: { name: 'CVV', size: 3 }
  },
  unionpay: {
    name: 'UnionPay',
    pattern: /^62/,
    gaps: [4, 8, 12],
    lengths: [16, 17, 18, 19],
    code: { name: 'CVN', size: 3 }
  }
}

/**
 * Detect card type from card number
 */
export function detectCardType(cardNumber: string): string {
  const cleanNumber = cardNumber.replace(/\D/g, '')
  
  for (const [key, cardType] of Object.entries(CARD_TYPES)) {
    if (cardType.pattern.test(cleanNumber)) {
      return cardType.name
    }
  }
  
  return 'Unknown'
}

/**
 * Extract and detect payment information from text
 */
export function extractPaymentInfo(text: string): {
  cardType?: string
  cardNumber?: string
  expiryDate?: string
  cvv?: string
  cardholderName?: string
} {
  console.log('PaymentDetection: Extracting payment info from text')
  
  const result: any = {}
  
  // Extract card number (4 groups of 4 digits or various formats)
  const cardNumberPattern = /\b(?:\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}|\d{15,16})\b/g
  const cardMatches = text.match(cardNumberPattern)
  
  if (cardMatches && cardMatches.length > 0) {
    const cardNumber = cardMatches[0].replace(/[\s-]/g, '')
    result.cardNumber = cardNumber
    result.cardType = detectCardType(cardNumber)
    console.log(`PaymentDetection: Detected card type: ${result.cardType}`)
  }
  
  // Extract expiry date (MM/YY, MM/YYYY, MM-YY, MM-YYYY)
  const expiryPattern = /\b(0[1-9]|1[0-2])[\/-](20\d{2}|\d{2})\b/g
  const expiryMatches = text.match(expiryPattern)
  
  if (expiryMatches && expiryMatches.length > 0) {
    result.expiryDate = expiryMatches[0]
    console.log(`PaymentDetection: Detected expiry: ${result.expiryDate}`)
  }
  
  // Extract CVV (3 or 4 digits, often near "CVV", "CVC", "CID")
  const cvvPattern = /(?:cvv|cvc|cid|security\s*code)\s*:?\s*(\d{3,4})/gi
  const cvvMatches = text.match(cvvPattern)
  
  if (cvvMatches && cvvMatches.length > 0) {
    const cvvMatch = cvvMatches[0].match(/\d{3,4}/)
    if (cvvMatch) {
      result.cvv = cvvMatch[0]
      console.log('PaymentDetection: Detected CVV')
    }
  }
  
  // Extract cardholder name (often on a line with "Name" or before card number)
  const namePattern = /(?:cardholder|name\s*on\s*card|card\s*name)\s*:?\s*([A-Za-z\s]{2,40})/gi
  const nameMatches = text.match(namePattern)
  
  if (nameMatches && nameMatches.length > 0) {
    const nameMatch = nameMatches[0].match(/([A-Za-z\s]{2,40})$/)
    if (nameMatch) {
      result.cardholderName = nameMatch[1].trim()
      console.log(`PaymentDetection: Detected cardholder: ${result.cardholderName}`)
    }
  }
  
  return result
}

/**
 * Validate card number using Luhn algorithm
 */
export function validateCardNumber(cardNumber: string): boolean {
  const cleanNumber = cardNumber.replace(/\D/g, '')
  
  if (cleanNumber.length < 13 || cleanNumber.length > 19) {
    return false
  }
  
  let sum = 0
  let isEven = false
  
  for (let i = cleanNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanNumber[i])
    
    if (isEven) {
      digit *= 2
      if (digit > 9) {
        digit -= 9
      }
    }
    
    sum += digit
    isEven = !isEven
  }
  
  return sum % 10 === 0
}

/**
 * Format card number with appropriate spacing
 */
export function formatCardNumber(cardNumber: string, cardType?: string): string {
  const cleanNumber = cardNumber.replace(/\D/g, '')
  const type = cardType || detectCardType(cleanNumber)
  
  const cardTypeKey = Object.keys(CARD_TYPES).find(key => 
    CARD_TYPES[key].name === type
  )
  
  if (cardTypeKey) {
    const gaps = CARD_TYPES[cardTypeKey].gaps
    let formatted = ''
    let lastGap = 0
    
    for (const gap of gaps) {
      if (cleanNumber.length > gap) {
        formatted += cleanNumber.slice(lastGap, gap) + ' '
        lastGap = gap
      }
    }
    
    formatted += cleanNumber.slice(lastGap)
    return formatted.trim()
  }
  
  // Default formatting: groups of 4
  return cleanNumber.replace(/(.{4})/g, '$1 ').trim()
}

/**
 * Mask card number for display
 */
export function maskCardNumber(cardNumber: string, visibleDigits: number = 4): string {
  const cleanNumber = cardNumber.replace(/\D/g, '')
  
  if (cleanNumber.length <= visibleDigits) {
    return '*'.repeat(cleanNumber.length)
  }
  
  const masked = '*'.repeat(cleanNumber.length - visibleDigits)
  const visible = cleanNumber.slice(-visibleDigits)
  
  return formatCardNumber(masked + visible)
}
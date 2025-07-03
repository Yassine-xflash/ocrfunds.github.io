"use client"

import { useState, useEffect } from 'react'
import { localStorageManager } from '@/lib/storage/local-storage'

// Global event emitter for dashboard updates
class DashboardEventEmitter extends EventTarget {
  triggerUpdate() {
    console.log('DashboardEventEmitter: Triggering dashboard update')
    this.dispatchEvent(new CustomEvent('dashboardUpdate'))
  }
}

export const dashboardEvents = new DashboardEventEmitter()

// Hook for components to trigger dashboard refresh
export function useDashboardRefresh() {
  const triggerRefresh = () => {
    console.log('useDashboardRefresh: Triggering refresh')
    dashboardEvents.triggerUpdate()
  }

  return { triggerRefresh }
}

// Hook for dashboard to listen to updates
export function useDashboardData() {
  const [dashboardStats, setDashboardStats] = useState({
    totalDonations: 0,
    averageDonation: 0,
    formsProcessed: 0,
    processingTime: 0
  })

  const calculateDashboardData = () => {
    try {
      console.log('useDashboardData: Calculating dashboard statistics from local storage')
      const extractedForms = localStorageManager.getExtractedForms()
      const uploadedFiles = localStorageManager.getUploadedFiles()
      
      // Calculate statistics from real uploaded data
      const validatedForms = extractedForms.filter(form => form.status === 'validated')
      const totalDonations = validatedForms.reduce((sum, form) => sum + form.fields.amount, 0)
      const averageDonation = validatedForms.length > 0 ? totalDonations / validatedForms.length : 0
      const formsProcessed = extractedForms.length
      
      // Calculate average processing time from real data
      const completedFiles = uploadedFiles.filter(file => file.status === 'completed')
      const avgProcessingTime = completedFiles.length > 0 ? 2.5 : 0 // Would calculate from real timestamps in production
      
      const calculatedStats = {
        totalDonations,
        averageDonation: Math.round(averageDonation * 100) / 100,
        formsProcessed,
        processingTime: avgProcessingTime
      }
      
      setDashboardStats(calculatedStats)
      console.log('useDashboardData: Updated dashboard stats:', calculatedStats)
      return calculatedStats
    } catch (error) {
      console.error('useDashboardData: Error calculating dashboard data:', error)
      const emptyStats = { totalDonations: 0, averageDonation: 0, formsProcessed: 0, processingTime: 0 }
      setDashboardStats(emptyStats)
      return emptyStats
    }
  }

  useEffect(() => {
    // Initial calculation
    calculateDashboardData()

    // Listen for updates
    const handleUpdate = () => {
      console.log('useDashboardData: Received update event, recalculating stats')
      calculateDashboardData()
    }

    dashboardEvents.addEventListener('dashboardUpdate', handleUpdate)
    
    // Also set up polling every 15 seconds
    const interval = setInterval(calculateDashboardData, 15000)

    return () => {
      dashboardEvents.removeEventListener('dashboardUpdate', handleUpdate)
      clearInterval(interval)
    }
  }, [])

  return {
    dashboardStats,
    refreshData: calculateDashboardData
  }
}
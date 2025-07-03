"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Upload, FileText, BarChart3, DollarSign, Users, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { DonationChart } from '@/components/donation-chart'
import { UploadInterface } from '@/components/upload-interface'
import { ProcessingQueue } from '@/components/processing-queue'
import { DataValidation } from '@/components/data-validation'
import { RecentActivityList } from '@/components/recent-activity-list'
import { useDashboardData } from '@/hooks/use-dashboard-data'

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const { dashboardStats, refreshData } = useDashboardData()

  console.log('Dashboard component rendered with stats:', dashboardStats)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">OCR Intelligence Platform</h1>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <CheckCircle className="w-3 h-3 mr-1" />
              System Operational
            </Badge>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Dashboard Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/60 backdrop-blur border-slate-200 hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Donations</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                ${dashboardStats.totalDonations.toLocaleString()}
              </div>
              {dashboardStats.totalDonations > 0 ? (
                <p className="text-xs text-green-600 mt-1">From {dashboardStats.formsProcessed} processed forms</p>
              ) : (
                <p className="text-xs text-slate-500 mt-1">No donations processed yet</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/60 backdrop-blur border-slate-200 hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Average Donation</CardTitle>
              <BarChart3 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                ${dashboardStats.averageDonation}
              </div>
              {dashboardStats.averageDonation > 0 ? (
                <p className="text-xs text-blue-600 mt-1">Per validated form</p>
              ) : (
                <p className="text-xs text-slate-500 mt-1">No validated forms yet</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/60 backdrop-blur border-slate-200 hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Forms Processed</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {dashboardStats.formsProcessed.toLocaleString()}
              </div>
              {dashboardStats.formsProcessed > 0 ? (
                <p className="text-xs text-purple-600 mt-1">Total extracted forms</p>
              ) : (
                <p className="text-xs text-slate-500 mt-1">Upload forms to get started</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/60 backdrop-blur border-slate-200 hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Avg Processing Time</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {dashboardStats.processingTime}s
              </div>
              {dashboardStats.processingTime > 0 ? (
                <p className="text-xs text-amber-600 mt-1">Average processing time</p>
              ) : (
                <p className="text-xs text-slate-500 mt-1">No processing data yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/60 backdrop-blur border border-slate-200">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Overview
            </TabsTrigger>
            <TabsTrigger value="upload" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Upload Forms
            </TabsTrigger>
            <TabsTrigger value="processing" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Processing Queue
            </TabsTrigger>
            <TabsTrigger value="validation" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Data Validation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-white/60 backdrop-blur border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-900">Donations Over Time</CardTitle>
                  <CardDescription className="text-slate-600">
                    Processing trends and donation patterns
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DonationChart />
                </CardContent>
              </Card>

              <Card className="bg-white/60 backdrop-blur border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-900">Recent Activity</CardTitle>
                  <CardDescription className="text-slate-600">
                    Latest form processing results
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RecentActivityList />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="upload">
            <UploadInterface />
          </TabsContent>

          <TabsContent value="processing">
            <ProcessingQueue />
          </TabsContent>

          <TabsContent value="validation">
            <DataValidation />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
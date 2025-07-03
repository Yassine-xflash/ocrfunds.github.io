"use client"

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const mockChartData = [
  { month: 'Jan', donations: 12500, forms: 89 },
  { month: 'Feb', donations: 15200, forms: 112 },
  { month: 'Mar', donations: 18700, forms: 134 },
  { month: 'Apr', donations: 21300, forms: 156 },
  { month: 'May', donations: 24600, forms: 178 },
  { month: 'Jun', donations: 27400, forms: 201 },
  { month: 'Jul', donations: 31200, forms: 235 }
]

export function DonationChart() {
  const [chartData, setChartData] = useState(mockChartData)

  useEffect(() => {
    console.log('DonationChart component mounted, loading chart data')
    // In production, this would fetch from /api/analytics/donations-over-time
    setChartData(mockChartData)
  }, [])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 backdrop-blur border border-slate-200 rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-slate-900">{label}</p>
          <div className="space-y-1">
            <p className="text-sm text-blue-600">
              Donations: ${payload[0].value.toLocaleString()}
            </p>
            <p className="text-sm text-green-600">
              Forms: {payload[1].value}
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="month" 
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            yAxisId="donations"
            orientation="left"
            stroke="#3b82f6"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <YAxis 
            yAxisId="forms"
            orientation="right"
            stroke="#10b981"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            yAxisId="donations"
            dataKey="donations" 
            fill="#3b82f6" 
            radius={[4, 4, 0, 0]}
            fillOpacity={0.8}
          />
          <Bar 
            yAxisId="forms"
            dataKey="forms" 
            fill="#10b981" 
            radius={[4, 4, 0, 0]}
            fillOpacity={0.6}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
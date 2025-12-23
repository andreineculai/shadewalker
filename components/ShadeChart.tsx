import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { RouteOption } from '../types';

interface ShadeChartProps {
  data: RouteOption['shadeProfile'];
  color?: string;
}

export const ShadeChart: React.FC<ShadeChartProps> = ({ data, color = "#3b82f6" }) => {
  // Normalize data for chart
  const chartData = data.map(point => ({
    time: `${point.timeOffset}m`,
    shade: point.shadeLevel,
    exposure: 100 - point.shadeLevel
  }));

  return (
    <div className="h-48 w-full mt-4 bg-white rounded-xl p-2 border border-slate-100">
      <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide ml-2">Sun Exposure Timeline</h4>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{
            top: 5,
            right: 10,
            left: -20,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorShade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={color} stopOpacity={0.1}/>
            </linearGradient>
            <linearGradient id="colorSun" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#f97316" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="time" 
            tick={{fontSize: 10, fill: '#64748b'}} 
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            tick={{fontSize: 10, fill: '#64748b'}} 
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            itemStyle={{ fontSize: '12px', fontWeight: 600 }}
            labelStyle={{ fontSize: '12px', color: '#64748b' }}
          />
          <Area 
            type="monotone" 
            dataKey="shade" 
            stroke={color} 
            fillOpacity={1} 
            fill="url(#colorShade)" 
            name="Shade %"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
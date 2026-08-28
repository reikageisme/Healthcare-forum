import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { DailyMetric } from '../../types';

interface UserGrowthChartProps {
  data: DailyMetric[];
}

export const UserGrowthChart: React.FC<UserGrowthChartProps> = ({ data }) => {
  const chartData = (data || []).map((item) => {
    let formattedDate = item.date;
    try {
      const parts = item.date.split('-');
      if (parts.length === 3) {
        formattedDate = `${parts[2]}/${parts[1]}`;
      }
    } catch {
      formattedDate = item.date;
    }

    return {
      ...item,
      displayDate: formattedDate,
      users: item.new_users ?? 0,
    };
  });

  if (!chartData || chartData.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm italic">
        Chưa có dữ liệu thống kê người dùng.
      </div>
    );
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="userGrowthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis
            dataKey="displayDate"
            tickLine={false}
            axisLine={{ stroke: '#E2E8F0' }}
            tick={{ fill: '#64748B', fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#64748B', fontSize: 11 }}
            allowDecimals={false}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-xl">
                    <p className="font-semibold text-slate-300 mb-1">Ngày {label}</p>
                    <p className="font-bold text-blue-300">
                      +{payload[0].value} thành viên mới
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="users"
            stroke="#3B82F6"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#userGrowthGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default UserGrowthChart;

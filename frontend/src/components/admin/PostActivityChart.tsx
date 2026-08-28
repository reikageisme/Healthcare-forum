import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { DailyMetric } from '../../types';

interface PostActivityChartProps {
  data: DailyMetric[];
}

export const PostActivityChart: React.FC<PostActivityChartProps> = ({ data }) => {
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
      posts: item.new_posts ?? 0,
      comments: item.new_comments ?? 0,
    };
  });

  if (!chartData || chartData.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm italic">
        Chưa có dữ liệu bài viết hàng ngày.
      </div>
    );
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-xl space-y-1">
                    <p className="font-semibold text-slate-300">Ngày {label}</p>
                    <p className="font-bold text-emerald-400">
                      {payload[0]?.value} bài viết mới
                    </p>
                    {payload[1] && (
                      <p className="font-bold text-blue-300">
                        {payload[1]?.value} bình luận
                      </p>
                    )}
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="posts" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PostActivityChart;

import api from '../lib/api';
import { Report, ReportCreateInput } from '../types';

export const reportService = {
  createReport: async (data: ReportCreateInput): Promise<Report> => {
    const response = await api.post<Report>('/reports', data);
    return response.data;
  },
};

export default reportService;

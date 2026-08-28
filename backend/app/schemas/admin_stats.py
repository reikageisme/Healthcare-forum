from pydantic import BaseModel, ConfigDict
from typing import List, Optional

class DailyDataPoint(BaseModel):
    date: str
    new_users: int = 0
    new_posts: int = 0
    new_comments: int = 0
    
    model_config = ConfigDict(from_attributes=True)

class AdminStatsOverview(BaseModel):
    total_users: int = 0
    total_posts: int = 0
    total_comments: int = 0
    total_pending_posts: int = 0
    total_open_reports: int = 0
    total_categories: int = 0
    total_doctors: int = 0

    model_config = ConfigDict(from_attributes=True)

class AdminStatsResponse(BaseModel):
    overview: AdminStatsOverview
    totals: Optional[AdminStatsOverview] = None
    time_series: List[DailyDataPoint]

    model_config = ConfigDict(from_attributes=True)

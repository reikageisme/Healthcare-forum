export type UserRole = 'user' | 'doctor' | 'moderator' | 'admin' | 'USER' | 'DOCTOR' | 'MODERATOR' | 'ADMIN';

export interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  fullName?: string; // Compatibility alias
  avatar_url?: string;
  avatar?: string; // Compatibility alias
  role: UserRole;
  specialty?: string;
  workplace?: string | null;
  /** Set only when a practising licence was reviewed and approved. */
  verified_at?: string | null;
  bio?: string;
  is_active?: boolean;
  created_at?: string;
}

export type PostType = 'article' | 'question' | 'review' | 'share' | 'ARTICLE' | 'QUESTION' | 'REVIEW' | 'SHARE';

export interface Tag {
  id: string;
  name: string;
  slug: string;
  created_at?: string;
}

export interface TagWithCount extends Tag {
  post_count: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  description?: string | null;
  /** null for a top-level category; set for a child. Cây sâu tối đa 3 cấp. */
  parent_id?: string | null;
  /** Thứ tự thủ công trong cùng một cấp; cùng số thì xếp theo tên. */
  sort_order?: number;
  created_at?: string;
  post_count?: number;
}

export type ReactionType = 'helpful' | 'like' | 'informative' | 'HELPFUL' | 'LIKE' | 'INFORMATIVE';

export interface ReactionCounts {
  helpful: number;
  like: number;
  informative: number;
  total: number;
}

export type PostStatus = 'pending' | 'approved' | 'rejected' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  thumbnail?: string | null;
  post_type: PostType;
  type?: PostType; // Compatibility alias
  status?: PostStatus;
  rejection_reason?: string | null;
  view_count: number;
  helpful_count: number;
  helpfulCount?: number; // Compatibility alias
  comment_count: number;
  commentCount?: number; // Compatibility alias
  is_published: boolean;
  created_at: string;
  createdAt?: string; // Compatibility alias
  updated_at?: string;
  author: User;
  category?: Category | null;
  tags: Tag[];
  user_reaction?: string | null;
  is_bookmarked?: boolean;
  is_anonymous?: boolean;
  accepted_comment_id?: string | null;
  reaction_breakdown?: ReactionCounts;
}

export interface PostCreateInput {
  title: string;
  content: string;
  excerpt?: string;
  thumbnail?: string | null;
  post_type?: string;
  category_id?: string | null;
  tags?: string[];
  tag_names?: string[];
  is_anonymous?: boolean;
}

export interface PostUpdateInput {
  title?: string;
  content?: string;
  excerpt?: string;
  thumbnail?: string | null;
  post_type?: string;
  category_id?: string | null;
  tags?: string[];
  tag_names?: string[];
}

export interface PostCursorPage {
  items: Post[];
  next_cursor: string | null;
  has_more: boolean;
  limit: number;
  total?: number;
}

export interface Comment {
  id: string;
  post_id: string;
  parent_id?: string | null;
  content: string;
  vote_count: number;
  is_anonymous?: boolean;
  is_accepted?: boolean;
  is_deleted: boolean;
  created_at: string;
  createdAt?: string; // Compatibility alias
  updated_at?: string;
  author?: User | null;
  replies: Comment[];
}

export interface CommentCreateInput {
  content: string;
  parent_id?: string | null;
  is_anonymous?: boolean;
}

export interface Story {
  id: string;
  image_url: string;
  caption?: string | null;
  created_at: string;
  expires_at: string;
  author: User;
}

/** Stories are shown one ring per author, the way every stories UI works. */
export interface StoryGroup {
  author: User;
  items: Story[];
  latest_at: string | null;
}

export interface DoctorVerification {
  id: string;
  user_id: string;
  full_name: string;
  license_number: string;
  specialty?: string | null;
  workplace?: string | null;
  document_url: string;
  status: 'pending' | 'approved' | 'rejected';
  review_notes?: string | null;
  created_at?: string;
  applicant?: User | null;
}

export interface CommentUpdateInput {
  content: string;
}

export interface ReactionToggleResponse {
  success: boolean;
  action: 'added' | 'removed' | 'updated' | string;
  current_reaction: string | null;
  counts: ReactionCounts;
}

export interface BookmarkToggleResponse {
  is_bookmarked: boolean;
}

export interface UploadResponse {
  url: string;
  filename: string;
  content_type: string;
  size: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

// Phase 3: Admin & Dashboard Metrics
export interface DailyMetric {
  date: string;
  new_users: number;
  new_posts: number;
  new_comments?: number;
}

export interface AdminStatsTotals {
  total_users: number;
  total_posts: number;
  total_comments: number;
  total_pending_posts: number;
  total_open_reports: number;
  total_categories?: number;
  total_doctors?: number;
}

export interface AdminStats {
  totals?: AdminStatsTotals;
  time_series?: DailyMetric[];
  // Compatibility direct properties if backend returns flat structure
  total_users?: number;
  total_posts?: number;
  total_comments?: number;
  pending_posts?: number;
  total_pending_posts?: number;
  open_reports?: number;
  total_open_reports?: number;
  total_categories?: number;
  total_doctors?: number;
  daily_metrics?: DailyMetric[];
}

// Phase 3: Reports
export type ReportTargetType = 'post' | 'comment' | 'user' | 'POST' | 'COMMENT' | 'USER';
export type ReportStatus = 'open' | 'resolved' | 'dismissed' | 'OPEN' | 'RESOLVED' | 'DISMISSED';

export interface Report {
  id: string;
  reporter_id: string;
  reporter?: User | null;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  details?: string | null;
  status: ReportStatus;
  created_at: string;
  resolved_at?: string | null;
  resolved_by_id?: string | null;
  resolved_by?: User | null;
  resolution_notes?: string | null;
  target_title?: string;
  target_author_name?: string;
  target_preview?: {
    title?: string;
    content?: string;
    author_name?: string;
  };
}

export interface ReportCreateInput {
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  details?: string;
}

// Phase 3: Admin Management Inputs
export interface UserAdminUpdateRoleInput {
  role?: UserRole;
  is_active?: boolean;
  specialty?: string;
  bio?: string;
}

export interface UserAdminStatusInput {
  is_active: boolean;
}

export interface CategoryCreateInput {
  name: string;
  slug?: string;
  icon?: string | null;
  description?: string | null;
}

export interface CategoryUpdateInput {
  name?: string;
  slug?: string;
  icon?: string | null;
  description?: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page?: number;
  limit?: number;
  total_pages?: number;
}


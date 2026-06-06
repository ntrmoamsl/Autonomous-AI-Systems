'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, PenTool, Calendar, BarChart3, MessageSquare, Settings,
  Rocket, ImageIcon, Send, Clock, TrendingUp, Users, Target,
  Lightbulb, Sparkles, CheckCircle2, XCircle, Loader2, Trash2,
  Eye, RefreshCw, Play, Pause, ChevronRight, Zap, Globe,
  Palette, BookOpen, Megaphone, Heart, MessageCircle, Share2,
  Plus, ArrowRight, Save, AlertCircle, Facebook, Activity,
  Bot, Timer, Shield, Cpu, Image as ImageLucide, ChevronLeft,
  ExternalLink, Copy, ThumbsUp, Eye as EyeIcon, Repeat2,
  CircleDot, Wifi, WifiOff, Crown, Flame, Layers, Video, Film
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

// ============================================================
// Types
// ============================================================

interface BusinessProfile {
  id: string;
  companyName: string;
  description: string;
  products: string;
  targetAudience: string;
  toneOfVoice: string;
  marketingGoals: string;
  offers?: string | null;
  faqs?: string | null;
  brandColors?: string | null;
  additionalInfo?: string | null;
  isActive: boolean;
  agentMode: string;
  imageModel: string;
  createdAt: string;
  updatedAt: string;
}

interface ContentPost {
  id: string;
  title?: string | null;
  content: string;
  contentType: string;
  hashtags?: string | null;
  cta?: string | null;
  imageUrl?: string | null;
  imageData?: string | null;
  videoUrl?: string | null;
  videoTaskId?: string | null;
  platform: string;
  status: string;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  publishResult?: string | null;
  retryCount: number;
  aiModel?: string | null;
  generationPrompt?: string | null;
  engagementScore?: number | null;
  reachCount?: number | null;
  likeCount?: number | null;
  commentCount?: number | null;
  shareCount?: number | null;
  imagePrompt?: string | null;
  mediaType?: string;         // "image" or "video"
  textOverlay?: string | null; // Short text on the image/video
  videoPrompt?: string | null; // Prompt for video generation
  decisionReason?: string | null;
  isAutonomous: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AgentLog {
  id: string;
  businessId: string;
  action: string;
  decision: string;
  reasoning: string;
  result?: string | null;
  status: string;
  relatedPostId?: string | null;
  tokensUsed?: number | null;
  executionTime?: number | null;
  createdAt: string;
}

interface AgentStatus {
  isRunning: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  mode: 'manual' | 'semi-auto' | 'fully-autonomous';
  totalDecisions: number;
  recentActions: number;
  pendingTasks: number;
}

interface AnalyticsOverview {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  scheduledPosts: number;
  failedPosts: number;
  totalReach: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgEngagement: string;
}

interface SmartReplyItem {
  id: string;
  originalMsg: string;
  replyText: string;
  intentType?: string | null;
  isAutonomous?: boolean;
  createdAt: string;
}

interface ImageGenTask {
  taskId: string;
  postId: string;
  status: 'processing' | 'success' | 'failed';
  progress: number;
}

// ============================================================
// Constants
// ============================================================

const TAB_CONFIG = [
  { id: 'dashboard', label: 'لوحة التحكم', icon: Rocket, color: 'from-emerald-500 to-teal-600' },
  { id: 'training', label: 'التدريب', icon: Brain, color: 'from-amber-500 to-orange-600' },
  { id: 'content', label: 'المحتوى', icon: PenTool, color: 'from-violet-500 to-purple-600' },
  { id: 'calendar', label: 'التقويم', icon: Calendar, color: 'from-cyan-500 to-blue-600' },
  { id: 'analytics', label: 'التحليلات', icon: BarChart3, color: 'from-rose-500 to-pink-600' },
  { id: 'replies', label: 'الردود', icon: MessageSquare, color: 'from-yellow-500 to-amber-600' },
  { id: 'settings', label: 'الإعدادات', icon: Settings, color: 'from-slate-400 to-gray-500' },
] as const;

const CONTENT_TYPE_LABELS: Record<string, string> = {
  educational: 'تعليمي',
  marketing: 'تسويقي',
  storytelling: 'قصصي',
  interactive: 'تفاعلي',
  promotional: 'ترويجي',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة',
  scheduled: 'مجدول',
  published: 'منشور',
  failed: 'فاشل',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  scheduled: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  published: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  failed: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
};

const ACTION_LABELS: Record<string, string> = {
  generate_content: 'توليد محتوى',
  generate_image: 'توليد صورة',
  generate_video: 'توليد فيديو',
  publish_post: 'نشر منشور',
  analyze_performance: 'تحليل الأداء',
  reply_comments: 'رد على تعليقات',
  schedule_post: 'جدولة منشور',
  check_pending_tasks: 'فحص المهام المعلقة',
  idle: 'خامل',
};

const ACTION_ICONS: Record<string, React.ReactNode> = {};

const INTENT_LABELS: Record<string, string> = {
  question: 'سؤال',
  purchase: 'رغبة في الشراء',
  complaint: 'شكوى',
  engagement: 'تفاعل',
};

const AUTONOMOUS_INTERVALS = [
  { value: 120, label: 'كل ساعتين' },
  { value: 240, label: 'كل 4 ساعات' },
  { value: 360, label: 'كل 6 ساعات' },
  { value: 720, label: 'كل 12 ساعة' },
  { value: 1440, label: 'يومياً' },
];

const GPT_IMAGE2_RATIOS = [
  { value: 'auto', label: 'تلقائي' },
  { value: '1:1', label: 'مربع (1:1)' },
  { value: '3:2', label: 'أفقي (3:2)' },
  { value: '2:3', label: 'عمودي (2:3)' },
  { value: '16:9', label: 'عريض (16:9)' },
  { value: '9:16', label: 'طويل (9:16)' },
  { value: '4:3', label: 'كلاسيكي (4:3)' },
  { value: '3:4', label: 'عمودي كلاسيكي (3:4)' },
];

// ============================================================
// Main Component
// ============================================================

export default function Home() {
  // Core state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [replies, setReplies] = useState<SmartReplyItem[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Agent autonomous state
  const [autoInterval, setAutoInterval] = useState(240); // minutes
  const [countdown, setCountdown] = useState(0);
  const [agentRunning, setAgentRunning] = useState(false);
  const autoRunRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Training form state
  const [form, setForm] = useState({
    companyName: '',
    description: '',
    products: '',
    targetAudience: '',
    toneOfVoice: 'professional',
    marketingGoals: '',
    offers: '',
    faqs: '',
    additionalInfo: '',
    agentMode: 'manual' as string,
    imageModel: 'gpt-image-2' as string,
  });

  // Content tab state
  const [contentFilter, setContentFilter] = useState('all');
  const [genContentType, setGenContentType] = useState('varied');
  const [genCustomPrompt, setGenCustomPrompt] = useState('');
  const [genCount, setGenCount] = useState(3);
  const [generating, setGenerating] = useState(false);

  // Image generation state
  const [imageTasks, setImageTasks] = useState<Map<string, ImageGenTask>>(new Map());
  const [imageAspectRatio, setImageAspectRatio] = useState('auto');
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Publishing state
  const [publishing, setPublishing] = useState<string | null>(null);

  // Reply state
  const [replyMessage, setReplyMessage] = useState('');
  const [generatingReply, setGeneratingReply] = useState(false);
  const [lastReply, setLastReply] = useState<{ reply: string; intentType: string } | null>(null);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);

  // Calendar state
  const [scheduleFreq, setScheduleFreq] = useState('daily');
  const [selectedTimes, setSelectedTimes] = useState<string[]>(['9ص', '6م']);
  const [autoPublish, setAutoPublish] = useState(false);
  const [autoGenerate, setAutoGenerate] = useState(false);

  // Schedule dialog
  const [scheduleDialogPost, setScheduleDialogPost] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');

  // ============================================================
  // Data Loading
  // ============================================================

  const loadBusiness = useCallback(async () => {
    try {
      const res = await fetch('/api/business');
      const data = await res.json();
      if (data.profiles && data.profiles.length > 0) {
        const activeProfile = data.profiles.find((p: BusinessProfile) => p.isActive) || data.profiles[0];
        setBusiness(activeProfile);
        setForm({
          companyName: activeProfile.companyName,
          description: activeProfile.description,
          products: activeProfile.products,
          targetAudience: activeProfile.targetAudience,
          toneOfVoice: activeProfile.toneOfVoice,
          marketingGoals: activeProfile.marketingGoals,
          offers: activeProfile.offers || '',
          faqs: activeProfile.faqs || '',
          additionalInfo: activeProfile.additionalInfo || '',
          agentMode: activeProfile.agentMode || 'manual',
          imageModel: 'gpt-image-2',
        });
      }
    } catch (error) {
      console.error('Error loading business:', error);
    }
  }, []);

  const loadPosts = useCallback(async () => {
    if (!business) return;
    try {
      const res = await fetch(`/api/content?businessId=${business.id}`);
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Error loading posts:', error);
    }
  }, [business]);

  const loadAnalytics = useCallback(async () => {
    if (!business) return;
    try {
      const res = await fetch(`/api/analytics?businessId=${business.id}`);
      const data = await res.json();
      setAnalytics(data.overview);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  }, [business]);

  const loadReplies = useCallback(async () => {
    if (!business) return;
    try {
      const res = await fetch(`/api/replies?businessId=${business.id}`);
      const data = await res.json();
      setReplies(data.replies || []);
    } catch (error) {
      console.error('Error loading replies:', error);
    }
  }, [business]);

  const loadAgentStatus = useCallback(async () => {
    if (!business) return;
    try {
      const res = await fetch(`/api/agent/status?businessId=${business.id}`);
      const data = await res.json();
      setAgentStatus(data);
    } catch (error) {
      console.error('Error loading agent status:', error);
    }
  }, [business]);

  const loadAgentLogs = useCallback(async () => {
    if (!business) return;
    try {
      const res = await fetch(`/api/agent/log?businessId=${business.id}&limit=50`);
      const data = await res.json();
      setAgentLogs(data.logs || []);
    } catch (error) {
      console.error('Error loading agent logs:', error);
    }
  }, [business]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadPosts(), loadAnalytics(), loadReplies(), loadAgentStatus(), loadAgentLogs()]);
  }, [loadPosts, loadAnalytics, loadReplies, loadAgentStatus, loadAgentLogs]);

  // ============================================================
  // Image Task Polling
  // ============================================================

  const pollImageTasks = useCallback(async () => {
    const pendingTasks = Array.from(imageTasks.entries()).filter(
      ([, task]) => task.status === 'processing'
    );
    if (pendingTasks.length === 0) return;

    for (const [postId, task] of pendingTasks) {
      try {
        // Find the post to determine if it's a video or image task
        const post = posts.find(p => p.id === postId);
        const isVideoTask = post?.mediaType === 'video';
        const apiEndpoint = isVideoTask ? '/api/media/video' : '/api/media/image';

        const res = await fetch(`${apiEndpoint}?taskId=${task.taskId}&postId=${postId}`);
        const data = await res.json();
        if (data.status === 'SUCCESS') {
          setImageTasks(prev => {
            const next = new Map(prev);
            next.set(postId, { ...task, status: 'success', progress: 100 });
            return next;
          });
          await loadPosts();
          toast({ title: isVideoTask ? 'تم إنشاء الفيديو!' : 'تم إنشاء الصورة!', description: isVideoTask ? 'تم إنشاء الفيديو بنجاح' : 'تم إنشاء الصورة بنجاح' });
        } else if (data.status === 'FAILED') {
          setImageTasks(prev => {
            const next = new Map(prev);
            next.set(postId, { ...task, status: 'failed', progress: 0 });
            return next;
          });
          toast({ title: isVideoTask ? 'فشل إنشاء الفيديو' : 'فشل إنشاء الصورة', description: isVideoTask ? 'حدث خطأ أثناء إنشاء الفيديو' : 'حدث خطأ أثناء إنشاء الصورة', variant: 'destructive' });
        } else {
          setImageTasks(prev => {
            const next = new Map(prev);
            const currentProgress = next.get(postId)?.progress || 0;
            next.set(postId, { ...task, progress: Math.min(currentProgress + 5, 90) });
            return next;
          });
        }
      } catch (error) {
        console.error('Error polling media task:', error);
      }
    }
  }, [imageTasks, loadPosts, posts]);

  useEffect(() => {
    const hasProcessingTasks = Array.from(imageTasks.values()).some(t => t.status === 'processing');
    if (hasProcessingTasks) {
      if (!pollingRef.current) {
        pollingRef.current = setInterval(pollImageTasks, 5000);
      }
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [imageTasks, pollImageTasks]);

  // ============================================================
  // Handlers (declared before effects that reference them)
  // ============================================================

  const handleSaveBusiness = async () => {
    try {
      if (business) {
        const res = await fetch('/api/business', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: business.id, ...form }),
        });
        const data = await res.json();
        setBusiness(data.profile);
        toast({ title: 'تم تحديث البيانات', description: 'تم حفظ بيانات الشركة وتدريب الوكيل' });
      } else {
        const res = await fetch('/api/business', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        setBusiness(data.profile);
        toast({ title: 'تم إنشاء الملف', description: 'تم حفظ بيانات الشركة وبدء التدريب' });
      }
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل في حفظ البيانات', variant: 'destructive' });
    }
  };

  const handleRunAgent = async () => {
    if (!business) return;
    setAgentRunning(true);
    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id }),
      });
      const data = await res.json();
      await refreshAll();
      if (data.results && data.results.length > 0) {
        const successCount = data.results.filter((r: { success: boolean }) => r.success).length;
        toast({
          title: 'اكتملت دورة الوكيل',
          description: `${successCount}/${data.results.length} إجراءات ناجحة`,
        });
      }
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل في تشغيل الوكيل', variant: 'destructive' });
    }
    setAgentRunning(false);
  };

  const handleGenerateContent = async () => {
    if (!business) {
      toast({ title: 'خطأ', description: 'يجب إنشاء ملف الشركة أولاً', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          contentType: genContentType === 'varied' ? undefined : genContentType,
          customPrompt: genCustomPrompt || undefined,
          count: genCount,
        }),
      });
      const data = await res.json();
      if (data.posts) {
        await loadPosts();
        toast({ title: 'تم توليد المحتوى', description: `تم إنشاء ${data.posts.length} منشورات جديدة` });

        // Auto-generate media for each post based on mediaType
        for (const post of data.posts) {
          if (post.mediaType === 'video' && post.videoPrompt) {
            handleGenerateVideo(post.id, post.videoPrompt, post.textOverlay || undefined);
          } else if (post.mediaType === 'image' && post.imagePrompt) {
            handleGenerateImage(post.id, post.imagePrompt);
          } else if (!post.mediaType && post.imagePrompt) {
            // Default: generate image if no mediaType specified but imagePrompt exists
            handleGenerateImage(post.id, post.imagePrompt);
          }
        }
      }
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل في توليد المحتوى', variant: 'destructive' });
    }
    setGenerating(false);
  };

  const handleGenerateImage = async (postId: string, imagePrompt: string) => {
    try {
      const res = await fetch('/api/media/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          prompt: imagePrompt,
          aspectRatio: imageAspectRatio,
          model: 'gpt-image-2',
        }),
      });
      const data = await res.json();
      if (data.taskId) {
        setImageTasks(prev => {
          const next = new Map(prev);
          next.set(postId, { taskId: data.taskId, postId, status: 'processing', progress: 10 });
          return next;
        });
        toast({ title: 'جارٍ إنشاء الصورة', description: `تم إرسال طلب إنشاء صورة...` });
      } else {
        toast({ title: 'خطأ', description: data.error || 'فشل في إنشاء طلب الصورة', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل في إنشاء الصورة', variant: 'destructive' });
    }
  };

  const handleGenerateVideo = async (postId: string, videoPrompt: string, textOverlay?: string) => {
    try {
      const res = await fetch('/api/media/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          prompt: videoPrompt,
          textOverlay: textOverlay || undefined,
        }),
      });
      const data = await res.json();
      if (data.taskId) {
        setImageTasks(prev => {
          const next = new Map(prev);
          next.set(postId, { taskId: data.taskId, postId, status: 'processing', progress: 10 });
          return next;
        });
        toast({ title: 'جارٍ إنشاء الفيديو', description: 'تم إرسال طلب إنشاء فيديو...' });
      } else {
        toast({ title: 'خطأ', description: data.error || 'فشل في إنشاء طلب الفيديو', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل في إنشاء الفيديو', variant: 'destructive' });
    }
  };

  const handlePublish = async (postId: string) => {
    setPublishing(postId);
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshAll();
        toast({ title: 'تم النشر بنجاح', description: 'تم نشر المنشور' });
      } else {
        toast({ title: 'خطأ في النشر', description: data.error?.message || 'فشل النشر', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل في نشر المنشور', variant: 'destructive' });
    }
    setPublishing(null);
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await fetch(`/api/content?id=${postId}`, { method: 'DELETE' });
      await loadPosts();
      toast({ title: 'تم الحذف', description: 'تم حذف المنشور' });
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل في حذف المنشور', variant: 'destructive' });
    }
  };

  const handleSchedulePost = async (postId: string, scheduledAt: string) => {
    try {
      await fetch('/api/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, scheduledAt }),
      });
      await loadPosts();
      setScheduleDialogPost(null);
      toast({ title: 'تم الجدولة', description: 'تم جدولة المنشور للنشر' });
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل في جدولة المنشور', variant: 'destructive' });
    }
  };

  const handleGenerateReply = async () => {
    if (!business || !replyMessage.trim()) return;
    setGeneratingReply(true);
    try {
      const res = await fetch('/api/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id, message: replyMessage }),
      });
      const data = await res.json();
      setLastReply({ reply: data.reply, intentType: data.intentType });
      await loadReplies();
      toast({ title: 'تم إنشاء الرد', description: 'تم إنشاء رد ذكي' });
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل في إنشاء الرد', variant: 'destructive' });
    }
    setGeneratingReply(false);
  };

  const handleSaveSchedule = async () => {
    if (!business) return;
    try {
      await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          frequency: scheduleFreq,
          preferredTimes: selectedTimes.join(', '),
          autoPublish,
          autoGenerate,
        }),
      });
      toast({ title: 'تم حفظ الجدول', description: 'تم تحديث إعدادات الجدولة' });
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل في حفظ الجدول', variant: 'destructive' });
    }
  };

  const toggleTime = (time: string) => {
    setSelectedTimes(prev =>
      prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]
    );
  };

  // 12-hour Arabic format time options
  const TIME_OPTIONS = [
    '12ص', '1ص', '2ص', '3ص', '4ص', '5ص', '6ص', '7ص', '8ص', '9ص', '10ص', '11ص',
    '12م', '1م', '2م', '3م', '4م', '5م', '6م', '7م', '8م', '9م', '10م', '11م',
  ];

  // ============================================================
  // Autonomous Agent Timer
  // ============================================================

  const countdownValueRef = useRef(autoInterval * 60);

  useEffect(() => {
    if (!business) return;
    const mode = form.agentMode;
    if (mode === 'fully-autonomous') {
      const intervalMs = autoInterval * 60 * 1000;
      countdownValueRef.current = autoInterval * 60;
      if (autoRunRef.current) clearInterval(autoRunRef.current);
      autoRunRef.current = setInterval(async () => {
        await handleRunAgent();
      }, intervalMs);

      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        countdownValueRef.current = countdownValueRef.current > 0
          ? countdownValueRef.current - 1
          : autoInterval * 60;
        setCountdown(countdownValueRef.current);
      }, 1000);
      // Set initial countdown via the interval's first tick
      setCountdown(countdownValueRef.current);
    } else {
      if (autoRunRef.current) {
        clearInterval(autoRunRef.current);
        autoRunRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }

    return () => {
      if (autoRunRef.current) clearInterval(autoRunRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [business, form.agentMode, autoInterval]);

  // Poll agent status every 30s
  useEffect(() => {
    if (!business) return;
    const interval = setInterval(loadAgentStatus, 30000);
    return () => clearInterval(interval);
  }, [business, loadAgentStatus]);

  // ============================================================
  // Initial Data Load
  // ============================================================

  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      const timer = setTimeout(() => { loadBusiness(); }, 0);
      return () => clearTimeout(timer);
    }
  }, [loadBusiness]);

  const hasRefreshedRef = useRef(false);
  useEffect(() => {
    if (business && !hasRefreshedRef.current) {
      hasRefreshedRef.current = true;
      const timer = setTimeout(() => { refreshAll(); }, 0);
      return () => clearTimeout(timer);
    }
  }, [business, refreshAll]);

  // ============================================================
  // Helpers
  // ============================================================

  const getPostImage = (post: ContentPost) => {
    if (post.imageData) return { type: 'base64' as const, src: `data:image/png;base64,${post.imageData}` };
    if (post.imageUrl) return { type: 'url' as const, src: post.imageUrl };
    return null;
  };

  const formatCountdown = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('ar-SA', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const filteredPosts = posts.filter(p => contentFilter === 'all' || p.status === contentFilter);

  const aspectRatios = GPT_IMAGE2_RATIOS;

  const trainingProgress = () => {
    if (!business) return 0;
    let score = 0;
    if (form.companyName) score += 15;
    if (form.description) score += 15;
    if (form.products) score += 15;
    if (form.targetAudience) score += 15;
    if (form.marketingGoals) score += 15;
    if (form.toneOfVoice) score += 5;
    if (form.offers) score += 10;
    if (form.faqs) score += 10;
    return score;
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col" dir="rtl">
      <div className="flex flex-1">
        {/* ============ SIDEBAR ============ */}
        <motion.aside
          initial={false}
          animate={{ width: sidebarCollapsed ? 68 : 240 }}
          className="h-screen sticky top-0 bg-slate-900/90 backdrop-blur-xl border-l border-white/10 flex flex-col overflow-hidden z-50 shrink-0"
        >
          {/* Logo */}
          <div className="p-3 flex items-center gap-3 border-b border-white/10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            {!sidebarCollapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden">
                <h1 className="font-bold text-sm bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent whitespace-nowrap">وكيل التسويق</h1>
                <p className="text-[10px] text-slate-500 whitespace-nowrap">AI Marketing Agent</p>
              </motion.div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {TAB_CONFIG.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium group ${
                    activeTab === tab.id
                      ? 'bg-white/10 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
                    activeTab === tab.id ? `bg-gradient-to-br ${tab.color}` : 'bg-slate-800 group-hover:bg-slate-700'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {!sidebarCollapsed && <span className="whitespace-nowrap">{tab.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* Active image tasks indicator */}
          {Array.from(imageTasks.values()).filter(t => t.status === 'processing').length > 0 && (
            <div className="px-2 py-2 border-t border-white/10">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-violet-500/10 text-violet-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {!sidebarCollapsed && <span className="text-xs">إنشاء صورة...</span>}
              </div>
            </div>
          )}

          {/* Agent status indicator */}
          <div className="px-2 py-2 border-t border-white/10">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/50">
              {agentStatus?.isRunning ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  {!sidebarCollapsed && <span className="text-xs text-emerald-400">الوكيل يعمل</span>}
                </>
              ) : (
                <>
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-500"></span>
                  {!sidebarCollapsed && <span className="text-xs text-slate-400">الوكيل خامل</span>}
                </>
              )}
            </div>
          </div>

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-3 border-t border-white/10 text-slate-400 hover:text-white transition-colors flex items-center justify-center"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </motion.aside>

        {/* ============ MAIN CONTENT ============ */}
        <main className="flex-1 overflow-y-auto flex flex-col min-h-screen">
          {/* Header */}
          <header className="sticky top-0 z-40 bg-slate-900/70 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-lg sm:text-xl font-bold">
                  {TAB_CONFIG.find(t => t.id === activeTab)?.label}
                </h2>
                <p className="text-xs sm:text-sm text-slate-400">
                  {business ? business.companyName : 'لم يتم إعداد الشركة بعد'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Agent mode badge */}
                {business && (
                  <Badge className={`text-xs ${
                    form.agentMode === 'fully-autonomous' 
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                      : form.agentMode === 'semi-auto'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                  }`}>
                    {form.agentMode === 'fully-autonomous' ? 'مستقل بالكامل' : form.agentMode === 'semi-auto' ? 'شبه تلقائي' : 'يدوي'}
                  </Badge>
                )}
                {/* Countdown */}
                {form.agentMode === 'fully-autonomous' && countdown > 0 && (
                  <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 font-mono text-xs">
                    <Timer className="w-3 h-3 ml-1" />
                    {formatCountdown(countdown)}
                  </Badge>
                )}
                {/* Active tasks */}
                {Array.from(imageTasks.values()).filter(t => t.status === 'processing').length > 0 && (
                  <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 animate-pulse text-xs">
                    <Loader2 className="w-3 h-3 ml-1 animate-spin" />
                    إنشاء صورة
                  </Badge>
                )}
                {business && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                    <CheckCircle2 className="w-3 h-3 ml-1" />
                    نشط
                  </Badge>
                )}
              </div>
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 p-4 sm:p-6">
            <AnimatePresence mode="wait">
              {/* ============ DASHBOARD TAB ============ */}
              {activeTab === 'dashboard' && (
                <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                  {!business ? (
                    <Card className="bg-slate-800/50 border-white/10">
                      <CardContent className="p-8 text-center">
                        <Rocket className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold mb-2">مرحباً بك في وكيل التسويق الذكي</h3>
                        <p className="text-slate-400 mb-6">ابدأ بتدريب الوكيل بإدخال بيانات شركتك</p>
                        <Button onClick={() => setActiveTab('training')} className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-8">
                          <ArrowRight className="w-4 h-4 ml-2" />
                          ابدأ التدريب
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {/* Agent Control Panel */}
                      <Card className="bg-gradient-to-br from-emerald-500/10 via-slate-800/50 to-teal-500/10 border-emerald-500/20 overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 animate-pulse"></div>
                        <CardContent className="p-6">
                          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
                            <div className="flex items-center gap-4 flex-1">
                              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
                                <Bot className="w-8 h-8 text-white" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-xl font-bold">الوكيل المستقل</h3>
                                  {agentStatus?.isRunning && (
                                    <span className="relative flex h-3 w-3">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-slate-400">
                                  {agentStatus?.isRunning ? 'الوكيل يعمل حالياً على اتخاذ قرارات...' : 'الوكيل في وضع الخمول - جاهز للعمل'}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <Button
                                onClick={handleRunAgent}
                                disabled={agentRunning}
                                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-6 shadow-lg shadow-emerald-500/25"
                              >
                                {agentRunning ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Play className="w-4 h-4 ml-2" />}
                                تشغيل الوكيل
                              </Button>
                            </div>
                          </div>

                          {/* Agent Mode Selector */}
                          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                            <button
                              onClick={() => { setForm(prev => ({ ...prev, agentMode: 'manual' })); }}
                              className={`p-4 rounded-xl border-2 transition-all text-right ${
                                form.agentMode === 'manual' 
                                  ? 'border-slate-400 bg-slate-700/50' 
                                  : 'border-white/10 bg-slate-800/30 hover:border-white/20'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Shield className="w-4 h-4 text-slate-400" />
                                <span className="font-medium text-sm">يدوي</span>
                              </div>
                              <p className="text-xs text-slate-500">أنت تتحكم بكل قرار</p>
                            </button>
                            <button
                              onClick={() => { setForm(prev => ({ ...prev, agentMode: 'semi-auto' })); }}
                              className={`p-4 rounded-xl border-2 transition-all text-right ${
                                form.agentMode === 'semi-auto' 
                                  ? 'border-amber-400 bg-amber-500/10' 
                                  : 'border-white/10 bg-slate-800/30 hover:border-white/20'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Zap className="w-4 h-4 text-amber-400" />
                                <span className="font-medium text-sm">شبه تلقائي</span>
                              </div>
                              <p className="text-xs text-slate-500">الوكيل يولد، أنت توافق</p>
                            </button>
                            <button
                              onClick={() => { setForm(prev => ({ ...prev, agentMode: 'fully-autonomous' })); }}
                              className={`p-4 rounded-xl border-2 transition-all text-right ${
                                form.agentMode === 'fully-autonomous' 
                                  ? 'border-emerald-400 bg-emerald-500/10' 
                                  : 'border-white/10 bg-slate-800/30 hover:border-white/20'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Crown className="w-4 h-4 text-emerald-400" />
                                <span className="font-medium text-sm">مستقل بالكامل</span>
                              </div>
                              <p className="text-xs text-slate-500">الوكيل يقرر كل شيء</p>
                            </button>
                          </div>

                          {/* Auto-run interval */}
                          {form.agentMode === 'fully-autonomous' && (
                            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                              <Timer className="w-5 h-5 text-emerald-400 shrink-0" />
                              <span className="text-sm text-emerald-300">التشغيل التلقائي كل:</span>
                              <Select value={String(autoInterval)} onValueChange={(v) => setAutoInterval(Number(v))}>
                                <SelectTrigger className="bg-slate-700/50 border-white/10 text-white w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {AUTONOMOUS_INTERVALS.map(opt => (
                                    <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {countdown > 0 && (
                                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                                  التالي: {formatCountdown(countdown)}
                                </span>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Stats Row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card className="bg-slate-800/50 border-white/10">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <PenTool className="w-4 h-4 text-violet-400" />
                              <span className="text-xs text-slate-500">إجمالي</span>
                            </div>
                            <p className="text-2xl font-bold">{posts.length}</p>
                            <p className="text-xs text-slate-400">منشور</p>
                          </CardContent>
                        </Card>
                        <Card className="bg-slate-800/50 border-white/10">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              <span className="text-xs text-slate-500">نُشر</span>
                            </div>
                            <p className="text-2xl font-bold text-emerald-400">{posts.filter(p => p.status === 'published').length}</p>
                            <p className="text-xs text-slate-400">منشور منشور</p>
                          </CardContent>
                        </Card>
                        <Card className="bg-slate-800/50 border-white/10">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <Clock className="w-4 h-4 text-amber-400" />
                              <span className="text-xs text-slate-500">مجدول</span>
                            </div>
                            <p className="text-2xl font-bold text-amber-400">{posts.filter(p => p.status === 'scheduled').length}</p>
                            <p className="text-xs text-slate-400">مجدول</p>
                          </CardContent>
                        </Card>
                        <Card className="bg-slate-800/50 border-white/10">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <XCircle className="w-4 h-4 text-rose-400" />
                              <span className="text-xs text-slate-500">فاشل</span>
                            </div>
                            <p className="text-2xl font-bold text-rose-400">{posts.filter(p => p.status === 'failed').length}</p>
                            <p className="text-xs text-slate-400">فاشل</p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Agent Status & Decision Feed */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Agent Status Card */}
                        <Card className="bg-slate-800/50 border-white/10">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Activity className="w-4 h-4 text-emerald-400" />
                              حالة الوكيل
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-400">الحالة</span>
                              <Badge className={agentStatus?.isRunning ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}>
                                {agentStatus?.isRunning ? 'يعمل' : 'خامل'}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-400">آخر تشغيل</span>
                              <span className="text-sm">{agentStatus?.lastRunAt ? formatDate(agentStatus.lastRunAt) : 'لم يتم بعد'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-400">إجمالي القرارات</span>
                              <span className="text-sm font-medium text-emerald-400">{agentStatus?.totalDecisions || 0}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-400">إجراءات (24س)</span>
                              <span className="text-sm font-medium text-amber-400">{agentStatus?.recentActions || 0}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-400">مهام معلقة</span>
                              <span className="text-sm font-medium text-violet-400">{agentStatus?.pendingTasks || 0}</span>
                            </div>
                            <Separator className="bg-white/5" />
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-400">النموذج</span>
                              <span className="text-xs font-mono text-violet-400">Claude Opus 4.8</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-400">نماذج الوسائط</span>
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-[10px] font-mono text-violet-400">الصور: GPT Image-2</span>
                                <span className="text-[10px] font-mono text-rose-400">الفيديو: Grok Imagine</span>
                              </div>
                            </div>
                            <Separator className="bg-white/5" />
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-400">توزيع الوسائط</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-cyan-400 flex items-center gap-1">
                                  <ImageIcon className="w-3 h-3" />
                                  {posts.filter(p => p.mediaType !== 'video').length}
                                </span>
                                <span className="text-xs text-slate-600">/</span>
                                <span className="text-xs text-rose-400 flex items-center gap-1">
                                  <Video className="w-3 h-3" />
                                  {posts.filter(p => p.mediaType === 'video').length}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Decision Feed */}
                        <Card className="bg-slate-800/50 border-white/10 lg:col-span-2">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base flex items-center gap-2">
                                <Flame className="w-4 h-4 text-amber-400" />
                                قرارات الوكيل الأخيرة
                              </CardTitle>
                              <Button variant="ghost" size="sm" onClick={loadAgentLogs} className="text-slate-400 hover:text-white h-7">
                                <RefreshCw className="w-3 h-3" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <ScrollArea className="h-72">
                              {agentLogs.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                  <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">لا توجد قرارات بعد. شغّل الوكيل لبدء العمل.</p>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {agentLogs.map((log) => (
                                    <div key={log.id} className="p-3 rounded-lg bg-slate-700/30 border border-white/5 hover:border-white/10 transition-colors">
                                      <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                          <Badge className={`text-[10px] px-1.5 py-0 ${
                                            log.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                                            log.status === 'executing' ? 'bg-amber-500/20 text-amber-400' :
                                            log.status === 'failed' ? 'bg-rose-500/20 text-rose-400' :
                                            'bg-slate-500/20 text-slate-400'
                                          }`}>
                                            {log.status === 'completed' ? 'مكتمل' : log.status === 'executing' ? 'ينفّذ' : log.status === 'failed' ? 'فاشل' : 'معلق'}
                                          </Badge>
                                          <span className="text-xs font-medium text-slate-300">
                                            {ACTION_LABELS[log.action] || log.action}
                                          </span>
                                        </div>
                                        <span className="text-[10px] text-slate-500">{formatDate(log.createdAt)}</span>
                                      </div>
                                      <p className="text-xs text-slate-400 leading-relaxed">{log.reasoning}</p>
                                      {log.executionTime && (
                                        <p className="text-[10px] text-slate-500 mt-1">⏱ {log.executionTime}ms</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Agent Activity Chart (simplified visual) */}
                      <Card className="bg-slate-800/50 border-white/10">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-violet-400" />
                            نشاط الوكيل (آخر 7 أيام)
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-end gap-2 h-32">
                            {Array.from({ length: 7 }, (_, i) => {
                              const day = new Date();
                              day.setDate(day.getDate() - (6 - i));
                              const dayStr = day.toLocaleDateString('ar-SA', { weekday: 'short' });
                              const dayLogs = agentLogs.filter(log => {
                                const logDate = new Date(log.createdAt);
                                return logDate.toDateString() === day.toDateString();
                              });
                              const height = Math.max(dayLogs.length * 12, 8);
                              return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                  <div className="w-full bg-slate-700/30 rounded-t relative overflow-hidden" style={{ height: `${height}px` }}>
                                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/30 to-teal-500/30 rounded-t"></div>
                                  </div>
                                  <span className="text-[10px] text-slate-500">{dayStr}</span>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </motion.div>
              )}

              {/* ============ TRAINING TAB ============ */}
              {activeTab === 'training' && (
                <motion.div key="training" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                  {/* Hero */}
                  <Card className="bg-gradient-to-br from-amber-500/10 to-orange-600/10 border-amber-500/20">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
                          <Brain className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold mb-1">تدريب الوكيل الذكي</h3>
                          <p className="text-slate-400 text-sm leading-relaxed">
                            أدخل بيانات شركتك لتصبح الذاكرة الدائمة للوكيل. يستخدمها في كل قرار محتوى وكل رد وكل استراتيجية.
                          </p>
                        </div>
                      </div>
                      {/* Training Progress */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-400">تقدم التدريب</span>
                          <span className="text-sm font-medium text-amber-400">{trainingProgress()}%</span>
                        </div>
                        <Progress value={trainingProgress()} className="h-2 bg-slate-700/50" />
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Company Info */}
                    <Card className="bg-slate-800/50 border-white/10">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Globe className="w-5 h-5 text-emerald-400" />
                          معلومات الشركة
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label className="text-sm text-slate-400 mb-1 block">اسم الشركة / المشروع *</Label>
                          <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="مثال: متجر الأناقة للملابس" className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500" />
                        </div>
                        <div>
                          <Label className="text-sm text-slate-400 mb-1 block">وصف الشركة *</Label>
                          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="وصف تفصيلي لشركتك..." rows={3} className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500" />
                        </div>
                        <div>
                          <Label className="text-sm text-slate-400 mb-1 block">المنتجات والخدمات *</Label>
                          <Textarea value={form.products} onChange={(e) => setForm({ ...form, products: e.target.value })} placeholder="اذكر منتجاتك وخدماتك بالتفصيل..." rows={3} className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500" />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Target & Goals */}
                    <Card className="bg-slate-800/50 border-white/10">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Target className="w-5 h-5 text-amber-400" />
                          الجمهور والأهداف
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label className="text-sm text-slate-400 mb-1 block">الجمهور المستهدف *</Label>
                          <Textarea value={form.targetAudience} onChange={(e) => setForm({ ...form, targetAudience: e.target.value })} placeholder="من هم عملاؤك المستهدفون؟" rows={2} className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500" />
                        </div>
                        <div>
                          <Label className="text-sm text-slate-400 mb-1 block">أسلوب العلامة التجارية</Label>
                          <Select value={form.toneOfVoice} onValueChange={(v) => setForm({ ...form, toneOfVoice: v })}>
                            <SelectTrigger className="bg-slate-700/50 border-white/10 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="professional">مهني واحترافي</SelectItem>
                              <SelectItem value="casual">عادي وودي</SelectItem>
                              <SelectItem value="friendly">صديق ومقرب</SelectItem>
                              <SelectItem value="authoritative">رسمي وصارم</SelectItem>
                              <SelectItem value="playful">مرح وخفيف</SelectItem>
                              <SelectItem value="inspirational">ملهم ومحفز</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-sm text-slate-400 mb-1 block">أهداف التسويق *</Label>
                          <Textarea value={form.marketingGoals} onChange={(e) => setForm({ ...form, marketingGoals: e.target.value })} placeholder="زيادة المبيعات، بناء الوعي بالعلامة التجارية..." rows={2} className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500" />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Offers & FAQs */}
                    <Card className="bg-slate-800/50 border-white/10">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Megaphone className="w-5 h-5 text-rose-400" />
                          العروض والأسئلة الشائعة
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label className="text-sm text-slate-400 mb-1 block">العروض والأسعار</Label>
                          <Textarea value={form.offers} onChange={(e) => setForm({ ...form, offers: e.target.value })} placeholder="العروض الحالية، الأسعار، الخصومات..." rows={3} className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500" />
                        </div>
                        <div>
                          <Label className="text-sm text-slate-400 mb-1 block">الأسئلة الشائعة</Label>
                          <Textarea value={form.faqs} onChange={(e) => setForm({ ...form, faqs: e.target.value })} placeholder="الأسئلة الشائعة وأجوبتها..." rows={3} className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500" />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Additional & Agent Config */}
                    <Card className="bg-slate-800/50 border-white/10">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <BookOpen className="w-5 h-5 text-violet-400" />
                          معلومات إضافية وإعدادات الوكيل
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label className="text-sm text-slate-400 mb-1 block">ملاحظات إضافية</Label>
                          <Textarea value={form.additionalInfo} onChange={(e) => setForm({ ...form, additionalInfo: e.target.value })} placeholder="معلومات إضافية للوكيل..." rows={3} className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500" />
                        </div>
                        <div>
                          <Label className="text-sm text-slate-400 mb-1 block">نماذج توليد الوسائط</Label>
                          <div className="p-3 rounded-xl bg-slate-700/30 border border-white/5 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-400">صور:</span>
                              <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-[10px]">
                                <ImageIcon className="w-2.5 h-2.5 ml-1" />
                                GPT Image 2
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-400">فيديو:</span>
                              <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px]">
                                <Video className="w-2.5 h-2.5 ml-1" />
                                Grok Imagine
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm text-slate-400 mb-1 block">وضع الوكيل</Label>
                          <Select value={form.agentMode} onValueChange={(v) => setForm({ ...form, agentMode: v })}>
                            <SelectTrigger className="bg-slate-700/50 border-white/10 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manual">يدوي</SelectItem>
                              <SelectItem value="semi-auto">شبه تلقائي</SelectItem>
                              <SelectItem value="fully-autonomous">مستقل بالكامل</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveBusiness}
                      disabled={!form.companyName || !form.description}
                      className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-8 py-3 text-lg rounded-xl shadow-lg shadow-amber-500/25"
                    >
                      <Save className="w-5 h-5 ml-2" />
                      حفظ وتدريب الوكيل
                    </Button>
                  </div>

                  {/* Memory Status */}
                  {business && (
                    <Card className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border-emerald-500/20">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                            <Brain className="w-6 h-6 text-emerald-400" />
                          </div>
                          <div>
                            <h4 className="font-bold text-emerald-400">الذاكرة الدائمة نشطة</h4>
                            <p className="text-sm text-slate-400">الوكيل يستخدم بيانات &quot;{business.companyName}&quot; في كل قرار</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-emerald-400">{posts.length}</p>
                            <p className="text-xs text-slate-400">منشور</p>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-amber-400">{posts.filter(p => p.status === 'published').length}</p>
                            <p className="text-xs text-slate-400">منشور</p>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-violet-400">{posts.filter(p => p.isAutonomous).length}</p>
                            <p className="text-xs text-slate-400">مستقل</p>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-rose-400">{replies.length}</p>
                            <p className="text-xs text-slate-400">رد ذكي</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              )}

              {/* ============ CONTENT TAB ============ */}
              {activeTab === 'content' && (
                <motion.div key="content" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                  {!business ? (
                    <Card className="bg-slate-800/50 border-white/10">
                      <CardContent className="p-8 text-center">
                        <Brain className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-2">يجب إعداد الشركة أولاً</h3>
                        <Button onClick={() => setActiveTab('training')} className="bg-amber-500 hover:bg-amber-600">
                          <ArrowRight className="w-4 h-4 ml-2" />الذهاب للتدريب
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {/* Generation Controls */}
                      <Card className="bg-gradient-to-br from-violet-500/10 to-purple-600/10 border-violet-500/20">
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                              <Sparkles className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold">توليد محتوى ذكي</h3>
                              <p className="text-slate-400 text-xs">مدعوم بـ <span className="text-violet-400 font-medium">Claude Opus 4.8</span></p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                            <div>
                              <Label className="text-xs text-slate-400 mb-1 block">نوع المحتوى</Label>
                              <Select value={genContentType} onValueChange={setGenContentType}>
                                <SelectTrigger className="bg-slate-700/50 border-white/10 text-white h-9 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="varied">متنوع (تلقائي)</SelectItem>
                                  <SelectItem value="educational">تعليمي</SelectItem>
                                  <SelectItem value="marketing">تسويقي</SelectItem>
                                  <SelectItem value="storytelling">قصصي</SelectItem>
                                  <SelectItem value="interactive">تفاعلي</SelectItem>
                                  <SelectItem value="promotional">ترويجي</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-slate-400 mb-1 block">طلب مخصص</Label>
                              <Input value={genCustomPrompt} onChange={(e) => setGenCustomPrompt(e.target.value)} placeholder="اختياري..." className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500 h-9 text-sm" />
                            </div>
                            <div>
                              <Label className="text-xs text-slate-400 mb-1 block">العدد</Label>
                              <Select value={String(genCount)} onValueChange={(v) => setGenCount(Number(v))}>
                                <SelectTrigger className="bg-slate-700/50 border-white/10 text-white h-9 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">1</SelectItem>
                                  <SelectItem value="3">3</SelectItem>
                                  <SelectItem value="5">5</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-end">
                              <Button onClick={handleGenerateContent} disabled={generating} className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white h-9">
                                {generating ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Plus className="w-4 h-4 ml-1" />}
                                توليد محتوى
                              </Button>
                            </div>
                          </div>
                          {/* Media Models Info & Image Settings */}
                          <div className="p-3 rounded-xl bg-slate-700/30 border border-white/5">
                            <div className="flex items-center gap-2 mb-2">
                              <Layers className="w-3.5 h-3.5 text-violet-400" />
                              <span className="text-xs font-medium text-violet-300">إعدادات الوسائط</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label className="text-[10px] text-slate-500 mb-1 block">النماذج النشطة</Label>
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-800/50">
                                    <ImageIcon className="w-3 h-3 text-violet-400" />
                                    <span className="text-[10px] text-slate-300">صور:</span>
                                    <span className="text-[10px] font-mono text-violet-400">GPT Image 2</span>
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 mr-auto" />
                                  </div>
                                  <div className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-800/50">
                                    <Video className="w-3 h-3 text-rose-400" />
                                    <span className="text-[10px] text-slate-300">فيديو:</span>
                                    <span className="text-[10px] font-mono text-rose-400">Grok Imagine</span>
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 mr-auto" />
                                  </div>
                                </div>
                              </div>
                              <div>
                                <Label className="text-[10px] text-slate-500 mb-1 block">نسبة الأبعاد (الصور)</Label>
                                <Select value={imageAspectRatio} onValueChange={setImageAspectRatio}>
                                  <SelectTrigger className="bg-slate-700/50 border-white/10 text-white h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {aspectRatios.map(r => (
                                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Filter */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {['all', 'draft', 'scheduled', 'published', 'failed'].map(status => (
                          <Button
                            key={status}
                            variant="ghost"
                            size="sm"
                            onClick={() => setContentFilter(status)}
                            className={`text-xs h-7 px-3 ${contentFilter === status ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
                          >
                            {status === 'all' ? 'الكل' : STATUS_LABELS[status]}
                          </Button>
                        ))}
                        <span className="text-xs text-slate-500 mr-auto">{filteredPosts.length} منشور</span>
                      </div>

                      {/* Posts Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredPosts.map(post => {
                          const postImage = getPostImage(post);
                          const imageTask = imageTasks.get(post.id);
                          const isVideo = post.mediaType === 'video';
                          return (
                            <Card key={post.id} className="bg-slate-800/50 border-white/10 hover:border-white/20 transition-colors overflow-hidden">
                              {/* Media Preview */}
                              {postImage && !isVideo && (
                                <div className="aspect-video bg-slate-700/30 relative overflow-hidden">
                                  <img src={postImage.src} alt={post.title || 'Post image'} className="w-full h-full object-cover" />
                                </div>
                              )}
                              {post.videoUrl && isVideo && (
                                <div className="aspect-video bg-slate-700/30 relative overflow-hidden">
                                  <video src={post.videoUrl} controls className="w-full h-full object-cover" />
                                </div>
                              )}
                              {!postImage && !post.videoUrl && isVideo && (
                                <div className="aspect-video bg-slate-700/30 relative overflow-hidden flex items-center justify-center">
                                  <Film className="w-12 h-12 text-slate-600" />
                                </div>
                              )}
                              {imageTask?.status === 'processing' && (
                                <div className="p-2">
                                  <Progress value={imageTask.progress} className="h-1.5 bg-slate-700/50" />
                                  <p className="text-[10px] text-violet-400 mt-1 text-center">{isVideo ? 'جارٍ إنشاء الفيديو...' : 'جارٍ إنشاء الصورة...'}</p>
                                </div>
                              )}
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <Badge className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[post.status]}`}>
                                    {STATUS_LABELS[post.status]}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/10 text-slate-400">
                                    {CONTENT_TYPE_LABELS[post.contentType] || post.contentType}
                                  </Badge>
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${isVideo ? 'border-rose-500/30 text-rose-400' : 'border-cyan-500/30 text-cyan-400'}`}>
                                    {isVideo ? <Video className="w-2.5 h-2.5 ml-0.5" /> : <ImageIcon className="w-2.5 h-2.5 ml-0.5" />}
                                    {isVideo ? 'فيديو' : 'صورة'}
                                  </Badge>
                                  {post.textOverlay && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/30 text-amber-400 line-clamp-1 max-w-[120px]">
                                      {post.textOverlay}
                                    </Badge>
                                  )}
                                  {post.isAutonomous && (
                                    <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                      <Bot className="w-2.5 h-2.5 ml-0.5" />مستقل
                                    </Badge>
                                  )}
                                </div>
                                {post.title && <h4 className="font-medium text-sm mb-1 line-clamp-1">{post.title}</h4>}
                                <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 mb-3">{post.content}</p>
                                {post.hashtags && (
                                  <p className="text-[10px] text-violet-400 mb-2 line-clamp-1">{post.hashtags}</p>
                                )}
                                <div className="flex items-center gap-1 flex-wrap">
                                  {post.status === 'draft' && (
                                    <>
                                      <Button size="sm" variant="ghost" onClick={() => handlePublish(post.id)} disabled={publishing === post.id} className="h-7 px-2 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">
                                        {publishing === post.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => setScheduleDialogPost(post.id)} className="h-7 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10">
                                        <Clock className="w-3 h-3" />
                                      </Button>
                                      {isVideo && post.videoPrompt && !post.videoUrl && !imageTask && (
                                        <Button size="sm" variant="ghost" onClick={() => handleGenerateVideo(post.id, post.videoPrompt!, post.textOverlay || undefined)} className="h-7 px-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10">
                                          <Video className="w-3 h-3" />
                                        </Button>
                                      )}
                                      {!isVideo && post.imagePrompt && !postImage && !imageTask && (
                                        <Button size="sm" variant="ghost" onClick={() => handleGenerateImage(post.id, post.imagePrompt!)} className="h-7 px-2 text-xs text-violet-400 hover:text-violet-300 hover:bg-violet-500/10">
                                          <ImageIcon className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </>
                                  )}
                                  <Button size="sm" variant="ghost" onClick={() => handleDeletePost(post.id)} className="h-7 px-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 mr-auto">
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                                <p className="text-[10px] text-slate-600 mt-2">{formatDate(post.createdAt)}</p>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>

                      {filteredPosts.length === 0 && (
                        <div className="text-center py-12 text-slate-500">
                          <PenTool className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>لا توجد منشورات. ولّد محتوى أو شغّل الوكيل المستقل.</p>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}

              {/* ============ CALENDAR TAB ============ */}
              {activeTab === 'calendar' && (
                <motion.div key="calendar" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                  {!business ? (
                    <Card className="bg-slate-800/50 border-white/10">
                      <CardContent className="p-8 text-center">
                        <Brain className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-2">يجب إعداد الشركة أولاً</h3>
                        <Button onClick={() => setActiveTab('training')} className="bg-cyan-500 hover:bg-cyan-600">
                          <ArrowRight className="w-4 h-4 ml-2" />الذهاب للتدريب
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {/* Schedule Config */}
                      <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border-cyan-500/20">
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0">
                              <Calendar className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold">إعدادات الجدولة</h3>
                              <p className="text-slate-400 text-xs">حدد متى وكيف ينشر الوكيل المحتوى</p>
                            </div>
                          </div>
                          <div className="space-y-5 mb-4">
                            {/* Frequency */}
                            <div>
                              <Label className="text-xs text-slate-400 mb-1.5 block">التكرار</Label>
                              <Select value={scheduleFreq} onValueChange={setScheduleFreq}>
                                <SelectTrigger className="bg-slate-700/50 border-white/10 text-white h-9 text-sm w-full sm:w-48">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="daily">يومياً</SelectItem>
                                  <SelectItem value="twice-daily">مرتين يومياً</SelectItem>
                                  <SelectItem value="weekly">أسبوعياً</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Preferred Times - 12-hour Arabic format */}
                            <div>
                              <Label className="text-xs text-slate-400 mb-2 block">
                                الأوقات المفضلة
                                <span className="text-slate-500 mr-1">({selectedTimes.length} مختار)</span>
                              </Label>
                              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1.5">
                                {TIME_OPTIONS.map(time => {
                                  const isSelected = selectedTimes.includes(time);
                                  const isAM = time.endsWith('ص');
                                  return (
                                    <button
                                      key={time}
                                      onClick={() => toggleTime(time)}
                                      className={`px-2 py-2 rounded-lg text-xs font-bold transition-all duration-200 border ${
                                        isSelected
                                          ? isAM
                                            ? 'bg-cyan-500/30 border-cyan-500/50 text-cyan-300 shadow-lg shadow-cyan-500/10'
                                            : 'bg-amber-500/30 border-amber-500/50 text-amber-300 shadow-lg shadow-amber-500/10'
                                          : 'bg-slate-700/30 border-white/5 text-slate-500 hover:bg-slate-700/50 hover:text-slate-300 hover:border-white/10'
                                      }`}
                                    >
                                      {time}
                                    </button>
                                  );
                                })}
                              </div>
                              {selectedTimes.length > 0 && (
                                <p className="text-[10px] text-slate-500 mt-2">
                                  الأوقات المختارة: {selectedTimes.join('، ')}
                                </p>
                              )}
                            </div>

                            {/* Auto Publish & Auto Generate Toggles */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${
                                autoPublish
                                  ? 'bg-emerald-500/15 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                                  : 'bg-slate-700/30 border-white/5'
                              }`}>
                                <Switch
                                  checked={autoPublish}
                                  onCheckedChange={setAutoPublish}
                                  className={`${autoPublish ? 'data-[state=checked]:bg-emerald-500' : ''}`}
                                />
                                <div className="flex items-center gap-2 flex-1">
                                  <Send className={`w-4 h-4 ${autoPublish ? 'text-emerald-400' : 'text-slate-400'}`} />
                                  <Label className={`text-sm font-medium ${autoPublish ? 'text-emerald-400' : 'text-slate-300'}`}>
                                    نشر تلقائي
                                  </Label>
                                </div>
                                {autoPublish && (
                                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0 animate-pulse">
                                    نشط
                                  </Badge>
                                )}
                              </div>
                              <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${
                                autoGenerate
                                  ? 'bg-emerald-500/15 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                                  : 'bg-slate-700/30 border-white/5'
                              }`}>
                                <Switch
                                  checked={autoGenerate}
                                  onCheckedChange={setAutoGenerate}
                                  className={`${autoGenerate ? 'data-[state=checked]:bg-emerald-500' : ''}`}
                                />
                                <div className="flex items-center gap-2 flex-1">
                                  <Sparkles className={`w-4 h-4 ${autoGenerate ? 'text-emerald-400' : 'text-slate-400'}`} />
                                  <Label className={`text-sm font-medium ${autoGenerate ? 'text-emerald-400' : 'text-slate-300'}`}>
                                    توليد تلقائي
                                  </Label>
                                </div>
                                {autoGenerate && (
                                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0 animate-pulse">
                                    نشط
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button onClick={handleSaveSchedule} className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white">
                            <Save className="w-4 h-4 ml-2" />
                            حفظ الجدول
                          </Button>
                        </CardContent>
                      </Card>

                      {/* Scheduled Posts List */}
                      <Card className="bg-slate-800/50 border-white/10">
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-400" />
                            المنشورات المجدولة
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="max-h-96">
                            {posts.filter(p => p.status === 'scheduled').length === 0 ? (
                              <div className="text-center py-8 text-slate-500">
                                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">لا توجد منشورات مجدولة</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {posts.filter(p => p.status === 'scheduled').map(post => (
                                  <div key={post.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/30 border border-white/5">
                                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                                      <Clock className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{post.title || post.content.substring(0, 60)}</p>
                                      <p className="text-[10px] text-slate-500">
                                        {post.scheduledAt ? formatDate(post.scheduledAt) : 'بانتظار التحديد'}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button size="sm" variant="ghost" onClick={() => handlePublish(post.id)} className="h-7 px-2 text-xs text-emerald-400">
                                        <Send className="w-3 h-3" />
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => handleDeletePost(post.id)} className="h-7 px-2 text-xs text-rose-400">
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </CardContent>
                      </Card>

                      {/* Recent Published */}
                      <Card className="bg-slate-800/50 border-white/10">
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            المنشورات المنشورة مؤخراً
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="max-h-64">
                            {posts.filter(p => p.status === 'published').length === 0 ? (
                              <p className="text-center text-sm text-slate-500 py-4">لا توجد منشورات منشورة بعد</p>
                            ) : (
                              <div className="space-y-2">
                                {posts.filter(p => p.status === 'published').slice(0, 10).map(post => (
                                  <div key={post.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/30 border border-white/5">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{post.title || post.content.substring(0, 60)}</p>
                                      <p className="text-[10px] text-slate-500">{post.publishedAt ? formatDate(post.publishedAt) : formatDate(post.createdAt)}</p>
                                    </div>
                                    {post.isAutonomous && (
                                      <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/20 text-emerald-400">
                                        <Bot className="w-2.5 h-2.5 ml-0.5" />مستقل
                                      </Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </motion.div>
              )}

              {/* ============ ANALYTICS TAB ============ */}
              {activeTab === 'analytics' && (
                <motion.div key="analytics" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                  {!business ? (
                    <Card className="bg-slate-800/50 border-white/10">
                      <CardContent className="p-8 text-center">
                        <Brain className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-2">يجب إعداد الشركة أولاً</h3>
                        <Button onClick={() => setActiveTab('training')} className="bg-rose-500 hover:bg-rose-600">
                          <ArrowRight className="w-4 h-4 ml-2" />الذهاب للتدريب
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {/* Performance Overview */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card className="bg-slate-800/50 border-white/10">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <EyeIcon className="w-4 h-4 text-cyan-400" />
                              <span className="text-xs text-slate-400">الوصول</span>
                            </div>
                            <p className="text-2xl font-bold text-cyan-400">{analytics?.totalReach || 0}</p>
                          </CardContent>
                        </Card>
                        <Card className="bg-slate-800/50 border-white/10">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Heart className="w-4 h-4 text-rose-400" />
                              <span className="text-xs text-slate-400">الإعجابات</span>
                            </div>
                            <p className="text-2xl font-bold text-rose-400">{analytics?.totalLikes || 0}</p>
                          </CardContent>
                        </Card>
                        <Card className="bg-slate-800/50 border-white/10">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageCircle className="w-4 h-4 text-amber-400" />
                              <span className="text-xs text-slate-400">التعليقات</span>
                            </div>
                            <p className="text-2xl font-bold text-amber-400">{analytics?.totalComments || 0}</p>
                          </CardContent>
                        </Card>
                        <Card className="bg-slate-800/50 border-white/10">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Repeat2 className="w-4 h-4 text-violet-400" />
                              <span className="text-xs text-slate-400">المشاركات</span>
                            </div>
                            <p className="text-2xl font-bold text-violet-400">{analytics?.totalShares || 0}</p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Stats Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-slate-800/50 border-white/10">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">متوسط التفاعل</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-3xl font-bold text-emerald-400">{analytics?.avgEngagement || '0'}</p>
                          </CardContent>
                        </Card>
                        <Card className="bg-slate-800/50 border-white/10">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">إجمالي المنشورات</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <p className="text-xl font-bold">{analytics?.totalPosts || 0}</p>
                                <p className="text-[10px] text-slate-500">إجمالي</p>
                              </div>
                              <div className="text-center">
                                <p className="text-xl font-bold text-emerald-400">{analytics?.publishedPosts || 0}</p>
                                <p className="text-[10px] text-slate-500">منشور</p>
                              </div>
                              <div className="text-center">
                                <p className="text-xl font-bold text-slate-400">{analytics?.draftPosts || 0}</p>
                                <p className="text-[10px] text-slate-500">مسودة</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-slate-800/50 border-white/10">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">أداء أنواع المحتوى</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {Object.entries(
                              posts.reduce((acc, p) => {
                                acc[p.contentType] = (acc[p.contentType] || 0) + 1;
                                return acc;
                              }, {} as Record<string, number>)
                            ).map(([type, count]) => (
                              <div key={type} className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-400">{CONTENT_TYPE_LABELS[type] || type}</span>
                                <span className="text-xs font-medium">{count}</span>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      </div>

                      {/* Recent Performance Table */}
                      <Card className="bg-slate-800/50 border-white/10">
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                            أداء المنشورات الأخيرة
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="max-h-72">
                            {posts.filter(p => p.status === 'published').length === 0 ? (
                              <p className="text-center text-sm text-slate-500 py-4">لا توجد بيانات أداء بعد</p>
                            ) : (
                              <div className="space-y-2">
                                {posts.filter(p => p.status === 'published').slice(0, 15).map(post => (
                                  <div key={post.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/20 border border-white/5">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm truncate">{post.title || post.content.substring(0, 80)}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-white/10 text-slate-500">
                                          {CONTENT_TYPE_LABELS[post.contentType]}
                                        </Badge>
                                        {post.isAutonomous && (
                                          <Badge className="text-[10px] px-1 py-0 bg-emerald-500/20 text-emerald-400">مستقل</Badge>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-400">
                                      <span className="flex items-center gap-1"><EyeIcon className="w-3 h-3" />{post.reachCount || 0}</span>
                                      <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{post.likeCount || 0}</span>
                                      <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{post.commentCount || 0}</span>
                                      <span className="flex items-center gap-1"><Repeat2 className="w-3 h-3" />{post.shareCount || 0}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </CardContent>
                      </Card>

                      {/* Agent Insights */}
                      <Card className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border-emerald-500/20">
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-amber-400" />
                            رؤى الوكيل الذكي
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {agentLogs.filter(l => l.action === 'analyze_performance' && l.status === 'completed').slice(0, 3).map(log => (
                              <div key={log.id} className="p-3 rounded-lg bg-slate-800/30 border border-white/5">
                                <p className="text-xs text-slate-300">{log.reasoning}</p>
                                {log.result && (
                                  <p className="text-[10px] text-slate-500 mt-1">
                                    {(() => { try { const r = JSON.parse(log.result); return r.details; } catch { return ''; } })()}
                                  </p>
                                )}
                              </div>
                            ))}
                            {agentLogs.filter(l => l.action === 'analyze_performance').length === 0 && (
                              <p className="text-sm text-slate-500">لم يقم الوكيل بتحليل الأداء بعد. شغّل الوكيل لبدء التحليل.</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </motion.div>
              )}

              {/* ============ REPLIES TAB ============ */}
              {activeTab === 'replies' && (
                <motion.div key="replies" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                  {!business ? (
                    <Card className="bg-slate-800/50 border-white/10">
                      <CardContent className="p-8 text-center">
                        <Brain className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-2">يجب إعداد الشركة أولاً</h3>
                        <Button onClick={() => setActiveTab('training')} className="bg-yellow-500 hover:bg-yellow-600">
                          <ArrowRight className="w-4 h-4 ml-2" />الذهاب للتدريب
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {/* Reply Generator */}
                      <Card className="bg-gradient-to-br from-yellow-500/10 to-amber-600/10 border-yellow-500/20">
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shrink-0">
                              <MessageSquare className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold">الردود الذكية</h3>
                              <p className="text-slate-400 text-xs">اختبر الردود الذكية على رسائل العملاء</p>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <Label className="text-xs text-slate-400 mb-1 block">رسالة العميل</Label>
                              <Textarea value={replyMessage} onChange={(e) => setReplyMessage(e.target.value)} placeholder="أدخل رسالة العميل هنا..." rows={2} className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500" />
                            </div>
                            <Button onClick={handleGenerateReply} disabled={generatingReply || !replyMessage.trim()} className="bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white">
                              {generatingReply ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Send className="w-4 h-4 ml-2" />}
                              إنشاء رد ذكي
                            </Button>
                          </div>
                          {lastReply && (
                            <div className="mt-4 p-4 rounded-xl bg-slate-700/30 border border-white/5">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400">
                                  {INTENT_LABELS[lastReply.intentType] || lastReply.intentType}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-200 leading-relaxed">{lastReply.reply}</p>
                              <Button variant="ghost" size="sm" className="mt-2 text-xs text-slate-400 hover:text-white h-6" onClick={() => { navigator.clipboard.writeText(lastReply.reply); toast({ title: 'تم النسخ' }); }}>
                                <Copy className="w-3 h-3 ml-1" />نسخ
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Auto-reply toggle */}
                      <Card className="bg-slate-800/50 border-white/10">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Bot className="w-5 h-5 text-emerald-400" />
                              <div>
                                <p className="text-sm font-medium">الرد التلقائي</p>
                                <p className="text-xs text-slate-500">الوكيل يرد تلقائياً على التعليقات</p>
                              </div>
                            </div>
                            <Switch checked={autoReplyEnabled} onCheckedChange={setAutoReplyEnabled} />
                          </div>
                        </CardContent>
                      </Card>

                      {/* Reply History */}
                      <Card className="bg-slate-800/50 border-white/10">
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-400" />
                            سجل الردود
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="max-h-96">
                            {replies.length === 0 ? (
                              <p className="text-center text-sm text-slate-500 py-4">لا توجد ردود سابقة</p>
                            ) : (
                              <div className="space-y-3">
                                {replies.map(reply => (
                                  <div key={reply.id} className="p-3 rounded-lg bg-slate-700/30 border border-white/5">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/10 text-slate-400">
                                        {INTENT_LABELS[reply.intentType || ''] || reply.intentType || 'عام'}
                                      </Badge>
                                      {reply.isAutonomous && (
                                        <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/20 text-emerald-400">
                                          <Bot className="w-2.5 h-2.5 ml-0.5" />مستقل
                                        </Badge>
                                      )}
                                      <span className="text-[10px] text-slate-500 mr-auto">{formatDate(reply.createdAt)}</span>
                                    </div>
                                    <div className="mb-2">
                                      <p className="text-xs text-slate-500 mb-1">الرسالة:</p>
                                      <p className="text-xs text-slate-300">{reply.originalMsg}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-500 mb-1">الرد:</p>
                                      <p className="text-xs text-emerald-300">{reply.replyText}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </motion.div>
              )}

              {/* ============ SETTINGS TAB ============ */}
              {activeTab === 'settings' && (
                <motion.div key="settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                  {/* AI Models Info */}
                  <Card className="bg-gradient-to-br from-violet-500/10 to-purple-600/10 border-violet-500/20">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                          <Cpu className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold">نماذج الذكاء الاصطناعي</h3>
                          <p className="text-slate-400 text-xs">النماذج المستخدمة في تشغيل الوكيل</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl bg-slate-800/50 border border-white/5">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                              <Brain className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">Claude Opus 4.8</p>
                              <p className="text-[10px] text-slate-500">الدماغ التنفيذي</p>
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">يتخذ جميع القرارات التسويقية بشكل مستقل. يولد المحتوى، يحلل الأداء، ويقرر متى ينشر.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-800/50 border border-white/5">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-violet-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">GPT Image-2</p>
                              <p className="text-[10px] text-slate-500">توليد الصور</p>
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">يولد صوراً احترافية للمنشورات. يدعم نسب أبعاد متعددة وجودة عالية.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-800/50 border border-white/5">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center">
                              <Video className="w-4 h-4 text-rose-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">Grok Imagine</p>
                              <p className="text-[10px] text-slate-500">توليد الفيديو</p>
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">يولد فيديوهات إبداعية من وصف نصي. يُستخدم تلقائياً عند اختيار نوع الوسائط فيديو.</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Configuration */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="bg-slate-800/50 border-white/10">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Layers className="w-4 h-4 text-violet-400" />
                          نماذج توليد الوسائط
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30 border border-white/5">
                            <div className="flex items-center gap-2">
                              <ImageIcon className="w-4 h-4 text-violet-400" />
                              <div>
                                <p className="text-sm font-medium">صور</p>
                                <p className="text-[10px] text-slate-500">توليد الصور تلقائياً</p>
                              </div>
                            </div>
                            <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 font-mono text-xs">GPT Image 2</Badge>
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30 border border-white/5">
                            <div className="flex items-center gap-2">
                              <Video className="w-4 h-4 text-rose-400" />
                              <div>
                                <p className="text-sm font-medium">فيديو</p>
                                <p className="text-[10px] text-slate-500">توليد الفيديو تلقائياً</p>
                              </div>
                            </div>
                            <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 font-mono text-xs">Grok Imagine</Badge>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500">الوكيل يختار تلقائياً نوع الوسائط (صورة أو فيديو) لكل منشور ويستخدم النموذج المناسب</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-800/50 border-white/10">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Facebook className="w-4 h-4 text-blue-400" />
                          اتصال فيسبوك
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30 border border-white/5">
                          <div className="flex items-center gap-2">
                            <Facebook className="w-5 h-5 text-blue-400" />
                            <div>
                              <p className="text-sm">حالة الاتصال</p>
                              <p className="text-xs text-slate-500">Facebook Graph API</p>
                            </div>
                          </div>
                          <Badge className="bg-emerald-500/20 text-emerald-400">
                            <Wifi className="w-3 h-3 ml-1" />
                            متصل
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500">يتم النشر تلقائياً على صفحة فيسبوك المرتبطة عند نشر المنشورات</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Agent Configuration */}
                  <Card className="bg-slate-800/50 border-white/10">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Bot className="w-4 h-4 text-emerald-400" />
                        إعدادات الوكيل المستقل
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm text-slate-400 mb-1 block">وضع التشغيل</Label>
                          <Select value={form.agentMode} onValueChange={(v) => setForm(prev => ({ ...prev, agentMode: v }))}>
                            <SelectTrigger className="bg-slate-700/50 border-white/10 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manual">يدوي - أنت تتحكم بكل شيء</SelectItem>
                              <SelectItem value="semi-auto">شبه تلقائي - الوكيل يولد، أنت توافق</SelectItem>
                              <SelectItem value="fully-autonomous">مستقل بالكامل - الوكيل يقرر كل شيء</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-sm text-slate-400 mb-1 block">فترة التشغيل التلقائي</Label>
                          <Select value={String(autoInterval)} onValueChange={(v) => setAutoInterval(Number(v))}>
                            <SelectTrigger className="bg-slate-700/50 border-white/10 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {AUTONOMOUS_INTERVALS.map(opt => (
                                <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button onClick={handleSaveBusiness} disabled={!business} className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white">
                        <Save className="w-4 h-4 ml-2" />
                        حفظ الإعدادات
                      </Button>
                    </CardContent>
                  </Card>

                  {/* About */}
                  <Card className="bg-slate-800/30 border-white/5">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Layers className="w-5 h-5 text-slate-500" />
                        <div>
                          <p className="text-sm text-slate-400">وكيل التسويق الذكي - الإصدار 2.0</p>
                          <p className="text-xs text-slate-600">نظام تسويق ذاتي مستقل مدعوم بالذكاء الاصطناعي</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ============ FOOTER ============ */}
          <footer className="sticky bottom-0 mt-auto border-t border-white/5 bg-slate-900/60 backdrop-blur-xl px-4 sm:px-6 py-3 z-30">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <Sparkles className="w-3 h-3" />
              <span>مدعوم بالذكاء الاصطناعي</span>
              <Separator orientation="vertical" className="h-3 bg-white/10" />
              <span className="font-mono text-violet-400/70">Claude Opus 4.8</span>
              <span>+</span>
              <span className="font-mono text-violet-400/70">GPT Image-2</span>
              <span>+</span>
              <span className="font-mono text-rose-400/70">Grok Imagine</span>
            </div>
          </footer>
        </main>
      </div>

      {/* ============ SCHEDULE DIALOG ============ */}
      <Dialog open={!!scheduleDialogPost} onOpenChange={(open) => { if (!open) setScheduleDialogPost(null); }}>
        <DialogContent className="bg-slate-800 border-white/10 text-white sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>جدولة المنشور</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm text-slate-400 mb-1 block">تاريخ ووقت النشر</Label>
              <Input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="bg-slate-700/50 border-white/10 text-white"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="ghost" className="text-slate-400">إلغاء</Button>
            </DialogClose>
            <Button
              onClick={() => {
                if (scheduleDialogPost && scheduleDate) {
                  handleSchedulePost(scheduleDialogPost, scheduleDate);
                }
              }}
              disabled={!scheduleDate}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
            >
              <Clock className="w-4 h-4 ml-2" />
              جدولة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, PenTool, Calendar, BarChart3, MessageSquare, Settings,
  Rocket, ImageIcon, Video, Send, Clock, TrendingUp, Users, Target,
  Lightbulb, Sparkles, CheckCircle2, XCircle, Loader2, Trash2,
  Edit3, Eye, RefreshCw, Play, Pause, ChevronRight, Zap, Globe,
  Palette, BookOpen, Megaphone, Heart, MessageCircle, Share2,
  Plus, ArrowRight, Save, AlertCircle, Facebook, Instagram, Twitter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

// Types
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
  status: string;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  likeCount?: number | null;
  commentCount?: number | null;
  shareCount?: number | null;
  reachCount?: number | null;
  createdAt: string;
  imagePrompt?: string;
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
  createdAt: string;
}

// Tab configuration
const tabs = [
  { id: 'training', label: 'لوحة التدريب', icon: Brain, color: 'from-emerald-500 to-teal-600' },
  { id: 'generate', label: 'توليد المحتوى', icon: PenTool, color: 'from-amber-500 to-orange-600' },
  { id: 'calendar', label: 'التقويم', icon: Calendar, color: 'from-violet-500 to-purple-600' },
  { id: 'analytics', label: 'التحليلات', icon: BarChart3, color: 'from-rose-500 to-pink-600' },
  { id: 'replies', label: 'الردود الذكية', icon: MessageSquare, color: 'from-cyan-500 to-blue-600' },
  { id: 'settings', label: 'الإعدادات', icon: Settings, color: 'from-slate-500 to-gray-600' },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState('training');
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [replies, setReplies] = useState<SmartReplyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
  });

  // Content generation state
  const [genContentType, setGenContentType] = useState('varied');
  const [genCustomPrompt, setGenCustomPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedPosts, setGeneratedPosts] = useState<ContentPost[]>([]);

  // Image generation state
  const [generatingImage, setGeneratingImage] = useState<string | null>(null);

  // Publishing state
  const [publishing, setPublishing] = useState<string | null>(null);

  // Reply state
  const [replyMessage, setReplyMessage] = useState('');
  const [generatingReply, setGeneratingReply] = useState(false);
  const [lastReply, setLastReply] = useState<{ reply: string; intentType: string } | null>(null);

  // Schedule state
  const [scheduleConfig, setScheduleConfig] = useState({
    frequency: 'daily',
    preferredTimes: ['09:00', '18:00'],
    autoPublish: false,
    autoGenerate: false,
  });

  // Load data
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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (cancelled) return;
      await loadBusiness();
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (cancelled || !business) return;
      await Promise.all([loadPosts(), loadAnalytics(), loadReplies()]);
    };
    load();
    return () => { cancelled = true; };
  }, [business]);

  // Handlers
  const handleSaveBusiness = async () => {
    setLoading(true);
    try {
      if (business) {
        const res = await fetch('/api/business', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: business.id, ...form }),
        });
        const data = await res.json();
        setBusiness(data.profile);
        toast({ title: 'تم تحديث الملف بنجاح', description: 'تم حفظ بيانات الشركة' });
      } else {
        const res = await fetch('/api/business', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        setBusiness(data.profile);
        toast({ title: 'تم إنشاء الملف بنجاح', description: 'تم حفظ بيانات الشركة' });
      }
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل في حفظ البيانات', variant: 'destructive' });
    }
    setLoading(false);
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
          count: 3,
        }),
      });
      const data = await res.json();
      if (data.posts) {
        setGeneratedPosts(data.posts);
        await loadPosts();
        toast({ title: 'تم توليد المحتوى', description: `تم إنشاء ${data.posts.length} منشورات جديدة` });
      }
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل في توليد المحتوى', variant: 'destructive' });
    }
    setGenerating(false);
  };

  const handleGenerateImage = async (postId: string, imagePrompt: string) => {
    setGeneratingImage(postId);
    try {
      const res = await fetch('/api/media/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, prompt: imagePrompt }),
      });
      const data = await res.json();
      if (data.imageBase64) {
        await loadPosts();
        setGeneratedPosts(prev => prev.map(p => p.id === postId ? { ...p, imageData: data.imageBase64 } : p));
        toast({ title: 'تم إنشاء الصورة', description: 'تم إنشاء صورة احترافية للمنشور' });
      }
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل في إنشاء الصورة', variant: 'destructive' });
    }
    setGeneratingImage(null);
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
        await loadPosts();
        await loadAnalytics();
        toast({ title: 'تم النشر بنجاح', description: 'تم نشر المنشور على فيسبوك' });
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
      setGeneratedPosts(prev => prev.filter(p => p.id !== postId));
      toast({ title: 'تم الحذف', description: 'تم حذف المنشور' });
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل في حذف المنشور', variant: 'destructive' });
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

  const handleSchedulePost = async (postId: string, scheduledAt: string) => {
    try {
      await fetch('/api/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, scheduledAt }),
      });
      await loadPosts();
      toast({ title: 'تم الجدولة', description: 'تم جدولة المنشور للنشر' });
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل في جدولة المنشور', variant: 'destructive' });
    }
  };

  const contentTypeLabels: Record<string, string> = {
    educational: 'تعليمي',
    marketing: 'تسويقي',
    storytelling: 'قصصي',
    interactive: 'تفاعلي',
    promotional: 'ترويجي',
  };

  const statusLabels: Record<string, string> = {
    draft: 'مسودة',
    scheduled: 'مجدول',
    published: 'منشور',
    failed: 'فاشل',
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-500',
    scheduled: 'bg-amber-500',
    published: 'bg-emerald-500',
    failed: 'bg-red-500',
  };

  const intentLabels: Record<string, string> = {
    question: 'سؤال',
    purchase: 'رغبة في الشراء',
    complaint: 'شكوى',
    engagement: 'تفاعل',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex" dir="rtl">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 72 : 260 }}
        className="h-screen sticky top-0 bg-slate-900/80 backdrop-blur-xl border-l border-white/10 flex flex-col overflow-hidden z-50"
      >
        {/* Logo */}
        <div className="p-4 flex items-center gap-3 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1 className="font-bold text-lg bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">وكيل التسويق</h1>
              <p className="text-[10px] text-slate-400">AI Marketing Agent</p>
            </motion.div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium group ${
                activeTab === tab.id
                  ? 'bg-white/10 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                activeTab === tab.id ? `bg-gradient-to-br ${tab.color}` : 'bg-slate-800 group-hover:bg-slate-700'
              }`}>
                <tab.icon className="w-4 h-4" />
              </div>
              {!sidebarCollapsed && <span>{tab.label}</span>}
            </button>
          ))}
        </nav>

        {/* Collapse button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-3 border-t border-white/10 text-slate-400 hover:text-white transition-colors flex items-center justify-center"
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
        </button>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-slate-900/60 backdrop-blur-xl border-b border-white/10 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">
                {tabs.find(t => t.id === activeTab)?.label}
              </h2>
              <p className="text-sm text-slate-400">
                {business ? `نشط: ${business.companyName}` : 'لم يتم إعداد الشركة بعد'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {business && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3 ml-1" />
                  نشط
                </Badge>
              )}
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Facebook className="w-4 h-4" />
                <span>فيسبوك</span>
              </div>
            </div>
          </div>
        </header>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {/* ============ TRAINING TAB ============ */}
            {activeTab === 'training' && (
              <motion.div key="training" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                {/* Hero Card */}
                <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-600/10 border-emerald-500/20">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
                        <Brain className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-1">لوحة تدريب الوكيل الذكي</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">
                          هنا تدخل كل معلومات شركتك. هذه المعلومات تصبح &quot;الذاكرة الدائمة&quot; للوكيل الذكي -
                          يستخدمها في كل قرار محتوى، كل رد، وكل استراتيجية تسويقية.
                        </p>
                      </div>
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
                        <label className="text-sm text-slate-400 mb-1 block">اسم الشركة / المشروع *</label>
                        <Input
                          value={form.companyName}
                          onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                          placeholder="مثال: متجر الأناقة للملابس"
                          className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400 mb-1 block">وصف الشركة *</label>
                        <Textarea
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          placeholder="وصف تفصيلي لشركتك أو مشروعك..."
                          rows={3}
                          className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400 mb-1 block">المنتجات والخدمات *</label>
                        <Textarea
                          value={form.products}
                          onChange={(e) => setForm({ ...form, products: e.target.value })}
                          placeholder="اذكر منتجاتك وخدماتك بالتفصيل..."
                          rows={3}
                          className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500"
                        />
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
                        <label className="text-sm text-slate-400 mb-1 block">الجمهور المستهدف *</label>
                        <Textarea
                          value={form.targetAudience}
                          onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
                          placeholder="من هم عملاؤك المستهدفون؟ أعمارهم، اهتماماتهم..."
                          rows={2}
                          className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400 mb-1 block">أسلوب العلامة التجارية</label>
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
                        <label className="text-sm text-slate-400 mb-1 block">أهداف التسويق *</label>
                        <Textarea
                          value={form.marketingGoals}
                          onChange={(e) => setForm({ ...form, marketingGoals: e.target.value })}
                          placeholder="مثال: زيادة المبيعات، بناء الوعي بالعلامة التجارية، زيادة التفاعل..."
                          rows={2}
                          className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500"
                        />
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
                        <label className="text-sm text-slate-400 mb-1 block">العروض والأسعار</label>
                        <Textarea
                          value={form.offers}
                          onChange={(e) => setForm({ ...form, offers: e.target.value })}
                          placeholder="العروض الحالية، الأسعار، الخصومات..."
                          rows={3}
                          className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400 mb-1 block">الأسئلة الشائعة</label>
                        <Textarea
                          value={form.faqs}
                          onChange={(e) => setForm({ ...form, faqs: e.target.value })}
                          placeholder="الأسئلة التي يطرحها العملاء بكثرة وأجوبتها..."
                          rows={3}
                          className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Additional Info */}
                  <Card className="bg-slate-800/50 border-white/10">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-violet-400" />
                        معلومات إضافية
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm text-slate-400 mb-1 block">ملاحظات إضافية</label>
                        <Textarea
                          value={form.additionalInfo}
                          onChange={(e) => setForm({ ...form, additionalInfo: e.target.value })}
                          placeholder="أي معلومات إضافية تريد أن يعرفها الوكيل الذكي..."
                          rows={5}
                          className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveBusiness}
                    disabled={loading || !form.companyName || !form.description}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-8 py-3 text-lg rounded-xl shadow-lg shadow-emerald-500/25"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : <Save className="w-5 h-5 ml-2" />}
                    {business ? 'تحديث البيانات' : 'حفظ وبدء التدريب'}
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
                          <p className="text-sm text-slate-400">الوكيل الذكي يستخدم بيانات &quot;{business.companyName}&quot; في كل قرار</p>
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
                          <p className="text-2xl font-bold text-violet-400">{posts.filter(p => p.status === 'scheduled').length}</p>
                          <p className="text-xs text-slate-400">مجدول</p>
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

            {/* ============ CONTENT GENERATION TAB ============ */}
            {activeTab === 'generate' && (
              <motion.div key="generate" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                {!business ? (
                  <Card className="bg-slate-800/50 border-white/10">
                    <CardContent className="p-8 text-center">
                      <Brain className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                      <h3 className="text-lg font-bold mb-2">يجب إعداد الشركة أولاً</h3>
                      <p className="text-slate-400 mb-4">انتقل إلى لوحة التدريب وأدخل بيانات شركتك</p>
                      <Button onClick={() => setActiveTab('training')} className="bg-emerald-500 hover:bg-emerald-600">
                        <ArrowRight className="w-4 h-4 ml-2" />
                        الذهاب للتدريب
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Generation Controls */}
                    <Card className="bg-gradient-to-br from-amber-500/10 to-orange-600/10 border-amber-500/20">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4 mb-6">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
                            <Sparkles className="w-7 h-7 text-white" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold mb-1">توليد محتوى ذكي</h3>
                            <p className="text-slate-400 text-sm">الوكيل الذكي يولد محتوى متنوعًا بناءً على بيانات شركتك وتاريخ الأداء</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="text-sm text-slate-400 mb-1 block">نوع المحتوى</label>
                            <Select value={genContentType} onValueChange={setGenContentType}>
                              <SelectTrigger className="bg-slate-700/50 border-white/10 text-white">
                                <SelectValue placeholder="نوع متنوع (تلقائي)" />
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
                            <label className="text-sm text-slate-400 mb-1 block">طلب مخصص (اختياري)</label>
                            <Input
                              value={genCustomPrompt}
                              onChange={(e) => setGenCustomPrompt(e.target.value)}
                              placeholder="مثال: منشور عن العرض الجديد..."
                              className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500"
                            />
                          </div>
                        </div>

                        <Button
                          onClick={handleGenerateContent}
                          disabled={generating}
                          className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-amber-500/25"
                        >
                          {generating ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : <Sparkles className="w-5 h-5 ml-2" />}
                          {generating ? 'جارٍ التوليد...' : 'توليد 3 منشورات'}
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Generated Posts */}
                    {generatedPosts.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                          <Lightbulb className="w-5 h-5 text-amber-400" />
                          المنشورات المولدة حديثًا
                        </h3>
                        {generatedPosts.map((post) => (
                          <Card key={post.id} className="bg-slate-800/50 border-white/10 overflow-hidden">
                            <CardContent className="p-0">
                              <div className="flex flex-col md:flex-row">
                                {/* Image Section */}
                                <div className="md:w-1/3 bg-slate-700/30 flex items-center justify-center min-h-[200px] relative">
                                  {post.imageData ? (
                                    <img
                                      src={`data:image/png;base64,${post.imageData}`}
                                      alt="صورة المنشور المولدة"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="text-center p-4">
                                      <ImageIcon className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                                      <p className="text-xs text-slate-500 mb-3">لا توجد صورة بعد</p>
                                      <Button
                                        size="sm"
                                        onClick={() => handleGenerateImage(post.id, post.imagePrompt || `Professional social media post for ${business.companyName}, modern design, high quality`)}
                                        disabled={generatingImage === post.id}
                                        className="bg-violet-500 hover:bg-violet-600 text-xs"
                                      >
                                        {generatingImage === post.id ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : <ImageIcon className="w-3 h-3 ml-1" />}
                                        إنشاء صورة
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                {/* Content Section */}
                                <div className="flex-1 p-5 space-y-3">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge className={`${statusColors[post.status]} text-white`}>
                                      {statusLabels[post.status]}
                                    </Badge>
                                    <Badge variant="outline" className="border-white/20 text-slate-300">
                                      {contentTypeLabels[post.contentType] || post.contentType}
                                    </Badge>
                                    {post.title && <span className="text-sm font-medium text-slate-300">{post.title}</span>}
                                  </div>
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
                                  {post.hashtags && (
                                    <div className="flex flex-wrap gap-1">
                                      {post.hashtags.split(',').map((tag, i) => (
                                        <span key={i} className="text-xs text-teal-400">#{tag.trim().replace('#', '')}</span>
                                      ))}
                                    </div>
                                  )}
                                  {post.cta && (
                                    <p className="text-sm text-amber-400 font-medium">👉 {post.cta}</p>
                                  )}
                                  <div className="flex items-center gap-2 pt-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handlePublish(post.id)}
                                      disabled={publishing === post.id}
                                      className="bg-emerald-500 hover:bg-emerald-600"
                                    >
                                      {publishing === post.id ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : <Send className="w-3 h-3 ml-1" />}
                                      نشر الآن
                                    </Button>
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10">
                                          <Clock className="w-3 h-3 ml-1" />
                                          جدولة
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="bg-slate-800 border-white/10">
                                        <DialogHeader>
                                          <DialogTitle>جدولة المنشور</DialogTitle>
                                        </DialogHeader>
                                        <Input
                                          type="datetime-local"
                                          onChange={(e) => {
                                            if (e.target.value) handleSchedulePost(post.id, e.target.value);
                                          }}
                                          className="bg-slate-700 border-white/10 text-white"
                                        />
                                      </DialogContent>
                                    </Dialog>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDeletePost(post.id)}
                                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    {/* All Posts History */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-teal-400" />
                        سجل المنشورات
                        <Badge variant="outline" className="border-white/20 text-slate-400">{posts.length}</Badge>
                      </h3>
                      <ScrollArea className="max-h-[600px]">
                        <div className="space-y-3">
                          {posts.filter(p => !generatedPosts.find(gp => gp.id === p.id)).map((post) => (
                            <Card key={post.id} className="bg-slate-800/30 border-white/5 hover:border-white/20 transition-colors">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge className={`${statusColors[post.status]} text-white text-[10px]`}>
                                        {statusLabels[post.status]}
                                      </Badge>
                                      <Badge variant="outline" className="border-white/20 text-slate-400 text-[10px]">
                                        {contentTypeLabels[post.contentType] || post.contentType}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-slate-300 line-clamp-2">{post.content}</p>
                                    {post.hashtags && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {post.hashtags.split(',').slice(0, 5).map((tag, i) => (
                                          <span key={i} className="text-[10px] text-teal-400">#{tag.trim().replace('#', '')}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {post.status === 'draft' && (
                                      <>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                          onClick={() => handlePublish(post.id)} disabled={publishing === post.id}>
                                          {publishing === post.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        </Button>
                                        {!post.imageData && (
                                          <Button size="icon" variant="ghost" className="h-8 w-8 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
                                            onClick={() => handleGenerateImage(post.id, `Professional social media post for ${business?.companyName}, modern design`)}
                                            disabled={generatingImage === post.id}>
                                            {generatingImage === post.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                                          </Button>
                                        )}
                                      </>
                                    )}
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                      onClick={() => handleDeletePost(post.id)}>
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                                {post.imageData && (
                                  <div className="mt-3 rounded-lg overflow-hidden max-h-32">
                                    <img src={`data:image/png;base64,${post.imageData}`} alt="صورة المنشور" className="w-full h-full object-cover" />
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                          {posts.length === 0 && (
                            <div className="text-center py-12 text-slate-500">
                              <PenTool className="w-10 h-10 mx-auto mb-3" />
                              <p>لا توجد منشورات بعد. ابدأ بتوليد المحتوى!</p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* ============ CALENDAR TAB ============ */}
            {activeTab === 'calendar' && (
              <motion.div key="calendar" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                <Card className="bg-gradient-to-br from-violet-500/10 to-purple-600/10 border-violet-500/20">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4 mb-6">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                        <Calendar className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-1">التقويم والجدولة</h3>
                        <p className="text-slate-400 text-sm">إدارة مواعيد النشر والجدولة التلقائية</p>
                      </div>
                    </div>

                    {/* Schedule Config */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="text-sm text-slate-400 mb-1 block">تكرار النشر</label>
                        <Select value={scheduleConfig.frequency} onValueChange={(v) => setScheduleConfig({ ...scheduleConfig, frequency: v })}>
                          <SelectTrigger className="bg-slate-700/50 border-white/10 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">يوميًا</SelectItem>
                            <SelectItem value="twice-daily">مرتين يوميًا</SelectItem>
                            <SelectItem value="weekly">أسبوعيًا</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-slate-400">نشر تلقائي</label>
                          <Switch checked={scheduleConfig.autoPublish} onCheckedChange={(v) => setScheduleConfig({ ...scheduleConfig, autoPublish: v })} />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-slate-400">توليد تلقائي</label>
                          <Switch checked={scheduleConfig.autoGenerate} onCheckedChange={(v) => setScheduleConfig({ ...scheduleConfig, autoGenerate: v })} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Scheduled Posts Timeline */}
                <Card className="bg-slate-800/50 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-lg">المنشورات المجدولة</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-96">
                      <div className="space-y-3">
                        {posts.filter(p => p.status === 'scheduled' || p.status === 'published').map((post, idx) => (
                          <div key={post.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors">
                            <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${post.status === 'published' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm line-clamp-1">{post.content}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge className={`${statusColors[post.status]} text-white text-[10px]`}>
                                  {statusLabels[post.status]}
                                </Badge>
                                <span className="text-[10px] text-slate-500">
                                  {post.scheduledAt ? new Date(post.scheduledAt).toLocaleDateString('ar-EG') : ''}
                                  {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('ar-EG') : ''}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {posts.filter(p => p.status === 'scheduled' || p.status === 'published').length === 0 && (
                          <div className="text-center py-8 text-slate-500">
                            <Calendar className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-sm">لا توجد منشورات مجدولة</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ============ ANALYTICS TAB ============ */}
            {activeTab === 'analytics' && (
              <motion.div key="analytics" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                <Card className="bg-gradient-to-br from-rose-500/10 to-pink-600/10 border-rose-500/20">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shrink-0">
                        <BarChart3 className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-1">لوحة التحليلات</h3>
                        <p className="text-slate-400 text-sm">تتبع أداء المحتوى واحصل على رؤى لتحسين الاستراتيجية</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { label: 'إجمالي المنشورات', value: analytics?.totalPosts || 0, icon: PenTool, color: 'text-amber-400', bg: 'from-amber-500/10 to-orange-500/10' },
                    { label: 'المنشورة', value: analytics?.publishedPosts || 0, icon: CheckCircle2, color: 'text-emerald-400', bg: 'from-emerald-500/10 to-teal-500/10' },
                    { label: 'الإعجابات', value: analytics?.totalLikes || 0, icon: Heart, color: 'text-rose-400', bg: 'from-rose-500/10 to-pink-500/10' },
                    { label: 'التعليقات', value: analytics?.totalComments || 0, icon: MessageCircle, color: 'text-violet-400', bg: 'from-violet-500/10 to-purple-500/10' },
                    { label: 'المشاركات', value: analytics?.totalShares || 0, icon: Share2, color: 'text-cyan-400', bg: 'from-cyan-500/10 to-blue-500/10' },
                  ].map((stat, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                      <Card className={`bg-gradient-to-br ${stat.bg} border-white/10`}>
                        <CardContent className="p-4">
                          <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                          <p className="text-2xl font-bold">{stat.value}</p>
                          <p className="text-xs text-slate-400">{stat.label}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* Content Type Distribution */}
                <Card className="bg-slate-800/50 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-rose-400" />
                      توزيع أنواع المحتوى
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(
                        posts.reduce((acc, p) => {
                          acc[p.contentType] = (acc[p.contentType] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([type, count]) => (
                        <div key={type} className="flex items-center gap-3">
                          <span className="text-sm text-slate-400 w-20">{contentTypeLabels[type] || type}</span>
                          <div className="flex-1 bg-slate-700/50 rounded-full h-3 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${posts.length > 0 ? (count / posts.length) * 100 : 0}%` }}
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                            />
                          </div>
                          <span className="text-sm font-medium w-8 text-left">{count}</span>
                        </div>
                      ))}
                      {posts.length === 0 && <p className="text-sm text-slate-500 text-center py-4">لا توجد بيانات بعد</p>}
                    </div>
                  </CardContent>
                </Card>

                {/* Performance Recommendations */}
                <Card className="bg-slate-800/50 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-amber-400" />
                      التوصيات الذكية
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics ? [
                        { text: `متوسط التفاعل: ${analytics.avgEngagement} - حافظ على التنوع في المحتوى`, icon: TrendingUp, color: 'text-emerald-400' },
                        { text: `نسبة النشر: ${analytics.totalPosts > 0 ? ((analytics.publishedPosts / analytics.totalPosts) * 100).toFixed(0) : 0}% - حاول نشر المزيد من المسودات`, icon: Send, color: 'text-amber-400' },
                        { text: 'أنشئ محتوى تفاعلي لزيادة التعليقات والمشاركات', icon: MessageCircle, color: 'text-violet-400' },
                      ].map((rec, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-700/30">
                          <rec.icon className={`w-5 h-5 ${rec.color} shrink-0 mt-0.5`} />
                          <p className="text-sm text-slate-300">{rec.text}</p>
                        </div>
                      )) : (
                        <p className="text-sm text-slate-500 text-center py-4">أنشئ ونشر محتوى للحصول على توصيات</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ============ SMART REPLIES TAB ============ */}
            {activeTab === 'replies' && (
              <motion.div key="replies" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border-cyan-500/20">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4 mb-6">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0">
                        <MessageSquare className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-1">الردود الذكية</h3>
                        <p className="text-slate-400 text-sm">الوكيل الذكي يفهم نية المستخدم ويرد بطبيعية تشبه البشر</p>
                      </div>
                    </div>

                    {/* Reply Generator */}
                    <div className="space-y-3">
                      <Textarea
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="اكتب رسالة العميل هنا... (سؤال، شكوى، طلب شراء، إلخ)"
                        rows={3}
                        className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500"
                      />
                      <Button
                        onClick={handleGenerateReply}
                        disabled={generatingReply || !replyMessage.trim()}
                        className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                      >
                        {generatingReply ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Sparkles className="w-4 h-4 ml-2" />}
                        إنشاء رد ذكي
                      </Button>
                    </div>

                    {/* Last Reply */}
                    {lastReply && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 rounded-xl bg-slate-700/30 border border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                            {intentLabels[lastReply.intentType] || lastReply.intentType}
                          </Badge>
                        </div>
                        <p className="text-sm leading-relaxed">{lastReply.reply}</p>
                        <Button size="sm" variant="outline" className="mt-3 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
                          <Send className="w-3 h-3 ml-1" />
                          إرسال الرد
                        </Button>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>

                {/* Reply History */}
                <Card className="bg-slate-800/50 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-lg">سجل الردود</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-96">
                      <div className="space-y-3">
                        {replies.map((reply) => (
                          <div key={reply.id} className="p-3 rounded-lg bg-slate-700/30 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="border-white/20 text-[10px]">
                                {intentLabels[reply.intentType || ''] || reply.intentType || 'تفاعل'}
                              </Badge>
                              <span className="text-[10px] text-slate-500">{new Date(reply.createdAt).toLocaleDateString('ar-EG')}</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div className="p-2 rounded bg-slate-600/30">
                                <p className="text-[10px] text-slate-500 mb-1">رسالة العميل:</p>
                                <p className="text-xs text-slate-300">{reply.originalMsg}</p>
                              </div>
                              <div className="p-2 rounded bg-cyan-500/10">
                                <p className="text-[10px] text-cyan-400 mb-1">الرد الذكي:</p>
                                <p className="text-xs text-slate-300">{reply.replyText}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {replies.length === 0 && (
                          <div className="text-center py-8 text-slate-500">
                            <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-sm">لا توجد ردود بعد</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ============ SETTINGS TAB ============ */}
            {activeTab === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                <Card className="bg-gradient-to-br from-slate-500/10 to-gray-600/10 border-slate-500/20">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center shrink-0">
                        <Settings className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-1">الإعدادات</h3>
                        <p className="text-slate-400 text-sm">إعدادات النشر والمنصات والتكاملات</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Platform Connections */}
                <Card className="bg-slate-800/50 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Globe className="w-5 h-5 text-emerald-400" />
                      المنصات المتصلة
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                          <Facebook className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium">فيسبوك</p>
                          <p className="text-xs text-slate-400">صفحة مرتبطة</p>
                        </div>
                      </div>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">متصل</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <Instagram className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium">إنستغرام</p>
                          <p className="text-xs text-slate-400">قريبًا</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-white/20 text-slate-400">قريبًا</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-sky-500 flex items-center justify-center">
                          <Twitter className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium">تويتر / X</p>
                          <p className="text-xs text-slate-400">قريبًا</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-white/20 text-slate-400">قريبًا</Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Models */}
                <Card className="bg-slate-800/50 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Brain className="w-5 h-5 text-violet-400" />
                      نماذج الذكاء الاصطناعي
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 rounded-lg bg-slate-700/30">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm">توليد المحتوى</p>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">نشط</Badge>
                      </div>
                      <p className="text-xs text-slate-400">نموذج لغوي متقدم - توليد نصوص تسويقية احترافية</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-700/30">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm">توليد الصور</p>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">نشط</Badge>
                      </div>
                      <p className="text-xs text-slate-400">نموذج توليد صور احترافية للمنشورات</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-700/30">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm">توليد الفيديو</p>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">نشط</Badge>
                      </div>
                      <p className="text-xs text-slate-400">نموذج توليد فيديوهات قصيرة (غير متزامن)</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Data Management */}
                <Card className="bg-slate-800/50 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-amber-400" />
                      إدارة البيانات
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full justify-start border-white/20 text-white hover:bg-white/10"
                      onClick={async () => {
                        if (business) {
                          await loadPosts();
                          await loadAnalytics();
                          await loadReplies();
                          toast({ title: 'تم التحديث', description: 'تم تحديث جميع البيانات' });
                        }
                      }}
                    >
                      <RefreshCw className="w-4 h-4 ml-2" />
                      تحديث البيانات
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="mt-auto border-t border-white/10 bg-slate-900/60 backdrop-blur-xl px-6 py-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <p>وكيل التسويق الذكي - AI Marketing Agent</p>
            <p>مدعوم بالذكاء الاصطناعي</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

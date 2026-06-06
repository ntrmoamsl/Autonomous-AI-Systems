import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Get analytics data
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
    }

    // Get all posts for this business
    const posts = await db.contentPost.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });

    // Get analytics snapshots
    const snapshots = await db.analyticsSnapshot.findMany({
      where: { businessId },
      orderBy: { date: 'desc' },
      take: 30,
    });

    // Calculate stats
    const totalPosts = posts.length;
    const publishedPosts = posts.filter(p => p.status === 'published').length;
    const draftPosts = posts.filter(p => p.status === 'draft').length;
    const scheduledPosts = posts.filter(p => p.status === 'scheduled').length;
    const failedPosts = posts.filter(p => p.status === 'failed').length;

    const totalReach = posts.reduce((sum, p) => sum + (p.reachCount || 0), 0);
    const totalLikes = posts.reduce((sum, p) => sum + (p.likeCount || 0), 0);
    const totalComments = posts.reduce((sum, p) => sum + (p.commentCount || 0), 0);
    const totalShares = posts.reduce((sum, p) => sum + (p.shareCount || 0), 0);

    // Content type distribution
    const contentTypeStats: Record<string, number> = {};
    posts.forEach(p => {
      contentTypeStats[p.contentType] = (contentTypeStats[p.contentType] || 0) + 1;
    });

    // Performance by content type
    const contentTypePerformance: Record<string, { count: number; avgEngagement: number; totalReach: number }> = {};
    posts.filter(p => p.status === 'published').forEach(p => {
      if (!contentTypePerformance[p.contentType]) {
        contentTypePerformance[p.contentType] = { count: 0, avgEngagement: 0, totalReach: 0 };
      }
      contentTypePerformance[p.contentType].count++;
      contentTypePerformance[p.contentType].avgEngagement += (p.engagementScore || 0);
      contentTypePerformance[p.contentType].totalReach += (p.reachCount || 0);
    });

    // Calculate averages
    Object.keys(contentTypePerformance).forEach(key => {
      const item = contentTypePerformance[key];
      item.avgEngagement = item.count > 0 ? item.avgEngagement / item.count : 0;
    });

    // Recent posts performance
    const recentPosts = posts.slice(0, 10).map(p => ({
      id: p.id,
      title: p.title,
      contentType: p.contentType,
      status: p.status,
      reachCount: p.reachCount || 0,
      likeCount: p.likeCount || 0,
      commentCount: p.commentCount || 0,
      shareCount: p.shareCount || 0,
      publishedAt: p.publishedAt,
      createdAt: p.createdAt,
    }));

    return NextResponse.json({
      overview: {
        totalPosts,
        publishedPosts,
        draftPosts,
        scheduledPosts,
        failedPosts,
        totalReach,
        totalLikes,
        totalComments,
        totalShares,
        avgEngagement: totalPosts > 0 ? ((totalLikes + totalComments + totalShares) / totalPosts).toFixed(2) : 0,
      },
      contentTypeStats,
      contentTypePerformance,
      recentPosts,
      snapshots,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

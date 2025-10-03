import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { TrendingUp, Users, Heart, MessageCircle, Share2 } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'

type FeedTab = 'explore' | 'following'

interface Post {
  id: string
  user: {
    name: string
    avatar: string
    location?: string
  }
  activity: {
    type: 'run' | 'walk' | 'bike'
    title: string
    distance: number // km
    duration: number // minutes
    pace: string
    territoriesClaimed: number
    route?: string
  }
  stats: {
    likes: number
    comments: number
  }
  timestamp: string
}

const mockPosts: Post[] = [
  {
    id: '1',
    user: { name: 'Sarah Johnson', avatar: '🏃‍♀️', location: 'San Francisco, CA' },
    activity: {
      type: 'run',
      title: 'Morning Territory Run',
      distance: 8.2,
      duration: 42,
      pace: '5:07',
      territoriesClaimed: 3,
    },
    stats: { likes: 24, comments: 5 },
    timestamp: '2 hours ago',
  },
  {
    id: '2',
    user: { name: 'Mike Chen', avatar: '🎽', location: 'New York, NY' },
    activity: {
      type: 'run',
      title: 'Evening Sprint Session',
      distance: 5.0,
      duration: 28,
      pace: '5:36',
      territoriesClaimed: 2,
    },
    stats: { likes: 18, comments: 3 },
    timestamp: '4 hours ago',
  },
]

export const Feed: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FeedTab>('explore')

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader title="Activity Feed" showBack={false} showProfile={true} />

      {/* Tab Switcher */}
      <div className="liquid-blur-card sticky top-[65px] z-40 border-b">
        <div className="max-w-2xl mx-auto px-6 py-3">
          <div className="flex gap-2 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('explore')}
              className={cn(
                'flex-1 py-2.5 rounded-md text-sm font-light transition-all',
                activeTab === 'explore'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Explore
            </button>
            <button
              onClick={() => setActiveTab('following')}
              className={cn(
                'flex-1 py-2.5 rounded-md text-sm font-light transition-all',
                activeTab === 'following'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Following
            </button>
          </div>
        </div>
      </div>

      {/* Feed Content */}
      <div className="max-w-2xl mx-auto px-6 py-6 space-y-4">
        {activeTab === 'explore' ? (
          <>
            {mockPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            <div className="text-center py-8 text-muted-foreground text-sm font-light">
              That's all for now. Check back later!
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <Users size={48} className="text-muted-foreground" strokeWidth={1} />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-light text-foreground">No activities yet</h3>
              <p className="text-sm font-light text-muted-foreground max-w-xs">
                Follow other runners to see their activities in your feed
              </p>
            </div>
            <button className="mt-4 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-light hover:bg-primary/90 transition-colors">
              Discover Runners
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const PostCard: React.FC<{ post: Post }> = ({ post }) => {
  const [liked, setLiked] = useState(false)

  return (
    <div className="card-breathable hover:shadow-md transition-shadow">
      {/* User Info */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xl">
          {post.user.avatar}
        </div>
        <div className="flex-1">
          <h3 className="font-normal text-sm">{post.user.name}</h3>
          <p className="text-xs font-light text-muted-foreground">{post.timestamp}</p>
        </div>
      </div>

      {/* Activity Details */}
      <div className="mb-4">
        <h2 className="text-lg font-light mb-3">{post.activity.title}</h2>

        <div className="grid grid-cols-4 gap-4">
          <div>
            <div className="text-2xl font-light">{post.activity.distance}</div>
            <div className="stat-label">km</div>
          </div>
          <div>
            <div className="text-2xl font-light">{post.activity.duration}</div>
            <div className="stat-label">min</div>
          </div>
          <div>
            <div className="text-2xl font-light">{post.activity.pace}</div>
            <div className="stat-label">/km</div>
          </div>
          <div>
            <div className="text-2xl font-light">{post.activity.territoriesClaimed}</div>
            <div className="stat-label">areas</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-6 pt-4 border-t border-border">
        <button
          onClick={() => setLiked(!liked)}
          className={cn(
            'flex items-center gap-2 text-sm font-light transition-colors',
            liked ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} strokeWidth={1.5} />
          <span>{post.stats.likes + (liked ? 1 : 0)}</span>
        </button>

        <button className="flex items-center gap-2 text-sm font-light text-muted-foreground hover:text-foreground transition-colors">
          <MessageCircle size={18} strokeWidth={1.5} />
          <span>{post.stats.comments}</span>
        </button>

        <button className="flex items-center gap-2 text-sm font-light text-muted-foreground hover:text-foreground transition-colors ml-auto">
          <Share2 size={18} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}

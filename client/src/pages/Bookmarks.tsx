/**
 * 收藏问题列表页面
 * 
 * 功能：
 * 1. 显示用户收藏的所有问题
 * 2. 支持删除收藏
 * 3. 支持从收藏列表重新练习
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  ArrowLeft, 
  Bookmark, 
  Trash2, 
  Play, 
  Clock,
  Target,
  Loader2,
  Edit3,
  FolderOpen,
  Plus,
  Filter,
  StickyNote
} from 'lucide-react';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';

export default function Bookmarks() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const isZh = language === 'zh';
  
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingNotes, setEditingNotes] = useState<{ id: number; notes: string } | null>(null);
  const [editingCategory, setEditingCategory] = useState<{ id: number; category: string } | null>(null);
  const [newCategory, setNewCategory] = useState('');
  
  const utils = trpc.useUtils();
  const { data: bookmarks, isLoading } = trpc.bookmarks.list.useQuery();
  const { data: categories } = trpc.bookmarks.categories.useQuery();
  
  const removeBookmark = trpc.bookmarks.remove.useMutation({
    onSuccess: () => {
      utils.bookmarks.list.invalidate();
      toast.success(isZh ? '已删除' : 'Removed');
    },
    onError: () => {
      toast.error(isZh ? '删除失败' : 'Failed to remove');
    }
  });
  
  const practiceBookmark = trpc.bookmarks.practice.useMutation({
    onSuccess: () => {
      utils.bookmarks.list.invalidate();
    }
  });
  
  const updateNotes = trpc.bookmarks.updateNotes.useMutation({
    onSuccess: () => {
      utils.bookmarks.list.invalidate();
      setEditingNotes(null);
      toast.success(isZh ? '笔记已保存' : 'Notes saved');
    },
    onError: () => {
      toast.error(isZh ? '保存失败' : 'Failed to save');
    }
  });
  
  const updateCategory = trpc.bookmarks.updateCategory.useMutation({
    onSuccess: () => {
      utils.bookmarks.list.invalidate();
      utils.bookmarks.categories.invalidate();
      setEditingCategory(null);
      toast.success(isZh ? '分类已更新' : 'Category updated');
    },
    onError: () => {
      toast.error(isZh ? '更新失败' : 'Failed to update');
    }
  });
  
  const handlePractice = (bookmark: NonNullable<typeof bookmarks>[0]) => {
    // 更新练习次数
    practiceBookmark.mutate({ id: bookmark.id });
    // 跳转到话题练习页面
    navigate(`/topic-practice?position=${encodeURIComponent(bookmark.targetPosition || bookmark.topic)}`);
  };
  
  const handleRemove = (id: number) => {
    removeBookmark.mutate({ id });
  };
  
  const getDifficultyColor = (difficulty: string | null) => {
    switch (difficulty) {
      case 'easy': return 'secondary';
      case 'hard': return 'destructive';
      default: return 'default';
    }
  };
  
  const getDifficultyLabel = (difficulty: string | null) => {
    switch (difficulty) {
      case 'easy': return isZh ? '简单' : 'Easy';
      case 'hard': return isZh ? '困难' : 'Hard';
      default: return isZh ? '中等' : 'Medium';
    }
  };
  
  const formatDate = (date: Date | string | null) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  // Filter bookmarks by category
  const filteredBookmarks = bookmarks?.filter(b => 
    selectedCategory === 'all' || (b.category || 'uncategorized') === selectedCategory
  );
  
  // Get unique categories from bookmarks
  const allCategories = categories || [];
  
  const handleSaveNotes = () => {
    if (editingNotes) {
      updateNotes.mutate({ id: editingNotes.id, notes: editingNotes.notes });
    }
  };
  
  const handleSaveCategory = () => {
    if (editingCategory) {
      const categoryToSave = newCategory.trim() || editingCategory.category;
      updateCategory.mutate({ id: editingCategory.id, category: categoryToSave });
      setNewCategory('');
    }
  };
  
  // Auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{isZh ? '请先登录' : 'Please Login'}</CardTitle>
            <CardDescription>
              {isZh ? '登录后可以查看收藏的问题' : 'Login to view your bookmarked questions'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} className="w-full">
              {isZh ? '返回首页' : 'Back to Home'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate('/interview-mode')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isZh ? '返回' : 'Back'}
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bookmark className="h-6 w-6" />
              {isZh ? '收藏的问题' : 'Bookmarked Questions'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {bookmarks?.length || 0} {isZh ? '个问题' : 'questions'}
            </p>
          </div>
        </div>
        
        {/* Category Filter */}
        {!isLoading && bookmarks && bookmarks.length > 0 && (
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={isZh ? '选择分类' : 'Select category'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {isZh ? '全部' : 'All'} ({bookmarks.length})
                  </SelectItem>
                  {allCategories.map((cat) => (
                    <SelectItem key={cat.category} value={cat.category}>
                      {cat.category === 'uncategorized' ? (isZh ? '未分类' : 'Uncategorized') : cat.category} ({cat.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              {isZh ? `显示 ${filteredBookmarks?.length || 0} 个问题` : `Showing ${filteredBookmarks?.length || 0} questions`}
            </p>
          </div>
        )}
        
        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
        {/* Empty state */}
        {!isLoading && (!bookmarks || bookmarks.length === 0) && (
          <Card>
            <CardContent className="py-12 text-center">
              <Bookmark className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {isZh ? '还没有收藏的问题' : 'No bookmarked questions yet'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {isZh 
                  ? '在面试练习中，将鼠标悬停在问题上点击收藏按钮' 
                  : 'Hover over questions during practice and click the bookmark button'}
              </p>
              <Button onClick={() => navigate('/interview-mode')}>
                {isZh ? '开始练习' : 'Start Practice'}
              </Button>
            </CardContent>
          </Card>
        )}
        
        {/* Bookmarks list */}
        {!isLoading && filteredBookmarks && filteredBookmarks.length > 0 && (
          <ScrollArea className="h-[calc(100vh-250px)]">
            <div className="space-y-4">
              {filteredBookmarks.map((bookmark) => (
                <Card key={bookmark.id} className="group">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary" />
                          {bookmark.topic}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant={getDifficultyColor(bookmark.difficulty)}>
                            {getDifficultyLabel(bookmark.difficulty)}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className="cursor-pointer hover:bg-accent"
                            onClick={() => setEditingCategory({ id: bookmark.id, category: bookmark.category || 'uncategorized' })}
                          >
                            <FolderOpen className="h-3 w-3 mr-1" />
                            {bookmark.category === 'uncategorized' || !bookmark.category ? (isZh ? '未分类' : 'Uncategorized') : bookmark.category}
                          </Badge>
                          {bookmark.targetPosition && (
                            <span className="text-xs">{bookmark.targetPosition}</span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setEditingNotes({ id: bookmark.id, notes: bookmark.notes || '' })}
                          title={isZh ? '编辑笔记' : 'Edit notes'}
                        >
                          <StickyNote className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemove(bookmark.id)}
                          disabled={removeBookmark.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm dark:prose-invert max-w-none mb-3 text-sm text-muted-foreground line-clamp-4">
                      <Streamdown>{bookmark.question}</Streamdown>
                    </div>
                    
                    {/* Notes display */}
                    {bookmark.notes && (
                      <div className="mb-3 p-2 bg-muted/50 rounded-md border-l-2 border-primary">
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                          <StickyNote className="h-3 w-3" />
                          {isZh ? '我的笔记' : 'My Notes'}
                        </p>
                        <p className="text-sm">{bookmark.notes}</p>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(bookmark.createdAt)}
                        </span>
                        {(bookmark.practiceCount ?? 0) > 0 && (
                          <span>
                            {isZh ? `练习 ${bookmark.practiceCount} 次` : `Practiced ${bookmark.practiceCount} times`}
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handlePractice(bookmark)}
                        disabled={practiceBookmark.isPending}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        {isZh ? '练习' : 'Practice'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
        
        {/* Empty state for filtered results */}
        {!isLoading && filteredBookmarks && filteredBookmarks.length === 0 && bookmarks && bookmarks.length > 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <Filter className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                {isZh ? '没有找到该分类的问题' : 'No questions in this category'}
              </p>
              <Button variant="link" onClick={() => setSelectedCategory('all')}>
                {isZh ? '查看全部' : 'View all'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Edit Notes Dialog */}
      <Dialog open={!!editingNotes} onOpenChange={(open) => !open && setEditingNotes(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5" />
              {isZh ? '编辑笔记' : 'Edit Notes'}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={editingNotes?.notes || ''}
            onChange={(e) => setEditingNotes(prev => prev ? { ...prev, notes: e.target.value } : null)}
            placeholder={isZh ? '添加你的学习笔记、心得或要点...' : 'Add your learning notes, insights, or key points...'}
            className="min-h-[150px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingNotes(null)}>
              {isZh ? '取消' : 'Cancel'}
            </Button>
            <Button onClick={handleSaveNotes} disabled={updateNotes.isPending}>
              {updateNotes.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isZh ? '保存' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Category Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              {isZh ? '设置分类' : 'Set Category'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {isZh ? '选择现有分类' : 'Select existing category'}
              </p>
              <Select 
                value={editingCategory?.category || ''} 
                onValueChange={(value) => setEditingCategory(prev => prev ? { ...prev, category: value } : null)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uncategorized">
                    {isZh ? '未分类' : 'Uncategorized'}
                  </SelectItem>
                  {allCategories.filter(c => c.category !== 'uncategorized').map((cat) => (
                    <SelectItem key={cat.category} value={cat.category}>
                      {cat.category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {isZh ? '或' : 'or'}
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {isZh ? '创建新分类' : 'Create new category'}
              </p>
              <div className="flex gap-2">
                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder={isZh ? '输入新分类名称' : 'Enter new category name'}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingCategory(null); setNewCategory(''); }}>
              {isZh ? '取消' : 'Cancel'}
            </Button>
            <Button onClick={handleSaveCategory} disabled={updateCategory.isPending}>
              {updateCategory.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isZh ? '保存' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

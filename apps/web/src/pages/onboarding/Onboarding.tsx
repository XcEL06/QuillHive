import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Feather, Sparkles, BookOpen, Palette, Briefcase, UserPlus, Users, GraduationCap, Code, Heart, Globe, TrendingUp, Eye, Trophy, Zap, Target, Star, Layers, DollarSign, Compass, PenTool, Camera, Mic, Video, BarChart2, Building2 } from 'lucide-react';
import { getStoredToken } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const INTERESTS = [
  'Writing', 'Poetry', 'Fiction', 'Non-Fiction', 'Art', 'Photography', 'Music', 'Film', 'Design',
  'Technology', 'Science', 'Business', 'Finance', 'Education', 'Career', 'Marketing', 'Productivity',
  'Travel', 'Food', 'Wellness', 'Fitness', 'Parenting', 'Relationships', 'Mental Health',
  'Culture', 'History', 'Philosophy', 'Politics', 'News', 'Books', 'Gaming', 'Sports',
  'DIY', 'Gardening', 'Pets', 'Fashion', 'Beauty', 'Cars', 'Outdoors',
];

const IDENTITY_TYPES = [
  { id: 'everyone', label: 'Just here', icon: Globe, desc: 'I want to read, learn, and connect' },
  { id: 'reader', label: 'Reader', icon: BookOpen, desc: 'I discover stories and ideas I love' },
  { id: 'writer', label: 'Writer', icon: Feather, desc: 'I share words, essays, or stories' },
  { id: 'artist', label: 'Artist', icon: Palette, desc: 'I share visual art or photography' },
  { id: 'professional', label: 'Professional', icon: Briefcase, desc: 'I share work, expertise, or insight' },
  { id: 'student', label: 'Student / Learner', icon: GraduationCap, desc: 'I am here to learn and grow' },
  { id: 'builder', label: 'Builder / Maker', icon: Code, desc: 'I build things and share what I make' },
  { id: 'community', label: 'Community member', icon: Heart, desc: 'I want to be part of a kind community' },
];

const CREATOR_GOALS = [
  { id: 'grow_audience', label: 'Grow my audience', icon: TrendingUp, desc: 'Reach more readers and build a following', color: 'primary' },
  { id: 'get_discovered', label: 'Get discovered', icon: Compass, desc: 'Be found by the right people for my work', color: 'violet' },
  { id: 'earn_opportunities', label: 'Earn opportunities', icon: DollarSign, desc: 'Land freelance work, collabs, or commissions', color: 'amber' },
  { id: 'build_portfolio', label: 'Build my portfolio', icon: Layers, desc: 'Showcase my best work in one place', color: 'blue' },
  { id: 'improve_craft', label: 'Improve my craft', icon: Star, desc: 'Get feedback and grow as a creator', color: 'green' },
  { id: 'connect_creators', label: 'Connect with creators', icon: Users, desc: 'Collaborate and network with peers', color: 'pink' },
  { id: 'share_ideas', label: 'Share my ideas', icon: Sparkles, desc: 'Express myself and contribute perspectives', color: 'indigo' },
  { id: 'build_brand', label: 'Build my brand', icon: Building2, desc: 'Establish my name and reputation', color: 'orange' },
];

const SKILL_CATEGORIES = [
  {
    label: 'Writing & Content',
    icon: PenTool,
    skills: ['Copywriting', 'Ghostwriting', 'Content Strategy', 'Blogging', 'Screenwriting', 'Technical Writing', 'UX Writing', 'Journalism', 'Editing', 'SEO Writing'],
  },
  {
    label: 'Visual & Design',
    icon: Palette,
    skills: ['Illustration', 'Graphic Design', 'UI/UX Design', 'Brand Identity', 'Motion Graphics', 'Infographics', 'Typography', 'Concept Art'],
  },
  {
    label: 'Photography & Video',
    icon: Camera,
    skills: ['Photography', 'Photo Editing', 'Videography', 'Video Editing', 'Color Grading', 'Documentary', 'Product Photography'],
  },
  {
    label: 'Audio & Music',
    icon: Mic,
    skills: ['Podcasting', 'Music Production', 'Voiceover', 'Sound Design', 'Mixing & Mastering', 'Songwriting'],
  },
  {
    label: 'Marketing & Growth',
    icon: BarChart2,
    skills: ['Social Media', 'Email Marketing', 'Growth Hacking', 'Community Building', 'Influencer Strategy', 'Analytics', 'PR & Outreach'],
  },
];

const GOAL_COLORS: Record<string, string> = {
  primary: 'border-primary bg-primary/10 text-primary',
  violet: 'border-violet-500 bg-violet-500/10 text-violet-500',
  amber: 'border-amber-500 bg-amber-500/10 text-amber-500',
  blue: 'border-blue-500 bg-blue-500/10 text-blue-500',
  green: 'border-green-500 bg-green-500/10 text-green-500',
  pink: 'border-pink-500 bg-pink-500/10 text-pink-500',
  indigo: 'border-indigo-500 bg-indigo-500/10 text-indigo-500',
  orange: 'border-orange-500 bg-orange-500/10 text-orange-500',
};

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { user, refreshUser } = useAuthStore();
  const { toast } = useToast();
  const token = getStoredToken();

  const [step, setStep] = useState(0);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [identityType, setIdentityType] = useState('');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [headline, setHeadline] = useState('');
  const [suggestedCreators, setSuggestedCreators] = useState<Record<string, unknown>[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [activeSkillCategory, setActiveSkillCategory] = useState(0);

  const isCreatorType = ['writer', 'artist', 'professional', 'builder'].includes(identityType);

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const toggleGoal = (goalId: string) => {
    setSelectedGoals(prev =>
      prev.includes(goalId) ? prev.filter(g => g !== goalId) : prev.length < 3 ? [...prev, goalId] : prev
    );
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : prev.length < 12 ? [...prev, skill] : prev
    );
  };

  const loadSuggestedCreators = async () => {
    try {
      const res = await fetch('/api/users/recommended?limit=5', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setSuggestedCreators(Array.isArray(data) ? data : []);
    } catch {
      setSuggestedCreators([]);
    }
  };

  // steps: 0=welcome, 1=interests, 2=type, 3=goals, 4=skills(creator only), 5=profile, 6=follow
  const steps = isCreatorType
    ? ['welcome', 'interests', 'type', 'goals', 'skills', 'profile', 'follow']
    : ['welcome', 'interests', 'type', 'goals', 'profile', 'follow'];
  const totalSteps = steps.length - 1;
  const progress = step > 0 ? (step / totalSteps) * 100 : 0;
  const currentStepName = steps[step] ?? 'welcome';

  const handleNext = async () => {
    if (currentStepName === 'interests' && selectedInterests.length < 3) {
      toast({ title: 'Pick at least 3 interests', variant: 'destructive' });
      return;
    }
    if (currentStepName === 'type' && !identityType) {
      toast({ title: 'Pick what brings you here', variant: 'destructive' });
      return;
    }
    if (currentStepName === 'profile') {
      setIsLoading(true);
      try {
        const profileRes = await fetch('/api/users/me/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            bio: bio || undefined,
            headline: headline || undefined,
            identityType,
          }),
        });
        if (!profileRes.ok) throw new Error('Could not save your profile.');

        for (const slug of selectedInterests.map(i => i.toLowerCase().replace(/\s+/g, '-'))) {
          const topicRes = await fetch(`/api/topics/${slug}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          if (topicRes.ok) {
            const topicData = await topicRes.json();
            if (topicData?.id) {
              await fetch(`/api/topics/${topicData.id}/follow`, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              });
            }
          }
        }

        if (selectedSkills.length > 0) {
          const creatorRes = await fetch('/api/users/me/creator', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ skills: selectedSkills }),
          });
          if (!creatorRes.ok) {
            const error = await creatorRes.json().catch(() => null) as { error?: string } | null;
            throw new Error(error?.error || 'Could not save creator skills.');
          }
        }
      } catch (error) {
        toast({
          title: 'Could not save your profile',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'destructive',
        });
        return;
      } finally {
        setIsLoading(false);
      }
      await loadSuggestedCreators();
    }

    if (currentStepName === 'follow') {
      await completeOnboarding();
      return;
    }

    setStep(s => s + 1);
  };

  const handleFollow = async (creator: Record<string, unknown>) => {
    try {
      await fetch(`/api/users/${creator.username}/follow`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setFollowedIds(s => new Set([...s, creator.id as number]));
    } catch {
    }
  };

  interface GoalCta {
    label: string;
    href: string;
    description: string;
  }

  const getGoalCta = (goals: string[]): GoalCta => {
    if (goals.includes('earn_opportunities') || goals.includes('build_portfolio')) {
      return {
        label: 'Open your opportunity workspace',
        href: '/workspace',
        description: 'Turn your skills and growing body of work into a profile people can hire',
      };
    }
    if (goals.includes('grow_audience') || goals.includes('get_discovered') || goals.includes('build_brand')) {
      return {
        label: 'Write your first post',
        href: '/write',
        description: 'Start building your audience with your first piece',
      };
    }
    if (goals.includes('connect_creators') || goals.includes('share_ideas')) {
      return {
        label: 'Explore the community',
        href: '/explore',
        description: 'Find creators who share your interests',
      };
    }
    return {
      label: 'Start exploring',
      href: '/',
      description: 'Discover what other creators are sharing',
    };
  };

  const completeOnboarding = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ onboardingComplete: true, onboardingGoals: selectedGoals, interests: selectedInterests }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(error?.error || 'Could not complete onboarding.');
      }
      await refreshUser();
      const goalCta = getGoalCta(selectedGoals);
      setLocation(goalCta.href);
    } catch (error) {
      toast({
        title: 'Could not finish onboarding',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {step > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Step {step} of {totalSteps}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Step 0: Welcome */}
          {currentStepName === 'welcome' && (
            <motion.div key="welcome" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="text-center space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center mx-auto">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-serif font-bold text-foreground mb-3">Welcome to QuillHive</h1>
                  <p className="text-foreground/80 text-lg font-medium leading-snug">
                  Welcome to QuillHive. Your Trust Score starts at zero — build it with real work, not followers.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-left">
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex flex-col items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-primary" /></div>
                  <p className="text-xs font-semibold text-center text-foreground">Grow an audience that knows your work</p>
                </div>
                <div className="bg-violet-500/5 border border-violet-500/20 rounded-2xl p-4 flex flex-col items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center"><Eye className="w-5 h-5 text-violet-500" /></div>
                  <p className="text-xs font-semibold text-center text-foreground">Get discovered for your skills</p>
                </div>
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex flex-col items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center"><Trophy className="w-5 h-5 text-amber-500" /></div>
                  <p className="text-xs font-semibold text-center text-foreground">Turn proof into paid work</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">In under 2 minutes, you'll start building your public proof of work.</p>
              <Button size="lg" className="rounded-2xl px-8 bg-gradient-to-r from-primary to-violet-500 border-0 text-white shadow-lg" onClick={() => setStep(1)}>
                Start Growing <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          )}

          {/* Step 1: Interests */}
          {currentStepName === 'interests' && (
            <motion.div key="interests" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div>
                <h2 className="text-2xl font-serif font-bold text-foreground mb-1">Pick your interests</h2>
                <p className="text-muted-foreground text-sm">Choose at least 3 topics to personalize your feed.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map(interest => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                      selectedInterests.includes(interest)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border text-foreground hover:border-primary hover:bg-primary/5'
                    }`}
                  >
                    {selectedInterests.includes(interest) && <Check className="w-3 h-3 inline mr-1" />}
                    {interest}
                  </button>
                ))}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">{selectedInterests.length} selected</span>
                <Button onClick={handleNext} disabled={selectedInterests.length < 3} className="rounded-xl">
                  Continue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Identity type */}
          {currentStepName === 'type' && (
            <motion.div key="type" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div>
                <h2 className="text-2xl font-serif font-bold text-foreground mb-1">What brings you to QuillHive?</h2>
                <p className="text-muted-foreground text-sm">Pick whatever fits best - you can change this later.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {IDENTITY_TYPES.map(type => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setIdentityType(type.id)}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        identityType === type.id
                          ? 'bg-primary/10 border-primary'
                          : 'bg-card border-border hover:border-primary/50'
                      }`}
                    >
                      <Icon className={`w-6 h-6 mb-2 ${identityType === type.id ? 'text-primary' : 'text-muted-foreground'}`} />
                      <p className="font-semibold text-sm text-foreground">{type.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{type.desc}</p>
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <Button onClick={handleNext} disabled={!identityType} className="rounded-xl">
                  Continue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Creator Goals */}
          {currentStepName === 'goals' && (
            <motion.div key="goals" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div>
                <h2 className="text-2xl font-serif font-bold text-foreground mb-1">What are you here to achieve?</h2>
                <p className="text-muted-foreground text-sm">Pick up to 3 goals - we'll personalise your experience around them.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {CREATOR_GOALS.map(goal => {
                  const Icon = goal.icon;
                  const isSelected = selectedGoals.includes(goal.id);
                  const colorClass = isSelected ? GOAL_COLORS[goal.color] : 'bg-card border-border text-muted-foreground hover:border-primary/40';
                  return (
                    <button
                      key={goal.id}
                      onClick={() => toggleGoal(goal.id)}
                      className={`p-4 rounded-2xl border text-left transition-all relative ${colorClass} ${!isSelected && selectedGoals.length >= 3 ? 'opacity-40 cursor-not-allowed' : ''}`}
                      disabled={!isSelected && selectedGoals.length >= 3}
                    >
                      {isSelected && <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-current flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>}
                      <Icon className="w-5 h-5 mb-2" />
                      <p className="font-semibold text-sm text-foreground">{goal.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{goal.desc}</p>
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">{selectedGoals.length}/3 selected</span>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={handleNext} className="rounded-xl text-muted-foreground text-sm">Skip</Button>
                  <Button onClick={handleNext} className="rounded-xl">
                    Continue <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4: Skills (creator types only) */}
          {currentStepName === 'skills' && (
            <motion.div key="skills" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-5">
              <div>
                <h2 className="text-2xl font-serif font-bold text-foreground mb-1">What are your skills?</h2>
                <p className="text-muted-foreground text-sm">Tag your expertise so clients and collaborators can find the right proof of work. Pick up to 12.</p>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {SKILL_CATEGORIES.map((cat, idx) => {
                  const CatIcon = cat.icon;
                  return (
                    <button
                      key={cat.label}
                      onClick={() => setActiveSkillCategory(idx)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-all flex-shrink-0 ${
                        activeSkillCategory === idx ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      <CatIcon className="w-3 h-3" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                {SKILL_CATEGORIES[activeSkillCategory]?.skills.map(skill => (
                  <button
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    className={`px-3.5 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                      selectedSkills.includes(skill)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : selectedSkills.length >= 12
                          ? 'bg-card border-border text-muted-foreground opacity-40 cursor-not-allowed'
                          : 'bg-card border-border text-foreground hover:border-primary hover:bg-primary/5'
                    }`}
                    disabled={!selectedSkills.includes(skill) && selectedSkills.length >= 12}
                  >
                    {selectedSkills.includes(skill) && <Check className="w-3 h-3 inline mr-1" />}
                    {skill}
                  </button>
                ))}
              </div>
              {selectedSkills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedSkills.map(skill => (
                    <Badge key={skill} variant="secondary" className="text-xs cursor-pointer" onClick={() => toggleSkill(skill)}>
                      {skill} ×
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">{selectedSkills.length}/12 selected</span>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={handleNext} className="rounded-xl text-muted-foreground text-sm">Skip</Button>
                  <Button onClick={handleNext} className="rounded-xl">
                    Continue <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 5: Bio / Headline */}
          {currentStepName === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div>
                <h2 className="text-2xl font-serif font-bold text-foreground mb-1">Tell your story</h2>
                <p className="text-muted-foreground text-sm">This is the first line of the profile people will use to decide whether to reach out.</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="headline">Headline</Label>
                  <Input
                    id="headline"
                    placeholder="e.g., Novelist & Poet | Writing about identity and belonging"
                    value={headline}
                    onChange={e => setHeadline(e.target.value)}
                    className="rounded-xl"
                    maxLength={120}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    placeholder="Share a little about who you are and what you're into..."
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    className="rounded-xl min-h-[100px] resize-none"
                    maxLength={500}
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={handleNext} disabled={isLoading} className="rounded-xl text-muted-foreground">Skip for now</Button>
                <Button onClick={handleNext} disabled={isLoading} className="rounded-xl">
                  {isLoading ? 'Saving...' : 'Continue'} <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 6: Follow people */}
          {currentStepName === 'follow' && (
            <motion.div key="follow" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div>
                <h2 className="text-2xl font-serif font-bold text-foreground mb-1">Build your opportunity network</h2>
                <p className="text-muted-foreground text-sm">Follow creators, clients, and collaborators whose work matches your direction. Your consistent work becomes your resume here.</p>
              </div>
              <div className="space-y-3">
                {suggestedCreators.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No suggestions yet - you'll discover great people in your feed.</p>
                )}
                {suggestedCreators.map((creator) => (
                  <div key={creator.id as number} className="flex items-center gap-3 p-3 rounded-2xl border border-border/60 bg-card">
                    <Avatar className="w-10 h-10 border border-border">
                      <AvatarImage src={(creator.avatarUrl as string) || ''} />
                      <AvatarFallback>{(creator.displayName as string)?.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{creator.displayName as string}</p>
                      <p className="text-xs text-muted-foreground truncate">{(creator.headline as string) || `@${creator.username as string}`}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={followedIds.has(creator.id as number) ? 'secondary' : 'outline'}
                      onClick={() => handleFollow(creator)}
                      disabled={followedIds.has(creator.id as number)}
                      className="rounded-xl gap-1.5 flex-shrink-0"
                    >
                      {followedIds.has(creator.id as number) ? <><Check className="w-3.5 h-3.5" /> Following</> : <><UserPlus className="w-3.5 h-3.5" /> Follow</>}
                    </Button>
                  </div>
                ))}
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3 flex items-center gap-3">
                <Zap className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-xs text-foreground/80">Your first post in the next 24h gets an automatic visibility boost. Start your proof of work while your profile is fresh.</p>
              </div>
              {(() => {
                const goalCta = getGoalCta(selectedGoals);
                return (
                  <div className="space-y-3">
                    <Button
                      onClick={handleNext}
                      disabled={isLoading}
                      className="w-full rounded-xl gap-2 bg-gradient-to-r from-primary to-violet-500 border-0 text-white"
                      size="lg"
                    >
                      {isLoading ? 'Setting up...' : goalCta.label} <ChevronRight className="w-4 h-4" />
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">{goalCta.description}</p>
                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

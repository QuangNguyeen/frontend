import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Video, Clock, Globe } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { roomService } from '../services/roomService';
import { VideoPickerDialog } from './VideoPickerDialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { VideoResponse } from '@/shared/types/api';

const LANG_LABELS: Record<string, string> = { en: 'English', ja: 'Japanese' };

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface CreateRoomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRoomModal({ open, onOpenChange }: CreateRoomModalProps) {
  const navigate = useNavigate();
  const [selectedVideo, setSelectedVideo] = useState<VideoResponse | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [maxReplays, setMaxReplays] = useState(3);
  const [examDuration, setExamDuration] = useState(30);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!selectedVideo) {
      toast.error('Please select a video');
      return;
    }
    setLoading(true);
    try {
      const res = await roomService.createRoom({
        video_id: selectedVideo.id,
        max_players: maxPlayers,
        max_replays: maxReplays,
        exam_duration_minutes: examDuration,
      });
      navigate(`/rooms/${res.room_code}`);
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="gap-5 p-5 sm:max-w-md sm:p-6">
          <DialogHeader>
            <DialogTitle>Create Room</DialogTitle>
            <DialogDescription>Set up a multiplayer dictation room</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5">
            {/* Video selection */}
            <div>
              <Label className="mb-2">Video</Label>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg border border-dashed transition-all text-left',
                  selectedVideo
                    ? 'border-primary/30 bg-primary/5 hover:border-primary/50'
                    : 'border-border hover:border-primary/30 hover:bg-muted/30',
                )}
              >
                {selectedVideo ? (
                  <>
                    <div className="relative w-16 h-9 rounded overflow-hidden bg-muted shrink-0">
                      <img
                        src={selectedVideo.thumbnail_url}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://placehold.co/128x72/1a1a2e/white?text=Video';
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug line-clamp-1">{selectedVideo.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span className="truncate">{selectedVideo.channel}</span>
                        <span className="flex items-center gap-0.5 shrink-0">
                          <Globe className="h-3 w-3" />
                          {LANG_LABELS[selectedVideo.language] ?? selectedVideo.language}
                        </span>
                        <span className="flex items-center gap-0.5 shrink-0">
                          <Clock className="h-3 w-3" />
                          {formatDuration(selectedVideo.duration)}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 py-1 text-muted-foreground w-full justify-center">
                    <Video className="h-4 w-4" />
                    <span className="text-sm">Click to select a video</span>
                  </div>
                )}
              </button>
            </div>

            {/* Room settings */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="maxPlayers" className="mb-2">Max Players</Label>
                <Input
                  id="maxPlayers"
                  type="number"
                  min={2}
                  max={50}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="maxReplays" className="mb-2">Max Replays</Label>
                <Input
                  id="maxReplays"
                  type="number"
                  min={0}
                  max={10}
                  value={maxReplays}
                  onChange={(e) => setMaxReplays(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="examDuration" className="mb-2">Time (min)</Label>
                <Input
                  id="examDuration"
                  type="number"
                  min={0}
                  max={120}
                  value={examDuration}
                  onChange={(e) => setExamDuration(Number(e.target.value))}
                />
                <p className="text-[10px] text-muted-foreground mt-1.5">0 = no limit</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={loading || !selectedVideo}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <VideoPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={setSelectedVideo}
        selectedVideoId={selectedVideo?.id}
      />
    </>
  );
}
